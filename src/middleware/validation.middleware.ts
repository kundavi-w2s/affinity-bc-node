import { Request, Response, NextFunction } from "express";
import { APP_CONSTANTS } from "../utils/constants";
import Joi from 'joi';
import * as CryptoJS from 'crypto-js';

export function validation(schema: Joi.ObjectSchema | Joi.AlternativesSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            const encryptionKey = process.env.CRYPTO_SECRET_KEY || 'test';
            const passwordFields = [APP_CONSTANTS.constword.password, APP_CONSTANTS.constword.new_password];
            passwordFields.forEach((field) => {
                if (req.body && req.body[field]) {
                    try {
                        const dec = CryptoJS.AES.decrypt(String(req.body[field]), encryptionKey).toString(CryptoJS.enc.Utf8);
                        if (dec) {
                            req.body[field] = dec;
                        }
                    } catch (e) {
                        console.error('error', e);
                    }
                }
            });
        } catch (e) {
            console.error('error', e);
        }

        const { error } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            const errorMessage = error.details
                .map(detail => detail.message.replace(/["']/g, ''))
                .join(', ');
            res.status(APP_CONSTANTS.code.status_badrequest_code).json({
                message: errorMessage,
                status: false,
                responseCode: APP_CONSTANTS.code.status_badrequest_code,
            });
            return;
        }
        next();
    }
}
