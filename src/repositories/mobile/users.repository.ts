import User from '../../models/user';
import UserProfile from '../../models/user_profile';
import { APP_CONSTANTS, PROFILE_FIELDS } from '../../utils/constants';

interface CreateUserData {
  email?: string | null;
  phone_number?: number | null;
  country_code?: string | null;
  password_hash: string;
  is_verified?: boolean;
  is_active?: number;
  device_token?: string | null;
  device_type?: string | null;
}

interface UserResponse {
  success: boolean;
  user?: any;
  message?: string;
  exists?: boolean;
  is_profile_completed?: boolean;
}

export class UserRepository {
  private normalizeEmail = (email?: string | null): string | null => {
    return email ? String(email).trim().toLowerCase() : null;
  };

  createUser = async (data: CreateUserData): Promise<UserResponse> => {
    try {
      const normalEmail = this.normalizeEmail(data.email);

      const user = await User.create({
        email: normalEmail,
        phone_number: data.phone_number,
        country_code: data.country_code,
        password_hash: data.password_hash,
        device_token: data.device_token,
        device_type: data.device_type,
      } as any);

      return { success: true, user };
    } catch (error: any) {
      const message = error?.name === APP_CONSTANTS.error.sequalize_err
        ? APP_CONSTANTS.message.email_exist
        : error.message || APP_CONSTANTS.message.failed_create_user;
      return { success: false, message };
    }
  };


  findByEmail = async (email: string): Promise<UserResponse> => {
    try {
      const normalEmail = this.normalizeEmail(email);
      const user = await User.findOne({ where: { email: normalEmail } });
      return { success: true, user };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.database_error };
    }
  };


  findByPhone = async (phone_number: number, country_code: string): Promise<UserResponse> => {
    try {
      const user = await User.findOne({ where: { phone_number, country_code } });
      return { success: true, user};
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.database_error };
    }
  };

  findUserbyID = async (id: any) => {
    return await User.findOne({
      where: { id }
    })
  }


  findById = async (id: any): Promise<UserResponse> => {
    try {
      const user = await User.findByPk(id, {
        include: [
          {
            model: UserProfile,
            attributes: [PROFILE_FIELDS.MANDATORY.FIRST_NAME,PROFILE_FIELDS.MANDATORY.LAST_NAME] // add all you need
          }
        ]
      });

      return {
        success: true,
        user,
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.message || APP_CONSTANTS.message.something_went_wrong
      };
    }
  };



  updatePassword = async (userId: number, passwordHash: string): Promise<UserResponse> => {
    try {
      await User.update({ password_hash: passwordHash }, { where: { id: userId } });
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.database_error };
    }
  };


  updateUser = async (id: number, data: any): Promise<UserResponse> => {
    try {
      const [affectedCount] = await User.update(data, { where: { id } });
      if (affectedCount === 0) {
        return { success: false, message: APP_CONSTANTS.message.user_not_found };
      }
      return { success: true };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.database_error };
    }
  };

  findUserWithProfile = async (
    email?: string,
    phone_number?: number | string,
    country_code?: string
  ): Promise<UserResponse> => {
    try {
      let user;

      if (email) {
        const normalEmail = this.normalizeEmail(email);
        user = await User.findOne({ where: { email: normalEmail } });
      } else if (phone_number && country_code) {
        const phoneNum = typeof phone_number === 'string' ? phone_number : String(phone_number);
        user = await User.findOne({ where: { phone_number: phoneNum, country_code } });
      }

      if (!user) {
        return { success: true, user: null};
      }

      const userProfile = await UserProfile.findOne({ where: { user_id: user.id } });
      const is_profile_completed = userProfile?.is_profile_completed || false;

      return {
        success: true,
        user: { ...user.toJSON(), is_profile_completed },
        exists: true,
        is_profile_completed,
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.message || APP_CONSTANTS.message.database_error
      };
    }
  };
}