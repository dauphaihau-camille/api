import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail, IsIn, IsOptional, IsString, MaxLength, 
} from 'class-validator';
import type { EmailAuthIntent } from '../../../app/auth.types';

export class StartEmailAuthDto {
  @ApiProperty({
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    required: false,
    enum: ['login', 'signup'],
  })
  @IsOptional()
  @IsIn(['login', 'signup'])
  intent?: EmailAuthIntent;

  @ApiProperty({
    required: false,
    example: 'Jane',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  display_name?: string;
}

export class StartEmailAuthResponseDto {
  @ApiProperty()
  challenge_id!: string;

  @ApiProperty()
  expires_in_seconds!: number;

  static fromResult(result: {
    challengeId: string;
    expiresInSeconds: number;
  }): StartEmailAuthResponseDto {
    return {
      challenge_id: result.challengeId,
      expires_in_seconds: result.expiresInSeconds,
    };
  }
}
