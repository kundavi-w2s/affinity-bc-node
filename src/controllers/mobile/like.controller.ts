import { Request, Response } from 'express';
import LikeService from '../../services/mobile/like.service';
import { sendError, sendSuccess, sendErrorWithLog } from '../../utils/responseHandler';
import { APP_CONSTANTS } from '../../utils/constants';

export class LikeController {
  private likeService: LikeService;

  constructor() {
    this.likeService = new LikeService();
  }

  likeProfile = async (req: Request, res: Response) => {
    try {
      const result = await this.likeService.likeProfile(req, res);
      if (!result.success) {
        return sendError(res, result.error, result.responseCode);
      }
      return sendSuccess(res, result.data, result.responseCode);
    } catch (error) {
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.likecontroller_likeErr, APP_CONSTANTS.code.status_internal_server);
    }
  };

  respondToLike = async (req: Request, res: Response) => {
    try {
      const result = await this.likeService.respondToLike(req, res);

      if (!result.success) {
        return sendError(res, result.error, result.responseCode);
      }

      return sendSuccess(res, result.data, result.responseCode);
    } catch (error) {
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.likecontroller_res_accept, APP_CONSTANTS.code.status_internal_server);
    }
  };

  getRequestList = async (req: Request, res: Response) => {
    try {
      const result = await this.likeService.getRequestProfiles(req, res);

      if (!result.success) {
        return sendError(res, result.error, result.responseCode);
      }

      return sendSuccess(res, result.data, result.responseCode);
    } catch (error) {
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.likecontroller_res_reject, APP_CONSTANTS.code.status_internal_server);
    }
  };
  getlikedProfile = async (req: Request, res: Response) => {
    try {
      const result = await this.likeService.getlikedProfile(req, res);

      if (!result.success) {
        return sendError(res, result.error, result.responseCode);
      }

      return sendSuccess(res, result.data, result.responseCode);
    } catch (error) {
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.likecontroller_res_reject, APP_CONSTANTS.code.status_internal_server);
    }
  };

  dislikeProfile = async (req: Request, res: Response) => {
    try {
      const result = await this.likeService.dislikeProfile(req, res);
      if (!result.success) {
        return sendError(res, result.error, result.responseCode);
      }
      return sendSuccess(res, result.data, result.responseCode);
    } catch (error) {
      return sendErrorWithLog(res, error, APP_CONSTANTS.error.likecontroller_dislikeErr, APP_CONSTANTS.code.status_internal_server);
    }
  };

}