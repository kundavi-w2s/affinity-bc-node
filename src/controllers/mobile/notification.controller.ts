import { Request, Response } from 'express';
import { NotificationService } from '../../services/mobile/notification.service';
import { APILogger } from '../../utils/logger';

export class NotificationController {
  private notificationService: NotificationService;
  private logger: APILogger;

  constructor() {
    this.notificationService = new NotificationService();
    this.logger = new APILogger();
  }

  getNotifications = async (req: Request, res: Response) => {
    await this.notificationService.getNotifications(req, res);
  };

  markNotificationAsSeen = async (req: Request, res: Response) => {
    await this.notificationService.markNotificationAsSeen(req, res);
  };


  markAllNotificationsAsSeen = async (req: Request, res: Response) => {
    await this.notificationService.markAllNotificationsAsSeen(req, res);
  };


  getUnreadCount = async (req: Request, res: Response) => {
    await this.notificationService.getUnreadCount(req, res);
  };
}
