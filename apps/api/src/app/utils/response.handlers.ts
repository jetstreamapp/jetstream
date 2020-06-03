import * as express from 'express';
import { UserFacingError } from './error-handler';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function healthCheck(req: express.Request, res: express.Response) {
  return res.status(200).end();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sendJson(res: express.Response, content?: any, status = 200) {
  content = content || {};
  res.status(status);

  return res.json({ data: content });
}

// DEPRECATED IN FAVOR OF ONE ERROR HANDLER
// // eslint-disable-next-line @typescript-eslint/no-explicit-any
// export function sendError(err: any, req: express.Request, res: express.Response) {
//   res.locals.path = req.path;
//   console.warn('[ERROR]', req.method, req.originalUrl);
//   console.warn('[ERROR]', err.message || 'An unknown error has occurred');

//   return res.status(res.statusCode || 500).json({ data: err.message || 'An unknown error has occurred' });
// }

// TODO: implement user facing errors and system facing errors and separate them
// TODO: this should handle ALL errors, and controllers need to throw proper errors!
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function uncaughtErrorHandler(err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
  if (err instanceof UserFacingError) {
    res.status(400);
    return res.json({
      error: true,
      message: err.message,
      data: err.additionalData,
    });
  }

  const errorMessage = 'There was an error processing the request';
  let status = err.status || 500;
  if (status < 100 || status > 500) {
    status = 500;
  }
  res.status(status);

  // If accept header does not include application/json, return plain text response
  try {
    const acceptHeader = req.get('Accept') || '';
    if (!acceptHeader.includes('application/json')) {
      return res.redirect('/404.html');
    }
  } catch (ex) {
    // NOOP
  }

  // Return JSON error response for all other scenarios
  return res.json({
    error: errorMessage,
    message: err.message,
    data: err.data,
  });
}
