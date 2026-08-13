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
