import Admin from "../../models/admin_model";
import AdminNotification from "../../models/admin_notification";
import User from "../../models/user";
import UserLocation from "../../models/user_location";
import UserProfile from "../../models/user_profile";
import LikedProfile from "../../models/liked_profile";
import BlockedUser from "../../models/blocked_user";
import {
  USER_FIELDS,
  ADMIN_FIELDS,
  USER_EXTRA_FIELDS,
  PROFILE_FIELDS,
  USER_FILTERS,
  USER_ASSOCIATIONS,
} from "../../utils/constants";
import { APP_CONSTANTS } from "../../utils/constants";
import { APILogger } from "../../utils/logger";
import { PaginationUtil } from "../../utils/pagination";
import { where, fn, col, Op } from "sequelize";

export class AdminRepository {
  private logger: APILogger;
  constructor() {
    this.logger = new APILogger();
  }
  createAdmin = async (
    full_name: string,
    email: string,
    password: string,
    is_account_owner: boolean
  ) => {
    return await Admin.create({ full_name, email, password, is_account_owner });
  };
  createAdminuser = async (full_name: string, email: string, role_id: any) => {
    return await Admin.create({
      full_name: full_name,
      email: email,
      role_id: role_id,
    });
  };

  checkAdmin = async (email: string) => {
    return await Admin.findOne({
      where: {
        email: email,
        is_active: true,
      },
    });
  };

  getAdminuserbyId = async (id: any) => {
    return await Admin.findOne({
      where: { id: id, is_active: true },
      attributes: {
        exclude: [
          ADMIN_FIELDS.OTP,
          ADMIN_FIELDS.OTP_EXPIRE_TIME,
          ADMIN_FIELDS.PASSWORD,
        ],
      },
    });
  };

  getAdminbyRole = async (role_id: number) => {
    return Admin.findAll({
      where: {
        role_id: role_id,
        is_active: true,
      },
    });
  };

  getAlladmins = async (page: number, perpage: number) => {
    return PaginationUtil.paginate(Admin, {
      page,
      limit: perpage,
      where: { is_active: true },
      attributes: {
        exclude: [
          ADMIN_FIELDS.OTP,
          ADMIN_FIELDS.OTP_EXPIRE_TIME,
          ADMIN_FIELDS.PASSWORD,
        ],
      },
      order: [[ADMIN_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
    });
  };
  countAlladmin = async () => {
    return Admin.count({
      where: { is_active: true },
    });
  };

  getUsersList = async (
    page: number,
    perPage: any,
    is_active?: boolean | string,
    search?: string,
    startDate?: string,
    endDate?: string
  ) => {
    try {
      // Build base where clause
      const whereClause: any = { is_deleted: false };

      if (is_active !== undefined && is_active !== null) {
          whereClause.is_active = is_active == APP_CONSTANTS.action.true ? true : false; 
      }

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        whereClause.created_at = {
          [Op.gte]: start,
          [Op.lte]: end,
        };
      }

      const profileInclude: any = {
        association: PROFILE_FIELDS.OPTIONAL.PROFILE,
        required: false,
        attributes: [
          PROFILE_FIELDS.MANDATORY.FIRST_NAME,
          PROFILE_FIELDS.MANDATORY.LAST_NAME,
          PROFILE_FIELDS.OPTIONAL.PROFILE_ID,
          PROFILE_FIELDS.OPTIONAL.PROFILE_ID,
          PROFILE_FIELDS.OPTIONAL.PROFILE_ID,
          PROFILE_FIELDS.MANDATORY.AGE,
          PROFILE_FIELDS.MANDATORY.HEIGHT,
          PROFILE_FIELDS.MANDATORY.GENDER,
        ],
      };

      // Compose final where clause. Use LOWER(...) + LIKE for case-insensitive matching.
      let finalWhereClause: any = whereClause;

      if (search && search.trim()) {
        const term = search.trim().toLowerCase();
        finalWhereClause = {
          ...whereClause,
          [Op.or]: [
            where(
              fn(
                PROFILE_FIELDS.OPTIONAL.LOWER,
                col(`${PROFILE_FIELDS.OPTIONAL.USER}.${ADMIN_FIELDS.EMAIL}`)
              ),
              { [Op.like]: `%${term}%` }
            ),
            where(
              fn(
                PROFILE_FIELDS.OPTIONAL.LOWER,
                col(
                  `${PROFILE_FIELDS.OPTIONAL.USER}.${ADMIN_FIELDS.PHONE_NUMBER}`
                )
              ),
              { [Op.like]: `%${term}%` }
            ),
            where(
              fn(
                PROFILE_FIELDS.OPTIONAL.LOWER,
                col(
                  `${PROFILE_FIELDS.OPTIONAL.PROFILE}.${PROFILE_FIELDS.MANDATORY.FIRST_NAME}`
                )
              ),
              { [Op.like]: `%${term}%` }
            ),
            where(
              fn(
                PROFILE_FIELDS.OPTIONAL.LOWER,
                col(
                  `${PROFILE_FIELDS.OPTIONAL.PROFILE}.${PROFILE_FIELDS.MANDATORY.LAST_NAME}`
                )
              ),
              { [Op.like]: `%${term}%` }
            ),
            where(
              fn(
                PROFILE_FIELDS.OPTIONAL.LOWER,
                col(
                  `${PROFILE_FIELDS.OPTIONAL.PROFILE}.${PROFILE_FIELDS.OPTIONAL.PROFILE_ID}`
                )
              ),
              { [Op.like]: `%${term}%` }
            ),
          ],
        };
      }

      return await PaginationUtil.paginate(User, {
        page,
        limit: perPage,
        where: finalWhereClause,
        attributes: {
          exclude: [
            USER_EXTRA_FIELDS.PASSWORD_HASH,
            USER_EXTRA_FIELDS.OTP,
            USER_EXTRA_FIELDS.OTP_EXPIRES_AT,
          ],
        },
        include: [profileInclude],
        subQuery: false,
        distinct: true,
        order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
      });
    } catch (err) {
      this.logger.error(
        APP_CONSTANTS.message.DB_error_AdminRepository_getUsersList,
        err
      );
      throw err;
    }
  };

  getUserById = async (userId: number) => {
    return await User.findOne({
      where: { id: userId },
      attributes: {
        exclude: [
          USER_EXTRA_FIELDS.PASSWORD_HASH,
          USER_EXTRA_FIELDS.OTP,
          USER_EXTRA_FIELDS.OTP_EXPIRES_AT,
        ],
      },
      include: [{ all: true, nested: true }],
    });
  };

  updateUserStatus = async (userId: number, isActive: boolean) => {
    return await User.update(
      { is_active: isActive },
      { where: { id: userId } }
    );
  };

  updateOTP = async (id: any, otp: any, otp_expire_time: any) => {
    return await Admin.update(
      { otp: otp, otp_expire_time: otp_expire_time },
      { where: { id: id } }
    );
  };
  updateAdminPassword = async (
    id: number,
    password: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const [affectedRows] = await Admin.update(
        { password },
        { where: { id } }
      );
      if (affectedRows === 0) {
        return {
          success: false,
          message: APP_CONSTANTS.message.admin_not_found_or_no_changes,
        };
      } else {
        return {
          success: true,
          message: APP_CONSTANTS.message.password_updated_successfully,
        };
      }
    } catch (err) {
      return {
        success: false,
        message:
          err instanceof Error
            ? err.message
            : APP_CONSTANTS.message.database_error_occurred,
      };
    }
  };

  deleteUser = async (userId: number, deletedBy?: string, adminId?: number) => {
    return await User.update(
      {
        is_deleted: true,
        is_active: false,
        deleted_at: new Date(),
        deleted_by: deletedBy,
        deleted_by_admin_id: adminId,
      },
      { where: { id: userId } }
    );
  };

  /** Restore a soft-deleted user */
  restoreUser = async (userId: number) => {
    return await User.update(
      {
        is_deleted: false,
        is_active: true,
        deleted_at: null,
        deleted_by: null,
        deleted_by_admin_id: null,
      },
      { where: { id: userId } }
    );
  };

  createAdminnotification = async (notificationObject: any) => {
    return AdminNotification.create(notificationObject);
  };

  getAllUsers = async (
    status: boolean | null,
    city: string | null = null,
    state: string | null = null
  ) => {
    let whereCondition: any = {};
    let profileWhere: any = {};
    // Filter by user active status
    if (status === true) {
      whereCondition.is_active = true;
    } else if (status === false) {
      whereCondition.is_active = false;
    }
    // If status is null → include all users regardless of active status
    // Apply city filter if provided
    if (city !== null && city !== undefined && city.trim() !== '') {
      profileWhere[PROFILE_FIELDS.MANDATORY.CITY] = city.trim(); // assuming your field is 'city'
    }
    // Apply state filter if provided
    if (state !== null && state !== undefined && state.trim() !== '') {
      profileWhere[PROFILE_FIELDS.MANDATORY.STATE] = state.trim(); // assuming your field is 'state'
    }
    return await User.findAll({
      where: whereCondition,
      attributes: [USER_FIELDS.ID, USER_FIELDS.DEVICE_TOKEN], // include id if needed
      include: [
        {
          model: UserLocation,
          where:
            Object.keys(profileWhere).length > 0 ? profileWhere : undefined,
          attributes: [
            PROFILE_FIELDS.MANDATORY.CITY,
            PROFILE_FIELDS.MANDATORY.STATE,
          ], // optional: fetch these fields
          required: Object.keys(profileWhere).length > 0, // only inner join if filtering
        },
      ],
    });
  };

  findById = async (id: number) => {
    return await Admin.findByPk(id);
  };

  getUserFilterList = async (
    filter: string,
    page: number,
    perPage: number | null,
    search?: string,
    startDate?: string,
    endDate?: string
  ) => {
    try {
      const whereClause: any = {};
      let model: any;
      let includeModels: any[] = [];

      /* ------------------ Helper Functions ------------------ */
      const createUserInclude = (association: string) => ({
        model: User,
        as: association,
        attributes: [USER_EXTRA_FIELDS.ID, ADMIN_FIELDS.EMAIL],
        include: [{
          model: UserProfile,
          as: PROFILE_FIELDS.OPTIONAL.PROFILE,
          attributes: [PROFILE_FIELDS.MANDATORY.FIRST_NAME, PROFILE_FIELDS.MANDATORY.LAST_NAME, PROFILE_FIELDS.OPTIONAL.PROFILE_ID]
        }]
      });

      const buildUserName = (user: any) => {
        if (!user) return 'Unknown';
        const profile = user.profile;
        if (profile) {
          const firstName = profile[PROFILE_FIELDS.MANDATORY.FIRST_NAME] || '';
          const lastName = profile[PROFILE_FIELDS.MANDATORY.LAST_NAME] || '';
          const fullName = `${firstName} ${lastName}`.trim();
          if (fullName) return fullName;
        }
        return user[ADMIN_FIELDS.EMAIL] || 'Unknown';
      };

      const createSearchCondition = (association: string, fields: string[]) => {
        const term = `%${search!.trim().toLowerCase()}%`;
        return fields.map(field =>
          where(fn(PROFILE_FIELDS.OPTIONAL.LOWER, col(`${association}.${field}`)), { [Op.like]: term })
        );
      };

      /* ------------------ Date Filter ------------------ */
      if (startDate && endDate) {
        whereClause[USER_EXTRA_FIELDS.CREATED_AT] = {
          [Op.gte]: new Date(startDate),
          [Op.lte]: new Date(endDate)
        };
      }

      /* ------------------ Search Filter ------------------ */
      if (search?.trim()) {
        const searchConditions: any[] = [];

        // Search in liker fields (for liked profiles)
        searchConditions.push(...createSearchCondition(USER_ASSOCIATIONS.LIKER, [
          USER_EXTRA_FIELDS.ID,
          ADMIN_FIELDS.EMAIL,
          `profile.${PROFILE_FIELDS.MANDATORY.FIRST_NAME}`,
          `profile.${PROFILE_FIELDS.MANDATORY.LAST_NAME}`
        ]));

        // Search in liked fields (for liked profiles)
        searchConditions.push(...createSearchCondition(USER_ASSOCIATIONS.LIKED, [
          USER_EXTRA_FIELDS.ID,
          ADMIN_FIELDS.EMAIL,
          `profile.${PROFILE_FIELDS.MANDATORY.FIRST_NAME}`,
          `profile.${PROFILE_FIELDS.MANDATORY.LAST_NAME}`
        ]));

      }

      const createTransformData = (actorAssoc: string, targetAssoc: string) => (item: any) => {
        const actorKey = actorAssoc.toLowerCase();
        const targetKey = targetAssoc.toLowerCase();
        return {
          id: item[USER_EXTRA_FIELDS.ID],
          created_at: item[USER_EXTRA_FIELDS.CREATED_AT],
          updated_at: item.updated_at,
          [`${actorKey}_name`]: buildUserName(item[actorAssoc]),
          [`${actorKey}_profile_id`]: item[actorAssoc]?.profile?.[PROFILE_FIELDS.OPTIONAL.PROFILE_ID] || null,
          [`${targetKey}_name`]: buildUserName(item[targetAssoc]),
          [`${targetKey}_profile_id`]: item[targetAssoc]?.profile?.[PROFILE_FIELDS.OPTIONAL.PROFILE_ID] || null,
          like_id: item[actorAssoc]?.profile?.[PROFILE_FIELDS.OPTIONAL.PROFILE_ID] || null,
          liked_id: item[targetAssoc]?.profile?.[PROFILE_FIELDS.OPTIONAL.PROFILE_ID] || null,
        };
      };

      /* ------------------ Filter Configuration ------------------ */
      const filterConfigs = {
        [USER_FILTERS.MATCHED_PROFILE]: {
          model: LikedProfile,
          status: APP_CONSTANTS.action.accepted,
          associations: [USER_ASSOCIATIONS.LIKER, USER_ASSOCIATIONS.LIKED],
          transformData: createTransformData(USER_ASSOCIATIONS.LIKER, USER_ASSOCIATIONS.LIKED)
        },
        [USER_FILTERS.LIKED_PROFILE]: {
          model: LikedProfile,
          status: APP_CONSTANTS.action.pending,
          associations: [USER_ASSOCIATIONS.LIKER, USER_ASSOCIATIONS.LIKED],
          transformData: createTransformData(USER_ASSOCIATIONS.LIKER, USER_ASSOCIATIONS.LIKED)
        },
        [USER_FILTERS.DISLIKE_PROFILE]: {
          model: LikedProfile,
          status: APP_CONSTANTS.action.disliked,
          associations: [USER_ASSOCIATIONS.LIKER, USER_ASSOCIATIONS.LIKED],
          transformData: createTransformData(USER_ASSOCIATIONS.LIKER, USER_ASSOCIATIONS.LIKED)
        },
        [USER_FILTERS.BLOCKED_USER]: {
          model: BlockedUser,
          associations: [USER_ASSOCIATIONS.BLOCKER, USER_ASSOCIATIONS.BLOCKED],
          transformData: createTransformData(USER_ASSOCIATIONS.BLOCKER, USER_ASSOCIATIONS.BLOCKED)
        }
      };

      const config = filterConfigs[filter as keyof typeof filterConfigs];
      if (!config) {
        this.logger.error(APP_CONSTANTS.message.Invalid_filter_type);
      }

      model = config.model;
      if (config.status) {
        whereClause.status = config.status;
      }
      includeModels = config.associations.map(createUserInclude);

      /* ------------------ Execute Query ------------------ */
      const paginationOptions: any = {
        page,
        where: whereClause,
        include: includeModels,
        order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
      };

      if (perPage !== null) {
        paginationOptions.limit = perPage;
      }

      const result = await PaginationUtil.paginate(model, paginationOptions);

      /* ------------------ Transform Response ------------------ */
      const transformedData = result.data.map((item: any) => config.transformData(item));

      return {
        ...result,
        data: transformedData
      };

    } catch (err) {
      this.logger.error('Error in getUserFilterList:', err);
      throw err;
    }
  };
}
