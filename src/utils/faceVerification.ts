import axios from 'axios';
import { APILogger } from './logger';
import { APP_CONSTANTS } from './constants';

const FACE_VERIFICATION_API_URL = process.env.FACE_VERIFICATION_API_URL || 'https://wingmawo.net/v1/face/validate';

interface FaceVerificationResponse {
  success: boolean;
  data?: any;
  message?: string;
}

export class FaceVerificationService {
  private logger = new APILogger();

  async verifyFace(
    selfieUrl: string,
    uploadedImageUrls: string[]
  ): Promise<FaceVerificationResponse> {
    try {
      if (!selfieUrl || !uploadedImageUrls || uploadedImageUrls.length === 0) {
        return {
          success: false,
          message: APP_CONSTANTS.message.image_req,
        };
      }

      const payload = {
        selfie_url: selfieUrl,
        uploaded_urls: uploadedImageUrls,
      };

      const response = await axios.post(
        FACE_VERIFICATION_API_URL,
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000, 
        }
      );

      return {
        success: true,
        data: response.data,
      };
    } catch (err: any) {
      this.logger.error(APP_CONSTANTS.message.face_verification_failed, {
        message: err.message,
        status: err.response?.status,
      });

      return {
        success: false,
        message:
          err.response?.data?.error ||
          APP_CONSTANTS.message.try_again,
      };
    }
  }
}
