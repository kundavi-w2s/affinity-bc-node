import UserPreference from '../../models/user_preference';
import { APP_CONSTANTS } from '../../utils/constants';

export interface PreferenceData {
  gender?: string[];
  age_min?: number;
  age_max?: number;
  languages?: string[];
  height_min_cm?: number;
  height_max_cm?: number;
  religion?: string[];
  education_level?: string[];
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
}

export class PreferenceRepository {
  async getPreferencesByUserId(userId: number): Promise<{ success: boolean; preference?: UserPreference | null; message?: string }> {
    try {
      const preference = await UserPreference.findOne({ where: { user_id: userId } });
      return { success: true, preference };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.something_went_wrong };
    }
  }

  async setPreferences(userId: number, data: PreferenceData): Promise<{ success: boolean; preference?: UserPreference | null; message?: string }> {
    try {
      const [preference, created] = await UserPreference.findOrCreate({
        where: { user_id: userId },
        defaults: { user_id: userId, ...data }
      });

      if (!created) {
        await preference.update(data);
      }

      return { success: true, preference };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.something_went_wrong };
    }
  }
}
