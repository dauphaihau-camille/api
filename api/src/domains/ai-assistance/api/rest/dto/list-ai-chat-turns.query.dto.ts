import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional, IsString, Max, Min, 
} from 'class-validator';
import {
  AI_CHAT_TURN_LIST_DEFAULT_LIMIT,
  AI_CHAT_TURN_LIST_MAX_LIMIT,
} from '../../../app/contracts/ai-assistance.contract';

export class ListAiChatTurnsQueryDto {
  @ApiPropertyOptional({
    default: AI_CHAT_TURN_LIST_DEFAULT_LIMIT,
    minimum: 1,
    maximum: AI_CHAT_TURN_LIST_MAX_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(AI_CHAT_TURN_LIST_MAX_LIMIT)
  limit: number = AI_CHAT_TURN_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    description: 'Opaque cursor returned as meta.next_cursor from the previous page.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;
}
