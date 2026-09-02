export class AiProviderHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly providerName: string,
  ) {
    super(message);
  }
}

export class AiProviderUnsupportedOperationError extends Error {
  constructor(providerName: string, operation: string) {
    super(`${providerName} does not support ${operation}.`);
  }
}

export function isTransientAiProviderError(error: unknown): boolean {
  const status = extractErrorStatus(error);

  if (status !== undefined) {
    return status === 408 || status === 429 || status >= 500;
  }

  if (error instanceof Error) {
    return error.name === 'AbortError'
      || error.name === 'TimeoutError'
      || error.name === 'APIConnectionTimeoutError'
      || error.name === 'RequestTimeoutError'
      || error.name === 'ConnectionError';
  }

  return false;
}

export function extractErrorStatus(error: unknown): number | undefined {
  if (error instanceof AiProviderHttpError) {
    return error.status;
  }

  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { status?: unknown; statusCode?: unknown };

  if (typeof candidate.status === 'number') {
    return candidate.status;
  }

  if (typeof candidate.statusCode === 'number') {
    return candidate.statusCode;
  }

  return undefined;
}
