import { Storage } from "@google-cloud/storage";
import { getSignedUrl } from "./formatImage";
import { APILogger } from "./logger";
import * as path from "path";

const logger = new APILogger();

// Initialize GCP Storage - project ID auto-detected from keyFile
const keyFile = process.env.GCP_KEY_FILE || 'src/settings/affinity-imageupload.json';
const storage = new Storage({
  keyFilename: path.resolve(keyFile),
});

const bucketName = process.env.GCP_STORAGE_BUCKET || 'affinity';
const bucket = storage.bucket(bucketName);

export class upload {
  fileUpload = async (fileBuffer: Buffer, destinationPath: string, contentType?: string) => {
    try {
      const file = bucket.file(destinationPath);
      const resolvedContentType = contentType || 'application/octet-stream';

      await file.save(fileBuffer, {
        metadata: {
          contentType: resolvedContentType,
        },
      });

      // Return the public URL or signed URL
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
      return publicUrl;
    } catch (error: any) {
      logger.error(`GCP Storage file upload failed: ${error.message}`);
      throw error;
    }
  };

  singleFileUpload = async (filename: string, file: { buffer: Buffer; originalname: string; mimetype?: string }) => {
    try {
      const destinationKey = `uploads/${filename}`;
      await this.fileUpload(file.buffer, destinationKey, file.mimetype);
      const signedUrlResult = await getSignedUrl(destinationKey);
      if (signedUrlResult.status) {
        return signedUrlResult.data;
      } else {
        logger.error(`Failed to generate signed URL for ${destinationKey}`);
        throw new Error("File uploaded, but failed to generate signed URL.");
      }
    } catch (error: any) {
      logger.error(`singleFileUpload error: ${error.message}`);
      throw error;
    }
  };
}