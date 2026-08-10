# Architecture

## Repository boundaries

- `frontend/` owns the web interface, client-side state, and contract integration adapters.
- `contract/` owns the GenLayer intelligent contract and contract-level tests.
- `docs/` owns architecture notes, decisions, and integration documentation.

## Frontend boundaries

- `app/` contains App Router routes, layouts, and application providers.
- `components/` contains reusable presentation components.
- `hooks/` contains reusable React hooks.
- `lib/` contains framework-independent utilities and configuration.
- `services/` contains external service and contract integration adapters.
- `types/` contains shared TypeScript types.
- `styles/` contains global styles and design tokens.

Business logic and domain-specific implementation are intentionally outside the scope of this scaffold.

