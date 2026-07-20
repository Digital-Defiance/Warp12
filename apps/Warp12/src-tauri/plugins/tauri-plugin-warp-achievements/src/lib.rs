use tauri::{
  plugin::{Builder, TauriPlugin},
  Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod commands;
mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
pub use desktop::Achievements;
#[cfg(mobile)]
pub use mobile::Achievements;

pub trait AchievementsExt<R: Runtime> {
  fn achievements(&self) -> &Achievements<R>;
}

impl<R: Runtime, T: Manager<R>> crate::AchievementsExt<R> for T {
  fn achievements(&self) -> &Achievements<R> {
    self.state::<Achievements<R>>().inner()
  }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("warp-achievements")
    .invoke_handler(tauri::generate_handler![
      commands::unlock,
      commands::progress,
      commands::show_ui
    ])
    .setup(|app, api| {
      #[cfg(mobile)]
      let achievements = mobile::init(app, api)?;
      #[cfg(desktop)]
      let achievements = desktop::init(app, api)?;
      app.manage(achievements);
      Ok(())
    })
    .build()
}
