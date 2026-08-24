import type { ConfigService } from '@nestjs/config';
import { parseCorsAllowedOrigins } from './cors.config';

export interface AppRuntimeConfig {
  port: number;
  requestBodyLimit: string;
  trustProxy: boolean;
  corsAllowedOrigins: string[];
}

export const APP_RUNTIME_CONFIG = Symbol('APP_RUNTIME_CONFIG');

export function buildAppRuntimeConfig(
  configService: Pick<ConfigService, 'get'>,
): AppRuntimeConfig {
  return {
    port: Number(configService.get<string>('PORT', '3000')),
    requestBodyLimit: configService.get<string>('REQUEST_BODY_LIMIT', '5mb'),
    trustProxy: configService.get<string>('TRUST_PROXY', 'false') === 'true',
    corsAllowedOrigins: parseCorsAllowedOrigins({
      CORS_ALLOWED_ORIGINS: configService.get<string>('CORS_ALLOWED_ORIGINS'),
    }),
  };
}
