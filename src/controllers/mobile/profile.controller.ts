import { APP_CONSTANTS } from "../../utils/constants";
import { ProfileService } from "../../services/mobile/profile.service";
import { Request, Response } from 'express';
import { sendErrorWithLog } from '../../utils/responseHandler';


export class ProfileController {
    private profileService: ProfileService;

    constructor() {
        this.profileService = new ProfileService();
    }

    updateProfile = async (req: Request, res: Response) => {
        try {
            const result = await this.profileService.updateProfile(req);
            return res.status(result.responseCode).json(result);
        } catch (error) {
            return sendErrorWithLog(
                res,
                error,
                APP_CONSTANTS.error.profilecontroller_err,
                APP_CONSTANTS.code.status_badrequest_code
            );
        }
    };

    getProfile = async (req: Request, res: Response) => {
        try {
            const result = await this.profileService.getProfile(req);
            return res.status(result.responseCode).json(result);
        } catch (error) {
            return sendErrorWithLog(
                res,
                error,
                APP_CONSTANTS.error.profilecontroller_err,
                APP_CONSTANTS.code.status_badrequest_code
            );
        }
    };

    deleteProfile = async (req: Request, res: Response) => {
        try {
            const result = await this.profileService.deleteProfile(req);
            return res.status(result.responseCode).json(result);
        } catch (error) {
            return sendErrorWithLog(
                res,
                error,
                APP_CONSTANTS.error.profilecontroller_err,
                APP_CONSTANTS.code.status_badrequest_code
            );
        }
    };

    find_matching = async (req: Request, res: Response) => {
        try {
            const result = await this.profileService.findMatching(req);

            return res.status(result.responseCode).json(result);
        } catch (error) {
            return sendErrorWithLog(
                res,
                error,
                APP_CONSTANTS.error.profilecontroller_err,
                APP_CONSTANTS.code.status_badrequest_code
            );
        }
    };

    completeProfilePrecent = async (req: Request, res: Response) => {
        try {
            const user = await this.profileService.completeProfilePrecent(req)
            return res.status(user.responseCode).json(user);
        } catch (error) {
            return sendErrorWithLog(
                res,
                error,
                APP_CONSTANTS.error.profilecontroller_err,
                APP_CONSTANTS.code.status_badrequest_code
            );
        }
    }

}
