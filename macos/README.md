# Writing Studio for Mac

The native app wraps the local Writing Studio workspace in a nonpersistent WKWebView. It serves the bundled web assets from an ephemeral listener bound to `127.0.0.1`. The listener serves static app files only. It has no document upload or text API.

## Build and launch

From the repository root:

```sh
cd web
npm ci
npm run build
cd ..
./macos/scripts/package.sh
open "macos/dist/Writing Studio.app"
```

The packaging script uses the installed Swift toolchain and bundles `web/dist` inside the app. It does not sign or notarize the app.

## Exporting a draft

Choose **Export TXT** to open the macOS Save panel. The app writes the current draft as UTF-8 plain text only after you choose Save. Cancel creates no file. The export stays on the Mac.

## Accessibility mode

Accessibility suggestions start off. This build supports TextEdit only. It reads up to 512 characters before the caret and inserts only after the user clicks Insert and the same text element and selection remain active. It does not use Input Monitoring or store document text.

To use this feature, enable TextEdit in the app and grant Writing Studio Accessibility access in System Settings. The app checks current access without opening the system permission prompt by itself. Revoke access in System Settings or pause suggestions in the app.

## Limits

Word uses the separate [Word task-pane add-in](../web/word-addin/README.md). Other apps are not enabled for Accessibility integration in this build. The app UI and static asset server have been built, but the Accessibility flow still needs an unlocked Mac and an approved Accessibility grant before it can be tested.
