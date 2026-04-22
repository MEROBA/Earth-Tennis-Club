# Frontend Integration Mapping

This maps current frontend modules to backend endpoints.

## Auth

- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/refresh`
- `POST /v1/auth/logout`

## Members module

- Read current profile: `GET /v1/members/me`
- Update profile: `PATCH /v1/members/me`
- Public member list: `GET /v1/members?city=&minNtrp=`

## Matching module

- Recommendations: `GET /v1/matches/recommendations?limit=8`

## Chat module

- Create/get rooms: `GET/POST /v1/chat/rooms`
- Messages: `GET/POST /v1/chat/rooms/{roomId}/messages`
- Play invites: `GET/POST /v1/chat/rooms/{roomId}/invites`

## Courts module

- Courts list: `GET /v1/courts?city=&surface=`
- Reviews list: `GET /v1/courts/{courtId}/reviews`
- Add/update own review: `POST /v1/courts/{courtId}/reviews`

## Forum module

- Posts list/create: `GET/POST /v1/forum/posts`
- Comments list/create: `GET/POST /v1/forum/posts/{postId}/comments`

## Error handling contract

All non-2xx responses should follow:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input",
  "details": null
}
```
