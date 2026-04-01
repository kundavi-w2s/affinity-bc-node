import { Request, Response } from 'express';
import { notificationRepository } from '../../repositories/mobile/notification.repository';
import { APP_CONSTANTS } from '../../utils/constants';
import { APILogger } from '../../utils/logger';
import { sendSuccess, sendError, sendErrorWithLog } from '../../utils/responseHandler';

export class NotificationService {
  private notificationRepository: notificationRepository;
  private logger: APILogger;

  constructor() {
    this.notificationRepository = new notificationRepository();
    this.logger = new APILogger();
  }

  /**
   * Get all notifications for the logged-in user
   */
  async getNotifications(req: Request, res: Response): Promise<any> {
    try {
      const userId = req.userId;

      if (!userId) {
        return sendError(res, APP_CONSTANTS.message.unauthorized, APP_CONSTANTS.code.status_unauthorize_code);
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

      const offset = (page - 1) * limit;
      const result = await this.notificationRepository.getNotifications(userId, limit, offset);

      if (result.error) {
        return sendError(res, result.error, result.responseCode || APP_CONSTANTS.code.status_internal_server);
      }

      return sendSuccess(res, {
        page,
        limit,
        total: result.total,
        notifications: result.data
      }, APP_CONSTANTS.code.status_success_code);
    } catch (error) {
      this.logger.error(APP_CONSTANTS.error.notification_fetch, error);
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.notification_fetch, APP_CONSTANTS.code.status_internal_server);
    }
  }

  /**
   * Mark a specific notification as seen
   */
  async markNotificationAsSeen(req: Request, res: Response): Promise<any> {
    try {
      const userId = req.userId;
      const { notificationId } = req.body;

      if (!userId) {
        return sendError(res, APP_CONSTANTS.message.unauthorized, APP_CONSTANTS.code.status_unauthorize_code);
      }

      if (!notificationId) {
        return sendError(res, APP_CONSTANTS.error.notification_id, APP_CONSTANTS.code.status_badrequest_code);
      }

      const result = await this.notificationRepository.markNotificationAsSeen(notificationId, userId);

      if (result.error) {
        return sendError(res, result.error, result.responseCode || APP_CONSTANTS.code.status_internal_server);
      }

      return sendSuccess(res, result.data, APP_CONSTANTS.code.status_success_code);
    } catch (error) {
      this.logger.error(APP_CONSTANTS.error.mark_seen, error);
      return sendErrorWithLog(res, error, APP_CONSTANTS.message.something_went_wrong, APP_CONSTANTS.code.status_internal_server);
    }
  }

  /**
   * Mark all notifications as seen for the user
   */
  async markAllNotificationsAsSeen(req: Request, res: Response): Promise<any> {
    try {
      const userId = req.userId;

      if (!userId) {
        return sendError(res, APP_CONSTANTS.message.unauthorized, APP_CONSTANTS.code.status_unauthorize_code);
      }

      const result = await this.notificationRepository.markAllNotificationsAsSeen(userId);

      if (result.error) {
        return sendError(res, result.error, result.responseCode || APP_CONSTANTS.code.status_internal_server);
      }

      return sendSuccess(res, result.data, APP_CONSTANTS.code.status_success_code);
    } catch (error) {
      this.logger.error(APP_CONSTANTS.error.all_message_mark_seen, error);
      return sendErrorWithLog(res, error, APP_CONSTANTS.message.something_went_wrong, APP_CONSTANTS.code.status_internal_server);
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(req: Request, res: Response): Promise<any> {
    try {
      const userId = req.userId;

      if (!userId) {
        return sendError(res, APP_CONSTANTS.message.unauthorized, APP_CONSTANTS.code.status_unauthorize_code);
      }

      const result = await this.notificationRepository.getUnreadCount(userId);

      if (result.error) {
        return sendError(res, result.error, result.responseCode || APP_CONSTANTS.code.status_internal_server);
      }

      return sendSuccess(res, result.data, APP_CONSTANTS.code.status_success_code);
    } catch (error) {
      this.logger.error(APP_CONSTANTS.error.unread_count, error);
      return sendErrorWithLog(res, error, APP_CONSTANTS.message.something_went_wrong, APP_CONSTANTS.code.status_internal_server);
    }
  }
}
