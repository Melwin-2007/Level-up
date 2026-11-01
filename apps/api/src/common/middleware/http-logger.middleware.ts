import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

export function httpLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const requestId = (req.headers['x-request-id'] as string) || '-';
    const user = (req as unknown as { user?: { userId?: string } }).user;
    const userId = user?.userId ?? 'anonymous';

    // Strictly log metadata only: request id, user id, route, status, duration
    logger.log(
      JSON.stringify({
        requestId,
        userId,
        method,
        route: originalUrl,
        statusCode,
        durationMs: duration,
      })
    );
  });

  next();
}
