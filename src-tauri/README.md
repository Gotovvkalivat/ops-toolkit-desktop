# Tauri shell

This folder is the prepared native shell for the unified frontend. The production flow is:

1. Publish `OpsToolkit.Desktop.Server` as a self-contained single-file sidecar.
2. Copy it to `src-tauri/binaries/OpsToolkit.Desktop.Server-x86_64-pc-windows-msvc.exe`.
3. Build the Tauri NSIS installer. Tauri starts the sidecar with `--no-open`; users see only the application window.

The web modules do not need to change when the shell is enabled: they already use same-origin REST endpoints and the shared navbar.
