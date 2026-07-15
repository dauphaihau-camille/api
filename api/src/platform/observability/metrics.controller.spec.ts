import { HttpException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { MetricsController } from './metrics.controller';
import type { ObservabilityService } from './observability.service';

describe('MetricsController', () => {
  function createObservabilityService() {
    return {
      contentType: jest.fn().mockReturnValue('text/plain'),
      renderMetrics: jest.fn().mockResolvedValue('metric_name 1'),
    } as unknown as jest.Mocked<ObservabilityService>;
  }

  function createConfigService(token?: string) {
    return {
      get: jest.fn().mockImplementation((key: string) =>
        key === 'METRICS_BEARER_TOKEN' ? token : undefined),
    } as unknown as jest.Mocked<ConfigService>;
  }

  function createResponse() {
    const response = {
      type: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    return response as unknown as jest.Mocked<Response>;
  }

  it('returns metrics when the bearer token matches', async () => {
    const observabilityService = createObservabilityService();
    const configService = createConfigService('secret-token');
    const response = createResponse();
    const controller = new MetricsController(observabilityService, configService);

    await controller.getMetrics('Bearer secret-token', response);

    expect(observabilityService.renderMetrics).toHaveBeenCalledTimes(1);
    expect(response.type).toHaveBeenCalledWith('text/plain');
    expect(response.send).toHaveBeenCalledWith('metric_name 1');
  });

  it('rejects requests with an invalid bearer token', async () => {
    const controller = new MetricsController(
      createObservabilityService(),
      createConfigService('secret-token'),
    );

    await expect(
      controller.getMetrics('Bearer wrong-token', createResponse()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fails closed when the metrics token is not configured', async () => {
    const controller = new MetricsController(
      createObservabilityService(),
      createConfigService(undefined),
    );

    try {
      await controller.getMetrics('Bearer any-token', createResponse());
      throw new Error('Expected metrics controller to reject');
    }
    catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(503);
    }
  });
});
