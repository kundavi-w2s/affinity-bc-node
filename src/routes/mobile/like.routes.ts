import { Router } from 'express';
import { LikeController } from '../../controllers/mobile/like.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

export class LikeRoutes {
    router: Router;
    public likeController: LikeController = new LikeController();

    constructor() {
        this.router = Router();
        this.routes();
    }

    routes() {
        this.router.post('/like', authMiddleware, this.likeController.likeProfile);
        this.router.post('/respond_to_like', authMiddleware, this.likeController.respondToLike);
        this.router.get('/request_profiles', authMiddleware, this.likeController.getRequestList);
        this.router.get('/liked_profile', authMiddleware, this.likeController.getlikedProfile)
        this.router.post('/dislike', authMiddleware, this.likeController.dislikeProfile);
    }
}
