import * as express from 'express';

export function logRoute(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.locals.path = req.path;
  // logger.info(req.method, req.originalUrl);
  console.info('[REQ]', req.method, req.originalUrl);
  next();
}

export function notFoundMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const error = new Error('Not Found');
  error['status'] = 404;
  res['message'] = 'Route not found';
  next(error);
}
