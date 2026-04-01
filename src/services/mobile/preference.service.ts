import { APP_CONSTANTS } from '../../utils/constants';
import { APILogger } from '../../utils/logger';
import { PreferenceRepository, PreferenceData } from '../../repositories/mobile/preference.repository';
import { ProfileRepository } from '../../repositories/mobile/profile.repository';

export class PreferenceService {
  private logger: APILogger;
  private preferenceRepository: PreferenceRepository;
  private profileRepository: ProfileRepository;

  constructor() {
    this.logger = new APILogger();
    this.preferenceRepository = new PreferenceRepository();
    this.profileRepository = new ProfileRepository();
  }

  async setPreferences(req: any, res: any) {
    try {
      const userId = req.userId;
      const data = req.body;

      if (!userId) {
        return {
          message: APP_CONSTANTS.message.unauthorized_user,
          status: false,
          responseCode: APP_CONSTANTS.code.status_unauthorize_code
        };
      }

      let preferenceData: any = { ...data };
      if (data.location && typeof data.location === 'object') {
        preferenceData.city = data.location.city;
        preferenceData.state = data.location.state;
        preferenceData.country = data.location.country;
        delete preferenceData.location;
      }

      if (preferenceData.age_min && preferenceData.age_max && preferenceData.age_min > preferenceData.age_max) {
        return {
          message: APP_CONSTANTS.message.age_min_greater_than_max,
          status: false,
          responseCode: APP_CONSTANTS.code.status_badrequest_code
        };
      }

      if (preferenceData.height_min_cm && preferenceData.height_max_cm && preferenceData.height_min_cm > preferenceData.height_max_cm) {
        return {
          message: APP_CONSTANTS.message.height_min_greater_than_max,
          status: false,
          responseCode: APP_CONSTANTS.code.status_badrequest_code
        };
      }

      const result = await this.preferenceRepository.setPreferences(userId, preferenceData);
      if (!result.success) {
        return {
          message: result.message,
          status: false,
          responseCode: APP_CONSTANTS.code.status_internal_server
        };
      }

      const { success: fetchSuccess, profile: updatedProfile } =
        await this.profileRepository.getByUserIdWithFullDetails(userId);

      if (fetchSuccess && updatedProfile) {
        const syncResult = await this.profileRepository.syncProfileToExternalService(updatedProfile);
        if (!syncResult.success) {
          this.logger.error(`External sync failed after preference update: ${syncResult.message}`);
        }
      }

      return {
        message: APP_CONSTANTS.message.preferences_saved_successfully,
        status: true,
        data: result.preference,
        responseCode: APP_CONSTANTS.code.status_success_code
      };
    } catch (error: any) {
      this.logger.error(error.message || error);
      return {
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server
      };
    }
  }

  async getPreferences(req: any, res: any) {
    try {
      const userId = req.userId;

      if (!userId) {
        return {
          message: APP_CONSTANTS.message.unauthorized_user,
          status: false,
          responseCode: APP_CONSTANTS.code.status_unauthorize_code
        };
      }

      const result = await this.preferenceRepository.getPreferencesByUserId(userId);
      if (!result.success) {
        return {
          message: result.message,
          status: false,
          responseCode: APP_CONSTANTS.code.status_internal_server
        };
      }

      return {
        message: APP_CONSTANTS.message.preferences_fetched_successfully,
        status: true,
        data: result.preference,
        responseCode: APP_CONSTANTS.code.status_success_code
      };
    } catch (error: any) {
      this.logger.error(error.message || error);
      return {
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server
      };
    }
  }
}