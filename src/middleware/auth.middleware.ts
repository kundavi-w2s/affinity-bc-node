import { NextFunction, Request } from "express";
import * as jwt from 'jsonwebtoken';
import { APP_CONSTANTS } from "../utils/constants";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export const authMiddleware = async (req: any, res: any, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(APP_CONSTANTS.code.status_exist_code)
      .json({ message: APP_CONSTANTS.message.token_required });
  }
  try {
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "affinity_local_key");
    req.userId = decoded.id; 
    next();
  } catch (error) {
    return res.status(APP_CONSTANTS.code.status_unauthorize_code)
      .json({ message: APP_CONSTANTS.message.invalid_token });
  }
};

// export const adminAuthMiddleware = async (req: any, res: any, next: NextFunction) => {
//   const token = req.headers.authorization?.split(' ')[1];
//   if (!token) {
//     return res.status(APP_CONSTANTS.code.status_exist_code)
//       .json({ message: APP_CONSTANTS.message.token_required });
//   }
//   try {
//     const decoded: any = jwt.verify(token, process.env.JWT_SECRET || "affinity_local_key");
//     // Verify admin exists before calling next() to avoid sending multiple responses
//     const checkAdmin = await new AdminRepository().checkAdmin(decoded.email);
//     if (checkAdmin) {
//       req.user = { id: decoded.id, setup: decoded.setup };
//       return next();
//     } else {
//       return res.status(APP_CONSTANTS.code.status_error_code)
//         .json({ message: APP_CONSTANTS.message.unauthorized_user });
//     }
//   } catch (error) {
//     return res.status(APP_CONSTANTS.code.status_error_code)
//       .json({ message: APP_CONSTANTS.message.invalid_token });
//   }
// };
