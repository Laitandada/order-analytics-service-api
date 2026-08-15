import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { perfStorage, RequestMetrics } from './perf-storage.js';
import crypto from 'node:crypto';

@Injectable()
export class PerfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (process.env.LOG_QUERIES !== 'true') {
      return next();
    }
    const store: RequestMetrics = {
      reqId: crypto.randomUUID(),
      url: req.originalUrl,
      requestStart: performance.now(),
      connectionAcquireDuration: 0,
      prismaQueryDuration: 0,
      prismaProcessDuration: 0,
    };

    perfStorage.run(store, () => {
      res.on('finish', () => {
        const totalDuration = performance.now() - store.requestStart;

        // Calculate result/Prisma processing time
        store.prismaProcessDuration = Math.max(
          0,
          totalDuration -
            store.connectionAcquireDuration -
            store.prismaQueryDuration,
        );

        if (process.env.LOG_QUERIES === 'true' && req.originalUrl.includes('/orders/')) {
          console.log(`
[PERF_BREAKDOWN] ${req.method} ${req.originalUrl} | ReqId: ${store.reqId}
  ├── Connection acquisition:   ${store.connectionAcquireDuration.toFixed(2)}ms
  ├── PostgreSQL query:         ${store.prismaQueryDuration.toFixed(2)}ms
  ├── Prisma/result processing: ${store.prismaProcessDuration.toFixed(2)}ms
  └── Total HTTP Request:       ${totalDuration.toFixed(2)}ms
`);
        }
      });
      next();
    });
  }
}
