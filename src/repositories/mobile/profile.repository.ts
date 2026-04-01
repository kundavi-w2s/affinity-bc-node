import UserImage from '../../models/image_master';
import UserProfile from '../../models/user_profile';
import UserLocation from '../../models/user_location';
import Preference from '../../models/user_preference';
import User from '../../models/user';
import { APP_CONSTANTS, UPSERT_MATCH_MAKING, RADAR_FIND_MATCH, USERLOCATION, FILTER_MATCH_CHECK,USERIMAGE,ADMIN_FIELDS, twoWeeks,GEMINI_API_ERROR_CHECK, PROFILE_FIELDS } from '../../utils/constants';
import { generateProfileId, calculateAge, buildPreferenceString } from '../../utils/helper';
import { getSignedUrl } from '../../utils/formatImage';
import axios from 'axios';
import LikedProfile from '../../models/liked_profile';
import ReportUser from '../../models/report_user';
import BlockedUser from '../../models/blocked_user';
import UserPreference from '../../models/user_preference';
import { Op } from 'sequelize';
import { app } from 'firebase-admin';

export interface ExternalProfilePayload {
  profile_id: string;
  email: string;
  phone_number: number;
  country_code: string;
  name: string;
  age: number;
  location: string;
  preferences: string;
  about_me: string;
  gender: string;
  orientation: string;
  relationship_type: string;
}

export interface ProfileResponseData {
  success: boolean;
  profile?: any;
  message?: string;
}

export class ProfileRepository {
 private sortImagesByOrderIndex(profile: any): void {
  if (!Array.isArray(profile.images) || profile.images.length === 0) {
    return;
  }

  profile.images.sort((a: any, b: any) => {
    return (a.order_index ?? Number.MAX_SAFE_INTEGER) -
           (b.order_index ?? Number.MAX_SAFE_INTEGER);
  });
}


  getByUserId = async (userId: number) => {
    try {
      const profile = await UserProfile.findOne({
        where: { user_id: userId },
        include: [
          {
            model: UserLocation,
            attributes: [USERLOCATION.LATITUDE, USERLOCATION.LONGITUDE, USERLOCATION.CITY, USERLOCATION.STATE, USERLOCATION.COUNTRY]
          },
          {
            model: UserImage,
            as: APP_CONSTANTS.constword.images,
            attributes: [USERIMAGE.ID, USERIMAGE.IMAGE_URL, USERIMAGE.IS_PROFILE_PIC, USERIMAGE.ORDER_INDEX]
          },
          {
            model: User,
            attributes: [ADMIN_FIELDS.EMAIL, ADMIN_FIELDS.PHONE_NUMBER, ADMIN_FIELDS.COUNTRY_CODE,ADMIN_FIELDS.IS_MOBILE_VERIFICATION]
          }
        ]
      });

      // Sort images by order_index
      if (profile) {
        this.sortImagesByOrderIndex(profile);
      }

      return { success: true, profile };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.failed_fetch_profile };
    }
  };

  getByUserIdWithFullDetails = async (userId: number): Promise<ProfileResponseData> => {
    try {
      const profile = await UserProfile.findOne({
        where: { user_id: userId },
        include: [
          {
            model: UserLocation,
            attributes: [USERLOCATION.LATITUDE, USERLOCATION.LONGITUDE, USERLOCATION.CITY, USERLOCATION.STATE, USERLOCATION.COUNTRY]
          },
          {
            model: UserImage,
            as: APP_CONSTANTS.constword.images,
            attributes: [USERIMAGE.ID, USERIMAGE.IMAGE_URL, USERIMAGE.IS_PROFILE_PIC, USERIMAGE.ORDER_INDEX],
            required: false
          },
          {
            model: User,
            attributes: [ADMIN_FIELDS.ID, ADMIN_FIELDS.EMAIL, ADMIN_FIELDS.PHONE_NUMBER, ADMIN_FIELDS.COUNTRY_CODE, APP_CONSTANTS.action.is_delete, ADMIN_FIELDS.IS_MOBILE_VERIFICATION, ADMIN_FIELDS.IS_ACTIVE]
          }
        ]
      });

      if (!profile) {
        return { success: false, message: APP_CONSTANTS.message.failed_fetch_profile };
      }

      // Sort images by order_index
      this.sortImagesByOrderIndex(profile);

      const user = profile.user as any;
      if (user?.is_deleted === true) {
        return { success: false, message: APP_CONSTANTS.message.your_account_deleted };
      }

      return { success: true, profile };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.failed_fetch_profile };
    }
  };
 
  findImageByUserId = async (userId: number): Promise<ProfileResponseData> => {
     try {
       const userProfile = await UserProfile.findOne({
         where: { user_id: userId },
         include: [
           {
             model: UserImage,
             as: APP_CONSTANTS.constword.images,
             attributes: [PROFILE_FIELDS.MANDATORY.IMAGE_URL],
           },
         ],
       });
 
       return { success: true, profile: userProfile };
     } catch (error: any) {
       return {
         success: false,
         message: error.message || APP_CONSTANTS.message.database_error,
       };
     }
   };
 
 

  userExists = async (userId: number): Promise<boolean> => {
    const user = await User.findByPk(userId);
    return !!user;
  };

  checkIfAlreadyDisliked = async (userProfileId: number, dislikedProfileId: number) => {
    try {
      const dislike = await LikedProfile.findOne({
        where: {
          user_profile_id: userProfileId,
          liked_profile_id: dislikedProfileId,
          status: APP_CONSTANTS.action.disliked,
        },
      });
      return { success: true, data: dislike };
    } catch (error: any) {
      return {
        success: false,
        message: APP_CONSTANTS.message.error_in_findDislikedprofiles,
        responseCode: APP_CONSTANTS.code.status_internal_server,
        error
      };
    }
  };

  upsertProfile = async (userId: number, data: any) => {
    try {
      const existing = await UserProfile.findOne({ where: { user_id: userId } });

      if (existing) {
        await existing.update(data);

        if (!existing.profile_id) {
          const newProfileId = await generateProfileId();
          await existing.update({ profile_id: newProfileId });
        }

        return { success: true, profile: existing };
      }

      const created = await UserProfile.create({
        ...data,
        user_id: userId,
        profile_id: await generateProfileId(),
      });

      return { success: true, profile: created };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.failed_to_update };
    }
  };

 updateImages = async (profileId: number, userId: number, urls: string[]) => {
  try {
    const profile = await UserProfile.findOne({
      where: { user_id: userId, id: profileId }
    });

    if (!profile) {
      return { success: false, message: APP_CONSTANTS.message.profile_not_found };
    }

    // Delete all existing images for this user
    await UserImage.destroy({
      where: { user_id: userId }
    });

    // Create new images in the exact order provided
    for (let i = 0; i < urls.length; i++) {
      const image_url = urls[i];
      const isProfilePic = i === 0;

      await UserImage.create({
        user_id: userId,
        image_url,
        is_profile_pic: isProfilePic,
        order_index: i,
      } as any);
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || APP_CONSTANTS.message.failed_to_update_image,
    };
  }
};



  upsertLocation = async (userId: number, location: any) => {
    try {
      const [loc] = await UserLocation.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId, ...location }
      });

      if (!loc.isNewRecord) {
        await loc.update(location);
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.failed_to_update_location };
    }
  };

  updateProfileCompletion = async (userId: number, isComplete: boolean) => {
    try {
      await UserProfile.update({ is_profile_completed: isComplete }, { where: { user_id: userId } });
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.profile_update_success };
    }
  };

  formatProfileWithImages = async (profile: any) => {
    try {
      const formattedProfile = profile.toJSON();

      // If images are not loaded, fetch them separately
      let rawImages = formattedProfile.images || [];
      
      if (rawImages.length === 0) {
        rawImages = await UserImage.findAll({
          where: { user_id: profile.user_id },
          attributes: [USERIMAGE.IMAGE_URL, USERIMAGE.IS_PROFILE_PIC, USERIMAGE.ORDER_INDEX],
          order: [['order_index', 'ASC']],
          raw: true
        });
      }

      // Map to array of URLs for profile_images
      const rawProfileImages = rawImages.map((img: any) => img.image_url);

      // Format images with signed URLs - only image_url and formatted_image_url
      const formattedImages = await Promise.all(
        rawImages.map(async (imgObj: any) => {
          const original = imgObj.image_url;

          if (original) {
            const { status, data } = await getSignedUrl(original);
            return {
              id: imgObj.id,
              image_url: original,
              is_profile_pic: imgObj.is_profile_pic,
              order_index: imgObj.order_index,
              formatted_image_url: status ? data : original,
            };
          }

          return {
            id: imgObj.id,
            image_url: null,
            is_profile_pic: imgObj.is_profile_pic,
            order_index: imgObj.order_index,
            formatted_image_url: null,
          };
        })
      );

      return {
        ...formattedProfile,
        profile_id: profile.profile_id,
        profile_images: rawProfileImages,
        images: formattedImages,
      };
    } catch (error: any) {
      return { message:  APP_CONSTANTS.message.profile_not_found };
    }
  };

  processDobAndAge = (dob: string) => {
    try {
      const dobDate = new Date(dob);

      if (isNaN(dobDate.getTime())) {
        return { success: false, message: APP_CONSTANTS.message.dob_verify };
      }

      return {
        success: true,
        dob: dobDate.toISOString().split('T')[0],
        age: calculateAge(dobDate),
      };
    } catch (error: any) {
      return { success: false, message: APP_CONSTANTS.message.dob_verify };
    }
  };

  formatUpdateProfileResponse = async (updatedProfile: any) => {
    try {
      const formattedProfile = updatedProfile.toJSON();
      
      // Fetch images separately to ensure they're included
      const images = await UserImage.findAll({
        where: { user_id: updatedProfile.user_id },
        attributes: [USERIMAGE.ID, USERIMAGE.IMAGE_URL, USERIMAGE.IS_PROFILE_PIC, USERIMAGE.ORDER_INDEX],
        order: [['order_index', 'ASC']],
        raw: true
      });
      
      // Map to profile_images (array of URLs)
      formattedProfile.profile_images = images.map((img: any) => img.image_url);

      // Format images with signed URLs
      const formattedImages = await Promise.all(
        images.map(async (img: any) => {
          const { status, data } = await getSignedUrl(img.image_url);
          return {
            id: img.id,
            image_url: img.image_url,
            is_profile_pic: img.is_profile_pic,
            order_index: img.order_index,
            formatted_image_url: status ? data : img.image_url
          };
        })
      );

      formattedProfile.images = formattedImages;

      return {
        success: true,
        data: {
          profile: {
            ...formattedProfile,
            profile_id: updatedProfile.profile_id,
          },
        },
      };
    } catch (error: any) {
      console.error('formatUpdateProfileResponse error:', error);
      return { success: false, message: error.message };
    }
  };
  getPreferencesByUserId = async (userId: number) => {
    try {
      return await Preference.findAll({ where: { user_id: userId } });
    } catch (error: any) {
      console.error(APP_CONSTANTS.error.get_preference, error);
      return [];
    }
  };

  formatPreferencesForAI = (preferences: any[]) => {
    if (!preferences || preferences.length === 0) return "";

    const pref = preferences[0].toJSON();

    return buildPreferenceString(pref);
  };

  syncProfileToExternalService = async (updatedProfile: any) => {
    try {
      const userId = updatedProfile.user_id;
      const name = updatedProfile.first_name + " " + updatedProfile.last_name;
      const user = await User.findByPk(userId);
      
      if (!user) {
        return { success: false, message: APP_CONSTANTS.message.user_not_found };
      }

      const location: any = await UserLocation.findOne({
        where: { user_id: userId }
      });

      const preferences = await this.getPreferencesByUserId(userId);
      const formattedPreferences = this.formatPreferencesForAI(preferences);

      const externalPayload = {
        profile_id: updatedProfile.profile_id,
        email: user.email,
        phone_number: user.phone_number,
        country_code: user.country_code ,
        name: name,
        age: updatedProfile.age,
        location: location.city,
        preferences: formattedPreferences,
        about_me: updatedProfile.short_bio,
        gender: updatedProfile.gender,
        orientation: updatedProfile.orientation,
        relationship_type: updatedProfile.relationship_type,
      } as ExternalProfilePayload;



      await axios.post(
        process.env.UPSERT_MATCH_MAKING || UPSERT_MATCH_MAKING,
        externalPayload,
        { headers: { 'Content-Type': 'application/json' } }
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  findMatchingExternal = async (updatedProfile: any) => {
    type RadarMatch = {
      user_id?: string;
      profile_id?: string;
      score?: number;
    };

    try {
      const userId = updatedProfile.user_id;
       const radarText =
        `About me: ${updatedProfile.short_bio || ''}`;

      const payload = {
        profile_id: updatedProfile.profile_id,
        text: radarText
      };

      const response = await axios.post(
        process.env.RADAR_FIND_MATCH || RADAR_FIND_MATCH,
        payload,
        { headers: { "Content-Type": "application/json" } }
      );

      const matches: RadarMatch[] = response.data?.results;

      if (matches.length === 0) {
        return { success: true, data: { match: null } };
      }

      const matchesWithUserId: any[] = [];

      for (const match of matches) {
        let dbProfile: any = null;

        if (match.profile_id && match.profile_id.trim() !== "" && match.profile_id !== "0") {
          dbProfile = await UserProfile.findOne({
            where: { profile_id: match.profile_id },
            include: [
              { model: UserImage, as: APP_CONSTANTS.constword.images, attributes: [USERIMAGE.IMAGE_URL, USERIMAGE.IS_PROFILE_PIC, USERIMAGE.ORDER_INDEX] },
              { model: UserLocation, attributes: [USERLOCATION.CITY] },
              {model: User, attributes:[ADMIN_FIELDS.IS_MOBILE_VERIFICATION,'is_deleted']}
            ]
          });

          if (dbProfile) {
            // Sort images by order_index
            this.sortImagesByOrderIndex(dbProfile);

            matchesWithUserId.push({
              ...match,
              user_id: dbProfile.user_id,
              dbProfile
            });
          }
        }

      }

      if (matchesWithUserId.length === 0) {
        console.warn(APP_CONSTANTS.error.no_match);
        return { success: true, data: { match: null } };
      }

      const validMatches = matchesWithUserId.filter(m => Number(m.user_id) > 0);

      const filteredMatches = await this.filterMatchesByUserInteractions(
        userId,
        validMatches
      );

      if (!filteredMatches || filteredMatches.length === 0) {
        return { success: true, data: { match: null } };
      }

      const mobileVerifiedMatches = filteredMatches.filter(m => {
        const user = m.dbProfile?.user as any;
        return user?.is_mobile_verification;
      });

      if (mobileVerifiedMatches.length === 0) {
        return { success: true, data: { match: null } };
      }

      const randomIndex = Math.floor(Math.random() * mobileVerifiedMatches.length);
      const finalMatch = mobileVerifiedMatches[randomIndex];


      const matchedProfile = await UserProfile.findOne({
        where: { user_id: finalMatch.user_id },
        include: [
          { model: UserImage, as: APP_CONSTANTS.constword.images, attributes: [USERIMAGE.IMAGE_URL, USERIMAGE.IS_PROFILE_PIC, USERIMAGE.ORDER_INDEX] },
          { model: UserLocation, attributes: [USERLOCATION.CITY] },
          { model: User, attributes: [ADMIN_FIELDS.IS_MOBILE_VERIFICATION] }
        ]
      });

      if (!matchedProfile) {
        return { success: true, data: { match: null } };
      }

      const profileJson = matchedProfile.toJSON();
      
      // Sort images by order_index
      this.sortImagesByOrderIndex(matchedProfile);
      const sortedProfileJson = matchedProfile.toJSON();

      const name = `${sortedProfileJson.first_name || ""} ${sortedProfileJson.last_name || ""}`.trim();

      let formattedImage = null;
      
      // Fetch images separately if not included in the association
      let images = sortedProfileJson.images || [];
      if (images.length === 0) {
        images = await UserImage.findAll({
          where: { user_id: finalMatch.user_id },
          attributes: [USERIMAGE.IMAGE_URL, USERIMAGE.IS_PROFILE_PIC, USERIMAGE.ORDER_INDEX],
          order: [['order_index', 'ASC']],
          raw: true
        });
      }

      if (images.length > 0) {
        const profilePic =
          images.find((i: any) => i.is_profile_pic) || images[0];

        const originalUrl = profilePic.image_url;
        const { status, data } = await getSignedUrl(originalUrl);

        formattedImage = {
          image_url: originalUrl,
          formatted_image_url: status ? data : originalUrl
        };
      }

      const result = {
        user_id: finalMatch.user_id,
        profile_id: sortedProfileJson.profile_id,
        name,
        location: sortedProfileJson.user_location?.city,
        image: formattedImage,
        score: finalMatch.score || 0
      };

      return { success: true, data: { match: result } };

    } catch (err: any) {
      console.error(APP_CONSTANTS.error.radar_err, err.message);
      return { success: false, message: err.message };
    }
  };


 async isUserBlocked(userId: number, targetUserId: number): Promise<boolean> {
  try {
    const blocked = await BlockedUser.findOne({
      where: {
        user_id: userId,
        blocked_user_id: targetUserId,
      }
    });

    return blocked ? true : false;
  } catch (error) {
    console.error(APP_CONSTANTS.error.is_user_blocked, error);
    return false;
  }
}

  async hasUserAnyBlockingRelationship(userId: number): Promise<boolean> {
  try {
    const blocked = await BlockedUser.findOne({
      where: {
        blocked_user_id: userId
      }
    });

    return blocked ? true : false;
  } catch (error) {
    console.error(APP_CONSTANTS.error.is_user_blocked, error);
    return false;
  }
}

  private filterMatchesByUserInteractions = async (
    userId: number,
    matches: any[]
  ): Promise<any[]> => {

    if (!matches?.length) return [];

    const filteredMatches: any[] = [];

    const candidateIds = matches
      .map(m => m.user_id ?? m.id)
      .filter(id => typeof id === 'number' && id > 0);

    if (!candidateIds.length) return [];

    const activeUsers = await User.findAll({
      where: {
        id: { [Op.in]: candidateIds },
        is_deleted: false
      },
      attributes: ['id']
    });

    const activeUserIds = new Set<number>(activeUsers.map(u => u.id));

    if (!activeUserIds.size) return [];

    const userInitiatedInteractions = await LikedProfile.findAll({
      where: {
        userProfileId: userId,
        likedProfileId: { [Op.in]: candidateIds }
      },
      attributes: [
        FILTER_MATCH_CHECK.USERPROFILEID,
        FILTER_MATCH_CHECK.LIKEDPROFILEID,
        FILTER_MATCH_CHECK.STATUS
      ]
    });

    const userReceivedInteractions = await LikedProfile.findAll({
      where: {
        userProfileId: { [Op.in]: candidateIds },
        likedProfileId: userId
      },
      attributes: [
        FILTER_MATCH_CHECK.USERPROFILEID,
        FILTER_MATCH_CHECK.LIKEDPROFILEID,
        FILTER_MATCH_CHECK.STATUS
      ]
    });

    const blockedUserIds = new Set<number>();

    const blockStatuses = new Set([
      APP_CONSTANTS.action.pending,
      APP_CONSTANTS.action.accepted,
      APP_CONSTANTS.action.reject,
      APP_CONSTANTS.action.disliked
    ]);

    for (const interaction of userInitiatedInteractions) {
      if (blockStatuses.has(interaction.status)) {
        blockedUserIds.add(interaction.likedProfileId);
      }
    }

    for (const interaction of userReceivedInteractions) {
      if (blockStatuses.has(interaction.status)) {
        blockedUserIds.add(interaction.userProfileId);
      }
    }

    // 5️⃣ Explicit blocks
    const userBlockedOthers = await BlockedUser.findAll({
      where: {
        user_id: userId,
        blocked_user_id: { [Op.in]: candidateIds }
      },
      attributes: [
        FILTER_MATCH_CHECK.BLOCKEDUSERID,
        FILTER_MATCH_CHECK.USERID
      ]
    });

    const userBlockedByOthers = await BlockedUser.findAll({
      where: {
        user_id: { [Op.in]: candidateIds },
        blocked_user_id: userId
      },
      attributes: [
        FILTER_MATCH_CHECK.BLOCKEDUSERID,
        FILTER_MATCH_CHECK.USERID
      ]
    });

    for (const b of userBlockedOthers) {
      blockedUserIds.add(b.blocked_user_id);
    }

    for (const b of userBlockedByOthers) {
      blockedUserIds.add(b.user_id);
    }

    // 6️⃣ Reports
    const reports = await ReportUser.findAll({
      where: {
        user_id: userId,
        reported_user_id: { [Op.in]: candidateIds }
      },
      attributes: [FILTER_MATCH_CHECK.REPORTEDUSERID]
    });

    for (const r of reports) {
      blockedUserIds.add(r.reported_user_id);
    }

    for (const match of matches) {
      const matchUserId = match.user_id ?? match.id;

      if (
        !matchUserId ||
        blockedUserIds.has(matchUserId) ||
        !activeUserIds.has(matchUserId)
      ) {
        continue;
      }

      filteredMatches.push(match);
    }

    return filteredMatches;
  };


  findUserByIdWithAllRelations = async (id: number): Promise<any> => {
    try {
      const user = await User.findByPk(id, {
        include: [
          { model: UserProfile, as: APP_CONSTANTS.constword.profile },
          { model: UserLocation, as: APP_CONSTANTS.constword.userLocation },
          { model: UserImage, as: APP_CONSTANTS.constword.images },
          { model: UserPreference, as: APP_CONSTANTS.constword.preference }
        ]
      });

      // Sort images by order_index
      if (user) {
        this.sortImagesByOrderIndex(user);
      }

      return {
        success: true,
        user,
        exists: !!user
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || APP_CONSTANTS.message.something_went_wrong
      };
    }
  };

  async softDeleteProfileAndUser(userId: number) {
    try {
      const now = new Date();
      const recreateDate = new Date(now.getTime() + twoWeeks);

      await User.update(
        {
          is_deleted: true,
          deleted_at: now,
          can_recreate_after: recreateDate,
          is_active: false,
        },
        { where: { id: userId } }
      );

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || String(err)
      };
    }
  };

  getUserProfileImage = async (userId: number) => {
    try {
      const profile = await UserProfile.findOne({
        where: { user_id: userId },
        include: [
          {
            model: UserImage,
            as: APP_CONSTANTS.constword.images,
            attributes: [USERIMAGE.ID, USERIMAGE.IMAGE_URL, USERIMAGE.IS_PROFILE_PIC],
            where: { is_profile_pic: true },
            required: false
          }
        ]
      });

      if (!profile) {
        return { success: false, data: null };
      }

      const images = (profile as any).images || [];
      const profileImage = images.length > 0 ? images[0] : null;

      return { success: true, data: profileImage };
    } catch (error: any) {
      return { success: false, data: null, message: error.message };
    }
  };

  getSignedImageUrl = async (imageUrl: string) => {
    try {
      const result = await getSignedUrl(imageUrl);
      return result;
    } catch (error: any) {
      return { status: false, data: null };
    }
  };

  updateProfileImageVerification = async (userId: number, isImageVerified: boolean): Promise<ProfileResponseData> => {
    try {
      await UserProfile.update(
        { is_image_verified: isImageVerified },
        { where: { user_id: userId } }
      );

      const updatedProfile = await UserProfile.findOne({
        where: { user_id: userId }
      });

      if (!updatedProfile) {
        return { success: false, message: APP_CONSTANTS.message.profile_not_found };
      }

      return { success: true, profile: updatedProfile };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.failed_to_update };
    }
  };

}
