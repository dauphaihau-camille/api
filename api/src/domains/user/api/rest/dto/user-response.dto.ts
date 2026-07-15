import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PaginatedResult, PaginationMeta } from '~/platform/application/pagination';
import type { UserSummary, UserListSort } from '../../../app/user.types';

export class UserSummaryResponseDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  version!: number;
  @ApiProperty()
  email!: string;
  @ApiPropertyOptional()
  display_name?: string;
  @ApiPropertyOptional()
  avatar?: string;
  @ApiProperty()
  status!: UserSummary['status'];

  static fromUserSummary(user: UserSummary): UserSummaryResponseDto {
    return {
      id: user.id,
      version: user.version,
      email: user.email,
      display_name: user.displayName,
      avatar: user.avatar,
      status: user.status,
    };
  }
}

export class PaginationMetaResponseDto {
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

  static fromPaginationMeta(meta: PaginationMeta): PaginationMetaResponseDto {
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

export class PaginatedUserSummaryResponseDto {
  @ApiProperty({
    type: () => UserSummaryResponseDto,
    isArray: true,
  })
  items!: UserSummaryResponseDto[];
  @ApiProperty({
    type: () => PaginationMetaResponseDto,
  })
  meta!: PaginationMetaResponseDto;

  static fromPaginatedResult(
    result: PaginatedResult<UserSummary>,
  ): PaginatedUserSummaryResponseDto {
    return {
      items: result.items.map(UserSummaryResponseDto.fromUserSummary),
      meta: PaginationMetaResponseDto.fromPaginationMeta(result.meta),
    };
  }
}

const externalToInternalSortFieldMap = {
  created_at: 'createdAt',
  email: 'email',
  display_name: 'displayName',
  status: 'status',
} as const satisfies Record<string, UserListSort['field']>;

export const USER_LIST_SORT_FIELDS_API = Object.keys(
  externalToInternalSortFieldMap,
) as Array<keyof typeof externalToInternalSortFieldMap>;

export function mapUserListSortField(field: string): UserListSort['field'] {
  return externalToInternalSortFieldMap[
    field as keyof typeof externalToInternalSortFieldMap
  ];
}
