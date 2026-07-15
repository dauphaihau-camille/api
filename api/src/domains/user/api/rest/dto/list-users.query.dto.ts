import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  USER_LIST_DEFAULT_LIMIT,
  USER_LIST_DEFAULT_PAGE,
  USER_LIST_MAX_LIMIT,
} from '../../../app/user.types';

export class ListUsersQueryDto {
  @ApiPropertyOptional({
    default: USER_LIST_DEFAULT_PAGE,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page: number = USER_LIST_DEFAULT_PAGE;

  @ApiPropertyOptional({
    default: USER_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: USER_LIST_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(USER_LIST_MAX_LIMIT)
  limit: number = USER_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    example: 'created_at:desc',
  })
  @IsOptional()
  @IsString()
  sort?: string;
}
