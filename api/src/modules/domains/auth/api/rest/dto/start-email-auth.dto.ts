import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class StartEmailAuthDto {
  @ApiProperty({
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;
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
