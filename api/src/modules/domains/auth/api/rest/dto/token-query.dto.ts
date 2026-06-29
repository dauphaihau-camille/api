import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TokenQueryDto {
  @ApiProperty({
    example: 'reset_token_123',
  })
  @IsString()
  token!: string;
}
