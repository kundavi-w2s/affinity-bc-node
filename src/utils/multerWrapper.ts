// utils/multerWrapper.ts
import multer from 'multer';
import { APP_CONSTANTS } from './constants';

export const multerUpload = (multerInstance: multer.Multer, fieldName: string, maxCount?: number) => {
  const upload = maxCount ? multerInstance.array(fieldName, maxCount) : multerInstance.single(fieldName);

  return (req: any, res: any, next: any) => {
    upload(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              message: APP_CONSTANTS.message.File_too_large,
              status: false,
              responseCode: APP_CONSTANTS.code.status_badrequest_code
            });
          }
          // Add other codes as needed...
          return res.status(400).json({
            message: err.message,
            status: false,
            responseCode: APP_CONSTANTS.code.status_badrequest_code
          });
        }
        return res.status(500).json({
          message: APP_CONSTANTS.message.something_went_wrong,
          status: false,
          responseCode: APP_CONSTANTS.code.status_internal_server
        });
      }
      next();
    });
  };
};