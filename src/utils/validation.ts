import Joi from 'joi';
import { APP_CONSTANTS } from './constants';
import { validateRequired, ServiceResponse } from './helper';

const indianPhoneRegex = /^[6-9][0-9]{9}$/;

export const registerSchema = Joi.alternatives().try(
  Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required()
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
      }),
    device_token: Joi.string().optional(),
    device_type: Joi.string().optional(),
  }),
  Joi.object({
    phone_number: Joi.string().pattern(indianPhoneRegex).required().messages({
      'string.pattern.base': 'Phone number must be a valid 10-digit Indian number'
    }),
    country_code: Joi.string().required(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required()
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 8 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
      }),
    device_token: Joi.string().optional(),
    device_type: Joi.string().optional(),
  })
).messages({
  'alternatives.match': 'Provide either a valid email with password OR phone_number with country_code and password'
});

export const signinSchema = Joi.alternatives().try(
  Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    device_token: Joi.string().optional(),
    device_type: Joi.string().optional(),
  }).messages({
    'string.email': 'Invalid email format',
    'string.empty': 'Email and password are required',
    'string.min': 'Password must be at least 6 characters'
  }),
  Joi.object({
    phone_number: Joi.string().pattern(indianPhoneRegex).required(),
    country_code: Joi.string().required(),
    password: Joi.string().min(6).required(),
    device_token: Joi.string().optional(),
    device_type: Joi.string().optional(),
  }).messages({
    'string.pattern.base': 'Phone number must be a valid 10-digit Indian number',
    'string.empty': 'Phone number, country code and password are required',
    'string.min': 'Password must be at least 6 characters'
  })
);

export const forgotPasswordSchema = Joi.alternatives().try(
  Joi.object({
    id: Joi.number().required(),
    phone_number: Joi.string().pattern(indianPhoneRegex).required().messages({ 'string.pattern.base': 'Phone number must be a valid 10-digit Indian number' }),
    country_code: Joi.string().required(),
    is_mobile_verification: Joi.boolean().required().valid(true)
  }),
  Joi.object({ 
    email: Joi.string().email().required(),
    is_mobile_verification: Joi.boolean()
  }).messages({ 'string.email': 'Invalid email format' }),
  Joi.object({
    phone_number: Joi.string().pattern(indianPhoneRegex).required().messages({ 'string.pattern.base': 'Phone number must be a valid 10-digit Indian number' }),
    country_code: Joi.string().required(),
    is_mobile_verification: Joi.boolean()
  })
).messages({ 'alternatives.match': 'Provide either email, phone_number with country_code, or userId with phone_number for mobile verification' });

export const verifyOtpSchema = Joi.object({
  userId: Joi.number().required().messages({ 'any.required': 'User ID is required' }),
  otp: Joi.string().length(6).required().messages({
    'string.empty': 'OTP is required',
    'string.length': 'OTP must be 6 digits'
  }),
  is_mobile_verification: Joi.boolean().required()

});

export const helpsupportSchema = Joi.object({
    issue_description: Joi.string().required(),
    user_id: Joi.number().required()
})

export const resetPasswordSchema = Joi.object({
  userId: Joi.number().required().messages({ 'any.required': 'User ID is required' }),
  new_password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required()
    .messages({
      'string.empty': 'New password is required',
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
    }),
});

export const adminRegisterSchema = Joi.object({
  full_name: Joi.string().required(),
  email: Joi.string().email().required(),
  new_password: Joi.string().required(),
}).messages({ 'string.email': 'Invalid email format', 'string.empty': 'All fields are required' });

export const profileSetupSchema = Joi.object({
  height: Joi.any(),
  education_field: Joi.any(),
  education_level: Joi.any(),
  work_place: Joi.any(),
  job_title: Joi.any(),
  short_bio: Joi.string().max(100).messages({ 'string.max': 'Short bio must be 100 characters or fewer' }),
  orientation: Joi.string().valid('Straight', 'Gay', 'Lesbian', 'Bisexual', 'Prefer not to say').messages({ 'any.only': 'Invalid orientation value' }),
  relationship_type: Joi.string().valid('Long-term relationship', 'Short-term relationship', 'Casual dating', 'Friendship', 'Not sure yet').messages({ 'any.only': 'Invalid relationship type' }),
  looking_for_gender: Joi.string().valid('Men', 'Women', 'Non Binary people', 'Everyone').messages({ 'any.only': 'Invalid looking_for_gender value' }),
  looking_for_intention: Joi.string().valid('To find a serious relationship', 'To date casually', 'To make new friends', 'To explore and see where it goes', 'Not sure yet').messages({ 'any.only': 'Invalid looking_for_intention value' }),
  ethnicity: Joi.any(),
  hometown: Joi.any(),
  family_children_status: Joi.any(),
  family_want_children: Joi.any(),
  religion: Joi.any(),
  political_beliefs: Joi.any(),
  drink: Joi.any(),
  smoke: Joi.any(),
  hobbies: Joi.any(),
  interests: Joi.any()
});

export const adminLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
}).messages({ 'string.email': 'Invalid email format', 'string.empty': 'Email and password are required' });

export const adminresetPassword = Joi.object({
    email: Joi.string().email().required(),
})
export const verfiyOtpSchema = Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.number().required()
})
export const adminConfirmpassword = Joi.object({
    email: Joi.string().email().required(),
  new_password: Joi.string().required(),
  confirm_password: Joi.string().optional()
});

export const triggerNotificationSchema = Joi.object({
    title: Joi.string().required(),
    message: Joi.string().required(),
    trigger_to: Joi.string().required()
})

// Chat Validation Schemas
export const sendMessageSchema = Joi.object({
  partnerId: Joi.number().required().messages({
    'number.base': 'Partner ID must be a number',
    'any.required': 'Partner ID is required'
  }),
  message: Joi.string().required().min(1).max(1000).messages({
    'string.empty': 'Message cannot be empty',
    'string.min': 'Message must be at least 1 character',
    'string.max': 'Message must be 1000 characters or less',
    'any.required': 'Message is required'
  })
});

export const blockToggleSchema = Joi.object({
  targetUserId: Joi.number().required().messages({
    'number.base': 'Target user ID must be a number',
    'any.required': 'Target user ID is required'
  })
});

export const reportUserSchema = Joi.object({
  reportedUserId: Joi.number().required().messages({
    'number.base': 'Reported user ID must be a number',
    'any.required': 'Reported user ID is required'
  }),
  reason: Joi.string().required().min(3).messages({
    'string.empty': 'Reason is required',
    'string.min': 'Reason must be at least 3 characters',
    'any.required': 'Reason is required'
  }),
  description: Joi.string().optional().max(500).messages({
    'string.max': 'Description must be 500 characters or less'
  })
});

export const getAISuggestionsSchema = Joi.object({
  partnerId: Joi.number().required().messages({
    'number.base': 'Partner ID must be a number',
    'any.required': 'Partner ID is required'
  }),
  chatHistory: Joi.array().optional(),
  userInput: Joi.string().optional()
});

// Like Profile Validation
export interface LikeValidationResult {
  success: boolean;
  error?: string;
  responseCode?: number;
}

export const validateLikeProfileRequest = (userId: number | undefined, likedId: number | undefined): LikeValidationResult => {
  if (!userId) {
    return { success: false, error: APP_CONSTANTS.message.unauthorized, responseCode: 401 };
  }
  
  if (!likedId) {
    return { success: false, error: APP_CONSTANTS.message.liked_id_req, responseCode: 400 };
  }
  
  if (userId === likedId) {
    return { success: false, error: APP_CONSTANTS.message.like_error, responseCode: 400 };
  }
  
  return { success: true };
};


export const validateRespondToLikeRequest = (
  userId: number | undefined,
  likedId: number | undefined,
  action: string | undefined
): ServiceResponse | null => {
  const userError = validateRequired(userId, APP_CONSTANTS.message.unauthorized, 401);
  if (userError) return userError;
  
  const paramsError = validateRequired(
    likedId && action,
    APP_CONSTANTS.message.liked_action_req,
    400
  );
  if (paramsError) return paramsError;
  
  if (!['accept', 'reject'].includes(action || '')) {
    return validateRequired(
      false,
      APP_CONSTANTS.message.invalid_action,
      400
    );
  }
  
  return null;
};

