use tauri_plugin_shell::ShellExt;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let sidecar = app
                .shell()
                .sidecar("OpsToolkit.Desktop.Server")?
                .args(["--no-open"])
                .env("OPS_TOOLKIT_PORT", "48731");
            let (_events, _child) = sidecar.spawn()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run OPS Toolkit");
}
