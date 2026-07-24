import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { DocumentAccessGrantPermission } from '../../../domain/enums/document-access-grant-permission.enum';

export class UpdateDocumentInvitationDto {
  @ApiProperty({
    enum: DocumentAccessGrantPermission,
  })
  @IsEnum(DocumentAccessGrantPermission)
  permission!: DocumentAccessGrantPermission;
}
