//! Desktop shell for Midad.
//!
//! The editor itself is the web app (apps/web) running in the system
//! WebView, with the engine compiled to WebAssembly — exactly the same code
//! as the browser version. The shell only adds what a browser cannot do
//! well: native open/save dialogs and writing files to a chosen path.
//!
//! Later milestones can move heavy work (batch export, PDF) into native
//! commands that call `midad-core` directly.

use std::path::PathBuf;

/// Write bytes to a path the user picked in a native save dialog.
#[tauri::command]
fn write_file(path: PathBuf, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| format!("{}: {e}", path.display()))
}

/// Read a text file (e.g. a .midad document) the user picked.
#[tauri::command]
fn read_text_file(path: PathBuf) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("{}: {e}", path.display()))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![write_file, read_text_file])
        .run(tauri::generate_context!())
        .expect("error while running Midad");
}
