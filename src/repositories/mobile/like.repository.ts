import { Transaction } from 'sequelize';
import LikedProfile from '../../models/liked_profile';
import { APP_CONSTANTS,USER_EXTRA_FIELDS } from '../../utils/constants';
import ChatHistory from '../../models/chat_history';
import { generateChannelId } from '../../utils/helper'
import { ChatRepository } from './chat.repository';

export default class LikeRepository {
  private chatRepository: ChatRepository;

  constructor() {
    this.chatRepository = new ChatRepository();
  }


  async checkIfAlreadyLiked(userProfileId: number, likedProfileId: number) {
    try {
      const like = await LikedProfile.findOne({
        where: {
          user_profile_id: userProfileId,
          liked_profile_id: likedProfileId,
        },
      });
      return { success: true, data: like };
    } catch (error) {
      return {
        success: false,
        message: APP_CONSTANTS.message.error_in_findLikedprofiles,
        responseCode: APP_CONSTANTS.code.status_internal_server,
        error
      };
    }
  }


  async createLike(userProfileId: number, likedProfileId: number, transaction?: Transaction) {
    try {
      const like = await LikedProfile.create(
        {
          userProfileId,
          likedProfileId,
          status: APP_CONSTANTS.action.pending,
        },
        { transaction }
      );
      return { success: true, data: like };
    } catch (error) {
      return {
        success: false,
        message: APP_CONSTANTS.message.error_in_likeProfile,
        responseCode: APP_CONSTANTS.code.status_internal_server,
        error
      };
    }
  }

  async createMatch(
    profileId1: number,
    profileId2: number,
    transaction?: Transaction
  ) {
    try {
      await LikedProfile.update(
        { status: APP_CONSTANTS.action.accepted },
        {
          where: {
            user_profile_id: profileId1,
            liked_profile_id: profileId2,
          },
          transaction,
        }
      );

      const channel_id = generateChannelId();

      await ChatHistory.create(
        {
          channel_id,
          sender_id: profileId1,
          receiver_id: profileId2,
          chat_message: null,
          is_read: true,
        },
        { transaction }
      );

      return {
        success: true,
        data: { channel_id },
      };

    } catch (error) {
      return {
        success: false,
        message: APP_CONSTANTS.message.error_in_createMatch,
        responseCode: APP_CONSTANTS.code.status_internal_server,
        error
      };
    }
  }

  async rejectLike(userProfileId: number, likedProfileId: number, transaction?: Transaction) {
    try {
      await LikedProfile.destroy({
        where: {
          user_profile_id: likedProfileId,
          liked_profile_id: userProfileId,
        },
        transaction,
      });

      return { success: true, data: true };
    } catch (error) {
      return {
        success: false,
        message: APP_CONSTANTS.message.error_in_rejectLike,
        responseCode: APP_CONSTANTS.code.status_internal_server,
        error
      };
    }
  }

  async getProfilesWhoLikedMe(userProfileId: number) {
    try {
      const requests = await LikedProfile.findAll({
        where: {
          liked_profile_id: userProfileId,
          status: APP_CONSTANTS.action.pending,
        },
        attributes: [USER_EXTRA_FIELDS.USER_PROFILE_ID, USER_EXTRA_FIELDS.STATUS, USER_EXTRA_FIELDS.CREATED_AT],
        order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
      });

      const requestsWithDetails = [];
      for (const request of requests) {
        const requestData = request.toJSON();
        const partnerDetails = await this.chatRepository.getPartnerDetails(requestData.user_profile_id);
        
        requestsWithDetails.push({
          ...requestData,
          partner_details: partnerDetails.data
        });
      }

      const totalRequests = requestsWithDetails.length;

      return {
        success: true,
        count: totalRequests,
        data: requestsWithDetails
      };

    } catch (error) {
      return {
        success: false,
        message: APP_CONSTANTS.message.error_in_getrequestProfiles,
        responseCode: APP_CONSTANTS.code.status_internal_server,
        error
      };
    }
  }

async getProfileslikedByme(userProfileId: number) {
  try {
    const likedProfiles = await LikedProfile.findAll({
      where: {
        user_profile_id: userProfileId,
        status: APP_CONSTANTS.action.pending,
      },
      attributes: [
        USER_EXTRA_FIELDS.USER_PROFILE_ID,
        USER_EXTRA_FIELDS.LIKED_PROFILE_ID,
        USER_EXTRA_FIELDS.STATUS,
        USER_EXTRA_FIELDS.CREATED_AT,
      ],
      order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
    });

    const likedProfilesWithDetails = await Promise.all(
      likedProfiles.map(async (profile) => {
        const profileData = profile.toJSON();

        // Fetch both user details
        const [partnerDetails] = await Promise.all([
          this.chatRepository.getPartnerDetails(profileData.liked_profile_id),
        ]);

        return {
          ...profileData,
          partner_details: partnerDetails?.data || null,
        };
      })
    );

    return {
      success: true,
      count: likedProfilesWithDetails.length,
      data: likedProfilesWithDetails,
    };

  } catch (error) {
    return {
      success: false,
      message: APP_CONSTANTS.message.error_in_findLikedprofiles,
      responseCode: APP_CONSTANTS.code.status_internal_server,
      error,
    };
  }
}

  async dislikeProfile(userProfileId: number, dislikedProfileId: number, transaction?: Transaction) {
    try {
      const dislike = await LikedProfile.create(
        {
          userProfileId,
          likedProfileId: dislikedProfileId,
          status: APP_CONSTANTS.action.disliked,
        },
        { transaction }
      );
      return { success: true, data: dislike };
    } catch (error) {
      return {
        success: false,
        message: APP_CONSTANTS.message.error_in_dislikeProfile,
        responseCode: APP_CONSTANTS.code.status_internal_server,
        error
      };
    }
  }

  async hasPendingLikeFrom(fromUserId: number, toUserId: number) {
  try {
    const like = await LikedProfile.findOne({
      where: {
        user_profile_id: fromUserId,
        liked_profile_id: toUserId,
        status: APP_CONSTANTS.action.pending, 
      },
    });
    return { success: true, data: !!like };
  } catch (error) {
    return {
      success: false,
      message: APP_CONSTANTS.message.error_in_findLikedprofiles,
      responseCode: APP_CONSTANTS.code.status_internal_server,
      error,
    };
  }
}

}