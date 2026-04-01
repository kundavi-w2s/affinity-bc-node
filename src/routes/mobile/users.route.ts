import { Router } from "express";
import { UserController } from "../../controllers/mobile/users.controller";
import { validation } from "../../middleware/validation.middleware";
import { registerSchema, signinSchema, forgotPasswordSchema, verifyOtpSchema, resetPasswordSchema, helpsupportSchema } from "../../utils/validation";

export class userRoutes {
    router: Router;
    public usersController: UserController = new UserController()
    constructor() {
        this.router = Router();
        this.routes();
    }
    routes() {
        this.router.post("/register", validation(registerSchema), this.usersController.register);
        this.router.post("/signin", validation(signinSchema), this.usersController.signIn);
        this.router.post("/refresh-token",  this.usersController.refreshToken);
        this.router.post('/forgot-password', validation(forgotPasswordSchema), this.usersController.forgotPassword);
        this.router.post('/verify-otp', validation(verifyOtpSchema), this.usersController.verifyOtp);
        this.router.post('/reset-password',validation(resetPasswordSchema), this.usersController.resetPassword);
        this.router.post("/help_support", validation(helpsupportSchema), this.usersController.helpSupport);
    }
    
}