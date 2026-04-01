import UserLocation from '../../models/user_location';
import { APP_CONSTANTS } from '../../utils/constants';

export class LocationRepository {
  getByUserId = async (userId: number) => {
    try {
      const location = await UserLocation.findOne({ where: { user_id: userId } });
      return { success: true, location };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.something_went_wrong };
    }
  };

  upsertLocation = async (userId: number, data: any): Promise<{ success: boolean; location?: UserLocation; message?: string }> => {
    try {
      const existing = await UserLocation.findOne({ where: { user_id: userId } });
      if (existing) {
        await existing.update(data);
        return { success: true, location: existing };
      }
      const created = await UserLocation.create({ ...data, user_id: userId });
      return { success: true, location: created };
    } catch (error: any) {
      return { success: false, message: error.message || APP_CONSTANTS.message.something_went_wrong };
    }
  };
}