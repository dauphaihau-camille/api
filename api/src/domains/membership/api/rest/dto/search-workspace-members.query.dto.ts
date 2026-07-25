import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

const DEFAULT_WORKSPACE_MEMBER_SEARCH_LIMIT = 5;
const MAX_WORKSPACE_MEMBER_SEARCH_LIMIT = 10;

export class SearchWorkspaceMembersQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    default: DEFAULT_WORKSPACE_MEMBER_SEARCH_LIMIT,
    minimum: 1,
    maximum: MAX_WORKSPACE_MEMBER_SEARCH_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(MAX_WORKSPACE_MEMBER_SEARCH_LIMIT)
  limit: number = DEFAULT_WORKSPACE_MEMBER_SEARCH_LIMIT;
}
