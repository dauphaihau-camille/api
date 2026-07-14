import {
  Controller,
  Get,
  Header,
  Headers,
  HttpException,
  HttpStatus,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ObservabilityService } from './observability.service';

const AUTHORIZATION_HEADER = 'authorization';

@Controller('metrics')
@SkipThrottle()
@ApiTags('Observability')
export class MetricsController {
  constructor(
    private readonly observabilityService: ObservabilityService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiProduces('text/plain')
  @ApiOkResponse({
    description: 'Prometheus metrics payload.',
    schema: { type: 'string' },
  })
  async getMetrics(
    @Headers(AUTHORIZATION_HEADER) authorizationHeader: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const configuredToken = this.configService.get<string>('METRICS_BEARER_TOKEN');

    if (!configuredToken) {
      throw new HttpException(
        'Metrics endpoint is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const providedToken = extractBearerToken(authorizationHeader);

    if (!providedToken || !secretsMatch(configuredToken, providedToken)) {
      throw new UnauthorizedException('Invalid metrics bearer token');
    }

    response
      .type(this.observabilityService.contentType())
      .send(await this.observabilityService.renderMetrics());
  }
}

function extractBearerToken(authorizationHeader?: string): string | undefined {
  if (!authorizationHeader) {
    return undefined;
  }

  const [scheme, token] = authorizationHeader.trim().split(/\s+/, 2);

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }

  return token;
}

function secretsMatch(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
