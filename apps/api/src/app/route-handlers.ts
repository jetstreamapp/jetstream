import { Response, NextFunction, Request } from 'express';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sendJson(res: Response, content: any, status = 200) {
  content = content || {};
  res.status(status);

  return res.json({ data: content });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleError(err: any, req: Request, res: Response, next: NextFunction) {
  res.locals.path = req.path;
  console.warn('[ERROR]', req.method, req.originalUrl);
  console.warn('[ERROR]', err.message || 'An unknown error has occurred');

  return res.status(res.statusCode || 500).json({ data: err.message || 'An unknown error has occurred' });
}
