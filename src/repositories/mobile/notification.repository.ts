import notificationMaster from "../../models/notification_master";
import User from "../../models/user";
import { USER_FIELDS, NOTIFICATION_FIELDS, APP_CONSTANTS } from "../../utils/constants";
import { APILogger } from "../../utils/logger";
import { createErrorResponse } from "../../utils/responseHandler";

export class notificationRepository {
    private logger: APILogger;

    constructor() {
        this.logger = new APILogger();
    }
    private formatUserNotification(notif: any) {
        return {
            id: notif[NOTIFICATION_FIELDS.ID],
            type: APP_CONSTANTS.type.user,
            [NOTIFICATION_FIELDS.SENDER_ID]: notif[NOTIFICATION_FIELDS.SENDER_ID],
            [NOTIFICATION_FIELDS.RECEIVER_ID]: notif[NOTIFICATION_FIELDS.RECEIVER_ID],
            title: notif[NOTIFICATION_FIELDS.NOTIFICATION_TYPE],
            [NOTIFICATION_FIELDS.MESSAGE]: notif[NOTIFICATION_FIELDS.MESSAGE],
            [NOTIFICATION_FIELDS.IS_SEEN]: notif[NOTIFICATION_FIELDS.IS_SEEN],
            [NOTIFICATION_FIELDS.CREATED_AT]: notif[NOTIFICATION_FIELDS.CREATED_AT]
        };
    }

    saveUserNotification = async (notify_object: any) => {
        return await notificationMaster.create(
            notify_object
        )
    }

    getUserById = async (id: number) => {
        return await User.findOne({
            where: { id },
            attributes: [USER_FIELDS.ID,USER_FIELDS.DEVICE_TOKEN]
        });
    };

    /**
     * Get all notifications for a user (both admin and user notifications)
     * Only returns unseen notifications with pagination
     */
    async getNotifications(
        userId: number,
        limit: number = 20,
        offset: number = 0
    ): Promise<any> {
        try {
            const userNotifications = await notificationMaster.findAll({
                where: {
                    [NOTIFICATION_FIELDS.RECEIVER_ID]: userId,
                    [NOTIFICATION_FIELDS.IS_SEEN]: false
                },
                attributes: [
                    NOTIFICATION_FIELDS.ID,
                    NOTIFICATION_FIELDS.SENDER_ID,
                    NOTIFICATION_FIELDS.RECEIVER_ID,
                    NOTIFICATION_FIELDS.MESSAGE,
                    NOTIFICATION_FIELDS.NOTIFICATION_TYPE,
                    NOTIFICATION_FIELDS.IS_SEEN,
                    NOTIFICATION_FIELDS.CREATED_AT
                ],
                order: [[NOTIFICATION_FIELDS.CREATED_AT, NOTIFICATION_FIELDS.DESC]],
                raw: true
            });

            const formattedNotifications = userNotifications.map(
                this.formatUserNotification
            );

            return {
                data: formattedNotifications.slice(offset, offset + limit),
                error: null,
                total: formattedNotifications.length
            };
        } catch (error) {
            this.logger.error(APP_CONSTANTS.error.notification_fetch, error);
            return createErrorResponse(
                APP_CONSTANTS.error.notification_fetch,
                APP_CONSTANTS.code.status_internal_server
            );
        }
    }

    /**
     * Mark a user notification as seen
     */
    async markNotificationAsSeen(notificationId: number, userId: number): Promise<any> {
        try {
            const notification = await notificationMaster.findOne({
                where: {
                    [NOTIFICATION_FIELDS.ID]: notificationId,
                    [NOTIFICATION_FIELDS.RECEIVER_ID]: userId
                }
            });

            if (!notification) {
                return createErrorResponse(APP_CONSTANTS.error.notification_not_found, APP_CONSTANTS.code.status_notfound_code);
            }

            if (notification.get(NOTIFICATION_FIELDS.IS_SEEN)) {
                return createErrorResponse(APP_CONSTANTS.error.already_seen, APP_CONSTANTS.code.status_badrequest_code);
            }

            await notificationMaster.update(
                { [NOTIFICATION_FIELDS.IS_SEEN]: true },
                {
                    where: {
                        [NOTIFICATION_FIELDS.ID]: notificationId,
                        [NOTIFICATION_FIELDS.RECEIVER_ID]: userId
                    }
                }
            );

            return {
                data: { success: true, message: APP_CONSTANTS.message.marked_as_seen },
                error: null
            };
        } catch (error) {
            this.logger.error(APP_CONSTANTS.error.mark_seen, error);
            return createErrorResponse(APP_CONSTANTS.error.mark_seen, APP_CONSTANTS.code.status_internal_server);
        }
    }

    /**
     * Mark all user notifications as seen
     */
    async markAllNotificationsAsSeen(userId: number): Promise<any> {
        try {
            // Mark user notifications as seen
            await notificationMaster.update(
                { [NOTIFICATION_FIELDS.IS_SEEN]: true },
                {
                    where: {
                        [NOTIFICATION_FIELDS.RECEIVER_ID]: userId,
                        [NOTIFICATION_FIELDS.IS_SEEN]: false
                    }
                }
            );

            return {
                data: { success: true },
                error: null
            };
        } catch (error) {
            this.logger.error(APP_CONSTANTS.error.all_message_mark_seen, error);
            return createErrorResponse(APP_CONSTANTS.error.all_message_mark_seen, APP_CONSTANTS.code.status_internal_server);
        }
    }

    /**
     * Get unread notification count for a user
     */
    async getUnreadCount(userId: number): Promise<any> {
        try {
            const count = await notificationMaster.count({
                where: {
                    [NOTIFICATION_FIELDS.RECEIVER_ID]: userId,
                    [NOTIFICATION_FIELDS.IS_SEEN]: false
                }
            });

            return {
                data: { unread_count: count },
                error: null
            };
        } catch (error) {
            this.logger.error(APP_CONSTANTS.error.unread_count, error);
            return {
                data: { unread_count: 0 },
                error: createErrorResponse(APP_CONSTANTS.error.unread_count, APP_CONSTANTS.code.status_internal_server),
            };
        }
    }

    /**
     * Create a message notification
     */
    async createMessageNotification(
        senderId: number,
        receiverId: number,
        message: string,
        notificationType: string = APP_CONSTANTS.constword.message
    ): Promise<any> {
        try {
            const notification = await notificationMaster.create({
                [NOTIFICATION_FIELDS.SENDER_ID]: senderId,
                [NOTIFICATION_FIELDS.RECEIVER_ID]: receiverId,
                [NOTIFICATION_FIELDS.MESSAGE]: message,
                [NOTIFICATION_FIELDS.NOTIFICATION_TYPE]: notificationType,
                [NOTIFICATION_FIELDS.IS_SEEN]: false
            } as any);

            return {
                data: notification.get({ plain: true }),
                error: null
            };
        } catch (error) {
            this.logger.error(APP_CONSTANTS.error.notification_fetch, error);
            return createErrorResponse(APP_CONSTANTS.error.notification_fetch, APP_CONSTANTS.code.status_internal_server);
        }
    }
}
