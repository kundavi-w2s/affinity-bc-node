import Joi from 'joi';

export const profileSchema = Joi.object({
  userId: Joi.number().required().messages({
    'string.empty': 'userId is required'
  }),
  
  first_name: Joi.string().required().messages({
    'string.empty': 'First name is required'
  }),
  last_name: Joi.string().required().messages({
    'string.empty': 'Last name is required'
  }),
  dob: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
    'date.base': 'Date of birth must be a valid date',
    'date.format': 'Date must be in YYYY-MM-DD format',
    'any.required': 'Date of birth is required'
  }),
  gender: Joi.string().required().messages({
    'string.empty': 'Gender is required'
  }),
  profile_images: Joi.array().items(Joi.string()).min(2).required().messages({
    'array.min': 'At least Two profile image is required'
  }),

  height: Joi.string().optional(),
  education: Joi.string().optional(),
  education_level: Joi.string().optional(),
  work_place: Joi.string().optional(),
  job_title: Joi.string().optional(),
  orientation: Joi.string().optional(),
  relationship_type: Joi.string().optional(),
  looking_for_gender: Joi.string().optional(),
  looking_for_intention: Joi.string().optional(),
  ethnicity: Joi.string().optional(),
  hometown: Joi.string().optional(),
  family_children_status: Joi.string().optional(),
  family_want_children: Joi.string().optional(),
  religion: Joi.string().optional(),
  political_beliefs: Joi.string().optional(),
  drink: Joi.string().optional(),
  smoke: Joi.string().optional(),
  hobbies: Joi.array().items(Joi.string()).optional(),
  interests: Joi.array().items(Joi.string()).optional(),
  languages: Joi.array().items(Joi.string()).optional(),
  manual_location: Joi.string().optional(),
  short_bio: Joi.string().min(100).max(300).messages({
    'string.min': 'Bio must be at least 100 characters long',
    'string.max': 'Bio cannot exceed 300 characters',
    'string.empty': 'Please write something about yourself'
  }),
  location: Joi.object({
    city: Joi.string().required().messages({
      'string.empty': 'City is required'
    }),
    state: Joi.string().required().messages({
      'string.empty': 'State is required'
    }),
    country: Joi.string().required().messages({
      'string.empty': 'Country is required'
    }),
    latitude: Joi.number().optional(),
    longitude: Joi.number().optional()
  }).optional()
});