import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCheckoutSessionRequestDto {
  @ApiPropertyOptional({
    description: 'Browser URL to return to after checkout completes or is canceled.',
  })
  @IsOptional()
  @IsString()
  return_url?: string;
}
