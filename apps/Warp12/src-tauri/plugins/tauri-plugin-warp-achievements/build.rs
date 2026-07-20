const COMMANDS: &[&str] = &["unlock", "progress", "show_ui"];

fn main() {
  let result = tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .ios_path("ios")
    .try_build();

  if !(cfg!(docsrs) && std::env::var("TARGET").unwrap_or_default().contains("android")) {
    result.unwrap();
  }
}
