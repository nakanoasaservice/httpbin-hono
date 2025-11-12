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

Pass the `Env` as generics when instantiating `Hono`:

```ts
// src/index.ts
const app = new Hono<{ Bindings: Env }>()
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

ISC. See the `LICENSE` file for details. The original httpbin project is © Kenneth Reitz and distributed under the ISC License.
