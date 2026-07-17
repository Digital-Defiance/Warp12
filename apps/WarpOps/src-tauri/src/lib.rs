mod oauth_server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .manage(oauth_server::OAuthServers::default())
    .invoke_handler(tauri::generate_handler![
      oauth_server::start_oauth_server,
      oauth_server::await_oauth_redirect
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
        // Auto-open the webview inspector in dev so OAuth console logs are visible.
        #[cfg(all(desktop, debug_assertions))]
        {
          use tauri::Manager;
          if let Some(window) = app.get_webview_window("main") {
            window.open_devtools();
          }
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
