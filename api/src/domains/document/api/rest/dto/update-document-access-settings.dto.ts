import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { DocumentAccessGrantPermission } from '../../../domain/enums/document-access-grant-permission.enum';

export class UpdateDocumentAccessSettingsDto {
  @ApiPropertyOptional({
    enum: DocumentAccessGrantPermission,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(DocumentAccessGrantPermission)
  workspace_member_permission?: DocumentAccessGrantPermission | null;
}
