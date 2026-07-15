import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

const supportedTokenTypes = ['reset_password'] as const;

export class VerifyTokenDto {
  @ApiProperty({
    example: 'reset_token_123',
  })
  @IsString()
  token!: string;

  @ApiProperty({
    enum: supportedTokenTypes,
    example: 'reset_password',
  })
  @IsString()
  @IsIn(supportedTokenTypes)
  type!: (typeof supportedTokenTypes)[number];
}
