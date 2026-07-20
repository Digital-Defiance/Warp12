use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlockRequest {
  pub id: String,
  pub play_games_id: Option<String>,
  pub game_center_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressRequest {
  pub id: String,
  pub current: u32,
  pub steps: u32,
  pub play_games_id: Option<String>,
  pub game_center_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementResult {
  pub status: String,
  pub detail: Option<String>,
}
