# Packsmith Server

The server also owns Packsmith's Microsoft OAuth redirect. Configure Entra with the
exact redirect URI `https://auth.pack-smith.com/`, then run the service with matching
values when deploying under a different hostname:

```bash
PACKSMITH_MS_CLIENT_ID=60cbe4bd-6824-4be1-9685-7fd5c33fff61 \
PACKSMITH_MS_CLIENT_SECRET=your-server-side-secret \
PACKSMITH_MS_REDIRECT_URI=https://auth.pack-smith.com/ npm start
```

`GET /v1/auth/microsoft/start` creates an authorization-code-with-PKCE session, `/`
receives Microsoft's callback, and `GET /v1/auth/microsoft/result?session=...` lets the
desktop app retrieve the result once. The server never puts Microsoft credentials in
the redirect URL and deletes each completed result after it is retrieved. Store
`PACKSMITH_MS_CLIENT_SECRET` only in the server's secret manager; never put it in the
desktop build, repository, callback URL, or client-side environment.

A small Node.js content-addressed pack service. `POST /v1/packs` accepts JSON containing a pack name and `{name,data}` files (base64); files are stored once by SHA-256. `GET /v1/packs/:code` returns its manifest and `GET /v1/blobs/:sha256` streams content.

Set `PACKSMITH_SERVER_DATA` and `PORT` as needed, then run `npm start`.
