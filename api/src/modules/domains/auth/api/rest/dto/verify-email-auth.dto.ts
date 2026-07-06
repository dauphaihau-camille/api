import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn, IsOptional, IsString, Length, MaxLength, 
} from 'class-validator';
import type { EmailAuthIntent } from '../../../app/auth.types';

export class VerifyEmailAuthDto {
  @ApiProperty()
  @IsString()
  challenge_id!: string;

  @ApiProperty({
    minLength: 6,
    maxLength: 6,
    example: '123456',
  })
  @IsString()
  @Length(6, 6)
  code!: string;

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
