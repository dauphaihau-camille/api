import { ApiProperty } from '@nestjs/swagger';
import type { CreateSubdocCommandResult } from '../../../app/contracts/document.contract';
import { DocumentResponseDto } from './document-response.dto';

export class CreateSubdocCommandResponseDto {
  @ApiProperty({
    type: DocumentResponseDto,
  })
  parent_document!: DocumentResponseDto;

  @ApiProperty({
    type: DocumentResponseDto,
  })
  child_document!: DocumentResponseDto;

  static fromResult(result: CreateSubdocCommandResult): CreateSubdocCommandResponseDto {
    return {
      parent_document: DocumentResponseDto.fromSummary(result.parentDocument),
      child_document: DocumentResponseDto.fromSummary(result.childDocument),
    };
  }
}
