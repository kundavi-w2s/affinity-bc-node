import { Router } from 'express';
import { ProfileController } from '../../controllers/mobile/profile.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { UserController } from '../../controllers/mobile/users.controller';
import { validation } from '../../middleware/validation.middleware';
import { configureMulter } from '../../utils/multer';
import { profileSchema } from '../../utils/profileValidation';
import { multerUpload } from '../../utils/multerWrapper';

const upload = configureMulter()
export class ProfileRoutes {
  router: Router;
  public usersController: UserController = new UserController();

  public profileController: ProfileController = new ProfileController();
  constructor() {
    this.router = Router();
    this.routes();
  }

  routes() {
    this.router.put('/profile-build',validation(profileSchema) ,this.profileController.updateProfile);
    this.router.get('/profile-build/:id', this.profileController.getProfile);
    this.router.post('/profile-delete/:id',authMiddleware, this.profileController.deleteProfile)
    this.router.post(
      '/upload-profile-images', multerUpload(upload, 'files', 6),
      this.usersController.uploadProfile
    );
    this.router.get("/profile_completion",authMiddleware, this.profileController.completeProfilePrecent);

    this.router.post(
      '/face_verify', authMiddleware, multerUpload(upload, 'files', 6),
      this.usersController.uploadProfileFaceVerify
    );
    this.router.post('/find-matching', authMiddleware, this.profileController.find_matching);
  }
}