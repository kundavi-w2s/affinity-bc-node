import CryptoJS from "crypto-js";
import * as jwt from "jsonwebtoken";

export const encryptPassword = (password: string, encryptionKey: string): string => {
  return CryptoJS.AES.encrypt(password, encryptionKey).toString();
};

export const decryptPassword = (encryptedPassword: string, encryptionKey: string): string => {
  return CryptoJS.AES.decrypt(encryptedPassword, encryptionKey).toString(CryptoJS.enc.Utf8);
};

export const generateJWT = (payload: any, jwtSecret: string, jwtExpiry: string | number): string => {
  const secret = jwtSecret as jwt.Secret;
  const options: jwt.SignOptions = { expiresIn: jwtExpiry as any };
  return jwt.sign(payload as string | object | Buffer, secret, options) as string;
};
