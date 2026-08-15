import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Shared static map storing pre-serialized JSON strings
export const orderCache = new Map<string, string>();

@Injectable()
export class FastCacheMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Only intercept GET /orders/:orderId
    if (req.method === 'GET' && req.originalUrl.startsWith('/orders/')) {
      const urlPath = req.originalUrl.split('?')[0];
      const urlParts = urlPath.split('/');
      const orderId = urlParts[urlParts.length - 1];

      // Validate uuid format to avoid intercepting other paths (if any)
      if (orderId && orderId.length === 36) {
        const orderedAt = req.query.orderedAt as string | undefined;
        const cacheKey = `${orderId}_${orderedAt || ''}`;
        const cachedJson = orderCache.get(cacheKey);

        if (cachedJson) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(cachedJson);
          return;
        }
      }
    }
    next();
  }
}
