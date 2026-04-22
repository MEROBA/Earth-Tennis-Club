# Software Design Description (SDD)

## 1. Document Control

- Project: Earth Tennis Club
- Version: 1.0.0
- Date: 2026-04-22
- Status: Active development baseline
- Scope: Current frontend implementation + backend contract and data architecture

## 2. Purpose

This document defines the current development specification for Earth Tennis Club, including functional behavior, architecture, data design, API contract boundaries, security controls, and non-functional requirements.

## 3. Product Scope

Earth Tennis Club is a tennis community platform that supports:

- Tennis level self-assessment (`UTR` and `NTRP` estimation)
- Member profile registration and public matching profile
- Player matching recommendations
- Chat interaction and play invitation scheduling
- Taiwan-wide court browsing with map and reviews
- Community forum posts and comments

## 4. Stakeholders

- End users: tennis players looking for partners/courts
- Product owner: platform operator/community organizer
- Engineering: frontend, backend, database, DevOps/security
- Moderation/admin: content and abuse management

## 5. Functional Requirements

### FR-01 User and Profile

- Users can register/login.
- Each user has one profile with:
  - display name
  - city
  - gender
  - age
  - years playing
  - preferred court surface
  - availability text
  - current UTR/NTRP

### FR-02 Assessment

- Users can answer tennis skill questionnaire.
- System computes estimated NTRP/UTR.
- Assessment history is stored for future analysis.

### FR-03 Matching

- Users can browse public member profiles.
- Users can get recommendation scores based on:
  - city proximity
  - level gap
  - age/experience proximity
  - availability similarity

### FR-04 Chat and Play Invite

- Users can open direct chat rooms.
- Users can send messages in rooms.
- Users can create play invites with date/time, court, note.
- Invite status supports lifecycle: proposed/accepted/rejected/cancelled/completed.

### FR-05 Courts and Reviews

- Users can browse court list/map across Taiwan.
- Users can filter by city/surface.
- Users can view and submit court reviews.
- One user can maintain one review per court (upsert behavior).

### FR-06 Forum

- Users can create posts by category.
- Users can add comments (supports threaded reply via parent comment id).
- Public read access is supported.

### FR-07 Security and Auth

- JWT access token authentication for protected APIs.
- Refresh token rotation with reuse detection.
- Logout revokes refresh session.
- Basic abuse controls (rate limiting, input validation, content sanitization).

## 6. Non-Functional Requirements

### NFR-01 Maintainability

- Frontend is modular (`modules`, `services`, `ui`, `state`).
- Backend contract is defined in OpenAPI.
- DB schema and auth flow are documented and versionable.

### NFR-02 Extensibility

- Storage and API layer are separated from UI logic.
- Data model supports role expansion, moderation, and analytics.

### NFR-03 Performance

- Core list endpoints support pagination.
- Recommended stack uses Redis for low-latency rate-limit/session checks.

### NFR-04 Security

- Input validation at API boundary.
- Argon2id password hashing.
- Access token short TTL and refresh token rotation.
- WAF/CDN recommended in production.

### NFR-05 Availability

- API should expose health endpoint.
- DB indexes are defined for hot read paths.

## 7. System Architecture

### 7.1 Frontend

- Static site deployable on GitHub Pages.
- Module-based JavaScript with ES modules.
- Current local mode: LocalStorage mock.
- API mode can be enabled via config.

### 7.2 Backend (Target)

- App API service (REST)
- PostgreSQL as system-of-record
- Redis for rate limit, token/session controls, and cache
- CDN/WAF in front of API for DDoS and bot defense

## 8. UI/UX Design Specification

Current visual direction for web frontend:

- Theme: high-contrast tennis/sports style
- Color system:
  - deep court-night blue backgrounds
  - electric blue accents
  - tennis-ball neon highlight
- Typography:
  - display: `Barlow Condensed`
  - body: `Noto Sans TC`
- Motion:
  - subtle reveal transitions
  - ambient glow effects
- Composition:
  - stadium/court-inspired line overlays
  - card-based tactical dashboard layout

Design inspiration targets:

- Nike sport app style (athletic, sharp contrast, bold headlines)
- Australian Open style cues (blue + tennis-energy highlights)

## 9. Data Design (PostgreSQL)

Schema file: `backend/db/schema.sql`

Primary entities:

- `app_users`
- `member_profiles`
- `member_assessments`
- `match_requests`
- `chat_rooms`
- `chat_room_participants`
- `chat_messages`
- `play_invites`
- `courts`
- `court_reviews`
- `forum_posts`
- `forum_comments`
- `auth_refresh_sessions`
- `auth_audit_logs`

Design notes:

- UUID primary keys for all major tables.
- Enum types enforce domain constraints.
- Trigger-based `updated_at` maintenance.
- Partial/compound indexes for high-frequency queries.

## 10. API Contract

OpenAPI file: `backend/api/openapi.yaml`

API domains:

- Auth: register/login/refresh/logout
- Members: me/profile/public list
- Matching: recommendation list
- Chat: rooms/messages/invites
- Courts: list/reviews
- Forum: posts/comments

Error contract:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": null
}
```

## 11. JWT and Session Specification

Flow file: `backend/docs/JWT_FLOW.md`

- Access token:
  - JWT bearer
  - TTL 15 minutes
- Refresh token:
  - HttpOnly cookie
  - TTL 30 days
  - rotation on refresh
  - reuse detection and session-family revocation
- Logout:
  - refresh session revoke
  - clear cookie

## 12. Security Controls

Frontend baseline:

- CSP in `index.html`
- Input sanitization and field bounds
- Client-side abuse throttling

Backend required controls:

- server-side validation (never trust frontend)
- rate limiting by IP and user key
- secure cookie flags (`HttpOnly`, `Secure`, `SameSite`)
- audit logging for auth events
- secret/key rotation process

## 13. Deployment Specification

Frontend:

- GitHub Pages static deployment

Backend target:

- Containerized API service
- PostgreSQL + Redis services
- Environment config via `.env`
- TLS termination and WAF at edge

## 14. Testing Strategy

- Unit tests:
  - scoring logic
  - matching scoring
  - auth token/session lifecycle
- Integration tests:
  - auth/register/login/refresh/logout
  - forum posting/commenting
  - chat message and invite operations
- E2E tests:
  - frontend workflows for member, matching, forum, courts

## 15. Traceability (Feature -> Artifacts)

- UI and interaction: `index.html`, `assets/css/styles.css`, `assets/js/*`
- API spec: `backend/api/openapi.yaml`
- DB schema: `backend/db/schema.sql`
- Auth flow: `backend/docs/JWT_FLOW.md`
- Architecture: `backend/docs/ARCHITECTURE.md`
- Frontend/backend mapping: `backend/docs/FRONTEND_INTEGRATION.md`

## 16. Known Gaps and Next Steps

- Current frontend still runs in mock storage mode by default.
- Backend implementation is not yet scaffolded in this repository.
- Recommended next phase:
  1. create backend service skeleton from OpenAPI
  2. apply DB migration and seed courts data
  3. integrate frontend API mode with auth and protected routes
