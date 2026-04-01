import { Router } from 'express';
import { NotificationController } from '../../controllers/mobile/notification.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

export class NotificationRoutes {
    router: Router;
    public notificationController: NotificationController = new NotificationController();

    constructor() {
        this.router = Router();
        this.routes();
    }

    routes() {
        this.router.use(authMiddleware);

        this.router.get('/list', this.notificationController.getNotifications);
        this.router.post('/mark-seen', this.notificationController.markNotificationAsSeen);
        this.router.post('/mark-all-seen', this.notificationController.markAllNotificationsAsSeen);
        this.router.get('/unread-count', this.notificationController.getUnreadCount);
    }
}
