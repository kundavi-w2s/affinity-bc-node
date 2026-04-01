import { Storage } from '@google-cloud/storage';
import * as path from 'path';
import { APP_CONSTANTS } from './constants';

// Initialize GCP Storage - project ID auto-detected from keyFile
const keyFile = process.env.GCP_KEY_FILE || 'src/settings/Affinity-firebase.json';
const storage = new Storage({
  keyFilename: path.resolve(keyFile),
});

const bucketName = process.env.GCP_STORAGE_BUCKET || 'affinity';
const bucket = storage.bucket(bucketName);

export async function getSignedUrl(
  img: string
): Promise<{ status: boolean; data: string }> {
  try {
    if (!img) {
      return { status: false, data: '' };
    }

    let objectPath = img;

    if (img.startsWith('http')) {
      const url = new URL(img);
      objectPath = url.pathname.replace(/^\/+/, ''); 
      objectPath = objectPath.replace(`${bucketName}/`, '');
    }

    objectPath = objectPath.trim();

    const file = bucket.file(objectPath);

    const [exists] = await file.exists();
    if (!exists) {
      return { status: false, data: '' };
    }

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return { status: true, data: signedUrl };
  } catch (err) {
    console.error(APP_CONSTANTS.message.Signed_url, err);
    return { status: false, data: '' };
  }
}
