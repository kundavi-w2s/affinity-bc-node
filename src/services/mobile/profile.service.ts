import { APP_CONSTANTS, PROFILE_FIELDS } from '../../utils/constants';
import { APILogger } from '../../utils/logger';
import { ProfileRepository } from '../../repositories/mobile/profile.repository';
import {UserRepository} from '../../repositories/mobile/users.repository'
import { calculateScore, isFieldFilled } from '../../utils/helper';
import UserImage from '../../models/image_master';

export class ProfileService {
  private logger: APILogger;
  private profileRepository: ProfileRepository;
    private userRepository: UserRepository;


  constructor() {
    this.logger = new APILogger();
    this.profileRepository = new ProfileRepository();
    this.userRepository = new UserRepository();

  }

  getProfile = async (req: any) => {
    try {
      const userId = req?.params?.id;

      if (!userId) {
        return {
          message: APP_CONSTANTS.message.unauthorized_user,
          status: false,
          responseCode: APP_CONSTANTS.code.status_unauthorize_code,
        };
      }

      const { profile } = await this.profileRepository.getByUserId(userId);

      const formattedProfile = await this.profileRepository.formatProfileWithImages(profile);

      const isBlocked = await this.profileRepository.hasUserAnyBlockingRelationship(userId);

      // attach `is_blocked` and `is_image_verified` to response
      const responseData = {
        ...formattedProfile,
        is_blocked: isBlocked,
        is_image_verified: profile?.is_image_verified || false,
      };

      return {
        message: APP_CONSTANTS.message.profile_fetch_success || "",
        status: true,
        data: responseData,
        responseCode: APP_CONSTANTS.code.status_success_code,
      };
    } catch (error: any) {
      this.logger.error(error.message || error);
      return {
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server,
      };
    }
  };

  updateProfile = async (req: any) => {
    try {
      const userId = req.body.userId || req.user?.id;

      if (!userId) {
        return {
          message: APP_CONSTANTS.message.unauthorized_user,
          status: false,
          responseCode: APP_CONSTANTS.code.status_unauthorize_code,
        };
      }

      const userExists = await this.profileRepository.userExists(userId);
      if (!userExists) {
        return {
          message: APP_CONSTANTS.message.user_not_found,
          status: false,
          responseCode: APP_CONSTANTS.code.status_notfound_code,
        };
      }

      const { profile_images = [], location, ...cleanPayload } = req.body;

      if (cleanPayload.dob) {
        const dobResult = this.profileRepository.processDobAndAge(cleanPayload.dob);

        if (!dobResult.success) {
          return {
            message: dobResult.message,
            status: false,
            responseCode: APP_CONSTANTS.code.status_badrequest_code,
          };
        }

        cleanPayload.dob = dobResult.dob;
        cleanPayload.age = dobResult.age;
      }

      delete cleanPayload.userId;

      const { success: upsertSuccess, profile, message: upsertMessage } =
        await this.profileRepository.upsertProfile(userId, cleanPayload);

      if (!upsertSuccess || !profile) {
        return {
          message: upsertMessage || APP_CONSTANTS.message.something_went_wrong,
          status: false,
          responseCode: APP_CONSTANTS.code.status_internal_server,
        };
      }

      if (profile_images.length > 0) {
        const { success: imagesSuccess, message: imagesMessage } =
          await this.profileRepository.updateImages(profile.id, userId, profile_images);

        if (!imagesSuccess) {
          this.logger.error(APP_CONSTANTS.message.image_update_failed,imagesMessage);
        }
      }

      if (location) {
        const { success: locSuccess, message: locMessage } =
          await this.profileRepository.upsertLocation(userId, location);

        if (!locSuccess) {
          this.logger.error(APP_CONSTANTS.message.failed_to_update_location, locMessage);
        }
      }

      const isProfileComplete = profile_images.length >= 2;

      const { success: completionSuccess, message: completionMessage } =
        await this.profileRepository.updateProfileCompletion(userId, isProfileComplete);

      if (!completionSuccess) {
        this.logger.error(APP_CONSTANTS.message.profile_update_success,completionMessage);
      }

      const { success: fetchSuccess, profile: updatedProfile } =
        await this.profileRepository.getByUserIdWithFullDetails(userId);

      if (!fetchSuccess || !updatedProfile) {
        return {
          message: APP_CONSTANTS.message.something_went_wrong,
          status: false,
          responseCode: APP_CONSTANTS.code.status_internal_server,
        };
      }

      const syncResult = await this.profileRepository.syncProfileToExternalService(updatedProfile);
      if (!syncResult.success) {
        this.logger.error(APP_CONSTANTS.error.external_fail, syncResult.message);
      }

      const formattedResult = await this.profileRepository.formatUpdateProfileResponse(updatedProfile);

      if (!formattedResult.success) {
        return {
          message: APP_CONSTANTS.message.something_went_wrong,
          status: false,
          responseCode: APP_CONSTANTS.code.status_internal_server,
        };
      }

      return {
        message: APP_CONSTANTS.message.profile_update_success,
        status: true,
        data: formattedResult.data,
        responseCode: APP_CONSTANTS.code.status_success_code,
      };
    } catch (error: any) {
      this.logger.error(error.message || error);
      return {
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server,
      };
    }
  };
  findMatching = async (req: any) => {
    try {
      const userId = req.userId; 

      if (!userId) {
        return {
          status: false,
          message: APP_CONSTANTS.message.unauthorized_user,
          responseCode: APP_CONSTANTS.code.status_unauthorize_code
        };
      }

      const userProfileResp = await this.profileRepository.getByUserIdWithFullDetails(userId);
      if (!userProfileResp.success || !userProfileResp.profile) {
        return {
          status: false,
          message: APP_CONSTANTS.message.profile_not_found,
          responseCode: APP_CONSTANTS.code.status_notfound_code
        };
      }

      const profile = userProfileResp.profile;
      const isMobileVerified = profile?.user?.is_mobile_verification;
      const isActive = profile?.user?.is_active
      
      if (!isMobileVerified || !isActive) {
        return {
          status: false,
          message: APP_CONSTANTS.message.verification,
          responseCode: APP_CONSTANTS.code.status_badrequest_code
        };
      }

      const result = await this.profileRepository.findMatchingExternal(profile);

      return {
        status: result.success,
        message: APP_CONSTANTS.message.match_successful,
        data: result.data || null,
        responseCode: APP_CONSTANTS.code.status_success_code
      };

    } catch (err: any) {
      return {
        status: false,
        message: err.message,
        responseCode: APP_CONSTANTS.code.status_internal_server
      };
    }
  };

  completeProfilePrecent = async (req: any) => {
    try {
      const user_id = req.body.user_id;

      if (!user_id) {
        return {
          message: APP_CONSTANTS.message.unauthorized_user,
          status: false,
          responseCode: APP_CONSTANTS.code.status_unauthorize_code
        };
      }

      const user = await this.profileRepository.findUserByIdWithAllRelations(user_id);
      if (!user.success || !user.user) {
        return {
          message: APP_CONSTANTS.message.user_not_found,
          status: false,
          responseCode: APP_CONSTANTS.code.status_notfound_code
        };
      }

      const profile = user.user.profile;
      const preference = user.user.preference;
      const location = user.user.userLocation;
      const images: UserImage[] = user.user.images || [];

      const WEIGHTS = {
        mandatory: 20,
        preference: 5,
        verification: 30,
        other: 25,
        images: 20
      };

      let mandatoryScore = 0;
      let preferenceScore = 0;
      let verificationScore = 0;
      let otherScore = 0;
      let imagesScore = 0;

      const missed_fields: string[] = [];

      const mandatoryFields = [
        { key: PROFILE_FIELDS.MANDATORY.FIRST_NAME, value: profile?.first_name },
        { key: PROFILE_FIELDS.MANDATORY.LAST_NAME, value: profile?.last_name },
        { key: PROFILE_FIELDS.MANDATORY.DOB, value: profile?.dob },
        { key: PROFILE_FIELDS.MANDATORY.GENDER, value: profile?.gender },
        { key: PROFILE_FIELDS.MANDATORY.LOCATION, value: location },
        { key: PROFILE_FIELDS.MANDATORY.PROFILE_IMAGE, value: images.some(img => img.is_profile_pic === true) }
      ];

      let mandatoryFilled = 0;
      mandatoryFields.forEach(field => {
        const filled = isFieldFilled(field.value);
        if (filled) mandatoryFilled++;
        else missed_fields.push(field.key);
      });

      mandatoryScore = calculateScore(mandatoryFilled, mandatoryFields.length, WEIGHTS.mandatory);

      const prefFields = [
        PROFILE_FIELDS.PREFERENCES.GENDER,
        PROFILE_FIELDS.PREFERENCES.AGE_MIN,
        PROFILE_FIELDS.PREFERENCES.AGE_MAX,
        PROFILE_FIELDS.PREFERENCES.LOCATION_RADIUS_KM,
        PROFILE_FIELDS.PREFERENCES.LANGUAGES,
        PROFILE_FIELDS.PREFERENCES.HEIGHT_MIN_CM,
        PROFILE_FIELDS.PREFERENCES.HEIGHT_MAX_CM,
        PROFILE_FIELDS.PREFERENCES.RELIGION,
        PROFILE_FIELDS.PREFERENCES.EDUCATION_LEVEL,
        PROFILE_FIELDS.PREFERENCES.ETHNICITY,
      ];

      let prefFilled = 0;
      prefFields.forEach(field => {
        const val = (preference as any)?.[field];
        if (isFieldFilled(val)) prefFilled++;
        else missed_fields.push(`preference_${field}`);
      });

      preferenceScore = prefFields.length > 0
        ? calculateScore(prefFilled, prefFields.length, WEIGHTS.preference)
        : 0;

      const isPhoneVerified = user.user.is_verified === true;
      const isProfileVerified = user.user.is_verified === true;

      if (isPhoneVerified && isProfileVerified) {
        verificationScore = WEIGHTS.verification;
      } else if (isPhoneVerified || isProfileVerified) {
        verificationScore = WEIGHTS.verification * 0.5;
      } else {
        verificationScore = 0;
        missed_fields.push(PROFILE_FIELDS.VERIFICATION.PHONE_VERIFICATION);
        missed_fields.push(PROFILE_FIELDS.VERIFICATION.PROFILE_VERIFICATION);
      }

      const otherFields = [
        PROFILE_FIELDS.OPTIONAL.EDUCATION,
        PROFILE_FIELDS.OPTIONAL.WORK_PLACE,
        PROFILE_FIELDS.OPTIONAL.JOB_TITLE,
        PROFILE_FIELDS.OPTIONAL.ORIENTATION,
        PROFILE_FIELDS.OPTIONAL.RELATIONSHIP_TYPE,
        PROFILE_FIELDS.OPTIONAL.LOOKING_FOR_GENDER,
        PROFILE_FIELDS.OPTIONAL.LOOKING_FOR_INTENTION,
        PROFILE_FIELDS.OPTIONAL.ETHNICITY,
        PROFILE_FIELDS.OPTIONAL.HOMETOWN,
        PROFILE_FIELDS.OPTIONAL.POLITICAL_BELIEFS,
        PROFILE_FIELDS.OPTIONAL.DRINK,
        PROFILE_FIELDS.OPTIONAL.SMOKE,
        PROFILE_FIELDS.OPTIONAL.HOBBIES,
        PROFILE_FIELDS.OPTIONAL.INTERESTS,
        PROFILE_FIELDS.OPTIONAL.LANGUAGES,
        PROFILE_FIELDS.OPTIONAL.EDUCATION_LEVEL,
      ];

      let otherFilled = 0;
      otherFields.forEach(field => {
        const val = (profile as any)?.[field];
        if (isFieldFilled(val)) otherFilled++;
        else missed_fields.push(`optional_${field}`);
      });

      otherScore = otherFields.length > 0
        ? calculateScore(otherFilled, otherFields.length, WEIGHTS.other)
        : 0;

      // Images
      const profileImagesCount = images.filter(img => img.is_profile_pic == false).length;
      const maxProfileImages = 3;
      const bonusImages = Math.min(profileImagesCount, maxProfileImages);
      imagesScore = Number(((bonusImages / maxProfileImages) * WEIGHTS.images).toFixed(2));

      if (bonusImages < maxProfileImages) {
        missed_fields.push(`add_${maxProfileImages - bonusImages}_more_images`);
      }

      const totalPercent = Math.round(
        mandatoryScore +
        preferenceScore +
        verificationScore +
        otherScore +
        imagesScore
      );

      return {
        completion_percent: Math.min(100, totalPercent),
        breakdown: {
          mandatory: Number(mandatoryScore.toFixed(2)),
          preference: Number(preferenceScore.toFixed(2)),
          verification: Number(verificationScore.toFixed(2)),
          other: Number(otherScore.toFixed(2)),
          images: Number(imagesScore.toFixed(2))
        },
        details: {
          totalImages: bonusImages,
          isPhoneVerified,
          isProfileVerified,
          mandatoryCompleted: mandatoryFilled + "/6",
          preferencesCompleted: prefFilled + "/" + prefFields.length,
          otherFieldsCompleted: otherFilled + "/" + otherFields.length
        },
        missed_fields,
        status: true,
        message: APP_CONSTANTS.message.user_fetched,
        responseCode: APP_CONSTANTS.code.status_success_code
      };

    } catch (error : any) {
      return {
        message: error.message || APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server
      };
    }
  }

 deleteProfile = async (req: any) => {
  try {
    const userId = req?.params?.id;

    if (!userId) {
      return {
        message: APP_CONSTANTS.message.unauthorized_user,
        status: false,
        responseCode: APP_CONSTANTS.code.status_unauthorize_code,
      };
    }

    const  user  = await this.userRepository.findUserbyID(userId);

    if (!user) {
      return {
        message: APP_CONSTANTS.message.user_not_found,
        status: false,
        responseCode: APP_CONSTANTS.code.status_notfound_code,
      };
    }

    const deleteResult = await this.profileRepository.softDeleteProfileAndUser(userId);

    if (!deleteResult.success) {
      return {
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server,
      };
    }

    return {
      message: APP_CONSTANTS.message.account_del,
      status: true,
      responseCode: APP_CONSTANTS.code.status_success_code,
    };
  } catch (error: any) {
    this.logger.error(error.message || error);
    return {
      message: APP_CONSTANTS.message.something_went_wrong,
      status: false,
      responseCode: APP_CONSTANTS.code.status_internal_server,
    };
  }
};


}

