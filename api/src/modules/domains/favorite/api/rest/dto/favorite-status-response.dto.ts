import { ApiProperty } from '@nestjs/swagger';
import type { FavoriteStatusSummary } from '../../../app/contracts/favorite.contract';

export class FavoriteStatusResponseDto {
  @ApiProperty()
  document_id!: string;

  @ApiProperty()
  is_favorite!: boolean;

  static fromSummary(summary: FavoriteStatusSummary): FavoriteStatusResponseDto {
    return {
      document_id: summary.documentId,
      is_favorite: summary.isFavorite,
    };
  }
}
