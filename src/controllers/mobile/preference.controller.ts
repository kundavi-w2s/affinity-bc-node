import { Request, Response } from 'express';
import { APP_CONSTANTS } from '../../utils/constants';
import { PreferenceService } from '../../services/mobile/preference.service';
import { sendErrorWithLog } from '../../utils/responseHandler';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    setup: boolean;
    email?: string;
    phone_number?: string;
    iat: number;
    exp: number;
  };
}

export class PreferenceController {
  private preferenceService: PreferenceService;

  constructor() {
    this.preferenceService = new PreferenceService();
  }

  setPreferences = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await this.preferenceService.setPreferences(req, res);
      return res.status(result.responseCode).json(result);
    } catch (error) {
      return sendErrorWithLog(
        res,
        error,
        APP_CONSTANTS.message.preference_controller,
        APP_CONSTANTS.code.status_internal_server
      );
    }
  };

  getPreferences = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await this.preferenceService.getPreferences(req, res);
      return res.status(result.responseCode).json(result);
    } catch (error) {
      return sendErrorWithLog(
        res,
        error,
        APP_CONSTANTS.message.preference_controller,
        APP_CONSTANTS.code.status_badrequest_code
      );
    }
  };
}
