import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    minLength: 20,
    description: 'Optional when the refresh token is provided via cookie.',
    example: 'rt_1234567890abcdefghijklmn',
  })
  @IsOptional()
  @IsString()
  @MinLength(20)
  refresh_token!: string;
}
