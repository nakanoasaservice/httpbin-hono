# httpbin-hono

A [httpbin](https://httpbin.org/) implementation built with [Hono](https://hono.dev/) and deployed on Cloudflare Workers.

httpbin is a simple HTTP Request & Response service, useful for testing HTTP clients and APIs.

## Features

- HTTP Methods (GET, POST, PUT, DELETE, PATCH, etc.)
- Status Codes
- Request Inspection
- Response Formats (JSON, XML, HTML, etc.)
- Response Inspection
- Authentication
- Dynamic Data
- Cookies
- Redirects
- Images
- Swagger UI documentation

## Prerequisites

- Node.js (v18 or later)
- pnpm

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

### Deploy with Button

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nakanoasaservice/httpbin-hono)

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

Pass the `CloudflareBindings` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

## Code Quality

Check code quality with Biome:

```bash
pnpm run check
```

Auto-fix issues:

```bash
pnpm run check:fix
```

## API Documentation

Once the server is running, visit the root endpoint (`/`) to access the Swagger UI documentation, which provides an interactive interface to explore all available endpoints.

## License

MIT
