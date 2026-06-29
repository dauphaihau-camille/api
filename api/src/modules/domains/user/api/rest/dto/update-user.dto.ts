import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum, IsInt, IsOptional, IsString, Min, 
} from 'class-validator';
import { UserStatus } from '~/modules/domains/auth/domain/enums/user-status.enum';

export class UpdateUserDto {
  @ApiProperty({
    minimum: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version!: number;

  @ApiPropertyOptional({
    example: 'Jane Doe',
  })
  @IsOptional()
  @IsString()
  display_name?: string;

  @ApiPropertyOptional({
    enum: UserStatus,
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({
    type: 'string',
    format: 'binary',
  })
  avatar_file?: unknown;
}
