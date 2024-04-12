import { ENV } from '@jetstream/api-config';
import { v2 as cloudinary } from 'cloudinary';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

cloudinary.config({ secure: true });

export const routeDefinition = {
  getUploadSignature: {
    controllerFn: () => getUploadSignature,
    validators: {
      hasSourceOrg: false,
    },
  },
};
const getUploadSignature = createRoute(routeDefinition.getUploadSignature.validators, async ({ user }, req, res, next) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const cloudName = cloudinary.config().cloud_name;
    const apiKey = cloudinary.config().api_key;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const apiSecret = cloudinary.config().api_secret!;
    const context = `caption=${user.id.replace('|', '\\|')}|environment=${ENV.JETSTREAM_SERVER_URL}`;

    const signature = cloudinary.utils.api_sign_request({ timestamp, upload_preset: 'jetstream-issues', context }, apiSecret);

    sendJson(res, { signature: signature, timestamp, cloudName: cloudName, apiKey: apiKey, context }, 200);
  } catch (ex) {
    next(new UserFacingError(ex));
  }
});
