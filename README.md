# Packsmith

Packsmith is an Electron Minecraft Java launcher with real Microsoft device-code authentication, provider-backed catalogs, portable Java runtimes, and isolated instance installation.

## Run

Register a **public/native** Microsoft Entra application, enable public client flows, and expose its client ID. No client secret belongs in a desktop app.

```bash
npm install
PACKSMITH_MS_CLIENT_ID=your-client-id npm start
```

Authentication completes the Microsoft, Xbox Live, XSTS, and Minecraft Services exchanges. Refresh and game credentials are stored in `Packsmith/packsmith.db` under `%PROGRAMDATA%` on Windows, `$XDG_DATA_HOME` on Linux, or `~/.local/share` otherwise. Instances and their downloaded runtimes live beside it in `instances/<name>`.

Version and discovery API responses persist in SQLite and are reused for at least one hour across restarts. Packsmith-server is the separately deployable content-addressed share service; see [`Packsmith-server/README.md`](Packsmith-server/README.md).
