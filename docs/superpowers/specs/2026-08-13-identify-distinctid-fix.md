# Fix `identify()` to send the distinctId — Design / Handoff

**Date:** 2026-08-13
**Status:** Draft
**Repo:** `umami-client`

## TL;DR

`identify()` sends the wrong payload: it includes a client `session` (which Umami
ignores for identity) and **omits the top-level `id`** that Umami needs to link an
anonymous session to a known user. As written, calling `identify()` establishes no
link. This is a **library-correctness bug**, not blocking any known consumer.

## Background

This surfaced while fixing a different issue in the consuming app (`xsp2stonks`):
custom events and page views were attributed to two different Umami visitors. That
was fixed by adding a first-class `distinctId` option to this client (shipped in
**1.2.0**), so the client now stamps `distinctId` as the top-level payload `id` on
every `trackPageView`/`trackEvent`. While reading Umami's source to verify that, we
found `identify()` has the same class of gap but was never corrected.

## The bug

Current `identify()` (`index.ts`):

```js
identify(properties = {}) {
  this.properties = { ...this.properties, ...properties };
  const { sessionId, websiteId } = this.options;
  return this.send(
    { website: websiteId, session: sessionId, data: { ...this.properties } },
    EventType.Identify,
  );
}
```

Two problems:

1. **No top-level `id`.** Umami's identify path links a session to a user only when
   the payload carries `id` (the distinctId). This method never sends one.
2. **`session: sessionId` is inert.** Umami computes the session server-side (hash of
   IP + user-agent + a rotating salt) and does not trust a client-supplied `session`
   for identity.

## Evidence (authoritative)

From Umami's collector, `umami-software/umami` → `src/app/api/send/route.ts` (read on
`master`):

- The handler destructures `id` from the payload and uses it as `distinctId`.
- In the `type === 'identify'` branch it does roughly:
  `if (websiteId && id) { const newLinkId = hash(sessionId, id); /* save session->user link */ }`
  where `sessionId` is the **server-computed** session. No `id` => the `if` is false =>
  no link.
- The session id itself is `uuid(sourceId, ip, userAgent, sessionSalt)` — server-side,
  salt rotates (~monthly).

**Re-open that file to confirm against the targeted Umami version** — the branch logic
can shift between releases.

## Proposed fix (confirm before implementing)

Make `identify()` send a top-level `id`. Open design questions:

- **Where does the id come from?** Likely `this.options.distinctId` (added in 1.2.0),
  so `identify()` is consistent with `trackPageView`/`trackEvent`. Optionally also
  accept an explicit id argument (`identify(properties, id?)`) for per-call callers.
- **Keep or drop `session: sessionId`?** It appears inert; verify against the target
  Umami version before removing (some deployments/versions may read it).
- **Keep `data: { ...properties }`** — that carries the user attributes and is the
  point of identify; leave it.

Sketch:

```js
identify(properties = {}) {
  this.properties = { ...this.properties, ...properties };
  const { websiteId, distinctId } = this.options;
  return this.send(
    { website: websiteId, id: distinctId, data: { ...this.properties } },
    EventType.Identify,
  );
}
```

## Testing & conventions (gotchas)

- **Tests:** Jest + ts-jest, jsdom env, in `index.test.ts`. **Project standard is 100%
  coverage** — keep it.
- **How to assert:** mock `global.fetch`, parse the request body, assert `payload.id`.
  There is already a `lastSentPayload()` helper in `index.test.ts` (from the distinctId
  work) — reuse it. Follow the existing `describe`/`runCommonTests` pattern. Note
  `umami` is a **singleton** and `init()` **merges** options, so order-dependent state
  can leak — set/clear options explicitly.
- **Unit tests can only assert payload shape** (that `id` is sent). True end-to-end
  verification (that Umami creates the link) needs a live Umami instance + the dashboard
  — call that out as a manual step; do not fake it.
- **`jest.config.ts` must stay loadable:** it uses `import type { Config } from 'jest'`.
  A value import breaks Jest 30 under Node's ESM/type-stripping loader.
- **Do not run bare `yarn check-types` and commit the result** — the repo's `tsc` has no
  `noEmit`, so it emits `index.js`/`*.js` into the repo root. Clean them up if they
  appear (`git status` will show `jest.config.js`, `index.test.js` as untracked).

## Release

Uses `semantic-release` + conventionalcommits. A **`fix:`** commit/PR title => **patch**
bump, auto-published on merge. Do **not** hand-edit `package.json`'s version. The git
remote points at the old `bert0RM/umami-client` name, which redirects to
`rmaced0/umami-client`; PRs land there.

## Scope note

This does **not** affect `xsp2stonks`, which uses the per-event `distinctId` (Option A)
and does not call `identify()`. This fix is purely to make the library's `identify()`
correct for other consumers.
