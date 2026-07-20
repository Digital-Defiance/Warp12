import GameKit
import ObjectiveC
import SwiftRs
import Tauri
import UIKit
import WebKit

class UnlockArgs: Decodable {
  let id: String
  let playGamesId: String?
  let gameCenterId: String?
}

class ProgressArgs: Decodable {
  let id: String
  let current: UInt
  let steps: UInt
  let playGamesId: String?
  let gameCenterId: String?
}

class AchievementsPlugin: Plugin {
  private var authStarted = false

  private func ensureAuthenticated(completion: @escaping (Bool) -> Void) {
    let local = GKLocalPlayer.local
    if local.isAuthenticated {
      completion(true)
      return
    }
    if authStarted {
      completion(local.isAuthenticated)
      return
    }
    authStarted = true
    local.authenticateHandler = { viewController, _ in
      if let vc = viewController {
        DispatchQueue.main.async {
          Self.keyRootViewController()?.present(vc, animated: true)
        }
        return
      }
      completion(local.isAuthenticated)
    }
  }

  private static func keyRootViewController() -> UIViewController? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first(where: { $0.isKeyWindow })?
      .rootViewController
  }

  @objc public func unlock(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(UnlockArgs.self)
    guard let platformId = args.gameCenterId, !platformId.isEmpty else {
      invoke.resolve([
        "status": "missing_platform_id",
        "detail": "Set gameCenterId after App Store Connect setup",
      ])
      return
    }

    ensureAuthenticated { ok in
      guard ok else {
        invoke.resolve([
          "status": "error",
          "detail": "Game Center not authenticated",
        ])
        return
      }
      let achievement = GKAchievement(identifier: platformId)
      achievement.percentComplete = 100
      achievement.showsCompletionBanner = true
      GKAchievement.report([achievement]) { error in
        if let error = error {
          invoke.resolve([
            "status": "error",
            "detail": error.localizedDescription,
          ])
        } else {
          invoke.resolve([
            "status": "unlocked",
            "detail": args.id,
          ])
        }
      }
    }
  }

  @objc public func progress(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(ProgressArgs.self)
    guard let platformId = args.gameCenterId, !platformId.isEmpty else {
      invoke.resolve([
        "status": "missing_platform_id",
        "detail": "Set gameCenterId after App Store Connect setup",
      ])
      return
    }

    let steps = max(args.steps, 1)
    let current = min(args.current, steps)
    let percent = Double(current) / Double(steps) * 100.0

    ensureAuthenticated { ok in
      guard ok else {
        invoke.resolve([
          "status": "error",
          "detail": "Game Center not authenticated",
        ])
        return
      }
      let achievement = GKAchievement(identifier: platformId)
      achievement.percentComplete = percent
      achievement.showsCompletionBanner = percent >= 100
      GKAchievement.report([achievement]) { error in
        if let error = error {
          invoke.resolve([
            "status": "error",
            "detail": error.localizedDescription,
          ])
        } else {
          let status = percent >= 100 ? "unlocked" : "progressed"
          invoke.resolve([
            "status": status,
            "detail": "\(args.id):\(current)/\(steps)",
          ])
        }
      }
    }
  }

  @objc public func showUi(_ invoke: Invoke) throws {
    ensureAuthenticated { ok in
      guard ok else {
        invoke.reject("Game Center not authenticated")
        return
      }
      DispatchQueue.main.async {
        guard let root = Self.keyRootViewController() else {
          invoke.reject("No root view controller")
          return
        }
        let vc = GKGameCenterViewController(state: .achievements)
        let host = GameCenterHostController()
        vc.gameCenterDelegate = host
        objc_setAssociatedObject(
          vc,
          &GameCenterHostController.assocKey,
          host,
          .OBJC_ASSOCIATION_RETAIN_NONATOMIC
        )
        root.present(vc, animated: true) {
          invoke.resolve()
        }
      }
    }
  }
}

private class GameCenterHostController: NSObject, GKGameCenterControllerDelegate {
  static var assocKey: UInt8 = 0

  func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
    gameCenterViewController.dismiss(animated: true)
  }
}

@_cdecl("init_plugin_warp_achievements")
func initPlugin() -> Plugin {
  return AchievementsPlugin()
}
