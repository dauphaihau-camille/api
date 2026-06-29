import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    minLength: 8,
    example: 'new-strong-password',
  })
  @IsString()
  @MinLength(8)
  password!: string;
}
