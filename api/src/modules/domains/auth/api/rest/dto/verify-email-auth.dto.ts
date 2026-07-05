import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

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
}
