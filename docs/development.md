# Development

## Prerequisites

- Node.js 20.9 or newer
- npm 10 or newer

## Frontend commands

Run these commands from `frontend/`:

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run format:check
npm run build
```

Copy `.env.example` to `.env.local` and set `API_FOOTBALL_KEY` to enable live fixtures. The key stays server-side and must not use a `NEXT_PUBLIC_` prefix.
