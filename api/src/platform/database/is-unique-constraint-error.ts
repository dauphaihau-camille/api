export function isUniqueConstraintError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const databaseError = error as Error & {
    code?: string;
    sqlState?: string;
  };

  return databaseError.name === 'UniqueConstraintViolationException'
    || databaseError.code === '23505'
    || databaseError.sqlState === '23505'
    || databaseError.message.includes('duplicate key value violates unique constraint');
}
