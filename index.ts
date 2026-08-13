import { version } from './package.json';

/**
 * Interface representing the configuration options for Umami.
 *
 * @property websiteId - The unique identifier for the website being tracked. This is a required property.
 * @property hostUrl - The base URL of the Umami server. Must not end with a `/`. Optional.
 * @property sessionId - A unique identifier for the session. This can be used to track a specific user session. Optional.
 * @property distinctId - A stable, caller-owned identifier for the visitor (Umami's `distinctId`). When set, it is
 *   sent as the top-level `id` on every page view and event so Umami attributes them all to the same visitor,
 *   independent of its server-computed, salt-rotating session. Optional.
 * @property userAgent - The user agent string of the client making the request. Optional.
 */
export interface UmamiOptions {
  websiteId: string;
  hostUrl: string;
  sessionId?: string;
  distinctId?: string;
  userAgent?: string;
}

/**
 * Represents the internal payload structure used for Umami.
 */
interface InternalUmamiPayload extends UmamiPayload {
  website: string;
  id?: string;
  name?: string;
  data?: UmamiEventData;
}

/**
 * Represents the payload structure used for Umami.
 */
export interface UmamiPayload {
  session?: string;
  hostname?: string;
  language?: string;
  referrer?: string;
  screen?: string;
  title?: string;
  url?: string;
}

/**
 * Represents a structure for event data in the Umami analytics system.
 * The data is represented as a collection of key-value pairs where the keys are strings.
 * Known properties are `revenue` and `currency` which are used for the Revenue report.
 *
 * Values associated with the keys can be of the following types:
 * - string: Used to represent textual data.
 * - number: Used to represent numeric values.
 * - Date: Used to represent temporal information.
 * - Undefined: Used for optional properties. Omitted from final payload if undefined.
 *
 */
export interface UmamiEventData extends Partial<UmamiRevenueData> {
  [key: string]: string | number | Date | undefined;
}

/**
 * Represents revenue data in Umami. This is used for the Revenue report.
 *
 * Properties:
 * - `revenue`: A numerical value representing the total revenue.
 * - `currency`: A string value indicating the currency of the revenue,
 *   adhering to ISO 4217 standard currency codes. If not recognized, the report will default to USD.
 */
export interface UmamiRevenueData {
  revenue: number;
  currency: string;
}

enum EventType {
  Event = 'event',
  Identify = 'identify',
}

/**
 * Represents an instance of Umami used for tracking events.
 * Provides methods to initialize the instance, track specific actions, and manage user properties.
 */
export class Umami {
  options: UmamiOptions;
  properties: object;

  constructor(options: UmamiOptions) {
    this.properties = {};
    this.options = options;
  }

  /**
   * Initializes the Umami instance with the given configuration options.
   *
   * @param {UmamiOptions} options - The configuration options for the Umami instance.
   * @return {void} Does not return a value.
   */
  init(options: UmamiOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Sends an event or data payload to the server.
   *
   * @param {UmamiPayload} payload - The data payload to be sent, containing relevant event details.
   * @param {EventType} [type=EventType.Event] - The type of event being sent (default is EventType.Event).
   * @return {Promise<Response>} A promise that resolves with the server's response.
   */
  private send(
    payload: InternalUmamiPayload,
    type: EventType = EventType.Event,
  ): Promise<Response> {
    const { hostUrl, userAgent } = this.options;

    return fetch(`${hostUrl}/api/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': userAgent || `Mozilla/5.0 Umami/${version}`,
      },
      body: JSON.stringify({ type, payload: payload }),
    });
  }

  /**
   * Tracks a page view event with specified or default parameters and sends the information to Umami.
   *
   * @param {UmamiPayload} [payload] - Optional additional data to send with the page view event.
   * Overrides defaults obtained from the browser.
   * @param data {UmamiEventData} [data] - Optional additional data to include with the page view event.
   * @return {Promise<Response>} - A promise that resolves to the server response from the tracking event.
   */
  trackPageView(payload?: UmamiPayload, data?: UmamiEventData): Promise<Response> {
    const { websiteId, distinctId } = this.options;

    return this.send(
      {
        website: websiteId,
        id: distinctId,
        hostname: window.location.hostname,
        language: navigator.language,
        referrer: document.referrer,
        screen: `${window.screen.width}x${window.screen.height}`,
        title: document.title,
        url: window.location.pathname,
        ...payload,
        ...data,
      },
      EventType.Event,
    );
  }

  /**
   * Tracks an event by sending event data to Umami.
   *
   * @param {string} event_name - The name of the event being tracked.
   * @param {UmamiEventData} [data] - Optional additional data to include with the event.
   * Overrides defaults obtained from the browser.
   * @return {Promise<Response>} A promise that resolves to the server response.
   */
  trackEvent(event_name: string, data?: UmamiEventData): Promise<Response> {
    const { websiteId, distinctId } = this.options;

    return this.send({
      hostname: window.location.hostname,
      language: navigator.language,
      referrer: document.referrer,
      screen: `${window.screen.width}x${window.screen.height}`,
      title: document.title,
      url: window.location.pathname,
      website: websiteId,
      id: distinctId,
      name: event_name,
      data: data,
    });
  }

  /**
   * Identifies a user by merging the provided properties with existing properties
   * and attaches the identifying properties to the sessionID in Umami.
   *
   * @param {object} [properties={}] - The user properties to be merged with existing properties and saved to Umami.
   * @return {Promise<Response>} A promise that resolves to the server response after sending the identification data.
   */
  identify(properties: object = {}): Promise<Response> {
    this.properties = { ...this.properties, ...properties };
    const { sessionId, websiteId } = this.options;

    return this.send(
      { website: websiteId, session: sessionId, data: { ...this.properties } },
      EventType.Identify,
    );
  }

  /**
   * Resets the properties of the current instance by clearing all existing properties.
   * @return {void} Does not return a value.
   */
  reset(): void {
    this.properties = {};
  }
}

const umami = new Umami({ websiteId: '', hostUrl: 'https://cloud.umami.is' });

export default umami;
