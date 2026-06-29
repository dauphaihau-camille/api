import {
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheckResponseDto } from './health-check.response.dto';
import { HealthService } from './health.service';

@Controller('health')
@SkipThrottle()
@ApiTags('Health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health',
  })
  @ApiOkResponse({
    type: HealthCheckResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'One or more health checks failed.',
    type: HealthCheckResponseDto,
  })
  async getHealth() {
    const result = await this.healthService.check();

    if (result.status === 'error') {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness',
  })
  @ApiOkResponse({
    type: HealthCheckResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'One or more readiness checks failed.',
    type: HealthCheckResponseDto,
  })
  async getReadiness() {
    const result = await this.healthService.check();

    if (result.status === 'error') {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
