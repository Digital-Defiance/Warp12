use serde::de::DeserializeOwned;
use tauri::{
  plugin::{PluginApi, PluginHandle},
  AppHandle, Runtime,
};

use crate::models::*;

#[cfg(target_os = "android")]
const PLUGIN_IDENTIFIER: &str = "org.digitaldefiance.warp.achievements";

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_warp_achievements);

pub fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> crate::Result<Achievements<R>> {
  #[cfg(target_os = "android")]
  let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "AchievementsPlugin")?;
  #[cfg(target_os = "ios")]
  let handle = api.register_ios_plugin(init_plugin_warp_achievements)?;
  Ok(Achievements(handle))
}

pub struct Achievements<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> Achievements<R> {
  pub fn unlock(&self, req: UnlockRequest) -> crate::Result<AchievementResult> {
    self
      .0
      .run_mobile_plugin("unlock", req)
      .map_err(Into::into)
  }

  pub fn progress(&self, req: ProgressRequest) -> crate::Result<AchievementResult> {
    self
      .0
      .run_mobile_plugin("progress", req)
      .map_err(Into::into)
  }

  pub fn show_ui(&self) -> crate::Result<()> {
    self
      .0
      .run_mobile_plugin("showUi", ())
      .map_err(Into::into)
  }
}
