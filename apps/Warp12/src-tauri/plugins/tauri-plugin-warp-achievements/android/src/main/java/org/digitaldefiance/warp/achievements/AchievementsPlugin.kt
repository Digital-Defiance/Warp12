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

  private fun ensurePlayGamesSignedIn(
    onReady: () -> Unit,
    onFailure: (String) -> Unit
  ) {
    if (!sdkReady) {
      onFailure("Play Games SDK not initialized")
      return
    }

    val signInClient = PlayGames.getGamesSignInClient(activity)
    signInClient.isAuthenticated.addOnCompleteListener { authTask ->
      if (authTask.isSuccessful && authTask.result.isAuthenticated) {
        onReady()
        return@addOnCompleteListener
      }

      signInClient.signIn().addOnCompleteListener { signInTask ->
        if (signInTask.isSuccessful && signInTask.result.isAuthenticated) {
          onReady()
        } else {
          onFailure(
            signInTask.exception?.message ?: "Play Games sign-in required"
          )
        }
      }
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

    ensurePlayGamesSignedIn(
      onReady = {
        PlayGames.getAchievementsClient(activity)
          .unlockImmediate(platformId)
          .addOnSuccessListener(
            OnSuccessListener {
              invoke.resolve(result("unlocked", args.id))
            }
          )
          .addOnFailureListener(
            OnFailureListener { err ->
              invoke.resolve(result("error", err.message ?: "unlock failed"))
            }
          )
      },
      onFailure = { message ->
        invoke.resolve(result("error", message))
      }
    )
  }

  @Command
  fun progress(invoke: Invoke) {
    val args = invoke.parseArgs(ProgressArgs::class.java)
    val platformId = args.playGamesId?.takeIf { it.isNotBlank() }
    if (platformId == null) {
      invoke.resolve(result("missing_platform_id", "Set playGamesId after Play Console setup"))
      return
    }

    val steps = args.steps.coerceAtLeast(1)
    val current = args.current.coerceIn(0, steps)
    val client = PlayGames.getAchievementsClient(activity)

    ensurePlayGamesSignedIn(
      onReady = {
        if (current >= steps) {
          client
            .unlockImmediate(platformId)
            .addOnSuccessListener(
              OnSuccessListener {
                invoke.resolve(result("unlocked", "${args.id}:$current/$steps"))
              }
            )
            .addOnFailureListener(
              OnFailureListener { err ->
                invoke.resolve(result("error", err.message ?: "unlock failed"))
              }
            )
        } else {
          client
            .setStepsImmediate(platformId, current)
            .addOnSuccessListener(
              OnSuccessListener {
                invoke.resolve(result("progressed", "${args.id}:$current/$steps"))
              }
            )
            .addOnFailureListener(
              OnFailureListener { err ->
                invoke.resolve(result("error", err.message ?: "progress failed"))
              }
            )
        }
      },
      onFailure = { message ->
        invoke.resolve(result("error", message))
      }
    )
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
