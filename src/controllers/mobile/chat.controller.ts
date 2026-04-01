import { Request, Response } from 'express';
import { ChatService } from '../../services/mobile/chat.service';
import { APP_CONSTANTS } from '../../utils/constants';
import { sendSuccess, sendError, sendErrorWithLog } from '../../utils/responseHandler';
import { APILogger } from '../../utils/logger';


export class ChatController {
  private logger: APILogger;

  private chatService: ChatService;

  constructor() {
    this.chatService = new ChatService();
    this.logger = new APILogger();

  }

  sendMessage = async (req: Request, res: Response) => {
    try {
      const result = await this.chatService.sendMessage(req, res);
      
      if (!result.success) {
        return sendError(res, result.error || APP_CONSTANTS.message.failed_send_message, result.responseCode);
      }

      return sendSuccess(res, result.data, APP_CONSTANTS.code.status_success_code);
    } catch (error) {
      this.logger.error(APP_CONSTANTS.error.chatcontroller_send_msg)
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.chatcontroller_send_msg, APP_CONSTANTS.code.status_internal_server);
    }
  };

  getChatHistory = async (req: Request, res: Response) => {
    try {
      const result = await this.chatService.getChatHistory(req, res);
      
      if (!result.success) {
        return sendError(res, result.error || APP_CONSTANTS.message.failed_fetch_chat_history, result.responseCode);
      }

      return sendSuccess(res, result.data, APP_CONSTANTS.code.status_success_code);
    } catch (error) {
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.chatcontroller_get_history, APP_CONSTANTS.code.status_internal_server);
    }
  };

  getChatList = async (req: Request, res: Response) => {
    try {
      const result = await this.chatService.getChatList(req, res);
      
      if (!result.success) {
        return sendError(res, result.error || APP_CONSTANTS.message.failed_fetch_chat_list, result.responseCode);
      }

      return sendSuccess(res, result.data, APP_CONSTANTS.code.status_success_code);
    } catch (error) {
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.chatcontroller_getchatList, APP_CONSTANTS.code.status_internal_server);
    }
  };

  toggleBlockUser = async (req: Request, res: Response) => {
    try {
      const result = await this.chatService.toggleBlockUser(req, res);
      
      if (!result.success) {
        return sendError(res, result.error || APP_CONSTANTS.message.something_went_wrong, result.responseCode);
      }

      return sendSuccess(res, result.data, APP_CONSTANTS.code.status_success_code);
    } catch (error) {
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.user_toggle_block, APP_CONSTANTS.code.status_internal_server);
    }
  };

  reportUser = async (req: Request, res: Response) => {
    try {
      const result = await this.chatService.reportUser(req, res);

      if (!result.success) {
        return sendError(res, result.error || APP_CONSTANTS.message.failed_report_user, result.responseCode);
      }

      return sendSuccess(res, { message: APP_CONSTANTS.message.report_success }, APP_CONSTANTS.code.status_success_code);
    } catch (error) {
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.report_user,  APP_CONSTANTS.code.status_internal_server);
    }
  };

 
  getAISuggestions = async (req: Request, res: Response) => {
    try {
      const userId = req.userId;
      const { partnerId, chatHistory = [], userInput = "" } = req.body;

      const result = await this.chatService.getAISuggestions(userId, partnerId, chatHistory, userInput);

      if (!result.success) {
        return sendError(res, result.error || APP_CONSTANTS.message.something_went_wrong, result.responseCode);
      }

      return sendSuccess(res, {
        suggestions: result.data,
        message: APP_CONSTANTS.message.ai_chat_success
      }, APP_CONSTANTS.code.status_success_code);
    } catch (error) {
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.ai_suggestion, APP_CONSTANTS.code.status_internal_server);
    }
  };

  getInitialAISuggestions = async (req: Request, res: Response) => {
    try {
      const userId = req.userId as number;
    let partnerId = req.params.partnerId as string;

      const result = await this.chatService.getInitialAISuggestions(userId, parseInt(partnerId));

      if (!result.success) {
        return sendError(res, result.error || APP_CONSTANTS.message.something_went_wrong, result.responseCode);
      }

      return sendSuccess(res, {
        suggestions: result.data,
        message: APP_CONSTANTS.message.initial_ai_Chat_success,
      }, APP_CONSTANTS.code.status_success_code);
    } catch (error) {
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.ai_initial_suggestion, APP_CONSTANTS.code.status_internal_server);
    }
  };

  subscribeToChannel = async (req: Request, res: Response) => {
    try {
      const userId = req.userId as number;
    let channelId = req.params.channelId as string;

      if (!userId) {
        return sendError(res, APP_CONSTANTS.message.unauthorized, APP_CONSTANTS.code.status_unauthorize_code);
      }

      if (!channelId) {
        return sendError(res, APP_CONSTANTS.message.chan_req, APP_CONSTANTS.code.status_badrequest_code);
      }

      const channelInfo = await this.chatService.getChannelInfo(channelId, userId);
      
      if (!channelInfo.success || !channelInfo.partnerId) {
        return sendError(res, APP_CONSTANTS.message.roomt_not_found, APP_CONSTANTS.code.status_notfound_code);
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("X-Accel-Buffering", "no");
      
      res.write(":connected\n\n");

      await this.chatService.subscribeToChannel(channelId, res, userId);

      req.on("close", () => {
        res.end();
      });
    } catch (error) {
      if (!res.headersSent) {
        return sendErrorWithLog(
          res,
          error,
          APP_CONSTANTS.error.subscribe_channel,
          APP_CONSTANTS.code.status_internal_server
        );
      }
      this.logger.error(APP_CONSTANTS.error.subscribe_channel, error);

      try {
        res.end();
      } catch (endErr) {
        this.logger.error(APP_CONSTANTS.error.sse_err, endErr);
      }
    }
  };

  searchChatList = async (req: Request, res: Response) => {
  try {
    const result = await this.chatService.searchInChatList(req, res);

    if (!result.success) {
      return sendError(res, result.error || APP_CONSTANTS.error.failed_search_chat, APP_CONSTANTS.code.status_badrequest_code);
    }

    return sendSuccess(res, result.data, APP_CONSTANTS.code.status_success_code);

  } catch (error) {
    return sendErrorWithLog(res, error, APP_CONSTANTS.message.search_err, APP_CONSTANTS.code.status_internal_server
    );
  }
};

  archiveChat = async (req: Request, res: Response) => {
    try {
      const result = await this.chatService.archiveChat(req, res);

      if (!result.success) {
        return sendError(res, result.error || APP_CONSTANTS.error.archiveChat, result.responseCode);
      }

      return sendSuccess(res, { ...result.data, message: result.message }, result.responseCode);
    } catch (error) {
      this.logger.error(APP_CONSTANTS.error.archiveChat);
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.archiveChat, APP_CONSTANTS.code.status_internal_server);
    }
  };

  unarchiveChat = async (req: Request, res: Response) => {
    try {
      const result = await this.chatService.unarchiveChat(req, res);

      if (!result.success) {
        return sendError(res, result.error || APP_CONSTANTS.error.unarchiveChat, result.responseCode);
      }

      return sendSuccess(res, { ...result.data, message: result.message }, result.responseCode);
    } catch (error) {
      this.logger.error(APP_CONSTANTS.error.unarchiveChat);
      return sendErrorWithLog(res, error,  APP_CONSTANTS.error.unarchiveChat, APP_CONSTANTS.code.status_internal_server);
    }
  };

  getArchivedChats = async (req: Request, res: Response) => {
    try {
      const result = await this.chatService.getArchivedChats(req, res);

      if (!result.success) {
        return sendError(res, result.error || APP_CONSTANTS.error.getArchivedChat, result.responseCode);
      }

      return sendSuccess(res, result.data, result.responseCode);
    } catch (error) {
      this.logger.error(APP_CONSTANTS.error.getArchivedChat);
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.getArchivedChat, APP_CONSTANTS.code.status_internal_server);
    }
  };

 deleteMessages = async (req: Request, res: Response) => {
  try {
    const result = await this.chatService.deleteMessages(req);

    if (!result.success) {
      return sendError(res, result.error, result.responseCode);
    }

    return sendSuccess(res, result.data, result.responseCode);
  } catch (error) {
    return sendErrorWithLog(
      res,
      error,
      APP_CONSTANTS.error.delete_message,
      APP_CONSTANTS.code.status_internal_server
    );
  }
};


removeChat = async (req: Request, res: Response) => {
  const result = await this.chatService.removeChat(req);

  if (!result.success) {
    return sendError(res, result.error, result.responseCode);
  }
  return sendSuccess(res, result.data || {}, result.responseCode);
};

}
