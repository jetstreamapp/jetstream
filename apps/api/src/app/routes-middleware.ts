import { NextFunction, Response, Request } from 'express';

export function logRoute(req: Request, res: Response, next: NextFunction) {
  res.locals.path = req.path;
  // logger.info(req.method, req.originalUrl);
  console.info('[REQ]', req.method, req.originalUrl);
  next();
}
