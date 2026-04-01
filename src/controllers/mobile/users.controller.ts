import { APP_CONSTANTS } from "../../utils/constants"
import { UsersService } from "../../services/mobile/users.service"
import {sendErrorWithLog} from "../../utils/responseHandler";

interface ServiceResponse {
    data?: {
        user: any;
        token?: string;
        refresh_token?: string;
    };
    message: string;
    status: boolean;
    responseCode: number;
    token?: string;
}

export class UserController {
    public userService: UsersService

    constructor() {
        this.userService = new UsersService()
    }


    register = async (req: any, res: any) => {
        const result = await this.userService.register(req);
        return res.status(result.responseCode).json(result);
    };

    signIn = async (req: any, res: any) => {
        try {
            const result = await this.userService.signIn(req) as ServiceResponse;
            if (result?.data?.token || result?.token) {
                const { data, token, ...rest } = result;
                return res.status(result.responseCode).json({
                    ...rest,
                    token: data?.token || token,
                    refresh_token: data?.refresh_token,
                    user: data?.user
                });
            }
            return res.status(result.responseCode).json(result);
        } catch (error) {
            return sendErrorWithLog(
                res,
                error,
                APP_CONSTANTS.error.signin,
                APP_CONSTANTS.code.status_badrequest_code
            );
        }
    };

    refreshToken = async (req: any, res: any) => {
        try {
            const result = await this.userService.refreshToken(req) as ServiceResponse;
            if (result?.data?.token) {
                const { data, ...rest } = result;
                return res.status(result.responseCode).json({
                    ...rest,
                    token: data?.token,
                    refresh_token: data?.refresh_token,
                    user: data?.user
                });
            }
            return res.status(result.responseCode).json(result);
        } catch (error) {
            return sendErrorWithLog(
                res,
                error,
                APP_CONSTANTS.message.refresh_failed,
                APP_CONSTANTS.code.status_unauthorize_code
            );
        }
    };

    forgotPassword = async (req: any, res: any) => {
        try {
            const result = await this.userService.forgotPassword(req) as ServiceResponse;
            return res.status(result.responseCode).json(result);
        } catch (error) {
             return sendErrorWithLog(
                res,
                error,
                APP_CONSTANTS.message.forgot_password,
                APP_CONSTANTS.code.status_badrequest_code
            );
        }
    };

    verifyOtp = async (req: any, res: any) => {
        try {
            const result = await this.userService.verifyOtp(req) as ServiceResponse;
            return res.status(result.responseCode).json(result);
        } catch (error) {
              return sendErrorWithLog(
                res,
                error,
                APP_CONSTANTS.message.invalid_otp,
                APP_CONSTANTS.code.status_badrequest_code
            );
        }
    };

    resetPassword = async (req: any, res: any) => {
        try {
            const result = await this.userService.resetPassword(req) as ServiceResponse;
            return res.status(result.responseCode).json(result);
        } catch (error) {
            return sendErrorWithLog(
                res,
                error,
                APP_CONSTANTS.error.reset_password_issue,
                APP_CONSTANTS.code.status_badrequest_code
            );
        }
    };

    uploadProfile = async (req: any, res: any) => {
        try {
            const user = await this.userService.uploadProfile(req)
            return res.status(user.responseCode).json(user);
        } catch (error) {
            return sendErrorWithLog(
                res,
                error,
                APP_CONSTANTS.error.upload_profile_issue,
                APP_CONSTANTS.code.status_badrequest_code
            );
        }
    }

    uploadProfileFaceVerify = async (req: any, res: any) => {
        try {
            const userId = req.userId;
            if (!userId) {
                return res.status(APP_CONSTANTS.code.status_unauthorize_code).json({
                    status: false,
                    message: APP_CONSTANTS.message.unauthorized_user,
                    responseCode: APP_CONSTANTS.code.status_unauthorize_code
                });
            }
            const result = await this.userService.uploadProfileFaceVerify(req, userId);
            return res.status(result.responseCode).json(result);
        } catch (error) {
            return sendErrorWithLog(
                res,
                error,
                'Face verification failed',
                APP_CONSTANTS.code.status_badrequest_code
            );
        }
    }

     helpSupport = async (req: any, res: any) => {
        try {
            const user = await this.userService.helpSupport(req)
            return res.status(user.responseCode).json(user);
        } catch (error: any) {
            return res.status(APP_CONSTANTS.code.status_internal_server).json({ message: error.message });
        }
    }

}