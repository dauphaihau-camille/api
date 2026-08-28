import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import {
  AI_CONVERSATION_SESSION_LIST_DEFAULT_LIMIT,
  AI_CONVERSATION_SESSION_LIST_DEFAULT_PAGE,
  AI_CONVERSATION_SESSION_LIST_MAX_LIMIT,
} from '../../../app/contracts/ai-assistance.contract';

export class ListAiConversationSessionsQueryDto {
  @ApiPropertyOptional({
    default: AI_CONVERSATION_SESSION_LIST_DEFAULT_PAGE,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page: number = AI_CONVERSATION_SESSION_LIST_DEFAULT_PAGE;

  @ApiPropertyOptional({
    default: AI_CONVERSATION_SESSION_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: AI_CONVERSATION_SESSION_LIST_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(AI_CONVERSATION_SESSION_LIST_MAX_LIMIT)
  limit: number = AI_CONVERSATION_SESSION_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Search conversation titles.',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
