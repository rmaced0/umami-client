import umami, { UmamiEventData, UmamiOptions, UmamiPayload } from './index';

const mockFetchResponse = {
  ok: true,
  json: jest.fn().mockResolvedValue({ success: true }),
};

// Helper function to mock fetch
const mockFetch = () => {
  global.fetch = jest.fn().mockResolvedValue(mockFetchResponse);
};

// Reads the `payload` object from the most recent /api/send request body.
const lastSentPayload = (): Record<string, unknown> => {
  const calls = (global.fetch as jest.Mock).mock.calls;
  const { body } = calls[calls.length - 1][1] as { body: string };
  return (JSON.parse(body) as { payload: Record<string, unknown> }).payload;
};

// Helper function to run common tests
const runCommonTests = () => {
  test('should initialize with default options', () => {
    expect(umami.options.websiteId).toBe('test-website');
    expect(umami.options.hostUrl).toBe('https://example.com');
  });

  test('should track page views', async () => {
    mockFetch();
    const response = await umami.trackPageView();
    expect(fetch).toHaveBeenCalled();
    expect(response.ok).toBe(true);
  });

  test('should track page views with payload', async () => {
    const event: UmamiPayload = { title: 'test' };

    mockFetch();
    const response = await umami.trackPageView(event);
    expect(fetch).toHaveBeenCalled();
    expect(response.ok).toBe(true);
  });

  test('should track custom events', async () => {
    mockFetch();
    const response = await umami.trackEvent('button_press');
    expect(fetch).toHaveBeenCalled();
    expect(response.ok).toBe(true);
  });

  test('should track custom events with payload', async () => {
    const event: UmamiEventData = { id: 'test' };

    mockFetch();
    const response = await umami.trackEvent('button_press', event);
    expect(fetch).toHaveBeenCalled();
    expect(response.ok).toBe(true);
  });

  test('should identify user', async () => {
    const properties = { userId: 'user123' };

    mockFetch();
    const response = await umami.identify(properties);
    expect(fetch).toHaveBeenCalled();
    expect(response.ok).toBe(true);
  });

  test('should identify user with no inputs', async () => {
    mockFetch();
    const response = await umami.identify();
    expect(fetch).toHaveBeenCalled();
    expect(response.ok).toBe(true);
  });

  test('should reset properties', () => {
    umami.reset();
    expect(umami.properties).toEqual({});
  });

  test('should omit payload.id when no distinctId is configured', async () => {
    mockFetch();
    await umami.trackEvent('button_press');
    expect(lastSentPayload()).not.toHaveProperty('id');
  });
};

describe('Umami', () => {
  const options: UmamiOptions = {
    websiteId: 'test-website',
    hostUrl: 'https://example.com',
  };

  beforeEach(() => {
    umami.reset();
    umami.init(options);
  });

  runCommonTests();
});

describe('Umami with user agent', () => {
  const options: UmamiOptions = {
    websiteId: 'test-website',
    hostUrl: 'https://example.com',
    userAgent: 'Mozilla',
  };

  beforeEach(() => {
    umami.reset();
    umami.init(options);
  });

  runCommonTests();
});

describe('Umami with distinctId', () => {
  const options: UmamiOptions = {
    websiteId: 'test-website',
    hostUrl: 'https://example.com',
    distinctId: 'visitor-123',
  };

  beforeEach(() => {
    umami.reset();
    umami.init(options);
    mockFetch();
  });

  test('sends the distinctId as top-level payload.id on custom events', async () => {
    await umami.trackEvent('button_press', { status: 'in-progress' });
    const payload = lastSentPayload();

    expect(payload.id).toBe('visitor-123');
    // The distinctId must identify the visitor, not leak into event properties.
    expect(payload.data).toEqual({ status: 'in-progress' });
    expect((payload.data as Record<string, unknown>).id).toBeUndefined();
  });

  test('sends the distinctId as top-level payload.id on page views', async () => {
    await umami.trackPageView();
    expect(lastSentPayload().id).toBe('visitor-123');
  });
});

describe('Umami identify', () => {
  const options: UmamiOptions = {
    websiteId: 'test-website',
    hostUrl: 'https://example.com',
    sessionId: 'session-abc',
    distinctId: undefined,
  };

  beforeEach(() => {
    umami.reset();
    umami.init(options);
    mockFetch();
  });

  test('sends properties.id as the top-level payload.id', async () => {
    await umami.identify({ id: 'user-123', plan: 'pro' });
    expect(lastSentPayload().id).toBe('user-123');
  });

  test('keeps the id out of the identify data properties', async () => {
    await umami.identify({ id: 'user-123', plan: 'pro' });
    expect(lastSentPayload().data).toEqual({ plan: 'pro' });
  });

  test('persists the identified id so later events share the visitor', async () => {
    await umami.identify({ id: 'user-123' });
    await umami.trackEvent('button_press');
    expect(lastSentPayload().id).toBe('user-123');
  });

  test('falls back to the configured distinctId when no id is given', async () => {
    umami.init({ ...options, distinctId: 'visitor-123' });

    await umami.identify({ plan: 'pro' });
    const payload = lastSentPayload();

    expect(payload.id).toBe('visitor-123');
    expect(payload.data).toEqual({ plan: 'pro' });
  });

  test('omits payload.id when no id is given and none is configured', async () => {
    await umami.identify({ plan: 'pro' });
    expect(lastSentPayload()).not.toHaveProperty('id');
  });

  // Umami's /api/send schema has no `session` field, so Zod strips it server-side.
  test('does not send a client-supplied session', async () => {
    await umami.identify({ id: 'user-123' });
    expect(lastSentPayload()).not.toHaveProperty('session');
  });
});
