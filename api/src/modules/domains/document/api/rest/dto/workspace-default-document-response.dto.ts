import { ApiPropertyOptional } from '@nestjs/swagger';
import type { WorkspaceDefaultDocument } from '../../../app/contracts/document.contract';

export class WorkspaceDefaultDocumentResponseDto {
  @ApiPropertyOptional()
  document_id?: string;

  static fromDefaultDocument(
    document: WorkspaceDefaultDocument,
  ): WorkspaceDefaultDocumentResponseDto {
    return {
      document_id: document.documentId,
    };
  }
}
