import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { HealthCheckResult } from './health.service';

export class HealthComponentResponseDto {
  @ApiProperty({
    enum: ['ok', 'error'],
  })
  status!: 'ok' | 'error';

  @ApiPropertyOptional()
  details?: string;
}

export class HealthComponentsResponseDto {
  @ApiProperty({
    type: () => HealthComponentResponseDto,
  })
  db!: HealthComponentResponseDto;

  @ApiProperty({
    type: () => HealthComponentResponseDto,
  })
  storage!: HealthComponentResponseDto;
}

export class HealthCheckResponseDto {
  @ApiProperty({
    enum: ['ok', 'error'],
  })
  status!: HealthCheckResult['status'];

  @ApiProperty()
  timestamp!: string;

  @ApiProperty({
    type: () => HealthComponentsResponseDto,
  })
  components!: HealthComponentsResponseDto;
}
