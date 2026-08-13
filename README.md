# umami-client

## Overview

The Umami node client allows you to send data to Umami.

## Installation

```shell
npm install umami-client
```

or with yarn

```shell
yarn add umami-client
```

This command will install api client [npm package](https://www.npmjs.com/package/@bert0rm/umami-client).
## Usage

```js
import umami from 'umami-client';

//~ init
let umamiClient = new umami.Umami({
  websiteId: '50429a93-8479-4073-be80-d5d29c09c2ec', // Your website id
  hostUrl: 'https://umami.mywebsite.com' // URL to your Umami instance
  // ,userAgent // (optional) agent specifications ( OS / Browser / Device )
  // ,distinctId // (optional) stable visitor id, sent as `id` on every page view and event
});

//~ track a page
await umamiClient.trackPageView();

//~ track a page with custom properties
const url = `/home`;
const title = "title of /home";
let event = {url, title}
await umamiClient.trackPageView(event);

//~ track a custom event
const event_name = "button-click"
const data = {"color": "red"};
await umamiClient.trackEvent(event_name, data);

//~ track a custom event for revenue reporting
const event_name = "checkout-store"
const data = {"item": "shirt", revenue: 19.99, currency: 'USD'};
await umamiClient.trackEvent(event_name, data);

//~ (optional) identify : add custom attributes to current session
const identifyOptions = {
  "attribute": "11.23",
}
await umamiClient.identify(identifyOptions);
```

If you're using Umami Cloud, then you can use `https://cloud.umami.is` as `hostUrl`.

For the `.trackPageView(payload)` function's `payload` argument, the properties you can send are:

- **hostname**: Hostname of server
- **language**: Client language (eg. en-US)
- **referrer**: Page referrer
- **screen**: Screen dimensions (eg. 1920x1080)
- **title**: Page title
- **url**: Page url

For the `.trackEvent(event_name, data)` function, you can add as many properties in `data` as you'd like.
- **event_name**: Event name
- **data**: Event data custom properties (values must be a `string`, `number`, or `Date`)

### Identifying the visitor with `distinctId`

By default, Umami derives an anonymous visitor server-side by hashing the request (IP + user agent + a periodically-rotating salt). Set a stable `distinctId` in the client options to attribute every page view and event to a single visitor you control:

```js
const umamiClient = new umami.Umami({
  websiteId: '50429a93-8479-4073-be80-d5d29c09c2ec',
  hostUrl: 'https://umami.mywebsite.com',
  distinctId: 'a-stable-per-visitor-id', // e.g. a persisted UUID, or your logged-in user id
});
```

When set, the client sends `distinctId` as the top-level `id` (Umami's `distinctId`) on every `trackPageView` and `trackEvent` call, so activity stays tied to one visitor regardless of the rotating server session. When omitted, no `id` is sent and Umami falls back to its server-side session.
