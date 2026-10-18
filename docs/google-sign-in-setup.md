# Tiki-Data Lab — Google Sign-In setup

Status: OAuth backend, Guest Mode and D1 schema are implemented. Actual Google Sign-In is disabled until production credentials are configured.

## Google Cloud setup (performed by the site owner)
1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create/select a project.
2. Configure **Google Auth Platform → Branding / Audience / Data Access** with the production domain `tiki-data.com`, the public Privacy Policy and Terms pages, and scopes `openid email profile`. While in Testing mode, add the permitted test users.
3. Create an **OAuth client ID → Web application**.
4. Set **Authorized JavaScript origin** to `https://tiki-data.com`.
5. Set **Authorized redirect URI** exactly to `https://tiki-data.com/auth/google/callback` (no trailing slash).
6. Store the Client ID and Client Secret only in Cloudflare Pages → tiki-data → Settings → Variables and Secrets → **Production**, using names:
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET` (encrypted secret)
7. Redeploy production if Cloudflare prompts for it.

**Never** put credentials or access tokens into GitHub, browser JavaScript, or a public issue. The client ID can be shared, but keep the client secret private.

## Activation and behavior
- `GET /api/auth/session` returns `login_enabled: false` until both credentials are available on `https://tiki-data.com`.
- The Google button appears in the account view only when `login_enabled: true`.
- `GET /auth/google/start` initiates OpenID Connect authorization code + PKCE S256 with state and nonce.
- `GET /auth/google/callback` exchanges the code on the server, verifies the signed ID token with Google JWKS and checks issuer, audience, expiry, nonce and Google subject.
- Signed-in users receive `__Host-td_session` with Secure, HttpOnly, SameSite=Lax, a 30-day maximum age. Only SHA-256 of the random session token is stored in D1. Changes require a same-origin POST with a session-specific CSRF header.
- Guest Mode works without a database session and stores followed teams only in the visitor's localStorage. Account favorites stay in D1. Local guest favorites can be explicitly imported from the account screen.
- The account screen includes logout and permanent deletion of the Tiki-Data user and preference rows.

## Database
See `migrations/20261018_google_auth.sql` (already applied to the existing `tiki_data_lab` D1 database, UUID `e068db27-cbcf-4dc2-8fe7-1c4c1ea46df7`).

## Production QA after credentials
1. As guest, load the website and visit the account page; favorite a team without logging in.
2. Sign in with a Google test user; verify callback and `/api/auth/session` now report authenticated.
3. Follow teams and toggle leagues; reload and verify settings persist.
4. Attempt POST to `/api/auth/preferences` without CSRF; must return HTTP 403.
5. Log out; verify the session is invalid and Guest Mode remains accessible.
6. Sign back in and delete the account; verify preferences and session are removed.
7. Check private mode, mobile rendering and CSP, and review the updated Privacy/Cookies pages.

The optional Google login is **not** consent for AdSense personalization. Obtain a certified CMP and finish private-contact/controller details separately before ad tracking.

## Security notes
Use only the canonical HTTPS production host for OAuth. Preview deployments intentionally disable Google Sign-In. Never log OAuth authorization codes, Google ID tokens, session tokens, or cookie values. Rotate any previously exposed third-party API credentials separately.
