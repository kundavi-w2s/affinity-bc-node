// src/services/SendNotification.ts
import { notificationRepository } from "../repositories/mobile/notification.repository";
import messaging from "../settings/firebase";
import { APP_CONSTANTS, DEFAULT_CONFIG } from "./constants";
import { APILogger } from "./logger";

export class SendNotification {
   
    private logger: APILogger
    
    constructor() {
        this.logger = new APILogger();
    }
    sendpushNotification = async (token: string, data: any) => {
        const title = data.title || DEFAULT_CONFIG.NEW_NOTIFICATION;
        const body = data.body || DEFAULT_CONFIG.NEW_MESSAGE;
        const image = data.image || undefined;

        const message: any = {
            token,

            notification: {
                title,
                body,
                image, 
            },

            data: {
                title,
                body,
                image: image || "",
                click_action: "FLUTTER_NOTIFICATION_CLICK",
            },

            android: {
                priority: "high",
                notification: {
                    channelId: "default_channel_id",
                    sound: "default",
                    imageUrl: image, 
                    clickAction: "FLUTTER_NOTIFICATION_CLICK",
                },
            },

            apns: {
                headers: {
                    "apns-priority": "10",
                },
                payload: {
                    aps: {
                        alert: {
                            title,
                            body,
                        },
                        sound: "default",
                        "mutable-content": 1, 
                    },
                },
                fcm_options: {
                    image, 
                },
            },
        };

        try {
            const response = await messaging.send(message);
            return { success: true, response };
        } catch (error: any) {
            console.error("FCM Error:", error.message || error);
            return { success: false, error: error.message || error };
        }
    };


    saveNotifcation = async (sender_id: any, receiver_id: number, notification_message: string) => {
        try {
            const notification = new notificationRepository()
            const notification_type = APP_CONSTANTS.action.connection
            let object = {
                sender_id: sender_id,
                receiver_id: receiver_id,
                message: notification_message,
                notification_type: notification_type
            }
            const data = await notification.saveUserNotification(object)
            return data
        }
        catch (error) {
            return ({
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode:  APP_CONSTANTS.code.status_internal_server
            })
        }
    }


}