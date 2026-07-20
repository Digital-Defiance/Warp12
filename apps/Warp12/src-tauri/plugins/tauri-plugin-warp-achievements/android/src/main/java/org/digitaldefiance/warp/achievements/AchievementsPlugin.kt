package org.digitaldefiance.warp.achievements

import android.app.Activity
import android.content.Intent
import android.webkit.WebView
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import com.google.android.gms.games.PlayGames
import com.google.android.gms.games.PlayGamesSdk
import com.google.android.gms.tasks.OnFailureListener
import com.google.android.gms.tasks.OnSuccessListener

@InvokeArg
class UnlockArgs {
  lateinit var id: String
  var playGamesId: String? = null
  var gameCenterId: String? = null
}

@InvokeArg
class ProgressArgs {
  lateinit var id: String
  var current: Int = 0
  var steps: Int = 1
  var playGamesId: String? = null
  var gameCenterId: String? = null
}

@TauriPlugin
class AchievementsPlugin(private val activity: Activity) : Plugin(activity) {
  @Volatile
  private var sdkReady = false

  override fun load(webView: WebView) {
    try {
      PlayGamesSdk.initialize(activity)
      sdkReady = true
    } catch (e: Exception) {
      sdkReady = false
    }
  }

  @Command
  fun unlock(invoke: Invoke) {
    val args = invoke.parseArgs(UnlockArgs::class.java)
    val platformId = args.playGamesId?.takeIf { it.isNotBlank() }
    if (platformId == null) {
      invoke.resolve(result("missing_platform_id", "Set playGamesId after Play Console setup"))
      return
    }
    if (!sdkReady) {
      invoke.resolve(result("error", "Play Games SDK not initialized"))
      return
    }

    // Play Games v2: unlock() is fire-and-forget (void), not a Task.
    try {
      PlayGames.getAchievementsClient(activity).unlock(platformId)
      invoke.resolve(result("unlocked", args.id))
    } catch (err: Exception) {
      invoke.resolve(result("error", err.message ?: "unlock failed"))
    }
  }

  @Command
  fun progress(invoke: Invoke) {
    val args = invoke.parseArgs(ProgressArgs::class.java)
    val platformId = args.playGamesId?.takeIf { it.isNotBlank() }
    if (platformId == null) {
      invoke.resolve(result("missing_platform_id", "Set playGamesId after Play Console setup"))
      return
    }
    if (!sdkReady) {
      invoke.resolve(result("error", "Play Games SDK not initialized"))
      return
    }

    val steps = args.steps.coerceAtLeast(1)
    val current = args.current.coerceIn(0, steps)
    val client = PlayGames.getAchievementsClient(activity)

    // Play Games v2: unlock() / setSteps() are fire-and-forget (void).
    try {
      if (current >= steps) {
        client.unlock(platformId)
        invoke.resolve(result("unlocked", "${args.id}:$current/$steps"))
      } else {
        client.setSteps(platformId, current)
        invoke.resolve(result("progressed", "${args.id}:$current/$steps"))
      }
    } catch (err: Exception) {
      invoke.resolve(result("error", err.message ?: "progress failed"))
    }
  }

  @Command
  fun showUi(invoke: Invoke) {
    if (!sdkReady) {
      invoke.reject("Play Games SDK not initialized")
      return
    }
    PlayGames.getAchievementsClient(activity)
      .achievementsIntent
      .addOnSuccessListener(
        OnSuccessListener { intent: Intent ->
          activity.startActivityForResult(intent, RC_ACHIEVEMENTS)
          invoke.resolve()
        }
      )
      .addOnFailureListener(
        OnFailureListener { err ->
          invoke.reject(err.message ?: "Unable to open achievements UI")
        }
      )
  }

  private fun result(status: String, detail: String?): JSObject {
    val obj = JSObject()
    obj.put("status", status)
    if (detail != null) {
      obj.put("detail", detail)
    }
    return obj
  }

  companion object {
    private const val RC_ACHIEVEMENTS = 9003
  }
}
