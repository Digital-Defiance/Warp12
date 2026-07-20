use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::*;

pub fn init<R: Runtime, C: DeserializeOwned>(
  app: &AppHandle<R>,
  _api: PluginApi<R, C>,
) -> crate::Result<Achievements<R>> {
  Ok(Achievements(app.clone()))
}

pub struct Achievements<R: Runtime>(AppHandle<R>);

impl<R: Runtime> Achievements<R> {
  pub fn unlock(&self, _req: UnlockRequest) -> crate::Result<AchievementResult> {
    Ok(AchievementResult {
      status: "skipped_desktop".into(),
      detail: None,
    })
  }

  pub fn progress(&self, _req: ProgressRequest) -> crate::Result<AchievementResult> {
    Ok(AchievementResult {
      status: "skipped_desktop".into(),
      detail: None,
    })
  }

  pub fn show_ui(&self) -> crate::Result<()> {
    Err(crate::Error::Message(
      "Achievements UI is only available on iOS/Android".into(),
    ))
  }
}
