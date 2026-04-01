import redisClient from '../../config/redis';
import { Request, Response } from 'express';
import { APP_CONSTANTS, DEFAULT_CONFIG, CHAT_HISTORY, USER_EXTRA_FIELDS } from '../../utils/constants';
import { ChatRepository } from '../../repositories/mobile/chat.repository';
import { AIService } from './ai.service';
import BlockedUser from '../../models/blocked_user';
import ChatHistory from '../../models/chat_history';
import { SendNotification } from '../../utils/notification';
import { notificationRepository } from '../../repositories/mobile/notification.repository';
import { UserRepository } from '../../repositories/mobile/users.repository';
import { ProfileRepository } from '../../repositories/mobile/profile.repository';
import { getSocket } from '../../utils/socket';
import LikeRepository from '../../repositories/mobile/like.repository';
import { APILogger } from '../../utils/logger';
import { sendSSEData } from '../../utils/helper';


export class ChatService {
  private redisClient: any;
  private chatRepository: ChatRepository;
  private aiService: AIService;
  private activeUsers: Map<string, Set<number>> = new Map();
  private notificationRepository: notificationRepository
  private userRepository: UserRepository;
  private profileRepository: ProfileRepository;
  private logger: APILogger;
    


  private formatHistoryForAI(
    messages: Array<any>,
    userId: number,
    userName: string,
    userGender?: string,
    partnerName?: string,
    partnerGender?: string
  ): Array<{ speaker: string; message: string }> {
    return messages.map(msg => {
      const senderId = Number(msg.sender_id ?? msg.owner_id ?? msg.ownerId);
      const text = (msg.chat_message ?? msg.message ?? msg.chatMessage) || '';

      const isUser = senderId === userId;
      const name = isUser ? userName : (partnerName || 'Match');
      const gender = isUser ? userGender : partnerGender;
      const genderLabel = gender ? `, ${gender}` : '';

      return {
        speaker: isUser ? `User (${name}${genderLabel})` : `Match (${name}${genderLabel})`,
        message: text
      };
    });
  }



  constructor() {
    this.redisClient = redisClient;
    this.chatRepository = new ChatRepository();
    this.userRepository = new UserRepository();
    this.profileRepository = new ProfileRepository();
    this.logger = new APILogger();
    this.aiService = new AIService();
    this.notificationRepository = new notificationRepository

  }
  private async ensureRedisConnection(): Promise<boolean> {
    try {
      const currentTime = new Date().toISOString();
      const isOpen = this.redisClient?.isOpen;
      
      if (!isOpen) {
        await this.redisClient.connect();
      }
      return true;
    } catch (error: any) {
      console.error(`[REDIS RECONNECT FAILED] ${new Date().toISOString()} - Error:`, error.message);
      return false;
    }
  }

  private async generateAISuggestionsForUser(
    userId: number,
    partnerId: number,
    currentUserInput: string,
    channelId: string
  ): Promise<any> {
    try {
      const userResult = await this.profileRepository.getByUserId(userId);
      const partnerResult = await this.profileRepository.getByUserId(partnerId);

      if (!userResult?.profile || !partnerResult?.profile) {
        return null;
      }

      const user = userResult.profile;
      const partner = partnerResult.profile;

      const userName = `${user.first_name || APP_CONSTANTS.constword.User}`.trim();
      const partnerName = `${partner.first_name ||  APP_CONSTANTS.constword.Match}`.trim();

      const userGender = user.gender ;
      const partnerGender = partner.gender ;

      const lastChats = await ChatHistory.findAll({
        where: { channel_id: channelId },
        attributes: [
          CHAT_HISTORY.CHAT_MSG,
          CHAT_HISTORY.SENDERID,
          CHAT_HISTORY.CREATED_AT,
        ],
        order: [[CHAT_HISTORY.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
        limit: 2,
        raw: true,
      });

      const formattedHistory = this.formatHistoryForAI(
        lastChats.reverse(),
        userId,
        userName,
        userGender,
        partnerName,
        partnerGender
      );

      if (currentUserInput?.trim()) {
        formattedHistory.push({
          speaker: `User (${userName}${userGender ? `, ${userGender}` : ''})`,
          message: currentUserInput.trim(),
        });
      }

      // Use partner data for the profile being suggested about
      const profileForSuggestions = this.buildPartnerProfile(partner);
      return await this.aiService.generateSuggestions(
        formattedHistory,
        currentUserInput,
        profileForSuggestions
      );

    } catch (error) {
      console.error(APP_CONSTANTS.error.ai_suggestion, error);
      return null;
    }
  }
async sendMessage(req: Request, res: Response): Promise<any> {
  const userId = req.userId;
  const { partnerId, message } = req.body;

  if (!userId) {
    return {
      success: false,
      error: APP_CONSTANTS.message.unauthorized,
      responseCode: APP_CONSTANTS.code.status_unauthorize_code
    };
  }

  if (!partnerId || !message) {
    return {
      success: false,
      error: APP_CONSTANTS.message.send_message_req,
      responseCode: APP_CONSTANTS.code.status_badrequest_code
    };
  }

  const blockStatus = await this.verifyCanChat(userId, partnerId);
  if (!blockStatus.canChat) {
    return {
      success: false,
      error: APP_CONSTANTS.message.cant_chat,
      responseCode: APP_CONSTANTS.code.status_badrequest_code
    };
  }

  let channelId = await this.chatRepository.getExistingChannelId(userId, partnerId);

  if (!channelId) {
    try {
      const likeRepo = new LikeRepository();
      const matchResult: any = await likeRepo.createMatch(partnerId, userId);

      if (matchResult?.success && matchResult?.data?.channel_id) {
        channelId = matchResult.data.channel_id;
      } else {
        return {
          success: false,
          message: APP_CONSTANTS.message.no_chan,
          responseCode: APP_CONSTANTS.code.status_exist_code
        };
      }
    } catch {
      return {
        success: false,
        message: APP_CONSTANTS.message.no_chan,
        responseCode: APP_CONSTANTS.code.status_exist_code
      };
    }
  }

  /** ---------------- CREATE MESSAGE ---------------- */
  const messageResult = await this.chatRepository.createMessage(
    channelId!,
    userId,     // sender
    message,
    partnerId  // receiver
  );

  if (messageResult.error) {
    return {
      success: false,
      error: messageResult.error || APP_CONSTANTS.message.failed_send_message,
      responseCode: APP_CONSTANTS.code.status_badrequest_code
    };
  }

  /**
   *  SINGLE SOURCE OF TRUTH
   * owner_id === message creator
   */
  const ownerId = messageResult.data.owner_id;

  /** ---------------- NOTIFICATION (UNCHANGED) ---------------- */
  const senderDetail = await this.userRepository.findById(userId);
  const senderName = senderDetail?.user?.profile?.first_name || DEFAULT_CONFIG.SOMEONE;
  const notificationMessage = `${senderName} sent you a message`;

  let senderImage: any = null;
  const imageResult = await this.profileRepository.getUserProfileImage(userId);
  if (imageResult?.success && imageResult?.data?.image_url) {
    const { status, data } = await this.profileRepository.getSignedImageUrl(
      imageResult.data.image_url
    );
    if (status) senderImage = data;
  }

  const sendNotify = new SendNotification();
  await sendNotify.saveNotifcation(userId, partnerId, notificationMessage);

  const userToken: any = await this.notificationRepository.getUserById(partnerId);
  if (userToken?.device_token) {
    await sendNotify.sendpushNotification(userToken.device_token, {
      title: notificationMessage,
      body: message,
      image : null
    });
  }

  /** ---------------- REDIS + AI LOGIC ---------------- */
  try {
    const isConnected = await this.ensureRedisConnection();
    if (isConnected && channelId) {

      /** -------- MESSAGE EVENT -------- */
      await this.redisClient.publish(
        channelId,
        JSON.stringify({
          type: APP_CONSTANTS.constword.message,
          sender_id: ownerId,
          id: messageResult.data.id,
          message: messageResult.data.chat_message,
          channel_id: channelId,
          created_at: messageResult.data.created_at,
          timestamp: new Date().toUTCString()
        })
      );

      try {
        /** -------- AI FOR RECEIVER (reply suggestion) -------- */
        const receiverSuggestions = await this.generateAISuggestionsForUser(
          partnerId, 
          userId,    
          '',        
          channelId
        );

        if (receiverSuggestions) {
          await this.redisClient.publish(
            channelId,
            JSON.stringify({
              type: APP_CONSTANTS.action.ai_suggestions,
              user_id: partnerId,
              owner_id: ownerId,
              icebreaker: receiverSuggestions.icebreaker,
              flirting: receiverSuggestions.flirting,
              next_step: receiverSuggestions.next_step,
              timestamp: new Date().toUTCString()
            })
          );
        }

        /** -------- AI FOR SENDER (next-message suggestion) -------- */
        const senderSuggestions = await this.generateAISuggestionsForUser(
          userId,    
          partnerId,  
          message,    
          channelId
        );

        if (senderSuggestions) {
          await this.redisClient.publish(
            channelId,
            JSON.stringify({
              type: APP_CONSTANTS.action.ai_suggestions,
              user_id: userId,
              owner_id: ownerId,
              icebreaker: senderSuggestions.icebreaker,
              flirting: senderSuggestions.flirting,
              next_step: senderSuggestions.next_step,
              timestamp: new Date().toUTCString()
            })
          );
        }

      } catch (aiErr) {
        this.logger.error('Failed to generate AI suggestions', aiErr);
      }
    }
  } catch (err) {
    console.error(APP_CONSTANTS.error.chan_pub, err);
  }

  return {
    success: true,
    data: {
      ...messageResult.data,
      channel_id: channelId
    },
    responseCode: APP_CONSTANTS.code.status_success_code
  };
}


  async getChatHistory(req: Request, res: Response): Promise<any> {
    const userId = req.userId as number;
    let channelId = req.params.channelId as string;
    if (!userId) {
      return {
        success: false,
        error: APP_CONSTANTS.message.unauthorized,
        responseCode: APP_CONSTANTS.code.status_unauthorize_code,
      };
    }
    if (!channelId) {
      return {
        success: false,
        error: APP_CONSTANTS.message.chan_req,
        responseCode: APP_CONSTANTS.code.status_badrequest_code,
      };
    }
    const rawPage = req.query.page;
    const rawLimit = req.query.limit;
    let page = APP_CONSTANTS.number.one;
    let limit = APP_CONSTANTS.number.ten;
    if (typeof rawPage === 'string') {
      const parsed = parseInt(rawPage, APP_CONSTANTS.number.ten);
      if (!isNaN(parsed) && parsed > 0) {
        page = parsed;
      }
    }
    if (typeof rawLimit === 'string') {
      const parsed = parseInt(rawLimit, APP_CONSTANTS.number.ten);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, APP_CONSTANTS.number.hundred);
      }
    }
    try {
      await this.chatRepository.markMessagesAsRead(channelId, userId);
      const historyResult = await this.chatRepository.getChatHistoryByChannel(channelId, page, limit, userId);
      if (historyResult.error) {
        return {
          success: false,
          error: APP_CONSTANTS.message.failed_fetch_chat_history,
          responseCode: APP_CONSTANTS.code.status_internal_server,
        };
      }
      let total = APP_CONSTANTS.number.zero;
      try {
        total = await ChatHistory.count({
          where: { channel_id: channelId },
        });
      } catch (err) {
        this.logger.error(APP_CONSTANTS.error.total_count_fetch, err)
      }
      return {
        success: true,
        data: {
          channel_id: channelId,
          page,
          limit,
          total,
          messages: historyResult.data,
        },
        responseCode: APP_CONSTANTS.code.status_success_code,
      };
    } catch (error) {
      this.logger.error(APP_CONSTANTS.error.chatcontroller_get_history,error)
      return {
        success: false,
        error: APP_CONSTANTS.message.failed_fetch_chat_history,
        responseCode: APP_CONSTANTS.code.status_internal_server,
      };
    }
  }

  async getChatList(req: Request, res: Response): Promise<any> {
    const userId = req.userId;

    if (!userId) {
      return { success: false, error: APP_CONSTANTS.message.unauthorized, responseCode: APP_CONSTANTS.code.status_unauthorize_code };
    }
    return this.getChatListById(userId);
  }
  private async getChatListById(userId: number): Promise<any> {
    if (!userId) {
      return {
        success: false,
        error: APP_CONSTANTS.message.unauthorized,
        responseCode: APP_CONSTANTS.code.status_unauthorize_code
      };
    }

    const partnersResult = await this.chatRepository.getChatPartners(userId);

    if (partnersResult.error) {
      return {
        success: false,
        error: APP_CONSTANTS.message.failed_fetch_chat_list,
        responseCode: APP_CONSTANTS.code.status_internal_server
      };
    }

    let partners = partnersResult.data;

    if (!partners || partners.length === 0) {
      return { success: true, data: [], responseCode: APP_CONSTANTS.code.status_success_code };
    }

    const updatedPartners = await Promise.all(
      partners.map(async (partner: any) => {
        const verifyChatResult = await this.chatRepository.verifyCanChat(userId, partner.partner_id);

        return {
          ...partner,
          is_blocked: verifyChatResult.reason === APP_CONSTANTS.action.blocked,
          is_matched: verifyChatResult.canChat
        };
      })
    );


    const sorted = updatedPartners.sort((a, b) => {
      const t1 = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
      const t2 = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
      return t2 - t1;
    });

    return { success: true, data: sorted, responseCode: APP_CONSTANTS.code.status_success_code };
  }



  async toggleBlockUser(req: Request, res: Response): Promise<any> {
    const userId = req.userId as number;
    const { targetUserId } = req.body;

    if (!userId) {
      return {
        success: false,
        error: APP_CONSTANTS.message.unauthorized,
        responseCode: APP_CONSTANTS.code.status_unauthorize_code
      };
    }

    if (!targetUserId) {
      return {
        success: false,
        error: APP_CONSTANTS.message.target_req,
        responseCode: APP_CONSTANTS.code.status_badrequest_code
      };
    }

    try {
      const blockedStatus = await this.chatRepository.getBlockedStatus(userId, targetUserId);
      const isCurrentlyBlocked = !!blockedStatus.data;

      const channelId = await this.chatRepository.getExistingChannelId(userId, targetUserId);

      if (isCurrentlyBlocked) {
        // ---------- UNBLOCK ----------
        const unblockResult = await this.chatRepository.unblockUser(userId, targetUserId);
        if (unblockResult.error) {
          return { success: false, error: APP_CONSTANTS.message.unblock_failed, responseCode: APP_CONSTANTS.code.status_internal_server };
        }

        if (channelId && this.redisClient?.isOpen) {
          const unblockEvent = {
            type: APP_CONSTANTS.action.unblocked,
            unblocker_id: userId,
            unblocked_id: targetUserId,
            is_block: false,
            timestamp: new Date().toUTCString()
          };

          await this.redisClient.publish(String(channelId), JSON.stringify(unblockEvent));
        }

        // Emit socket event for dashboard update
        const io = getSocket();
        if (io) {
          io.emit(APP_CONSTANTS.socket_fields.userUnblocked, { unblockerId: userId, unblockedId: targetUserId });
        }

        return {
          success: true,
          data: {
            id: targetUserId,
            action: APP_CONSTANTS.action.unblocked,
            is_blocked: false,
            message: APP_CONSTANTS.message.user_unblocked_success
          },
          responseCode: APP_CONSTANTS.code.status_success_code
        };

      } else {
        const blockResult = await this.chatRepository.blockUser(userId, targetUserId);
        if (blockResult.error) {
          return { success: false, error: APP_CONSTANTS.message.failed_block_user, responseCode: APP_CONSTANTS.code.status_internal_server };
        }

        if (channelId && this.redisClient?.isOpen) {
          const blockEvent = {
            type: APP_CONSTANTS.action.blocked,
            blocked_by: userId,
            blocked_id: targetUserId,
            is_block: true,
            timestamp: new Date().toUTCString()
          };

          await this.redisClient.publish(String(channelId), JSON.stringify(blockEvent));
        }

        // Emit socket event for dashboard update
        const io = getSocket();
        if (io) {
          io.emit(APP_CONSTANTS.socket_fields.userBlocked, { blockerId: userId, blockedId: targetUserId });
        }

        return {
          success: true,
          data: {
            id: targetUserId,
            action: APP_CONSTANTS.action.blocked,
            is_blocked: true,
            message: APP_CONSTANTS.message.blocked_success
          },
          responseCode: APP_CONSTANTS.code.status_success_code
        };
      }

    } catch (error) {
      return {
        success: false,
        error: APP_CONSTANTS.message.something_went_wrong,
        responseCode: APP_CONSTANTS.code.status_internal_server
      };
    }
  }


  async reportUser(req: Request, res: Response): Promise<any> {
    const userId = req.userId;
    const { reportedUserId, reason, description } = req.body;

    if (!userId) {
      return { success: false, error: APP_CONSTANTS.message.unauthorized, responseCode: APP_CONSTANTS.code.status_unauthorize_code };
    }

    const reportResult = await this.chatRepository.reportUser(userId, reportedUserId, reason, description);

    if (reportResult.error) {
      return { success: false, error: APP_CONSTANTS.message.failed_report_user, responseCode: APP_CONSTANTS.code.status_internal_server };
    }

    // Emit socket event for dashboard update
    const io = getSocket();
    if (io) {
      io.emit(APP_CONSTANTS.socket_fields.userReported, { reporterId: userId, reportedId: reportedUserId, reason });
    }

    return { success: true, data: reportResult.data, responseCode: APP_CONSTANTS.code.status_success_code };
  }

  async getInitialAISuggestions(userId: number | undefined, partnerId: number): Promise<any> {
    if (!userId) return { success: false, error: APP_CONSTANTS.message.unauthorized, responseCode: APP_CONSTANTS.code.status_unauthorize_code };
    if (!partnerId) return { success: false, error: APP_CONSTANTS.message.validation_error, responseCode: APP_CONSTANTS.code.status_badrequest_code };

    try {
      const partnerResult = await this.profileRepository.getByUserId(partnerId);
      const userResult = await this.profileRepository.getByUserId(userId);

      if (!partnerResult?.profile || !userResult?.profile) {
        return { success: false, error: APP_CONSTANTS.message.user_not_found, responseCode: APP_CONSTANTS.code.status_notdatafound_code };
      }

      const partner = partnerResult.profile;
      const user = userResult.profile;

      const partnerProfile = this.buildPartnerProfile(partner);

      const suggestions = await this.aiService.generateSuggestions(
        [],
        '',
        partnerProfile
      );

      if (!suggestions) {
        return { success: false, error: APP_CONSTANTS.message.something_went_wrong, responseCode: APP_CONSTANTS.code.status_internal_server };
      }

      return { success: true, data: suggestions, responseCode: APP_CONSTANTS.code.status_success_code };

    } catch (error) {
      return { success: false, error: APP_CONSTANTS.message.something_went_wrong, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async getAISuggestions(
    userId: number | undefined,
    partnerId: number,
    chatHistory: Array<{ speaker: string; message: string }> = [],
    userInput: string = ''
  ): Promise<any> {
    if (!userId) return { success: false, error: APP_CONSTANTS.message.unauthorized, responseCode: APP_CONSTANTS.code.status_unauthorize_code };
    if (!partnerId) return { success: false, error: APP_CONSTANTS.message.validation_error, responseCode: APP_CONSTANTS.code.status_badrequest_code };

    try {
      const partnerResult = await this.profileRepository.getByUserId(partnerId);
      const userResult = await this.profileRepository.getByUserId(userId);

      if (!partnerResult?.profile || !userResult?.profile) {
        return { success: false, error: APP_CONSTANTS.message.user_not_found, responseCode: APP_CONSTANTS.code.status_notdatafound_code };
      }

      const partner = partnerResult.profile;
      const user = userResult.profile;

      const userName = `${user.first_name || APP_CONSTANTS.constword.User}`.trim();
      const partnerName = `${partner.first_name || APP_CONSTANTS.constword.Match}`.trim();

      const userGender = user.gender;
      const partnerGender = partner.gender;

      let formattedChatHistory: Array<{ speaker: string; message: string }>;

      if (chatHistory && chatHistory.length > 0) {
        formattedChatHistory = chatHistory.map(entry => {
          const isUserSpeaker = entry.speaker.includes(APP_CONSTANTS.constword.User);
          const name = isUserSpeaker ? userName : partnerName;
          const gender = isUserSpeaker ? userGender : partnerGender;
          const genderLabel = gender ? `, ${gender}` : '';

          return {
            speaker: isUserSpeaker
              ? `User (${name}${genderLabel})`
              : `Match (${name}${genderLabel})`,
            message: entry.message.trim()
          };
        });
      } else {
        formattedChatHistory = [];
      }

      // Append userInput if provided
      if (userInput?.trim()) {
        formattedChatHistory.push({
          speaker: `User (${userName}${userGender ? `, ${userGender}` : ''})`,
          message: userInput.trim(),
        });
      }

      const partnerProfile = this.buildPartnerProfile(partner);

      const suggestions = await this.aiService.generateSuggestions(
        formattedChatHistory,
        userInput,
        partnerProfile
      );

      if (!suggestions) {
        return { success: false, error: APP_CONSTANTS.message.ai_chat_error, responseCode: APP_CONSTANTS.code.status_internal_server };
      }

      return { success: true, data: suggestions, responseCode: APP_CONSTANTS.code.status_success_code };

    } catch (error) {
      this.logger.error(APP_CONSTANTS.error.ai_suggestion);

      return { success: false, error: APP_CONSTANTS.message.something_went_wrong, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  private buildPartnerProfile(partner: any): string {
    const profile: string[] = [];

    // Name with gender and orientation
    const name = `${partner.first_name || ''} ${partner.last_name || ''}`.trim();
    if (name) {
      let nameWithDetails = `Name: ${name}`;
      if (partner.gender) nameWithDetails += ` (${partner.gender}`;
      if (partner.orientation) nameWithDetails += `, ${partner.sexual_orientation}`;
      nameWithDetails += ')';
      profile.push(nameWithDetails);
    }

    // Intent/Looking for
    if (partner.looking_for_intention) {
      profile.push(`Intent: ${partner.looking_for_intention}`);
    } else if (partner.looking_for_gender) {
      profile.push(`Intent: ${partner.looking_for_gender}`);
    }

    // Bio
    if (partner.short_bio) {
      profile.push(`Bio: ${partner.short_bio}`);
    }

    return profile.join('\n');
  }

async subscribeToChannel(
  channelId: string,
  res: Response,
  userId: number
): Promise<void> {
  let subscriber: any;
  const subscriptionStartTime = new Date().toISOString();

  try {
    if (!this.activeUsers.has(channelId)) {
      this.activeUsers.set(channelId, new Set());
    }
    this.activeUsers.get(channelId)!.add(userId);

    const channelInfo = await this.getChannelInfo(channelId, userId);
    const partnerId = channelInfo?.partnerId;

    if (!partnerId) {
      sendSSEData(res, APP_CONSTANTS.action.error, { message: APP_CONSTANTS.message.invalid_channel});
      res.end();
      return;
    }

    sendSSEData(res, APP_CONSTANTS.action.connection, {
      channel_id: channelId,
      user_id: userId,
      active_users: Array.from(this.activeUsers.get(channelId)!)
    });

    let canChat = true;
    let blockedBy: number | null = null;

    const updateBlockStatus = async () => {
      const status = await this.verifyCanChat(userId, partnerId);
      canChat = status.canChat;
      blockedBy = status.blockedBy;

      if (!canChat) {
        sendSSEData(res, APP_CONSTANTS.action.blocked, {
          blocked_by: blockedBy,
          blocked_id: blockedBy === userId ? partnerId : userId,
          is_block: true
        });
      }
    };

    await updateBlockStatus();

    //  AI suggestions helper 
    const sendAISuggestions = async (suggestionsForUserId: number = userId, suggestionsAboutPartnerId: number = partnerId) => {
      if (!canChat) return;

      const suggestions = await this.generateAISuggestionsForUser(
        suggestionsForUserId,
        suggestionsAboutPartnerId,
        '',
        channelId
      );

      if (suggestions) {
        sendSSEData(res, APP_CONSTANTS.action.ai_suggestions, {
          user_id: suggestionsForUserId,
          owner_id: suggestionsAboutPartnerId,
          icebreaker: suggestions.icebreaker,
          flirting: suggestions.flirting,
          next_step: suggestions.next_step
        });
      }
    };

    await sendAISuggestions();

    //  Redis subscriber
    subscriber = this.redisClient.duplicate();
    
    if (!subscriber.isOpen) {
      await subscriber.connect();
    }

    // Listen to subscriber connection events
    subscriber.on('error', (err: any) => {
      console.error(`[REDIS SUBSCRIBER ERROR] ${new Date().toISOString()} - Channel: ${channelId}, Error:`, err.message);
    });

    subscriber.on('end', () => {
      console.warn(`[REDIS SUBSCRIBER DISCONNECTED] ${new Date().toISOString()} - Channel: ${channelId}`);
    });

    await subscriber.subscribe(channelId, async (message: string) => {
      try {
        const parsed = JSON.parse(message);

        //  BLOCK / UNBLOCK EVENTS
        if (
          parsed.type === APP_CONSTANTS.action.blocked ||
          parsed.type === APP_CONSTANTS.action.unblocked
        ) {
          const isBlocked = parsed.type === APP_CONSTANTS.action.blocked;
          canChat = !isBlocked;
          blockedBy = parsed.blocked_by || parsed.unblocker_id;

          sendSSEData(res, parsed.type, {
            blocked_by: blockedBy,
            blocked_id: parsed.blocked_id || parsed.unblocked_id,
            is_block: isBlocked
          }, parsed.timestamp);

          //  Send AI again if unblocked
          if (!isBlocked) {
            await sendAISuggestions();
          }
          return;
        }

        //  READ RECEIPT
        if (parsed.type === APP_CONSTANTS.action.read_receipt) {
          sendSSEData(res, APP_CONSTANTS.action.read_receipt, {
            channel_id: parsed.channel_id,
            reader_id: parsed.reader_id,
            is_read: true
          }, parsed.timestamp);
          return;
        }

        //  AI SUGGESTIONS
        if (parsed.type === APP_CONSTANTS.action.ai_suggestions) {
          // Only send suggestions to the intended user
          if (parsed.user_id === userId) {
            sendSSEData(res, APP_CONSTANTS.action.ai_suggestions, {
              user_id: parsed.user_id,
              owner_id: parsed.owner_id,
              icebreaker: parsed.icebreaker,
              flirting: parsed.flirting,
              next_step: parsed.next_step
            }, parsed.timestamp);
          }
          return;
        }

        //  CHAT MESSAGE
        if (parsed.sender_id !== undefined && canChat) {
          const senderId = parsed.sender_id;

          sendSSEData(res, APP_CONSTANTS.constword.message, {
            id: parsed.id,
            owner_id: senderId,
            message: parsed.message,
            channel_id: parsed.channel_id,
            created_at: parsed.created_at
          }, parsed.timestamp);

          // MARK AS READ
          if (
            senderId !== userId &&
            this.activeUsers.get(channelId)?.has(userId)
          ) {
            await this.chatRepository.markMessagesAsRead(channelId, userId);

            await this.redisClient.publish(
              channelId,
              JSON.stringify({
                type: APP_CONSTANTS.action.read_receipt,
                channel_id: channelId,
                reader_id: userId,
                timestamp: new Date().toUTCString()
              })
            );
          }
        }
      } catch (err) {
        this.logger.error(APP_CONSTANTS.error.subscribe_channel, err);
      }
    });

    res.on('close', () => {
      const closeTime = new Date().toISOString();
      
      this.activeUsers.get(channelId)?.delete(userId);
      const remainingUsers = this.activeUsers.get(channelId)?.size || 0;
      
      if (remainingUsers === 0) {
        this.activeUsers.delete(channelId);
      }
      
      if (subscriber) {
        subscriber?.disconnect().catch((err: any) => {
          console.error(`[SUBSCRIBER DISCONNECT ERROR] ${new Date().toISOString()} - Channel: ${channelId}, Error:`, err.message);
        });
      }
    });

  } catch (error: any) {
    const errorTime = new Date().toISOString();
    console.error(`[SUBSCRIBE ERROR] ${errorTime} - Channel: ${channelId}, User: ${userId}, Error:`, error.message);
    console.error(`[SUBSCRIBE ERROR STACK] ${errorTime}`, error.stack);
    
    this.logger.error(APP_CONSTANTS.error.subscribe_channel, error);
    
    if (subscriber) {
      subscriber?.disconnect().catch((err: any) => {
        console.error(`[SUBSCRIBER DISCONNECT ERROR] ${new Date().toISOString()} - Error:`, err.message);
      });
    }
    
    res.end();
  }
}


  async getActiveUsers(
    channelId: string
  ): Promise<{ success: boolean; data?: any; error?: string; responseCode: number }> {
    try {
      const activeUserIds = Array.from(this.activeUsers.get(channelId) || new Set());

      return {
        success: true,
        data: {
          channel_id: channelId,
          active_users: activeUserIds,
          count: activeUserIds.length,
        },
        responseCode: APP_CONSTANTS.code.status_success_code,
      };
    } catch (error) {
      return {
        success: false,
        error: APP_CONSTANTS.message.something_went_wrong,
        responseCode: APP_CONSTANTS.code.status_internal_server,
      };
    }
  }

  async verifyCanChat(
    userId: number,
    partnerId: number
  ): Promise<{
    canChat: boolean;
    blockedBy: number | null;
  }> {

    try {
      // ---- User blocked partner
      const blockedByMe = await BlockedUser.findOne({
        where: {
          user_id: userId,
          blocked_user_id: partnerId
        }
      });

      if (blockedByMe) {
        return {
          canChat: false,
          blockedBy: userId
        };
      }

      // ---- Partner blocked user
      const blockedByPartner = await BlockedUser.findOne({
        where: {
          user_id: partnerId,
          blocked_user_id: userId
        }
      });

      if (blockedByPartner) {
        return {
          canChat: false,
          blockedBy: partnerId
        };
      }

      return {
        canChat: true,
        blockedBy: null
      };

    } catch (error) {
      return {
        canChat: false,
        blockedBy: null
      };
    }
  }


  async getChannelInfo(channelId: string, userId: number): Promise<any> {
    try {
      const channel = await ChatHistory.findOne({
        where: {
          channel_id: channelId,
        },
        attributes: [CHAT_HISTORY.SENDERID, CHAT_HISTORY.RECEIVERID],
        raw: true
      });

      if (!channel) {
        return {
          success: false,
          message: APP_CONSTANTS.message.roomt_not_found,
          partnerId: null
        };
      }

      if (channel.sender_id !== userId && channel.receiver_id !== userId) {
        return {
          success: false,
          message: APP_CONSTANTS.message.roomt_not_found,
          partnerId: null
        };
      }

      const partnerId = channel.sender_id === userId ? channel.receiver_id : channel.sender_id;

      return {
        success: true,
        partnerId,
        channel
      };
    } catch (error) {
      console.error(APP_CONSTANTS.error.getchannel, error);
      return {
        success: false,
        message: APP_CONSTANTS.message.something_went_wrong,
        partnerId: null,
        error
      };
    }
  }

  async searchInChatList(req: Request, res: Response): Promise<any> {
    try {
      const userId = req.userId;

      if (!userId) {
        return { success: false, error: APP_CONSTANTS.message.unauthorized, responseCode: APP_CONSTANTS.code.status_unauthorize_code };
      }

      const query = (req.query.query as string) || "";

      const result = await this.chatRepository.searchChats(userId, query);

      if (result.error) {
        return { success: false, error: result.error };
      }

      // Add profile images to each search result
      const enrichedResults = await Promise.all(
        (result.data || []).map(async (item: any) => {
          let profileImage: any = null;
          
          try {
            const partnerId = item.partner_id || item.id;
            if (partnerId) {
              const imageResult = await this.profileRepository.getUserProfileImage(partnerId);
              if (imageResult?.success && imageResult?.data?.image_url) {
                const { status, data } = await this.profileRepository.getSignedImageUrl(imageResult.data.image_url);
                if (status) {
                  profileImage = data;
                }
              }
            }
          } catch (err) {
            console.error(APP_CONSTANTS.error.getchannel, err);
            return {
              success: false,
              message: APP_CONSTANTS.message.something_went_wrong,
              partnerId: null,
              err
            };
          }

          return {
            ...item,
            profile_image: profileImage
          };
        })
      );

      return { success: true, data: enrichedResults };

    } catch (error) {
      return { success: false, error };
    }
  }

  async archiveChat(req: Request, res: Response): Promise<any> {
    const userId = req.userId;
    const { channelId } = req.body;

    if (!userId) {
      return { success: false, error: APP_CONSTANTS.message.unauthorized, responseCode: APP_CONSTANTS.code.status_unauthorize_code };
    }

    if (!channelId) {
      return { success: false, error: APP_CONSTANTS.message.chan_req, responseCode: APP_CONSTANTS.code.status_badrequest_code };
    }

    try {
      const channelInfo = await this.getChannelInfo(channelId, userId);
      if (!channelInfo.success || !channelInfo.partnerId) {
        return { success: false, error: APP_CONSTANTS.message.chat_not_found, responseCode: APP_CONSTANTS.code.status_notfound_code };
      }

      const result = await this.chatRepository.archiveChat(userId, channelId, channelInfo.partnerId);

      if (result.error) {
        return { success: false, error: result.error, responseCode: APP_CONSTANTS.code.status_internal_server };
      }

      return {
        success: true,
        message: APP_CONSTANTS.message.archived_success,
        data: result.data,
        responseCode: APP_CONSTANTS.code.status_success_code
      };
    } catch (error) {
      return { success: false, error: APP_CONSTANTS.message.something_went_wrong, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async unarchiveChat(req: Request, res: Response): Promise<any> {
    const userId = req.userId;
    const { channelId } = req.body;

    if (!userId) {
      return { success: false, error: APP_CONSTANTS.message.unauthorized, responseCode: APP_CONSTANTS.code.status_unauthorize_code };
    }

    if (!channelId) {
      return { success: false, error: APP_CONSTANTS.message.chan_req, responseCode: APP_CONSTANTS.code.status_badrequest_code };
    }

    try {
      const result = await this.chatRepository.unarchiveChat(userId, channelId);

      if (result.error) {
        return { success: false, error: result.error, responseCode: APP_CONSTANTS.code.status_internal_server };
      }

      return {
        success: true,
        message: APP_CONSTANTS.message.unarchived_Success,
        data: result.data || { success: true, is_archived: false },
        responseCode: APP_CONSTANTS.code.status_success_code
      };
    } catch (error) {
      return { success: false, error: APP_CONSTANTS.message.something_went_wrong, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async getArchivedChats(req: Request, res: Response): Promise<any> {
    const userId = req.userId;

    if (!userId) {
      return { success: false, error: APP_CONSTANTS.message.unauthorized, responseCode: APP_CONSTANTS.code.status_unauthorize_code };
    }

    try {
      const result = await this.chatRepository.getArchivedChats(userId);
      if (result.error) {
        return { success: false, error: result.error, responseCode: APP_CONSTANTS.code.status_internal_server };
      }

      const archives = result.data || [];

      const enriched = await Promise.all(archives.map(async (a: any) => {
        const partnerId = a.other_user_id || a.other_user || a.partner_id || null;
        let partner = null;
        if (partnerId) {
          try {
            const pd = await this.chatRepository.getPartnerDetails(partnerId, userId);
            partner = pd && pd.data ? pd.data : null;
          } catch (err) {
            partner = null;
          }
        }

        return { ...a, partner };
      }));

      return {
        success: true,
        data: enriched,
        message: APP_CONSTANTS.message.getarchived_status,
        responseCode: APP_CONSTANTS.code.status_success_code
      };
    } catch (error) {
      return { success: false, error: APP_CONSTANTS.message.something_went_wrong, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async deleteMessages(req: Request): Promise<any> {
    const userId = req.userId;
    const { channelId, messageIds } = req.body;

    if (!userId) {
      return { success: false, error: APP_CONSTANTS.message.unauthorized, responseCode: APP_CONSTANTS.code.status_unauthorize_code };
    }

    if (!channelId) {
      return { success: false, error: APP_CONSTANTS.message.chan_req, responseCode: APP_CONSTANTS.code.status_badrequest_code };
    }

    const channelInfo = await this.getChannelInfo(channelId, userId);
    if (!channelInfo.success) {
      return { success: false, error: APP_CONSTANTS.message.chat_not_found, responseCode: APP_CONSTANTS.code.status_notdatafound_code };
    }

    const result = await this.chatRepository.deleteMessages(
      channelId,
      userId,
      messageIds
    );

    if (result.error) {
      return { success: false, error: result.error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }

    const msg = Array.isArray(messageIds) && messageIds.length > 0
      ? APP_CONSTANTS.message.selected_message
      : APP_CONSTANTS.message.clearchat;

    return {
      success: true,
      data: { ...result.data, message: msg },
      responseCode: APP_CONSTANTS.code.status_success_code
    };
  }

  async removeChat(req: Request): Promise<any> {
    const userId = req.userId;
    const { channelId } = req.body;

    if (!userId) {
      return { success: false, error: APP_CONSTANTS.message.unauthorized, responseCode: APP_CONSTANTS.code.status_unauthorize_code };
    }

    if (!channelId) {
      return { success: false, error: APP_CONSTANTS.message.chan_req, responseCode: APP_CONSTANTS.code.status_badrequest_code };
    }

    const channelInfo = await this.getChannelInfo(channelId, userId);
    if (!channelInfo.success) {
      return { success: false, error: APP_CONSTANTS.message.chat_not_found, responseCode: APP_CONSTANTS.code.status_notdatafound_code };
    }

    const result = await this.chatRepository.removeChatForUser(
      channelId,
    );

    if (result.error) {
      return { success: false, error: result.error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }

    return {
      success: true,
      data: { message: APP_CONSTANTS.message.chat_removed },
      responseCode: APP_CONSTANTS.code.status_success_code
    };
  }
}