import User from '../models/user';
import { APP_CONSTANTS } from './constants';
import { Response } from 'express';

export interface ServiceResponse {
  success: boolean;
  error?: string;
  data?: any;
  responseCode?: number;
  message?: string;
}

/**
 * Send Server-Sent Events (SSE) data to client
 */
export const sendSSEData = (
  res: Response,
  type: string,
  data: any,
  timestamp?: string
): void => {
  res.write(`data: ${JSON.stringify({
    type,
    data,
    timestamp: timestamp || new Date().toUTCString()
  })}\n\n`);
};

/**
 * Safely parse deleted_for_users JSON field from database
 * Handles both array and stringified JSON formats
 */
export const parseDeletedUsers = (value: any): number[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const calculateAge = (dob: Date): number => {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    
    return age;
};

export const checkUserDeletionStatus = (user: any) => {
  if (!user) {
    return { allow: true }; 
  }

  if (user.is_deleted) {
    const now = new Date();
    const recreateAllowed = user.can_recreate_after ? new Date(user.can_recreate_after) : null;

    if (recreateAllowed && now >= recreateAllowed) {
      return {
        allow: true,
        deleted: true,
        message: APP_CONSTANTS.message.create_newone,
      };
    }

    return {
      allow: false,
      deleted: true,
      message: APP_CONSTANTS.message.your_account_deleted,
      remaining_days: recreateAllowed
        ? Math.ceil((recreateAllowed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    };
  }

  return { allow: true, deleted: false };
};


export const generateProfileId = async (): Promise<string> => {
  try {
    const randomNum = Math.floor(Math.random() * 1_000_000);
    const padded = randomNum.toString().padStart(6, "0");
    return `WIN${padded}`;
  } catch (error) {
    console.error("Error generating profile ID:", error);

    const fallbackNum = Math.floor(Math.random() * 1_000_000)
      .toString()
      .padStart(6, "0");

    return `WIN${fallbackNum}`;
  }
};


export const buildPreferenceString = (pref: any) => {
  if (!pref) return "";

  const sections: string[] = [];

  if (Array.isArray(pref.gender) && pref.gender.length) {
    sections.push(`Preferred gender: ${pref.gender.join(", ")}`);
  }

  if (pref.age_min && pref.age_max) {
    sections.push(`Age between ${pref.age_min} and ${pref.age_max} years`);
  }

  if (pref.location) {
    const { city, state, country } = pref.location;
    const loc = [city, state, country].filter(Boolean).join(", ");
    if (loc) sections.push(`Preferred location: ${loc}`);
  }

  if (Array.isArray(pref.languages) && pref.languages.length) {
    sections.push(`Languages: ${pref.languages.join(", ")}`);
  }

  if (pref.height_min_cm && pref.height_max_cm) {
    sections.push(`Height between ${pref.height_min_cm}cm and ${pref.max_height_cm}cm`);
  }

  if (Array.isArray(pref.religion) && pref.religion.length) {
    sections.push(`Religion: ${pref.religion.join(", ")}`);
  }

  if (Array.isArray(pref.education_level) && pref.education_level.length) {
    sections.push(`Education level: ${pref.education_level.join(", ")}`);
  }

  return sections.join(", ");
};



export class Helper {
    async checkandUpdateSubscription(userId: string): Promise<boolean> {
        try {
            const user = await User.findByPk(userId);
            if (!user) {
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error checking subscription:', error);
            return false;
        }
    }
}

export const generateOTP = (length: number): string => {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('');
}

export const isFieldFilled = (value: any): boolean => {
  if (value === null || value === undefined || value === '' || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length > 0;
  }
  return true;
};

export const calculateScore = (filled: number, total: number, weight: number): number => {
  return total > 0 ? Number(((filled / total) * weight).toFixed(2)) : 0;
};
export const errorResponse = (error: string, responseCode: number = 500): ServiceResponse => {
  return {
    success: false,
    error,
    responseCode
  };
};

export const successResponse = (data?: any, message?: string): ServiceResponse => {
  return {
    success: true,
    error: undefined,
    data: data || { message: message || 'Success' },
    responseCode: 200
  };
};


export const validateRequired = (
  value: any,
  errorMessage: string,
  responseCode: number = 400
): ServiceResponse | null => {
  if (!value) {
    return errorResponse(errorMessage, responseCode);
  }
  return null;
};

export const validateRepositoryResult = async (
  result: any,
  transaction?: any
): Promise<ServiceResponse | null> => {
  if (!result.success) {
    if (transaction) {
      await transaction.rollback();
    }
    return errorResponse(result.message, result.responseCode);
  }
  return null;
};

export function generateChannelId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export const buildUserInclude = (
    alias: string,
    is_active?: string
) => {
    const status = is_active?.toLowerCase();

    if (
        status === APP_CONSTANTS.action.active ||
        status === APP_CONSTANTS.action.inactive
    ) {
        return {
            model: User,
            as: alias,
            where: { is_active: status === APP_CONSTANTS.action.active },
            attributes: [],
            required: true,
        };
    }

    return {
        model: User,
        as: alias,
        attributes: [],
    };
};
