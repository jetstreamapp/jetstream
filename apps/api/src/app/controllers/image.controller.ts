import { ENV } from '@jetstream/api-config';
import { UserProfileServer } from '@jetstream/types';
import { v2 as cloudinary } from 'cloudinary';
import { NextFunction } from 'express';
import { Request, Response } from '../types/types';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';

cloudinary.config({ secure: true });

export const routeValidators = {
  getUploadSignature: [],
};

export async function getUploadSignature(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as UserProfileServer;
    const timestamp = Math.round(new Date().getTime() / 1000);
    const cloudName = cloudinary.config().cloud_name;
    const apiKey = cloudinary.config().api_key;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const apiSecret = cloudinary.config().api_secret!;
    const context = `caption=${user.id.replace('|', '\\|')}|environment=${ENV.JETSTREAM_SERVER_URL}`;

    const signature = cloudinary.utils.api_sign_request({ timestamp: timestamp, upload_preset: 'jetstream-issues', context }, apiSecret);

    sendJson(res, { signature: signature, timestamp: timestamp, cloudName: cloudName, apiKey: apiKey, context }, 200);
  } catch (ex) {
    next(new UserFacingError(ex.message));
  }
}
