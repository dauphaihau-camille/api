export interface CursorPaginationMeta {
  limit: number;
  nextCursor?: string;
  hasMore: boolean;
}

export interface CursorPaginatedResult<T> {
  items: T[];
  meta: CursorPaginationMeta;
}

export function buildCursorPaginationMeta(
  limit: number,
  hasMore: boolean,
  nextCursor?: string,
): CursorPaginationMeta {
  return {
    limit,
    nextCursor,
    hasMore,
  };
}
