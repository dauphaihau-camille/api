import { fetchWithTimeout } from './fetch-with-timeout';

describe('fetchWithTimeout', () => {
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
  const originalFetch = global.fetch;

  beforeAll(() => {
    global.fetch = fetchMock;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
  });

  it('adds an abort signal to outbound requests', async () => {
    await fetchWithTimeout('https://example.com', {
      timeoutMs: 1_234,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );

    const [, init] = fetchMock.mock.calls[0];
    const signal = init?.signal as AbortSignal;

    expect(signal.aborted).toBe(false);
  });

  it('preserves the caller signal while enforcing a timeout', async () => {
    const controller = new AbortController();

    await fetchWithTimeout('https://example.com', {
      signal: controller.signal,
    });

    const [, init] = fetchMock.mock.calls[0];
    const signal = init?.signal as AbortSignal;

    expect(signal).not.toBe(controller.signal);

    controller.abort();

    expect(signal.aborted).toBe(true);
  });
});
