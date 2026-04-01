import { Response } from 'express';
import { APP_CONSTANTS } from './constants';

export const sendSuccess = (res: Response, data: any, code: number = APP_CONSTANTS.code.status_success_code) => {
  return res.status(code).json({ status: true, data, responseCode: code });
};

export const sendMessage = (res: Response, message: string, code: number = APP_CONSTANTS.code.status_success_code) => {
  return res.status(code).json({ status: true, message, responseCode: code });
};

export const sendError = (res: Response, message: string, code: number = APP_CONSTANTS.code.status_internal_server) => {
  return res.status(code).json({ status: false, message, responseCode: code });
};

export const createErrorResponse = (message: string, code: number = APP_CONSTANTS.code.status_internal_server) => {
  return {
    data: null,
    error: message,
    responseCode: code
  };
};

export const sendValidationError = (res: Response, errors: any[], code: number = APP_CONSTANTS.code.status_badrequest_code) => {
  return res.status(code).json({ status: false, message: APP_CONSTANTS.message.validation_error, errors, responseCode: code });
};

export const sendErrorWithLog = (res: Response, error: unknown, customMessage: string = APP_CONSTANTS.message.something_went_wrong, code: number = APP_CONSTANTS.code.status_internal_server) => {
  return res.status(code).json({ status: false, message: customMessage, responseCode: code });
};
