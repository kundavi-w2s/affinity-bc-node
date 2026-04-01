import { Request, Response } from 'express';
import { sequelize } from '../../config/database';
import LikeRepository from '../../repositories/mobile/like.repository';
import { UserRepository } from '../../repositories/mobile/users.repository';
import { ProfileRepository } from '../../repositories/mobile/profile.repository';
import { APP_CONSTANTS, DEFAULT_CONFIG } from '../../utils/constants';
import { validateLikeProfileRequest, validateRespondToLikeRequest } from '../../utils/validation';
import { validateRequired, errorResponse, successResponse, validateRepositoryResult } from '../../utils/helper';
import { SendNotification } from '../../utils/notification';
import { notificationRepository } from '../../repositories/mobile/notification.repository';
import { getSocket } from '../../utils/socket';

export default class LikeService {
  private userRepository: UserRepository;
  private likeRepository: LikeRepository;
  private profileRepository: ProfileRepository;
  private notificationRepository: notificationRepository

  constructor() {
    this.userRepository = new UserRepository();
    this.likeRepository = new LikeRepository();
    this.profileRepository = new ProfileRepository();
    this.notificationRepository = new notificationRepository
  }

  async likeProfile(req: Request, res: Response): Promise<any> {
    const userId = req.userId as number;
    const { likedId } = req.body;

    const validationResult = validateLikeProfileRequest(userId, likedId);
    if (!validationResult.success) return validationResult;

    const transaction = await sequelize.transaction();

    try {
      const userExistsResult = await this.userRepository.findById(likedId);
      if (!userExistsResult.success || !userExistsResult.user) {
        await transaction.rollback();
        return errorResponse(APP_CONSTANTS.message.liked_user_not_found, 404);
      }

      if (userId === likedId) {
        await transaction.rollback();
        return errorResponse(APP_CONSTANTS.message.self_like, APP_CONSTANTS.code.status_badrequest_code);
      }

      const senderDetail = await this.userRepository.findById(userId);
      const senderName = senderDetail?.user?.profile?.first_name || DEFAULT_CONFIG.SOMEONE;

      const alreadyLikedResult = await this.likeRepository.checkIfAlreadyLiked(userId, likedId);
      if (alreadyLikedResult.data) {
        await transaction.rollback();
        return successResponse({ message: APP_CONSTANTS.message.already_liked });
      }

      const createLikeResult = await this.likeRepository.createLike(userId, likedId, transaction);
      const createError = await validateRepositoryResult(createLikeResult, transaction);
      if (createError) return createError;

      const notificationMessage = `${senderName} liked your profile`;
      const sendNotify = new SendNotification();
      await sendNotify.saveNotifcation(userId, likedId, notificationMessage);

      let senderImage: any = null;
      const imageResult = await this.profileRepository.getUserProfileImage(userId);
      if (imageResult?.success && imageResult?.data?.image_url) {
        const { status, data } = await this.profileRepository.getSignedImageUrl(imageResult.data.image_url);
        if (status) {
          senderImage = data;
        }
      }

      const userToken: any = await this.notificationRepository.getUserById(likedId);
      if (userToken?.device_token) {
        await sendNotify.sendpushNotification(userToken.device_token, {
          title: DEFAULT_CONFIG.NEW_LIKE,
          body: notificationMessage,
        },
      );
      }

      const hasPendingLikeResult = await this.likeRepository.hasPendingLikeFrom(likedId, userId);
      const mutualError = await validateRepositoryResult(hasPendingLikeResult, transaction);
      if (mutualError) return mutualError;

      if (hasPendingLikeResult.data) {
        const createMatchResult = await this.likeRepository.createMatch(userId, likedId, transaction);
        const matchError = await validateRepositoryResult(createMatchResult, transaction);
        if (matchError) return matchError;

        await transaction.commit();
        const io = getSocket();
        if (io) {
          io.emit(APP_CONSTANTS.socket_fields.matchCreated, { userId, likedId });
        }

        return successResponse({
          message: APP_CONSTANTS.message.match_successful,
          matched: true,
        });
      }

      await transaction.commit();
      const io = getSocket();
      if (io) {
        io.emit(APP_CONSTANTS.socket_fields.likeCreated, { userId, likedId });
      }
      return successResponse({
        message: APP_CONSTANTS.message.you_liked_this_profile,
        matched: false,
      });

    } catch (error: any) {
      await transaction.rollback();
      console.error(APP_CONSTANTS.error.like_con, error);
      return errorResponse(APP_CONSTANTS.message.something_went_wrong, APP_CONSTANTS.code.status_internal_server);
    }
  }

  async respondToLike(req: Request, res: Response): Promise<any> {
    const userId = req.userId;
    const { likedId, action } = req.body;

    if (!userId) return errorResponse(APP_CONSTANTS.message.unauthorized, APP_CONSTANTS.code.status_unauthorize_code);

    const validationError = validateRespondToLikeRequest(userId, likedId, action);
    if (validationError) return validationError;

    const transaction = await sequelize.transaction();

    try {
      const hasPendingLikeResult = await this.likeRepository.hasPendingLikeFrom(likedId, userId);

      const repoError = await validateRepositoryResult(hasPendingLikeResult, transaction);
      if (repoError) return repoError;

      if (!hasPendingLikeResult.data) {
        await transaction.rollback();
        return errorResponse(APP_CONSTANTS.message.no_like_request_found, 404);
      }

      if (action === APP_CONSTANTS.action.reject) {
        const rejectResult = await this.likeRepository.rejectLike(userId, likedId, transaction);
        const rejectError = await validateRepositoryResult(rejectResult, transaction);
        if (rejectError) return rejectError;

        await transaction.commit();
        return successResponse({ message: APP_CONSTANTS.message.request_declined });
      }

      const createMatchResult = await this.likeRepository.createMatch(likedId, userId, transaction);
      const matchError = await validateRepositoryResult(createMatchResult, transaction);
      if (matchError) return matchError;

      const senderDetail = await this.userRepository.findById(userId);
      const senderName = senderDetail?.user?.profile?.first_name || DEFAULT_CONFIG.SOMEONE;
      const notificationMessage = `${senderName} accepted your connection`;
      const sendNotify = new SendNotification();
      await sendNotify.saveNotifcation(userId, likedId, notificationMessage);

      let senderImage: any = null;
      const imageResult = await this.profileRepository.getUserProfileImage(userId);
      if (imageResult?.success && imageResult?.data?.image_url) {
        const { status, data } = await this.profileRepository.getSignedImageUrl(imageResult.data.image_url);
        if (status) {
          senderImage = data;
        }
      }

      const userToken: any = await this.notificationRepository.getUserById(likedId);
      if (userToken?.device_token) {
        await sendNotify.sendpushNotification(userToken.device_token, {
          title: DEFAULT_CONFIG.CONNECTION_ACCEPTED,
          body: notificationMessage,
          image: senderImage || null,
        });
      }

      await transaction.commit();
      return successResponse({
        message: APP_CONSTANTS.message.match_successful,
        matched: true,
      });

    } catch (error: any) {
      await transaction.rollback();
      console.error(APP_CONSTANTS.error.respond_con, error);
      return errorResponse(APP_CONSTANTS.message.something_went_wrong, APP_CONSTANTS.code.status_internal_server);
    }
  }

  async getRequestProfiles(req: Request, res: Response): Promise<any> {
    const userId = req.userId as number;

    const userError = validateRequired(userId, APP_CONSTANTS.message.unauthorized, 401);
    if (userError) {
      return userError;
    }

    try {
      const result = await this.likeRepository.getProfilesWhoLikedMe(
        userId,
      );

      const repositoryError = await validateRepositoryResult(result);
      if (repositoryError) {
        return repositoryError;
      }

      return successResponse(result);

    } catch (error) {
      return errorResponse(APP_CONSTANTS.message.something_went_wrong, 500);
    }
  }

   async getlikedProfile(req: Request, res: Response): Promise<any> {
    const userId = req.userId as number;

    const userError = validateRequired(userId, APP_CONSTANTS.message.unauthorized, 401);
    if (userError) {
      return userError;
    }

    try {
      const result = await this.likeRepository.getProfileslikedByme(
        userId,
      );

      const repositoryError = await validateRepositoryResult(result);
      if (repositoryError) {
        return repositoryError;
      }

      return successResponse(result);

    } catch (error) {
      return errorResponse(APP_CONSTANTS.message.something_went_wrong, 500);
    }
  }


  async dislikeProfile(req: Request, res: Response): Promise<any> {
    const userId = req.userId;
    const { dislikedId } = req.body;

    const validationResult = validateLikeProfileRequest(userId, dislikedId);
    if (!validationResult.success) {
      return validationResult;
    }

    const transaction = await sequelize.transaction();
    try {
      const userExistsResult = await this.userRepository.findById(dislikedId);
      if (!userExistsResult.success || !userExistsResult.user) {
        await transaction.rollback();
        return errorResponse(APP_CONSTANTS.message.disliked_user_not_found, 404);
      }

      const alreadyDislikedResult = await this.profileRepository.checkIfAlreadyDisliked(userId as number, dislikedId);

      const dislikeError = await validateRepositoryResult(alreadyDislikedResult, transaction);
      if (dislikeError) {
        return dislikeError;
      }

      if (alreadyDislikedResult.data) {
        await transaction.rollback();
        return successResponse({ message: APP_CONSTANTS.message.already_disliked });
      }

      const createDislikeResult = await this.likeRepository.dislikeProfile(userId as number, dislikedId, transaction);

      const createError = await validateRepositoryResult(createDislikeResult, transaction);
      if (createError) {
        return createError;
      }

      await transaction.commit();
      return successResponse({ message: APP_CONSTANTS.message.you_disliked_this_profile });

    } catch (error) {
      await transaction.rollback();
      return errorResponse(APP_CONSTANTS.message.something_went_wrong, APP_CONSTANTS.code.status_internal_server);
    }
  }

}