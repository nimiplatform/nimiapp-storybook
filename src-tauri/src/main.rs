#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use tauri::Manager;

use nimi_shell_tauri::capabilities::{oauth, runtime, session_logging};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfirmDialogPayload {
    #[allow(dead_code)]
    title: Option<String>,
    #[allow(dead_code)]
    description: Option<String>,
    #[allow(dead_code)]
    level: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConfirmDialogResult {
    confirmed: bool,
}

fn start_dragging_window(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    if window.is_fullscreen().unwrap_or(false) {
        return Ok(());
    }

    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        window.start_dragging().map_err(|error| error.to_string())
    })) {
        Ok(result) => result,
        Err(_) => Err("window drag unavailable".to_string()),
    }
}

#[tauri::command]
fn start_window_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    start_dragging_window(window)
}

#[tauri::command]
fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .or_else(|| app.webview_windows().into_values().next())
        .ok_or_else(|| "main window unavailable".to_string())?;
    let _ = window.unminimize();
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())
}

#[tauri::command]
fn confirm_dialog(payload: ConfirmDialogPayload) -> Result<ConfirmDialogResult, String> {
    let _ = payload;
    Err(nimi_shell_tauri::capabilities::standard_shell_error(
        "capability-unavailable",
        "storybook-native-confirm-dialog-unavailable",
        "Use Storybook in-app confirmation UI for product confirmations.",
        "tauri",
        None,
    ))
}

fn load_dotenv_files() {
    let root_env_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.env");
    if root_env_path.exists() {
        match dotenvy::from_path_iter(&root_env_path) {
            Ok(iter) => {
                for item in iter.flatten() {
                    let (key, value) = item;
                    let should_override = key.starts_with("NIMI_") || key.starts_with("VITE_NIMI_");
                    if should_override || std::env::var_os(&key).is_none() {
                        std::env::set_var(&key, &value);
                    }
                }
                eprintln!("[storybook] dotenv loaded path={}", root_env_path.display());
            }
            Err(error) => {
                eprintln!(
                    "[storybook] dotenv load failed path={} error={error}",
                    root_env_path.display()
                );
            }
        }
    }
}

fn configure_runtime_bridge_env() {
    if cfg!(debug_assertions) && std::env::var_os("NIMI_RUNTIME_BRIDGE_MODE").is_none() {
        std::env::set_var("NIMI_RUNTIME_BRIDGE_MODE", "RUNTIME");
    }
}

fn main() {
    load_dotenv_files();
    configure_runtime_bridge_env();
    session_logging::set_app_session_prefix("storybook");
    session_logging::install_panic_hook();
    session_logging::log_boot_marker("storybook main() entered");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            confirm_dialog,
            start_window_drag,
            focus_main_window,
            oauth::open_external_url,
            oauth::oauth_listen_for_code,
            runtime::runtime_bridge_unary,
            runtime::runtime_bridge_stream_open,
            runtime::runtime_bridge_stream_close,
            runtime::runtime_bridge_status,
            session_logging::log_renderer_event,
        ])
        .run(tauri::generate_context!())
        .expect("error running storybook");
}
