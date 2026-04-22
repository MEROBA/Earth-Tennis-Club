# Backend Contract Package

This folder contains backend design artifacts for implementation.

## Files

- `api/openapi.yaml`: REST API contract
- `db/schema.sql`: PostgreSQL schema (core tables, indexes, constraints, triggers)
- `docs/JWT_FLOW.md`: access/refresh token lifecycle
- `docs/ARCHITECTURE.md`: stack decision and scaling path
- `docs/FRONTEND_INTEGRATION.md`: endpoint mapping from current frontend modules

## Recommended stack

- PostgreSQL for source-of-truth data
- Redis for rate limit, token/session safety checks, and hot cache
- CDN/WAF in front of API

## Apply schema

```bash
psql "$DATABASE_URL" -f backend/db/schema.sql
```

## Next implementation order

1. Build `auth` routes first (`register/login/refresh/logout`).
2. Build `members` and `courts` read APIs.
3. Build `forum` and `reviews` write APIs.
4. Build `chat` and `play_invites` APIs.
5. Add recommendation endpoint and background scoring jobs.
