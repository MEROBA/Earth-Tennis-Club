# JWT Flow (Access + Refresh Rotation)

## Token model

- Access Token
  - Format: JWT
  - TTL: 15 minutes
  - Stored in memory on frontend (preferred)
  - Used in `Authorization: Bearer <token>`

- Refresh Token
  - Format: opaque random string (preferred) or JWT
  - TTL: 30 days
  - Stored as `HttpOnly + Secure + SameSite=Strict` cookie
  - Rotation on every refresh

## Claims (access token)

- `sub`: user_id (UUID)
- `email`: user email
- `role`: `user|moderator|admin`
- `sid`: session_id
- `iat`, `exp`
- `iss`, `aud`

## Register/Login flow

1. Client sends credentials to `/v1/auth/register` or `/v1/auth/login`.
2. Backend verifies password hash (Argon2id).
3. Backend creates session record in `auth_refresh_sessions`.
4. Backend returns access token in JSON and sets refresh cookie.

## Refresh flow (rotation)

1. Client calls `/v1/auth/refresh` with refresh cookie.
2. Backend validates session token hash in DB.
3. Backend checks:
   - session not revoked
   - not expired
   - not replayed
4. Backend rotates token:
   - old token marked `rotated_at`
   - new token issued and saved
5. Backend returns new access token + refresh cookie.

## Reuse detection

If an old refresh token is used again after rotation:

1. Mark current session family as compromised.
2. Revoke all descendant sessions for that user/session family.
3. Force re-login and emit security event.

## Logout flow

- Endpoint: `POST /v1/auth/logout`
- Action:
  - revoke current refresh session
  - clear refresh cookie
  - optional: store access `jti` in Redis denylist until expiry

## Authorization policy

- Public routes: health, register, login, courts list, forum read (optional)
- Auth routes: member update, chat, posting reviews/comments, invite actions
- Role routes: moderation/admin actions

## Security controls checklist

- Password hashing with Argon2id + per-user salt
- Brute-force protection (IP + email key)
- Refresh token hash stored in DB (never plain token)
- `HttpOnly` cookie for refresh token
- CSRF defense for cookie-based refresh endpoint
- Key rotation for JWT signing keys (`kid` support)
- Audit log for auth events (login success/fail, refresh, logout, revoke)

## Frontend integration contract

- Access token returned by login/refresh response body
- Frontend retries one time on `401` using refresh endpoint
- If refresh fails, frontend clears local state and redirects to login
