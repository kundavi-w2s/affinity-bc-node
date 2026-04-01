import { APP_CONSTANTS, DEFAULT_CONFIG, MAX_FILE_SIZE } from "../../utils/constants";
import { APILogger } from "../../utils/logger";
import { UserRepository } from "../../repositories/mobile/users.repository";
import { EmailSender } from '../../utils/emailSender';
import { upload } from "../../utils/fileupload";
import { generateUniqueFileName } from "../../utils/generateUniqueFileName";
import { generateOTP,checkUserDeletionStatus } from "../../utils/helper";
import { decryptPassword, encryptPassword, generateJWT } from "../../utils/password_convertion";
import { infoRepository } from "../../repositories/mobile/info.repository";
import { getSocket } from "../../utils/socket";
import { sendOtpViaGupshupSMS } from "./gupshup.service";
import UserProfile from "../../models/user_profile";
import UserImage from "../../models/image_master";
import { ProfileRepository } from "../../repositories/mobile/profile.repository";
import { getSignedUrl } from "../../utils/formatImage";
import {FaceVerificationService} from '../../utils/faceVerification';
import { AppCheck } from "firebase-admin/lib/app-check/app-check";



export class UsersService {
  private logger: APILogger;
  private userRepository: UserRepository;
  private emailSender: EmailSender;
  private upload: upload;
  private encryptionKey: string;
  private jwtSecret: string;
  private jwtExpiry: string;
  private refreshSecret: string;
  private jwtExpiry_refresh: string;
  public infoRepository: infoRepository;
  private profileRepository: ProfileRepository;


  constructor() {
    this.logger = new APILogger();
    this.userRepository = new UserRepository();
    this.upload = new upload();
    this.emailSender = new EmailSender();
    this.encryptionKey = process.env.CRYPTO_SECRET_KEY || DEFAULT_CONFIG.ENCRYPT_KEY;
    this.jwtSecret = process.env.JWT_SECRET || DEFAULT_CONFIG.JWT_SECRET;
    this.jwtExpiry = process.env.JWT_EXPIRY || DEFAULT_CONFIG.EXPIRY_TIME;

    this.jwtExpiry_refresh = process.env.REFRESH_EXPIRY || DEFAULT_CONFIG.REFRESH_EXPIRY;
    this.refreshSecret = process.env.REFRESH_SECRET || DEFAULT_CONFIG.REFRESH_SECRET;
    
    this.infoRepository = new infoRepository();
    this.profileRepository = new ProfileRepository();
  }

  register = async (req: any) => {
  try {
    const { email, phone_number, country_code, password } = req.body;
    const payload = { email, phone_number, country_code };
    const passwordHash = encryptPassword(password, this.encryptionKey);

    const isEmailRegister = !!email;

    const existing = isEmailRegister
      ? await this.userRepository.findByEmail(email)
      : await this.userRepository.findByPhone(phone_number, country_code);

    if (!existing.success) {
      return {
        status: false,
        message: APP_CONSTANTS.message.database_user_check_error,
        responseCode: APP_CONSTANTS.code.status_internal_server,
        error: APP_CONSTANTS.message.failed_create_user,
      };
    }

    if (existing.user) {
      const deletionStatus = checkUserDeletionStatus(existing.user);

      if (!deletionStatus.allow) {
        return {
          status: false,
          message: deletionStatus.message,
          responseCode: APP_CONSTANTS.code.status_internal_server,
        };
      }

      if (!existing.user.is_deleted) {
        return {
          status: false,
          message: isEmailRegister
            ? APP_CONSTANTS.message.email_exist
            : APP_CONSTANTS.message.exist_user_check,
          responseCode: APP_CONSTANTS.code.status_exist_code,
        };
      }
    }

    const userData = isEmailRegister
      ? { email, password_hash: passwordHash }
      : { phone_number, country_code, password_hash: passwordHash };

    const createRes = await this.userRepository.createUser(userData);

    if (!createRes.success) {
      return {
        status: false,
        message: createRes.message || APP_CONSTANTS.message.failed_create_user,
        responseCode: APP_CONSTANTS.code.status_internal_server,
        payload,
      };
    }

    const createdUser = createRes.user;

    // Emit socket event for dashboard update
    const io = getSocket();
    if (io) {
      io.emit(APP_CONSTANTS.socket_fields.userCreated, { userId: createdUser.id, email: createdUser.email, phone_number: createdUser.phone_number });
    }

    return {
      status: true,
      message: APP_CONSTANTS.message.registeration_success,
      responseCode: APP_CONSTANTS.code.status_success_code,
      payload,
      data: {
        user: {
          id: createdUser.id,
          email: createdUser.email,
          phone_number: createdUser.phone_number,
          country_code: createdUser.country_code,
          device_token: createdUser.device_token,
          device_type: createdUser.device_type,
        },
      },
    };

  } catch (error: any) {
    return {
      status: false,
      message: APP_CONSTANTS.message.register_user_failed,
      responseCode: APP_CONSTANTS.code.status_internal_server,
      payload: req.body,
    };
  }
};



  signIn = async (req: any) => {
  try {
    const { email, phone_number, country_code, password, device_token, device_type } = req.body;
    let user: any;
    let tokenPayload: any;
    let is_profile_completed: boolean;

    if (email && password) {
      const result = await this.userRepository.findUserWithProfile(email, undefined, undefined);
      if (!result.success || !result.user) {
        return {
          status: false,
          message: APP_CONSTANTS.message.email_not_register,
          responseCode: APP_CONSTANTS.code.status_notdatafound_code
        };
      }
      user = result.user;
      is_profile_completed = result.is_profile_completed || false;
      tokenPayload = { id: user.id, email };
    } else if (phone_number && country_code && password) {
      const result = await this.userRepository.findUserWithProfile(undefined, phone_number, country_code);
      if (!result.success || !result.user) {
        return {
          status: false,
          message: APP_CONSTANTS.message.user_not_found,
          responseCode: APP_CONSTANTS.code.status_notdatafound_code
        };
      }
      user = result.user;
      is_profile_completed = result.is_profile_completed || false;
      tokenPayload = { id: user.id, phone_number, country_code };
    } else {
      return {
        status: false,
        message: APP_CONSTANTS.message.signin_failed,
        responseCode: APP_CONSTANTS.code.status_badrequest_code
      };
    }

    if (user.is_deleted && user.deleted_by === APP_CONSTANTS.action.admin) {
      return {
        status: false,
        message: APP_CONSTANTS.message.admin_delete,
        responseCode: APP_CONSTANTS.code.status_unauthorize_code
      };
    }


    const decryptedPassword = decryptPassword(user.password_hash || '', this.encryptionKey);
    if (decryptedPassword !== password) {
      return {
        status: false,
        message: APP_CONSTANTS.message.invalid_credential,
        responseCode: APP_CONSTANTS.code.status_unauthorize_code
      };
    }

    if (user.is_deleted) {
      const now = new Date();
      const can_recreate_after = user.can_recreate_after ? new Date(user.can_recreate_after) : null;

      if (can_recreate_after && now >= can_recreate_after) {
        return {
          status: false,
          message: APP_CONSTANTS.message.account_permanently_deleted,
          responseCode: APP_CONSTANTS.code.status_notdatafound_code
        };
      }

      if (can_recreate_after && now < can_recreate_after) {
        await this.userRepository.updateUser(user.id, {
          is_deleted: false,
          can_recreate_after: null,
          deleted_at: null,
          is_active: true
        });
        user = await this.userRepository.findUserbyID(user.id);
      }
    }

    if (device_token || device_type) {
      await this.userRepository.updateUser(user.id, {
        device_token: device_token || user.device_token,
        device_type: device_type || user.device_type,
      });
      user = await this.userRepository.findUserbyID(user.id);
    }

   const token = generateJWT(tokenPayload, this.jwtSecret, this.jwtExpiry);

    const refresh_token = generateJWT(
      { id: user.id },
      this.refreshSecret,
      this.jwtExpiry_refresh
    );

    return {
      status: true,
      message: APP_CONSTANTS.message.login_success,
      data: {
        user: {
          id: user.id,
          email: user.email,
          phone_number: user.phone_number,
          country_code: user.country_code,
          is_profile_completed: is_profile_completed,
          device_token: user.device_token,
          device_type: user.device_type,
        },
        token,
        refresh_token
      },
      responseCode: APP_CONSTANTS.code.status_success_code
    };

  } catch (error: any) {
    return {
      message: APP_CONSTANTS.message.database_error,
      status: false,
      responseCode: APP_CONSTANTS.code.status_internal_server,
      error: error?.message || "Sign-in failed"
    };
  }
};

  refreshToken = async (req: any) => {
    try {
      const { refresh_token } = req.body;
      
      if (!refresh_token) {
        return {
          status: false,
          message: APP_CONSTANTS.message.token_required,
          responseCode: APP_CONSTANTS.code.status_badrequest_code
        };
      }

      const decoded: any = await new Promise((resolve, reject) => {
        const jwt = require('jsonwebtoken');
        jwt.verify(
          refresh_token,
          this.refreshSecret,
          (err: any, decoded: any) => {
            if (err) reject(err);
            else resolve(decoded);
          }
        );
      });

      const result = await this.userRepository.findUserbyID(decoded.id);
      if (!result || !result.id) {
        return {
          status: false,
          message: APP_CONSTANTS.message.user_not_found,
          responseCode: APP_CONSTANTS.code.status_notdatafound_code
        };
      }

      const user = result;

      if (user.is_deleted && user.deleted_by === APP_CONSTANTS.action.admin) {
        return {
          status: false,
          message: APP_CONSTANTS.message.admin_delete,
          responseCode: APP_CONSTANTS.code.status_unauthorize_code
        };
      }

      const tokenPayload = user.email 
        ? { id: user.id, email: user.email }
        : { id: user.id, phone_number: user.phone_number, country_code: user.country_code };

      const newToken = generateJWT(tokenPayload, this.jwtSecret, this.jwtExpiry);

      // Generate new refresh token
      const newRefreshToken = generateJWT(
        { id: user.id },
        this.refreshSecret,
        this.jwtExpiry_refresh
      );

      return {
        status: true,
        message: APP_CONSTANTS.message.token_refreshed,
        data: {
          token: newToken,
          refresh_token: newRefreshToken,
          user: {
            id: user.id,
            email: user.email,
            phone_number: user.phone_number,
            country_code: user.country_code,
            device_token: user.device_token,
            device_type: user.device_type,
          }
        },
        responseCode: APP_CONSTANTS.code.status_success_code
      };
    } catch (error: any) {
      this.logger.error(APP_CONSTANTS.error.refreshToken_error, error);
      return {
        status: false,
        message: APP_CONSTANTS.message.invalid_token,
        responseCode: APP_CONSTANTS.code.status_unauthorize_code,
        error: error?.message || APP_CONSTANTS.message.refresh_failed
      };
    }
  };


forgotPassword = async (req: any) => {
  try {
    const { email, phone_number, country_code, is_mobile_verification = false, id } = req.body;
    let user: any;

    if (is_mobile_verification && id) {

      const result = await this.userRepository.findById(id);
      if (!result.success || !result.user) {
        return {
          status: false,
          message: APP_CONSTANTS.message.user_not_found,
          responseCode: APP_CONSTANTS.code.status_notdatafound_code
        };
      }

      user = result.user;

      if (user.is_mobile_verification === true) {
        return {
          status: false,
          message: APP_CONSTANTS.message.already_Verified,
          responseCode: APP_CONSTANTS.code.status_badrequest_code
        };
      }

      if (phone_number && country_code) {

        if (user.phone_number && user.phone_number !== phone_number && user.is_mobile_verification === true) {
          return {
            status: false,
            message: APP_CONSTANTS.message.dont_verify_mobile,
            responseCode: APP_CONSTANTS.code.status_badrequest_code
          };
        }

        const phoneResult = await this.userRepository.findByPhone(phone_number, country_code);
        if (phoneResult.success && phoneResult.user && phoneResult.user.id !== id) {

          return {
            status: false,
            message: APP_CONSTANTS.message.phone_number_already_registered,
            responseCode: APP_CONSTANTS.code.status_exist_code
          };
        }

        if (!user.phone_number) {
          await this.userRepository.updateUser(id, {
            phone_number,
            country_code
          });
          user = await this.userRepository.findUserbyID(id);
        }
      }
    }

    
    else if (email) {
      const result = await this.userRepository.findByEmail(email);
      if (!result.success || !result.user) {
        return {
          status: false,
          message: APP_CONSTANTS.message.email_not_register,
          responseCode: APP_CONSTANTS.code.status_notdatafound_code
        };
      }
      user = result.user;
    }

    else if (phone_number && country_code) {
      const result = await this.userRepository.findByPhone(phone_number, country_code);
      if (!result.success || !result.user) {
        return {
          status: false,
          message: APP_CONSTANTS.message.user_not_found,
          responseCode: APP_CONSTANTS.code.status_notdatafound_code
        };
      }
      user = result.user;
    }

   
    else {
      return {
        status: false,
        message: APP_CONSTANTS.message.invalid_request,
        responseCode: APP_CONSTANTS.code.status_badrequest_code
      };
    }

    // const otp = "123456"; 
    //generate dynamic otp
    const TEST_PHONE = "8098572635";
    const TEST_COUNTRY_CODE = "+91";

    const otp =
      phone_number === TEST_PHONE && country_code === TEST_COUNTRY_CODE
        ? "123456"
        : Math.floor(100000 + Math.random() * 900000).toString();
    // const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    user.otp = otp;
    user.otp_expires_at = expiresAt;

    await this.userRepository.updateUser(user.id, {
      otp,
      otp_expires_at: expiresAt
    });

    await user.save();
    const countryCode = country_code ? country_code.slice(1) : '';
    
    if (email && !phone_number) {
      await this.emailSender.sendEmail(user.email, "Password Reset/Verification", `Your OTP is ${otp}`);
    } else if (phone_number) {
            this.logger.info(`OTP ${otp} sent to ${countryCode}${phone_number}`);
      try {
        await sendOtpViaGupshupSMS(countryCode, phone_number, otp);
        
        this.logger.info(`OTP sent to ${countryCode}${phone_number}`);
      } catch (err) {
        this.logger.error(APP_CONSTANTS.message.gupshup_failed, err);
        return {
          status: false,
          message: APP_CONSTANTS.message.failed_to_send_otp,
          responseCode: APP_CONSTANTS.code.status_internal_server
        };
      }
    }

 
    return {
      status: true,
      message: APP_CONSTANTS.message.otp_sent,
      data: {
        userId: user.id,
        expires_at: expiresAt,
        is_verified: user.is_verified,
        is_mobile_verification: user.is_mobile_verification, 
        phone_number: user.phone_number,
        country_code: user.country_code
      },
      responseCode: APP_CONSTANTS.code.status_success_code
    };

  } catch (error) {
    console.error(error);
    return {
      status: false,
      message: APP_CONSTANTS.message.something_went_wrong,
      responseCode: APP_CONSTANTS.code.status_internal_server
    };
  }
};


  verifyOtp = async (req: any) => {
    try {
      const { otp, userId,is_mobile_verification } = req.body;
      const userRes = await this.userRepository.findById(userId);

      if (!userRes.success || !userRes.user) {
        return {
          status: false,
          message: APP_CONSTANTS.message.user_not_found,
          responseCode: APP_CONSTANTS.code.status_notfound_code
        };
      }

      const user = userRes.user;

      if (
        user.otp !== otp ||
        !user.otp_expires_at ||
        user.otp_expires_at < new Date()
      ) {
        return {
          status: false,
          message: APP_CONSTANTS.message.invalid_otp,
          responseCode: APP_CONSTANTS.code.status_badrequest_code
        };
      }

      user.otp = null;
      user.otp_expires_at = null;

      if (is_mobile_verification === true) {
        user.is_mobile_verification = true;
      } else {
        user.is_verified = true;
      }

      await user.save();

      return {
        status: true,
        message: APP_CONSTANTS.message.otp_verified,
        data: {
          userId: user.id,
          is_verified: user.is_verified,
          is_mobile_verification: user.is_mobile_verification
        },
        responseCode: APP_CONSTANTS.code.status_success_code
      };

    } catch (error) {
      return {
        status: false,
        message: APP_CONSTANTS.message.something_went_wrong,
        responseCode: APP_CONSTANTS.code.status_internal_server
      };
    }
  };



  resetPassword = async (req: any) => {
    try {
      const { new_password, userId } = req.body;
      const userRes = await this.userRepository.findById(userId);
      if (!userRes.success || !userRes.user) {
        return { message: APP_CONSTANTS.message.user_not_found, status: false, responseCode: APP_CONSTANTS.code.status_notdatafound_code };
      }

      const user = userRes.user;
      // Check if OTP was verified (is_verified flag set by verifyOtp)
      if (!user.is_verified) {
        return { message: APP_CONSTANTS.message.not_otp_verification, status: false, responseCode: APP_CONSTANTS.code.status_unauthorize_code };
      }

      const passwordHash = encryptPassword(new_password, this.encryptionKey);
      const updateRes = await this.userRepository.updatePassword(user.id, passwordHash);
      if (!updateRes.success) {
        return { message: updateRes.message, status: false, responseCode: APP_CONSTANTS.code.status_internal_server };
      }

      user.otp = null;
      user.otp_expires_at = null;
      user.is_verified = false;
      await user.save();

      return { status: true, message: APP_CONSTANTS.message.password_update, responseCode: APP_CONSTANTS.code.status_success_code };
    } catch (error: any) {
      return { message: APP_CONSTANTS.message.something_went_wrong, status: false, responseCode: APP_CONSTANTS.code.status_internal_server };
    }
  };

  uploadProfile = async (req: any) => {
  try {
    // For single file upload, use req.file (not req.files)
    const file = req.files[0];

    if (!file) {
      return {
        message: APP_CONSTANTS.message.no_file,
        status: false,
        responseCode: APP_CONSTANTS.code.status_badrequest_code,
      };
    }

    // Generate unique filename
    const filename = generateUniqueFileName(file.originalname, file.mimetype);

    // Upload the single file to your storage
    const uploadedUrl = await this.upload.singleFileUpload(filename, file);

    // Return single result object (not an array)
    return {
      result: [{
        image_url: uploadedUrl,
        file_name: `uploads/${filename}`,
      }],
      status: true,
      responseCode: APP_CONSTANTS.code.status_success_code,
    };
  } catch (error: any) {
    this.logger.error(`Upload profile error: ${error.message}`);
    return {
      message: APP_CONSTANTS.message.something_went_wrong,
      status: false,
      responseCode: APP_CONSTANTS.code.status_internal_server,
    };
  }
};

  helpSupport = async (req: any) => {
    try {
      const user_id = req.body.user_id || req.user.id;
      const issue_description = req.body.issue_description;
      const user_info = await this.userRepository.findUserbyID(user_id)
      if (user_info) {
        await this.infoRepository.helpAndsupport(user_id, issue_description)
        // Emit socket event for dashboard update
        const io = getSocket();
        if (io) {
          io.emit(APP_CONSTANTS.socket_fields.helpSupportCreated, { userId: user_id, issueDescription: issue_description });
        }
        return ({
          message: APP_CONSTANTS.message.helpandsupportmessage,
          status: true,
          responseCode: APP_CONSTANTS.code.status_success_code
        })
      }
      else {
        return ({
          message: APP_CONSTANTS.message.unauthorized_user,
          status: false,
          responseCode: APP_CONSTANTS.code.status_badrequest_code
        })
      }

    }
    catch (error) {
      return ({
        message: APP_CONSTANTS.message.something_went_wrong,
        status: false,
        responseCode: APP_CONSTANTS.code.status_internal_server
      })
    }
  }

  uploadProfileFaceVerify = async (req: any, userId: number) => {
    try {
      const faceVerificationService = new FaceVerificationService();

      // Get selfie file
      const selfieFile = req.files?.[0];
      if (!selfieFile) {
        return {
          status: false,
          message: APP_CONSTANTS.message.selfie_image,
          responseCode: APP_CONSTANTS.code.status_badrequest_code,
        };
      }

      // Generate unique filename for selfie
      const selfieFilename = generateUniqueFileName(selfieFile.originalname, selfieFile.mimetype);
      const selfileFilenameUpload = `uploads/${selfieFilename}`
      const selfieUrl = await this.upload.singleFileUpload(selfieFilename, selfieFile);

      const userProfileData = await this.profileRepository.findImageByUserId(userId);

      if (!userProfileData.success || !userProfileData.profile) {
        return {
          status: false,
          message: userProfileData.message || APP_CONSTANTS.message.profile_found,
          responseCode: APP_CONSTANTS.code.status_badrequest_code,
        };
      }

      const userProfile = userProfileData.profile;

      // Get profile image URLs
      const profileImages = userProfile.profile_images || [];
      const imageUrls = (userProfile.images || []).map((img: any) => img.image_url);
      
      // Combine both sources of URLs
      const allUploadedUrls = [...new Set([...profileImages, ...imageUrls])].filter(url => url);

      if (allUploadedUrls.length === 0) {
        return {
          status: false,
          message: APP_CONSTANTS.message.image_not_found,
          responseCode: APP_CONSTANTS.code.status_badrequest_code,
        };
      }

      // Format all image URLs to get full URLs using getSignedUrl
      const formattedImageUrls = await Promise.all(
        allUploadedUrls.map(async (img: string) => {
          const { status, data } = await getSignedUrl(img);
          return status ? data : img;
        })
      );

      // Call external face verification API
      // selfieUrl is already formatted from singleFileUpload
      const verificationResult = await faceVerificationService.verifyFace(
        selfieUrl,
        formattedImageUrls
      );

      if (!verificationResult.success) {
        return {
          status: false,
          message: verificationResult.message || APP_CONSTANTS.message.face_verification_failed,
          responseCode: APP_CONSTANTS.code.status_badrequest_code,
        };
      }

      const verificationData = Array.isArray(verificationResult.data) ? verificationResult.data[0] : verificationResult.data;
      const matchPercentage = verificationData?.match_percentage || 0;
      const isImageVerified = matchPercentage > 85;

      // Update user profile with verification status using repository
      const updateResult = await this.profileRepository.updateProfileImageVerification(userId, isImageVerified);
      
      if (!updateResult.success || !updateResult.profile) {
        return {
          status: false,
          message: updateResult.message || APP_CONSTANTS.message.failed_to_update,
          responseCode: APP_CONSTANTS.code.status_internal_server,
        };
      }

      // Return verification result
      return {
        status: true,
        message: isImageVerified ? APP_CONSTANTS.message.face_verification_success : APP_CONSTANTS.message.face_verify_score,
        data: {
          selfie_url: selfieUrl,
          verification_result: verificationResult.data,
          is_image_verified: updateResult.profile.is_image_verified || false,
          match_percentage: matchPercentage,
        },
        responseCode: APP_CONSTANTS.code.status_success_code,
      };
    } catch (error: any) {
      this.logger.error(`Face verification error: ${error.message}`);
      return {
        status: false,
        message: APP_CONSTANTS.message.something_went_wrong,
        responseCode: APP_CONSTANTS.code.status_internal_server,
        error: error.message,
      };
    }
  };

}