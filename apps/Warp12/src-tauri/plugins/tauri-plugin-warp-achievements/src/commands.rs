use tauri::{command, AppHandle, Runtime};

use crate::{models::*, AchievementsExt, Result};

#[command]
pub(crate) async fn unlock<R: Runtime>(
  app: AppHandle<R>,
  id: String,
  play_games_id: Option<String>,
  game_center_id: Option<String>,
) -> Result<AchievementResult> {
  app.achievements().unlock(UnlockRequest {
    id,
    play_games_id,
    game_center_id,
  })
}

#[command]
pub(crate) async fn progress<R: Runtime>(
  app: AppHandle<R>,
  id: String,
  current: u32,
  steps: u32,
  play_games_id: Option<String>,
  game_center_id: Option<String>,
) -> Result<AchievementResult> {
  app.achievements().progress(ProgressRequest {
    id,
    current,
    steps,
    play_games_id,
    game_center_id,
  })
}

#[command]
pub(crate) async fn show_ui<R: Runtime>(app: AppHandle<R>) -> Result<()> {
  app.achievements().show_ui()
}
