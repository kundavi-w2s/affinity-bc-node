import { Router } from 'express';
import { ChatController } from '../../controllers/mobile/chat.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { validation } from '../../middleware/validation.middleware';
import { sendMessageSchema, blockToggleSchema, reportUserSchema, getAISuggestionsSchema } from '../../utils/validation';

export class ChatRoutes {
    router: Router;
    public chatController: ChatController = new ChatController();

    constructor() {
        this.router = Router();
        this.routes();
    }

    routes() {
        this.router.use(authMiddleware);

        this.router.post('/message', validation(sendMessageSchema), this.chatController.sendMessage);
        this.router.get('/subscribe/:channelId', this.chatController.subscribeToChannel);
        this.router.get('/list', this.chatController.getChatList);
        this.router.get('/search', this.chatController.searchChatList);
        this.router.get('/history/:channelId', this.chatController.getChatHistory);

        this.router.post('/block-toggle', validation(blockToggleSchema), this.chatController.toggleBlockUser);
        this.router.post('/report', validation(reportUserSchema), this.chatController.reportUser);
        
        this.router.post('/ai/suggestions', validation(getAISuggestionsSchema), this.chatController.getAISuggestions);
        this.router.get('/ai/initial-suggestions/:partnerId', this.chatController.getInitialAISuggestions);

        // Archive, delete, and remove chat operations
        this.router.post('/archive', this.chatController.archiveChat);
        this.router.post('/unarchive', this.chatController.unarchiveChat);
        this.router.get('/archived', this.chatController.getArchivedChats);
        this.router.post('/delete', this.chatController.deleteMessages);
        this.router.post('/remove', this.chatController.removeChat);
    }
}
