# httpbin-hono

A [httpbin](https://httpbin.org/) implementation built with [Hono](https://hono.dev/) and deployed on Cloudflare Workers.

**🌐 Live Demo**: [httpbin-hono.naas.workers.dev](https://httpbin-hono.naas.workers.dev/)

httpbin is a simple HTTP Request & Response service, useful for testing HTTP clients and APIs. Special thanks to [Kenneth Reitz](https://www.kennethreitz.org/) for creating the original httpbin project. This implementation is inspired by and built upon the foundation of httpbin.

- **Original httpbin**: [httpbin.org](https://httpbin.org/)
- **httpbin GitHub**: [github.com/postmanlabs/httpbin](https://github.com/postmanlabs/httpbin)
- **Kenneth Reitz**: [kennethreitz.org](https://www.kennethreitz.org/)

## 🚀 Deploy in One Click

**Self-host your own httpbin instance on Cloudflare Workers in seconds.** No configuration needed—just click the button below and deploy directly to your Cloudflare account. Get your own private httpbin service with no rate limits, complete control, and full customization.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nakanoasaservice/httpbin-hono)

After deployment, your httpbin service will be available at `https://your-worker-name.your-subdomain.workers.dev`. Visit the root endpoint to access the interactive Swagger UI documentation.

## Why httpbin-hono?

- **🚀 Easy Cloudflare Deployment**: Deploy to Cloudflare Workers with a single click—no Docker, no server management, no infrastructure setup required
- **⚡ Fast & Low Latency**: Built on Cloudflare's global edge network for minimal latency worldwide
- **💰 Cost-Effective**: Extremely affordable—free for most use cases thanks to Cloudflare Workers' generous free tier
- **🔧 Portable**: Built with [Hono](https://hono.dev/), making it easy to deploy to other platforms (Node.js, Deno, Bun, etc.) if needed

## Prerequisites

- [pnpm](https://pnpm.io/) 12
- Node.js 24 (used by [Vite+](https://viteplus.dev/) for formatting, linting, type checking and tests)

## Installation

```bash
pnpm install
```

## Development

Start the development server:

```bash
pnpm run dev
```

The service will be available at `http://localhost:8787` (or the port specified by Wrangler).

## Deployment

### Deploy Manually

Deploy to Cloudflare Workers:

```bash
pnpm run deploy
```

## Type Generation

For generating/synchronizing types based on your Worker configuration, run:

```bash
pnpm run cf-typegen
```

Routes that use bindings (such as `ASSETS`) pass the `Env` as generics when instantiating `Hono`:

```ts
// src/routes/images.ts
export const images = new Hono<{ Bindings: Env }>();
```

## Code Quality

Formatting, linting and type checking run through [Vite+](https://viteplus.dev/) (Oxfmt, Oxlint and tsgolint), configured in `vite.config.ts`:

```bash
pnpm run check
```

Auto-fix issues:

```bash
pnpm run check:fix
```

## Testing

Tests run in the Workers runtime with Vite+ (Vitest) and `@cloudflare/vitest-plugin`:

```bash
pnpm run test
```

## API Documentation

Once the server is running, visit the root endpoint (`/`) to access the Swagger UI documentation, which provides an interactive interface to explore all available endpoints.

## Differences from httpbin

httpbin-hono implements every endpoint of [httpbin](https://github.com/postmanlabs/httpbin) (as of commit `f8ec666`) except `/legacy`, including CORS headers on every response and cookie-based state for Digest auth. The differences below are intentional: they come from the Cloudflare Workers platform, fix bugs in the original, keep information httpbin throws away, or avoid complexity for little benefit.

### Platform (Cloudflare Workers)

- **Request header names are lowercase.** Workers normalizes header names, so `/headers`, `/get` and similar endpoints return `user-agent` instead of `User-Agent`.
- **`origin` comes from Cloudflare headers.** The client IP is read from `CF-Connecting-IP`, then `True-Client-IP`, `X-Forwarded-For` and `X-Real-IP`. Cloudflare's own headers (`CF-Ray`, `CF-IPCountry`, …) are hidden like httpbin's environment headers unless `?show_env=1` is passed.
- **`/status` supports 200–599 only.** The Workers `Response` constructor rejects other codes, so 1xx codes return `400`. For the same reason, `/drip?code=` must be a status code that can carry a body.
- **`/brotli` is compressed by the runtime.** Workers has no brotli encoder for JavaScript, so the response is marked `Content-Encoding: br` and the runtime compresses it when sending. If the client doesn't accept brotli, Cloudflare re-encodes it (for example as gzip). `/gzip` and `/deflate` are compressed by the worker and always use that encoding, like httpbin.

### Bug fixes and stricter validation

- **Invalid input returns `400`.** In httpbin, a non-integer path segment returns `404` (`/bytes/abc`, `/redirect/abc`), and some invalid values crash with `500` (`/redirect/0`, `/delay/-1`, `/bytes/10?seed=abc`, `/drip?numbytes=abc`).
- **Digest auth checks the algorithm in the URL.** httpbin hashes with whatever `algorithm` the client sends, so `/digest-auth/auth/user/passwd/SHA-256` also accepts an MD5 response. httpbin-hono requires the algorithm the route asks for.
- **`/base64` also accepts standard Base64** (`+`, padding), not just the URL-safe alphabet.
- **Digest auth rejects an unknown `qop` or algorithm with `400`.** httpbin treats an unknown `qop` as "either" and an unknown algorithm as MD5, so a typo such as `/digest-auth/auth/user/passwd/SHA256` silently uses MD5.

### Echoing more of the request

- **`data` always contains the raw body.** For form posts (`application/x-www-form-urlencoded`, `multipart/form-data`), httpbin returns `"data": ""` because Flask consumes the body while parsing the form. httpbin-hono returns both the parsed `form` and the raw `data`.
- **JSON keys are not sorted.** httpbin sorts every key (Flask's `JSON_SORT_KEYS`), including inside the echoed `json`, `args` and `/response-headers`, so you can't see the order you sent. httpbin-hono keeps the original order. The request-echo endpoints (`/get`, `/post`, `/anything`, …) still list their own keys (`args`, `data`, … `url`) alphabetically.

### Simplifications

- **`/legacy` is not implemented.** It is httpbin's old landing page, superseded by the Swagger UI at `/`, and its content links to defunct services.
- **Seeded random bytes differ from httpbin.** `/bytes` and `/stream-bytes` with the same `seed` always return the same bytes, and the two endpoints agree with each other. The bytes are not the ones Python's `random.seed()` would produce.
- **Streamed chunks are between 1 KB and 64 KB.** `chunk_size` for `/stream-bytes` and `/range` is clamped to that range, and `/drip` sends at most 64 KB at a time. Tiny chunks cost a lot of CPU (`chunk_size=1` for 100 KB takes seconds), and one huge chunk holds the whole body in memory.
- **`/drip` sends bytes in batches of at least 50 ms** instead of sleeping after every byte, so a large `numbytes` doesn't schedule millions of timers. The stream ends with the last byte instead of a final pause.
- **`/response-headers` echoes only the query parameters.** httpbin also adds the response's own `Content-Type` and `Content-Length` to the JSON body, recalculating until the length is stable.
- **CORS preflights return `204 No Content` for any path** (via Hono's `cors` middleware), the conventional status for a bodiless response. httpbin returns `200`, answers `OPTIONS` only for existing routes, and lists slightly different methods in `Access-Control-Allow-Methods`.
- **Digest auth details:** the realm is `Fake Realm` (httpbin uses `me@kennethreitz.com`), and nonces are random UUIDs instead of hashes of the client IP and time.
- **Cookies set by `/cookies/set` have `SameSite=Lax`.** httpbin sets no `SameSite` attribute.

## License

ISC. See the `LICENSE` file for details. The original httpbin project is © Kenneth Reitz and distributed under the ISC License.
