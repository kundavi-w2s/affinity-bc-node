import { Op } from 'sequelize';
import User from '../../models/user';
import UserProfile from '../../models/user_profile';
import ChatHistory from '../../models/chat_history';
import BlockedUser from '../../models/blocked_user';
import ReportUser from '../../models/report_user';
import NotificationMaster from '../../models/notification_master';
import ChatArchive from '../../models/chat_archive';
import { APP_CONSTANTS, USER_EXTRA_FIELDS, PROFILE_FIELDS, USER_FIELDS, CHAT_HISTORY, ADMIN_FIELDS } from '../../utils/constants';
import { getSignedUrl } from '../../utils/formatImage';
import UserImage from '../../models/image_master';
import { error } from 'console';
import { APILogger } from '../../utils/logger';
import { parseDeletedUsers } from '../../utils/helper';

export class ChatRepository {
    private logger: APILogger;
    constructor() {
          this.logger = new APILogger();
      
    }

  async createMessage(
  channelId: string,
  senderId: number,
  message: string,
  receiverId: number
): Promise<any> {
  try {
    if (senderId === receiverId) {
      return { data: null, error: APP_CONSTANTS.message.self_message };
    }

    const [senderExists, receiverExists] = await Promise.all([
      User.findByPk(senderId),
      User.findByPk(receiverId)
    ]);

    if (!senderExists || !receiverExists) {
      return { data: null, error: 'Invalid sender or receiver' };
    }

    const lastMessage = await ChatHistory.findOne({
      where: { channel_id: channelId },
      attributes: [CHAT_HISTORY.ARCHIVED_FOR_USERS],
      order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
      raw: true
    });

    const archivedForUsers = lastMessage
      ? parseDeletedUsers(lastMessage.archived_for_users)
      : [];

    const chat = await ChatHistory.create({
      channel_id: channelId,
      sender_id: senderId,
      receiver_id: receiverId,
      chat_message: message,
      is_read: false,
      archived_for_users: archivedForUsers
    });

    const raw = chat.get({ plain: true });
    raw.owner_id = raw.sender_id;

    delete raw.sender_id;
    delete raw.receiver_id;

    return { data: raw, error: null };

  } catch (error) {
    return {
      status: false,
      error,
      responseCode: APP_CONSTANTS.code.status_internal_server
    };
  }
}

  async searchChats(profileId: number, query: string): Promise<any> {

    try {
      if (!query || query.trim() === "") {
        return { data: [], error: null };
      }

      const users = await UserProfile.findAll({
        where: {
          user_id: { [Op.ne]: profileId },
          [Op.or]: [
            { first_name: { [Op.like]: `%${query}%` } },
            { last_name: { [Op.like]: `%${query}%` } }
          ]
        },
        attributes: [
          PROFILE_FIELDS.MANDATORY.FIRST_NAME,
          PROFILE_FIELDS.MANDATORY.LAST_NAME,
          USER_FIELDS.USER_ID
        ],
        raw: true
      });

      const results: any[] = [];

      for (const user of users) {
        const channelId = await this.getExistingChannelId(profileId, user.user_id);

        if (!channelId) continue;

        const lastMessage: any = await ChatHistory.findOne({
          where: { channel_id: channelId },
          attributes: [CHAT_HISTORY.CHANNAL_ID, CHAT_HISTORY.CHAT_MSG, CHAT_HISTORY.SENDERID, CHAT_HISTORY.RECEIVERID, CHAT_HISTORY.CREATED_AT],
          order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
          raw: true
        });

        if (!lastMessage) continue;

        results.push({
          partner_id: user.user_id,
          full_name: `${user.first_name} ${user.last_name}`,
          last_message: lastMessage.chat_message,
          last_message_time: lastMessage.created_at,
          owner_id: lastMessage.sender_id,
          channel_id: lastMessage.channel_id
        });
      }

      return { data: results, error: null };

    } catch (error) {
      return {
        data: null,
        error,
        responseCode: APP_CONSTANTS.code.status_internal_server
      };
    }
  }


  async getExistingChannelId(userId1: number, userId2: number) {
    try {
      const existingChat = await ChatHistory.findOne({
        where: {
          [Op.or]: [
            { sender_id: userId1, receiver_id: userId2 },
            { sender_id: userId2, receiver_id: userId1 }
          ]
        },
        order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
        attributes: [APP_CONSTANTS.constword.channelID],
        raw: true
      });

      return existingChat?.channel_id || null;

    } catch (err) {
      return null;
    }
  }

  async isUserBlocked(userId1: number, userId2: number): Promise<any> {
    try {
      const blocked = await BlockedUser.findOne({
        where: {
          user_id: userId1,
          blocked_user_id: userId2,
        },
      });
      return { data: blocked, error: null };
    } catch (error) {
      return { data: null, error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async createNotification(notificationData: any): Promise<any> {
    try {
      const notification = await NotificationMaster.create(notificationData);
      return { data: notification, error: null };
    } catch (error) {
      return { data: null, error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }


  async getUnreadCountByChannel(channelId: string, receiverId: number): Promise<any> {
    try {
      const count = await ChatHistory.count({
        where: {
          channel_id: channelId,
          receiver_id: receiverId,
          is_read: false,
        },
      });
      return { data: count, error: null };
    } catch (error) {
      return { data: APP_CONSTANTS.number.zero, error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async getChatHistoryByChannel(
    channelId: string,
    page: number,
    limit: number,
    userId: number
  ): Promise<{ data: any[]; error: any | null; responseCode?: number }> {
    try {
      const messages = await ChatHistory.findAll({
        where: { channel_id: channelId },
        attributes: [
          CHAT_HISTORY.ID,
          CHAT_HISTORY.CHANNAL_ID,
          CHAT_HISTORY.SENDERID,
          CHAT_HISTORY.RECEIVERID,
          CHAT_HISTORY.CHAT_MSG,
          CHAT_HISTORY.IS_READ,
          CHAT_HISTORY.IS_ARCHIVED,
          CHAT_HISTORY.DELETED_FOR_USERS, // ✅ IMPORTANT
          CHAT_HISTORY.CREATED_AT
        ],
        order: [[CHAT_HISTORY.CREATED_AT, CHAT_HISTORY.DESC]],
        limit,
        offset: (page - 1) * limit,
        raw: true
      });

      // Filter deleted messages correctly
      const visibleMessages = messages.filter(msg => {
        const deletedUsers = parseDeletedUsers(msg.deleted_for_users);
        return !deletedUsers.includes(userId);
      });

      // Fetch sender profiles once
      const senderIds = [...new Set(visibleMessages.map(m => m.sender_id))];

      const profiles = await UserProfile.findAll({
        where: { user_id: senderIds },
        attributes: [
          USER_FIELDS.USER_ID,
          PROFILE_FIELDS.MANDATORY.FIRST_NAME,
          PROFILE_FIELDS.MANDATORY.LAST_NAME
        ],
        raw: true
      });

      const profileMap = new Map(
        profiles.map(p => [p.user_id, `${p.first_name} ${p.last_name}`])
      );

      const formattedMessages = visibleMessages.map(msg => ({
        owner_id: msg.sender_id,
        full_name: profileMap.get(msg.sender_id) || '',
        channel_id: msg.channel_id,
        chat_message: msg.chat_message,
        is_archived: !!msg.is_archived,
        created_at: msg.created_at,
        is_read: !!msg.is_read,
        messageid: msg.id
      }));

      return { data: formattedMessages, error: null };
    } catch (error) {
      this.logger.error(APP_CONSTANTS.message.failed_fetch_chat_history, error);

      return {
        data: [],
        error: error || APP_CONSTANTS.message.failed_fetch_chat_history,
        responseCode: APP_CONSTANTS.code.status_internal_server,
      };
    }
  }

  async markMessagesAsRead(channelId: string, receiverId: number): Promise<any> {
    try {
      await ChatHistory.update(
        { is_read: true },
        {
          where: {
            channel_id: channelId,
            receiver_id: receiverId,
            is_read: false,
          },
        }
      );
      return { data: true, error: null };
    } catch (error) {
      return { status: false, error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async getChatPartners(profileId: number): Promise<any> {
    try {
      const matches = await ChatHistory.findAll({
        where: {
          [Op.or]: [
            { sender_id: profileId },
            { receiver_id: profileId }
          ]
        },
        raw: true
      });

      if (!matches.length) {
        return { data: [], error: null };
      }

      const uniquePartnerIds = new Set<number>();
      for (const msg of matches) {
        const partnerId = msg.sender_id === profileId ? msg.receiver_id : msg.sender_id;
        uniquePartnerIds.add(partnerId);
      }

      const partners: any[] = [];

      for (const partnerId of uniquePartnerIds) {

        const partner = await UserProfile.findOne({
          where: { user_id: partnerId },
          attributes: [USER_FIELDS.ID, USER_FIELDS.USER_ID, PROFILE_FIELDS.MANDATORY.FIRST_NAME, PROFILE_FIELDS.MANDATORY.LAST_NAME],
          raw: true
        });

        if (!partner) continue;

        const userImage = await UserImage.findOne({
          where: { user_id: partnerId, is_profile_pic: true },
          attributes: [PROFILE_FIELDS.MANDATORY.IMAGE_URL],
          raw: true
        });

        let formattedImage = userImage?.image_url || null;

        if (formattedImage) {
          try {
            const { status, data } = await getSignedUrl(formattedImage);
            if (status) formattedImage = data;
          } catch (err) {
            console.error(APP_CONSTANTS.error.image_url, err);
          }
        }

        const unreadCount = await ChatHistory.count({
          where: {
            receiver_id: profileId,
            sender_id: partnerId,
            is_read: false
          }
        });

        const channelId = await this.getExistingChannelId(profileId, partnerId);

        let lastMessage: any = null;
        if (channelId) {
          lastMessage = await ChatHistory.findOne({
            attributes: [
              CHAT_HISTORY.CHAT_MSG,
              CHAT_HISTORY.CREATED_AT,
              CHAT_HISTORY.CHANNAL_ID,
              CHAT_HISTORY.SENDERID,
              CHAT_HISTORY.RECEIVERID,
              CHAT_HISTORY.IS_ARCHIVED,
              CHAT_HISTORY.DELETED_FOR_USERS,
              CHAT_HISTORY.ARCHIVED_FOR_USERS
            ],
            where: { channel_id: channelId },
            order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
            raw: true
          });

          if (lastMessage) {
            const deletedUsers = parseDeletedUsers(lastMessage.deleted_for_users);
            if (deletedUsers.includes(profileId)) {
              lastMessage = null;
            }
          }
        }

        const isArchivedForUser = lastMessage
          ? parseDeletedUsers(lastMessage.archived_for_users).includes(profileId)
          : false;

          partners.push({
          partner_id: partnerId,
          full_name: `${partner.first_name} ${partner.last_name}`.trim(),
          formatted_profile_picture: formattedImage,

          last_message: lastMessage?.chat_message || null,
          last_message_time: lastMessage?.created_at || null,

          owner_id: lastMessage ? lastMessage.sender_id : null,

            channel_id: lastMessage?.channel_id || channelId,
            unread_count: unreadCount,
            is_archived: isArchivedForUser
          });

      }

      return { data: partners, error: null };
    } catch (error) {
      return { data: [], error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }


  async getLatestMessageByChannel(channelId: string): Promise<any> {
    try {
      const latestMessage = await ChatHistory.findOne({
        where: { channel_id: channelId },
        order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
      });
      return { data: latestMessage, error: null };
    } catch (error) {
      return { data: null, error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async getPartnerDetails(profileId: number, currentUserId?: number): Promise<any> {
    try {
      const profile = await User.findOne({
        where: { id: profileId },
        attributes: [USER_EXTRA_FIELDS.ID, ADMIN_FIELDS.EMAIL, ADMIN_FIELDS.PHONE_NUMBER, ADMIN_FIELDS.COUNTRY_CODE],
        include: [
          {
            model: UserProfile,
            as: APP_CONSTANTS.constword.profile,
            attributes: [
              PROFILE_FIELDS.MANDATORY.FIRST_NAME, PROFILE_FIELDS.MANDATORY.LAST_NAME
            ],
            required: false,
          }
        ],
        raw: false,
      });

      if (!profile) {
        return { data: null, error: null };
      }

      const userImage = await UserImage.findOne({
        where: { user_id: profileId, is_profile_pic: true },
        attributes: [PROFILE_FIELDS.MANDATORY.IMAGE_URL],
        raw: true
      });

      const userProfile = (profile as any).profile || {};

      let profilePicture = userImage?.image_url || null;
      let formattedProfilePicture = null;

      if (profilePicture) {
        try {
          const { status, data } = await getSignedUrl(profilePicture);
          if (status) formattedProfilePicture = data;
        } catch (err) {
          console.error(APP_CONSTANTS.error.get_url, err);
        }
      }

      // Check if chat is archived for current user (if currentUserId is provided)
      let isArchived = false;
      if (currentUserId) {
        const channelId = await this.getExistingChannelId(currentUserId, profileId);
        if (channelId) {
          const latestMessage = await ChatHistory.findOne({
            where: { channel_id: channelId },
            attributes: [CHAT_HISTORY.ARCHIVED_FOR_USERS],
            order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
            raw: true
          });

          if (latestMessage) {
            const archivedUsers = parseDeletedUsers(latestMessage.archived_for_users);
            isArchived = archivedUsers.includes(currentUserId);
          }
        }
      }

      const flattened = {
        id: profile.id,
        email: profile.email,
        phone_number: profile.phone_number,
        country_code: profile.country_code,
        first_name: userProfile.first_name,
        last_name: userProfile.last_name,
        image_url: profilePicture,
        formatted_image_url: formattedProfilePicture,
        is_archived: isArchived,
      };

      return { data: flattened, error: null };

    } catch (error) {
      return { data: null, error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async getBlockedStatus(userId: number, partnerId: number): Promise<any> {
    try {
      const blocked = await BlockedUser.findOne({
        where: {
          user_id: userId,
          blocked_user_id: partnerId,
        },
      });
      return { data: blocked, error: null };
    } catch (error) {
      return { status: false, error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async blockUser(userId: number, blockedUserId: number): Promise<any> {
    try {
      const blockedUser = await BlockedUser.create({
        user_id: userId,
        blocked_user_id: blockedUserId,
      } as any);
      return { data: blockedUser, error: null };
    } catch (error) {
      return { data: null, error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async reportUser(userId: number, reportedUserId: number, reason: string, description?: string): Promise<any> {
    try {
      const reportData = {
        user_id: userId,
        reported_user_id: reportedUserId,
        reason,
        description,
        status: APP_CONSTANTS.action.pending,
      };
      const report = await ReportUser.create(reportData as any);
      return { data: report, error: null };
    } catch (error) {
      return { data: null, error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async unblockUser(userId: number, unblockedUserId: number): Promise<any> {
    try {
      await BlockedUser.destroy({
        where: {
          user_id: userId,
          blocked_user_id: unblockedUserId,
        },
      });
      return { data: true, error: null };
    } catch (error) {
      return { data: null, error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }

  async verifyCanChat(userId: number, partnerId: number): Promise<any> {
    try {
      if (!userId || !partnerId) {
        return {
          canChat: false,
          reason: APP_CONSTANTS.message.invalid_error,
          blockedBy: null,
          error: null,
        };
      }

      //  Check if user blocked partner (user initiated block)
      const blocked = await BlockedUser.findOne({
        where: {
          user_id: userId,
          blocked_user_id: partnerId,
        },
      });

      if (blocked) {
        return {
          canChat: false,
          reason: APP_CONSTANTS.action.blocked,
          blockedBy: APP_CONSTANTS.constword.self,
          error: null,
        };
      }

      const blockedByPartner = await BlockedUser.findOne({
        where: {
          user_id: partnerId,
          blocked_user_id: userId,
        },
      });

      if (blockedByPartner) {
        return {
          canChat: false,
          reason: APP_CONSTANTS.action.blocked,
          blockedBy: APP_CONSTANTS.constword.partner,
          error: null,
        };
      }

      //  Find existing channel by channel_id only (single condition)
      const channelId = await this.getExistingChannelId(userId, partnerId);

      if (channelId) {
        const channel = await ChatHistory.findOne({
          where: { channel_id: channelId },
          attributes: [CHAT_HISTORY.CHANNAL_ID],
          raw: true
        });

        if (channel) {
          return {
            canChat: true,
            reason: APP_CONSTANTS.message.exist_channel,
            channel_id: channel.channel_id,
            blockedBy: null,
            error: null,
          };
        }
      }

      return {
        canChat: false,
        reason: APP_CONSTANTS.message.no_chan,
        blockedBy: null,
        error: null,
      };

    } catch (error) {
      console.error(APP_CONSTANTS.error.match_for_chat, error);
      return {
        status: false,
        error,
        responseCode: APP_CONSTANTS.code.status_internal_server
      };
    }
  }

  // Archive chat for user
 async archiveChat(
  userId: number,
  channelId: string,
  otherUserId: number
): Promise<any> {
  try {
    // Create entry in ChatArchive table for tracking
    const archived = await ChatArchive.create({
      user_id: userId,
      channel_id: channelId,
      other_user_id: otherUserId,
      archive_reason: APP_CONSTANTS.message.reason
    } as any);

    // Also update archived_for_users array in all messages for this channel
    const chatMessages = await ChatHistory.findAll({
      where: { channel_id: channelId },
      raw: true
    });

    for (const message of chatMessages) {
      const archivedUsers = parseDeletedUsers(message.archived_for_users);

      if (!archivedUsers.includes(userId)) {
        archivedUsers.push(userId);

        await ChatHistory.update(
          { archived_for_users: archivedUsers },
          { where: { id: message.id } }
        );
      }
    }

    return {
      data: {
        archived,
        channel_id: channelId,
        is_archived: true
      },
      error: null
    };

  } catch (error) {
    return {
      data: null,
      error,
      responseCode: APP_CONSTANTS.code.status_internal_server
    };
  }
}


  // Unarchive chat for user
  async unarchiveChat(
  userId: number,
  channelId: string
): Promise<any> {
  try {
    // Delete entry from ChatArchive table
    await ChatArchive.destroy({
      where: {
        user_id: userId,
        channel_id: channelId
      }
    });

    // Also remove user from archived_for_users array in all messages
    const chatMessages = await ChatHistory.findAll({
      where: { channel_id: channelId },
      raw: true
    });

    for (const message of chatMessages) {
      const archivedUsers = parseDeletedUsers(message.archived_for_users);

      if (archivedUsers.includes(userId)) {
        const index = archivedUsers.indexOf(userId);
        archivedUsers.splice(index, 1);

        await ChatHistory.update(
          { archived_for_users: archivedUsers },
          { where: { id: message.id } }
        );
      }
    }

    return {
      data: {
        channel_id: channelId,
        is_archived: false,
        unarchived_by_user: userId
      },
      error: null
    };

  } catch (error) {
    return {
      data: null,
      error,
      responseCode: APP_CONSTANTS.code.status_internal_server
    };
  }
}

async getArchivedChats(userId: number): Promise<any> {
  try {
    // Get archived chats from ChatArchive table (source of truth)
    const archived = await ChatArchive.findAll({
      where: { user_id: userId },
      order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
      raw: true
    });

    if (!archived.length) {
      return { data: [], error: null };
    }

    const channelIds = archived.map(a => a.channel_id);
    const results: any[] = [];

    // For each archived channel, get the latest message and partner info
    for (const archiveRecord of archived) {
      const channelId = archiveRecord.channel_id;
      const partnerId = archiveRecord.other_user_id;

      // Get latest message in the channel
      const latestMessage = await ChatHistory.findOne({
        where: { channel_id: channelId },
        attributes: [
          CHAT_HISTORY.CHAT_MSG,
          CHAT_HISTORY.CREATED_AT,
          CHAT_HISTORY.ARCHIVED_FOR_USERS
        ],
        order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
        raw: true
      });

      // Get partner profile
      const partner = await UserProfile.findOne({
        where: { user_id: partnerId },
        attributes: [
          USER_FIELDS.USER_ID,
          PROFILE_FIELDS.MANDATORY.FIRST_NAME,
          PROFILE_FIELDS.MANDATORY.LAST_NAME
        ],
        raw: true
      });

      if (!partner) continue;

      results.push({
        channel_id: channelId,
        partner_id: partnerId,
        full_name: `${partner.first_name} ${partner.last_name}`.trim(),
        last_message: latestMessage?.chat_message || null,
        last_message_time: latestMessage?.created_at || null,
        archived_at: archiveRecord.created_at,
        is_archived: true
      });
    }

    return { data: results, error: null };

  } catch (error) {
    return {
      data: [],
      error,
      responseCode: APP_CONSTANTS.code.status_internal_server
    };
  }
}


  async isArchivedForUser(userId: number, channelId: string): Promise<any> {
    try {
      const latestMessage = await ChatHistory.findOne({
        where: { channel_id: channelId },
        attributes: [CHAT_HISTORY.ARCHIVED_FOR_USERS],
        order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
        raw: true
      });

      if (!latestMessage) {
        return { data: false, error: null };
      }

      const archivedUsers = parseDeletedUsers(latestMessage.archived_for_users);
      const isArchived = archivedUsers.includes(userId);

      return { data: isArchived, error: null };
    } catch (error) {
      return { data: false, error, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  }
  async deleteMessages(
    channelId: string,
    userId: number,
    messageIds?: number[]
  ): Promise<{ data: any; error: any }> {
    try {
      const where: any = {
        channel_id: channelId,
        chat_message: { [Op.ne]: null },
      };

      if (Array.isArray(messageIds) && messageIds.length > 0) {
        where.id = { [Op.in]: messageIds };
      }

      const messages = await ChatHistory.findAll({ where });

      for (const message of messages) {
        const deletedUsers = parseDeletedUsers(message.deleted_for_users);

        if (!deletedUsers.includes(userId)) {
          deletedUsers.push(userId);

          // Use update for cleaner code
          await ChatHistory.update(
            { deleted_for_users: deletedUsers },
            { where: { id: message.id } }
          );
        }
      }

      return {
        data: messageIds?.length
          ? { deleted: messageIds }
          : { cleared: true },
        error: null,
      };
    } catch (error) {
      return { data: null, error };
    }
  }

  async removeChatForUser(
    channelId: string,
  ): Promise<any> {
    try {
      await ChatHistory.destroy({
        where: {
          channel_id: channelId,
        }
      });
      return { data: { cleared: true }, error: null };

    } catch {
      return { data: null, error }
    }
  }

}

