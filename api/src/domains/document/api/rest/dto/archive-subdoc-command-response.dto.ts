import { ApiProperty } from '@nestjs/swagger';
import type { ArchiveSubdocCommandResult } from '../../../app/contracts/document.contract';
import { DocumentResponseDto } from './document-response.dto';

export class ArchiveSubdocCommandResponseDto {
  @ApiProperty({
    type: DocumentResponseDto,
  })
  parent_document!: DocumentResponseDto;

  @ApiProperty({
    type: DocumentResponseDto,
  })
  archived_child_document!: DocumentResponseDto;

  static fromResult(result: ArchiveSubdocCommandResult): ArchiveSubdocCommandResponseDto {
    return {
      parent_document: DocumentResponseDto.fromSummary(result.parentDocument),
      archived_child_document: DocumentResponseDto.fromSummary(result.archivedChildDocument),
    };
  }
}
