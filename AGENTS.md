# AGENTS.md

## Toolchain

- Development Node.js is pinned only in `package.json#devEngines.runtime`. `mise.toml` provides bootstrap majors; use the global Vite+ CLI with environment management enabled for exact runtime selection. Compatibility CI may override the development pin.

- Node 24 and pnpm (version from `packageManager` in `package.json`; see `mise.toml`).
- Verify with `pnpm install --frozen-lockfile`, `vp check`, `vp test run`. CI runs the same (`.github/workflows/check.yml`, required check `Check`).

## Dependency updates

- Dependabot opens update PRs (`.github/dependabot.yml`). `.github/workflows/dependabot-triage.yml` enables auto-merge for patch/minor updates on versions >= 1.0; GitHub merges them once `Check` passes.
- Not managed by Dependabot: `vite`, `vite-plus`, `vitest`. `vite` is an npm alias for `@voidzero-dev/vite-plus-core`, and `vite`/`vitest` are pinned in `pnpm-workspace.yaml` `overrides`. Update all three together, keeping `package.json` and the overrides in sync.
- Merging to `main` triggers a Cloudflare Workers Builds production deploy. Do not run `wrangler deploy` or other deploy commands.
