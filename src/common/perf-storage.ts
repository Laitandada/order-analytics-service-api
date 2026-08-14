import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestMetrics {
  reqId: string;
  url: string;
  requestStart: number;
  connectionAcquireDuration: number;
  prismaQueryDuration: number;
  prismaProcessDuration: number;
}

export const perfStorage = new AsyncLocalStorage<RequestMetrics>();
