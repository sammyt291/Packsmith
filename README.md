# Packsmith

Packsmith is a desktop-first Minecraft Java launcher interface built with Electron. It provides local account and instance management, loader/runtime configuration, a compatible-mod picker, and the user experience for synchronized share codes.

## Run locally

```bash
npm install
npm start
```

For a real Microsoft OAuth device code, register a public/native application in Microsoft Entra ID, enable public client flows, and provide its client ID:

```bash
PACKSMITH_MS_CLIENT_ID=your-client-id npm start
```

Without that variable Packsmith deliberately uses a clearly marked preview flow so the complete interface can be evaluated without shipping a shared application secret. Device authorization opens Microsoft's own page, where Microsoft controls password and 2FA challenges; Packsmith only presents the short-lived code.

## Current scope

- Multiple Microsoft-account UI and device-code authentication entry point
- Vanilla, Fabric, Forge, and NeoForge instance creation
- Minecraft, Java, Xms/Xmx, and JVM argument settings
- Searchable mod selection with explicit version pinning
- Share-code generation and synchronized-pack join experience
- Modrinth, CurseForge, and ATLauncher discovery placeholders; FTB is explicitly planned for later

Downloading game assets, completing the Xbox/Minecraft token exchange, catalog provider API adapters, launching Java, and the Packsmith synchronization service require production credentials/infrastructure and are intentionally not simulated as complete.
