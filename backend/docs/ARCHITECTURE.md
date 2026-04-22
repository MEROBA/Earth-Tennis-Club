# Backend Architecture Decision

## Goal

Support these product features with production-ready scalability:

- Member system (profile, level, preference)
- Match recommendations
- Chat + play invites
- Court catalog + reviews
- Forum posts + comments
- JWT-based authentication and authorization

## Recommendation

Use **PostgreSQL + Redis + Object Storage (optional)**.

- PostgreSQL: source of truth for transactional data
- Redis: rate limit, refresh-token denylist, chat presence, hot cache
- Object Storage (future): images and large media (court photos, avatars)

This is more robust than PostgreSQL-only for chat/realtime and abuse protection.

## Why this over PostgreSQL-only

1. Rate limit and anti-abuse logic in Redis is fast and cheap.
2. JWT revocation/rotation needs quick token-state checks.
3. Chat presence and transient state are not ideal for relational storage.
4. Hot endpoint caching (courts list, forum list) reduces DB load.

## Service layout

- `API Gateway / Reverse Proxy` (Nginx or Cloudflare)
- `App Server` (Node.js / Go / Python, any framework)
- `PostgreSQL` (primary DB)
- `Redis` (cache + security controls)

## Core backend boundaries

- `auth` module: register/login/refresh/logout/JWT claims
- `member` module: profile and assessment history
- `match` module: recommendation query and scoring pipeline
- `chat` module: room/message/invite
- `court` module: static court records and reviews
- `forum` module: posts/comments/moderation flags

## Security baseline

- Access token: short TTL (15 min)
- Refresh token: long TTL (30 days), rotation + reuse detection
- Password hashing: Argon2id
- TLS only
- Strict CORS allowlist
- API rate limit by IP + user ID
- WAF/CDN in front of public API

## Scaling path

1. Start with monolith app + PostgreSQL + Redis.
2. Add read replicas and connection pool when read traffic grows.
3. Move chat to websocket service if needed.
4. Add queue workers for recommendation recompute / moderation tasks.

## Alternative options

### Option A: Managed BaaS (Supabase)

Good if you want faster delivery and lower ops burden:

- Pros: managed Postgres/Auth/Storage, fast MVP
- Cons: custom auth logic and complex matchmaking may outgrow defaults

### Option B: PostgreSQL-only

Can work for MVP, but expected bottlenecks:

- rate-limit state
- token revocation checks
- chat transient state

Not recommended for your target feature set unless traffic is very low.
