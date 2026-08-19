# Packsmith Server

The server loads `Packsmith-server/.env` by default. The committed file contains a
deliberately non-working client-secret placeholder; replace it through your deployment
secret manager or a private environment file. Set `PACKSMITH_ENV_FILE` to load a file
from another location. **Never commit a real client secret.**

The server also owns Packsmith's Microsoft OAuth redirect. Configure Entra with the
exact redirect URI `https://auth.pack-smith.com/`, then run the service with matching
values in `.env` when deploying under a different hostname:

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

To terminate TLS in Node, set both PEM file paths:

```dotenv
PACKSMITH_SSL_CERT_PATH=/etc/letsencrypt/live/auth.pack-smith.com/fullchain.pem
PACKSMITH_SSL_KEY_PATH=/etc/letsencrypt/live/auth.pack-smith.com/privkey.pem
```

Both settings are required together. Leave both empty when a reverse proxy terminates
TLS. Relative paths are resolved from the server process's working directory.

A small Node.js content-addressed pack service. `POST /v1/packs` accepts JSON containing a pack name and `{name,data}` files (base64); files are stored once by SHA-256. `GET /v1/packs/:code` returns its manifest and `GET /v1/blobs/:sha256` streams content.

Set `PACKSMITH_SERVER_DATA` and `PORT` as needed, then run `npm start`.
