# Authentication and authorization contract

The existing Argon2id password hashing, opaque random session tokens, SHA-256 token storage, PostgreSQL sessions, and default eight-hour expiry are retained. `0001_auth.py` is unchanged. Additive migrations extend users with name, phone, customer/staff/admin role, permissions, preferences, and optional email-verification state.

## Preserved endpoints

- `POST /api/v1/auth/login`: `{ "email": "user@example.com", "password": "..." }` → `{ "session_token": "...", "expires_at": "<UTC>", "user": { "id": "<UUID>", "email": "...", "role": "customer", "name": "...", "phone": "...", "permissions": [], "preferences": {}, "email_verified": false } }`.
- `GET /api/v1/auth/me`: same user shape. Missing, expired, revoked or inactive-account sessions return 401.
- `POST /api/v1/auth/logout`: revokes the presented session; returns `{ "detail": "Signed out" }`.

Passwords/tokens are never persisted in browser localStorage. Next.js retains the raw token only in an HttpOnly, SameSite=Lax cookie (Secure in production) and sends it to FastAPI as a Bearer token. Browser login/register JSON excludes the session token. Mutations validate their same-origin request origin. See API-CONTRACT.md for account extension endpoints.

## Account extensions

Registration creates customers only and rejects a role/permissions field. New passwords require at least ten characters, including a letter and digit. Existing passwords, including six-character passwords created through the earlier CLI policy, remain valid. A password change or reset revokes existing sessions; reset and verification tokens are hashed, one-use, and expire after thirty minutes. Recovery responses do not reveal account existence. The optional email-verification setting sends verification emails on registration; customers can also request verification from account settings. Login failures are database-throttled by hashed email key after five invalid attempts, with a fifteen-minute window.

`/account` requires authentication. Login redirects customers to `/account`, administrators to `/admin`, and staff to their permitted management area. Backend inventory operations require `inventory.view` or `inventory.manage`; mutation endpoints require manage. All administration resources enforce their respective permissions; staff cannot assign roles or permissions. Customers never receive management access simply by logging in.

Existing accounts default to customer. Trusted role promotion is an explicit local command:

```sh
cd backend
uv run python -m backend.manage your-email@example.com --role admin
```

No hardcoded admin account or default password exists. Role changes are audited, and current role/permissions are loaded from the user for each authenticated API request. Sign out revokes the backend session and clears the cookie. Local recovery messages are written privately to backend/.mailbox unless SMTP is configured.
