const DEFAULT_EXTERNAL_HTTP_TIMEOUT_MS = 5_000;

export interface FetchWithTimeoutInit extends RequestInit {
  timeoutMs?: number;
}

export async function fetchWithTimeout(
  input: string | URL | globalThis.Request,
  init: FetchWithTimeoutInit = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_EXTERNAL_HTTP_TIMEOUT_MS, signal, ...rest } = init;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  return fetch(input, {
    ...rest,
    signal: requestSignal,
  });
}
