import { Router } from 'express';
import { PreferenceController } from '../../controllers/mobile/preference.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

export class PreferenceRoutes {
  router: Router;
  public preferenceController: PreferenceController = new PreferenceController();

  constructor() {
    this.router = Router();
    this.routes();
  }

  routes() {
    this.router.use(authMiddleware);
    this.router.put('/set', this.preferenceController.setPreferences);
    this.router.get('/', this.preferenceController.getPreferences);
  }
}
