# Packsmith Server

A small Node.js content-addressed pack service. `POST /v1/packs` accepts JSON containing a pack name and `{name,data}` files (base64); files are stored once by SHA-256. `GET /v1/packs/:code` returns its manifest and `GET /v1/blobs/:sha256` streams content.

Set `PACKSMITH_SERVER_DATA` and `PORT` as needed, then run `npm start`.
