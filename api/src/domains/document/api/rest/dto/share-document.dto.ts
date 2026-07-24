import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DocumentAccessGrantPermission } from '../../../domain/enums/document-access-grant-permission.enum';

export class ShareDocumentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    enum: DocumentAccessGrantPermission,
  })
  @IsEnum(DocumentAccessGrantPermission)
  permission!: DocumentAccessGrantPermission;
}

export class ShareDocumentsDto {
  @ApiProperty({
    type: ShareDocumentDto,
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShareDocumentDto)
  grants!: ShareDocumentDto[];
}
