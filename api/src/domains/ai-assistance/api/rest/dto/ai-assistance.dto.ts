import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsOptional, IsString, MaxLength,
} from 'class-validator';
import type { CursorPaginatedResult, CursorPaginationMeta } from '~/platform/application/cursor-pagination';
import type { PaginatedResult, PaginationMeta } from '~/platform/application/pagination';
import type {
  AiChatTurnSummary,
  AiConversationSessionSummary,
  AiDocumentAttachment,
} from '../../../app/contracts/ai-assistance.contract';

export class CreateAiChatTurnDto {
  @ApiProperty()
  @IsString()
  @MaxLength(4_000)
  message!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  document_ids?: string[];
}

export class AiDocumentAttachmentResponseDto {
  @ApiProperty()
  document_id!: string;

  @ApiProperty()
  title!: string;

  static fromSummary(attachment: AiDocumentAttachment): AiDocumentAttachmentResponseDto {
    return {
      document_id: attachment.documentId,
      title: attachment.title,
    };
  }
}

export class AiConversationSessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspace_id!: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiProperty()
  group!: string;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;

  static fromSummary(session: AiConversationSessionSummary): AiConversationSessionResponseDto {
    return {
      id: session.id,
      workspace_id: session.workspaceId,
      title: session.title,
      group: session.group,
      created_at: session.createdAt.toISOString(),
      updated_at: session.updatedAt.toISOString(),
    };
  }
}

export class AiPaginationMetaResponseDto {
  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  total_pages!: number;

  @ApiProperty()
  has_next_page!: boolean;

  @ApiProperty()
  has_previous_page!: boolean;

  static fromPaginationMeta(meta: PaginationMeta): AiPaginationMetaResponseDto {
    return {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      total_pages: meta.totalPages,
      has_next_page: meta.hasNextPage,
      has_previous_page: meta.hasPreviousPage,
    };
  }
}

export class PaginatedAiConversationSessionResponseDto {
  @ApiProperty({ type: () => AiConversationSessionResponseDto, isArray: true })
  items!: AiConversationSessionResponseDto[];

  @ApiProperty({ type: () => AiPaginationMetaResponseDto })
  meta!: AiPaginationMetaResponseDto;

  static fromPaginatedResult(
    result: PaginatedResult<AiConversationSessionSummary>,
  ): PaginatedAiConversationSessionResponseDto {
    return {
      items: result.items.map(AiConversationSessionResponseDto.fromSummary),
      meta: AiPaginationMetaResponseDto.fromPaginationMeta(result.meta),
    };
  }
}

export class AiChatTurnResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  session_id!: string;

  @ApiProperty()
  user_message!: string;

  @ApiProperty()
  assistant_response!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty({ type: [AiDocumentAttachmentResponseDto] })
  attachments!: AiDocumentAttachmentResponseDto[];

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;

  static fromSummary(turn: AiChatTurnSummary): AiChatTurnResponseDto {
    return {
      id: turn.id,
      session_id: turn.sessionId,
      user_message: turn.userMessage,
      assistant_response: turn.assistantResponse,
      status: turn.status,
      attachments: turn.attachments.map(AiDocumentAttachmentResponseDto.fromSummary),
      created_at: turn.createdAt.toISOString(),
      updated_at: turn.updatedAt.toISOString(),
    };
  }
}

export class AiCursorPaginationMetaResponseDto {
  @ApiProperty()
  limit!: number;

  @ApiPropertyOptional()
  next_cursor?: string;

  @ApiProperty()
  has_more!: boolean;

  static fromCursorPaginationMeta(meta: CursorPaginationMeta): AiCursorPaginationMetaResponseDto {
    return {
      limit: meta.limit,
      next_cursor: meta.nextCursor,
      has_more: meta.hasMore,
    };
  }
}

export class CursorPaginatedAiChatTurnResponseDto {
  @ApiProperty({ type: () => AiChatTurnResponseDto, isArray: true })
  items!: AiChatTurnResponseDto[];

  @ApiProperty({ type: () => AiCursorPaginationMetaResponseDto })
  meta!: AiCursorPaginationMetaResponseDto;

  static fromCursorPaginatedResult(
    result: CursorPaginatedResult<AiChatTurnSummary>,
  ): CursorPaginatedAiChatTurnResponseDto {
    return {
      items: result.items.map(AiChatTurnResponseDto.fromSummary),
      meta: AiCursorPaginationMetaResponseDto.fromCursorPaginationMeta(result.meta),
    };
  }
}
