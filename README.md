# Packsmith

Packsmith is an Electron Minecraft Java launcher with real Microsoft device-code authentication, provider-backed catalogs, portable Java runtimes, and isolated instance installation.

## Microsoft application setup

> [!IMPORTANT]
> A person using a packaged Packsmith release should only have to sign in. They should
> not have to register their own application. The Packsmith build/distributor is
> responsible for supplying one application (client) ID.

Packsmith now includes the public application (client) ID
`60cbe4bd-6824-4be1-9685-7fd5c33fff61`, so users and ordinary source builds do not
need to set an environment variable. This identifier is not a secret. Its Entra
registration must support **personal Microsoft accounts** before Packsmith's
`consumers` sign-in endpoint will accept it.

### Can I add Microsoft sign-in without a tenant?

No. There is no supported anonymous, local-only, or “personal developer” client ID.
Microsoft must know which application is requesting a user's tokens, so every OAuth
request must identify an app registration owned by a directory. Packsmith cannot
generate that identifier, derive it from a Minecraft account, or replace it with an
access token.

This means an individual developer who cannot obtain access to an Entra tenant cannot
independently publish working Microsoft sign-in. The practical choices are to:

1. have an organization or project maintainer with a tenant own the registration and
   supply its client ID in official Packsmith builds;
2. obtain a tenant through one of Microsoft's eligible Azure, organization, education,
   or developer offerings; or
3. ship without Microsoft/Minecraft sign-in until the project has a registration.

Do not copy the client ID of the official Minecraft Launcher or another third-party
launcher. It identifies their application, not Packsmith, and its owner can revoke or
restrict it. Adding a token-proxy server does not remove the requirement either—the
server operator would still need to own a Microsoft app registration and safely handle
users' credentials.

An app registration can only be created inside a Microsoft Entra tenant (directory). A
standalone personal Microsoft account is no longer allowed to create an application
outside a directory, even though that same personal account can sign in to Packsmith
after the application has been configured.

If **New registration** shows the message in the screenshot—“The ability to create
applications outside of a directory has been deprecated”—there is no missing button
or token to generate. Cancel that dialog. The developer/distributor must first do one
of the following:

- switch to an existing Azure/Entra tenant where they may register applications;
- create a directory by signing up for Azure; or
- join the Microsoft 365 Developer Program, if Microsoft says the account is eligible.

If none of those options is available, that account cannot create the required client
ID. Do not enter a Microsoft 365 access token, subscription ID, tenant ID, or client
secret in place of it.

In the [Microsoft Entra admin center](https://entra.microsoft.com/):

1. Switch to the directory in which you are allowed to register applications.
2. Open **Identity > Applications > App registrations > New registration**.
3. Select **Personal Microsoft accounts only** as the supported account type. If the
   app also needs work or school accounts, select the multitenant option that includes
   personal Microsoft accounts instead.
4. Finish the registration and copy the **Application (client) ID** from its Overview
   page. Do not copy the object ID or directory/tenant ID.
5. Under **Authentication**, add the web redirect URI
   `https://auth.pack-smith.com/`. It must match exactly, including the trailing slash.
6. Create a client secret for the confidential web callback and store it only as
   `PACKSMITH_MS_CLIENT_SECRET` on the authentication server. Packsmith also uses PKCE.
   Never put the secret in the desktop application or this repository.

Creating the Entra registration is only the first gate. Minecraft/Xbox may also reject
an otherwise valid client ID as an **invalid app registration** until the application
has completed any registration or review Microsoft currently requires for Minecraft
Services. Follow the process linked by Microsoft's
[`AppRegInfo`](https://aka.ms/AppRegInfo) redirect; do not assume that an arbitrary
Entra client ID is sufficient for a distributable launcher.

Install the dependencies and start Packsmith:

```bash
npm install
npm start
```

Distributors that maintain a different app registration can override the bundled ID:

```bash
PACKSMITH_MS_CLIENT_ID=your-client-id npm start
```

On PowerShell, set the override for the current window with
`$env:PACKSMITH_MS_CLIENT_ID = 'your-client-id'` before running `npm start`.

The desktop app begins authentication at `https://auth.pack-smith.com` by default.
Local and self-hosted deployments can set `PACKSMITH_AUTH_SERVER` in the desktop app
and must set the server's `PACKSMITH_MS_REDIRECT_URI` to the exact Entra redirect URI.
The callback exchanges the authorization code using PKCE and gives the desktop app the
result through a one-time, short-lived polling session; credentials are never placed
in the callback URL.

### Common registration errors

- **`AADSTS9002332` / configured for Azure Active Directory users only:** change the
  app registration's supported account type to **Personal Microsoft accounts only**,
  or the multitenant option that also includes personal Microsoft accounts. Minecraft
  consumer accounts cannot sign in while the app is organization-only.
- **“Client secret or client assertion” is required / `AADSTS7000218`:** the app is
  being treated as a confidential client. Confirm the PKCE/public-client configuration
  and exact redirect URI; do not create or put a secret in Packsmith.
- **“Application was not found in the directory”:** check that the value is the
  **Application (client) ID**, and that the registration supports personal Microsoft
  accounts. Packsmith deliberately uses the `consumers` sign-in endpoint.
- **“Creating applications outside of a directory has been deprecated”:** the signed-in
  account has no usable Entra directory. Follow one of the directory options above;
  changing the application settings cannot bypass this prerequisite.
- **The portal opens Microsoft 365:** return to the Entra admin center after a directory
  has been provisioned, then switch to that directory before opening App registrations.

An application (client) ID is a public identifier and may be included in a desktop-app
build. A **client secret** is different: only the confidential callback server may
hold it. The Electron application cannot keep a secret and must never ship or request
one. A distributor should use an app registration they control rather than copying
another application's client ID.

Authentication completes the Microsoft, Xbox Live, XSTS, and Minecraft Services exchanges. Refresh and game credentials are stored in `Packsmith/packsmith.db` under `%PROGRAMDATA%` on Windows, `$XDG_DATA_HOME` on Linux, or `~/.local/share` otherwise. Instances and their downloaded runtimes live beside it in `instances/<name>`.

Version and discovery API responses persist in SQLite and are reused for at least one hour across restarts. Packsmith-server is the separately deployable content-addressed share service; see [`Packsmith-server/README.md`](Packsmith-server/README.md).
