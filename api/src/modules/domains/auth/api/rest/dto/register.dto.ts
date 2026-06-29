import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail, IsOptional, IsString, MinLength, 
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    minLength: 8,
    example: 'strong-password',
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: 'Jane Doe',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  display_name?: string;
}
