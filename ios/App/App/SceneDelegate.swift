import UIKit
import Capacitor

/// UIScene lifecycle adoption.
///
/// Apps built against the iOS 26 SDK and later must adopt the scene lifecycle
/// or the system refuses to launch them — UIKit fires a deliberate trap in
/// `__UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`, which
/// reads as an immediate crash on launch with no message. Build 25 predated
/// this because it was compiled with an older SDK. Xcode 26 became mandatory
/// for App Store uploads on 2026-04-28, so there is no version of this app we
/// can ship that avoids the requirement.
///
/// This file follows Capacitor's own migration guide for 8.5. The window and
/// root view controller are created here in code; Main.storyboard no longer
/// provides them. If a custom CAPBridgeViewController subclass is ever
/// introduced, instantiate it here rather than setting it in the storyboard.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        // Hands the connection options to Capacitor so plugins still see the
        // launch context — a universal link or a custom-scheme URL that opened
        // the app cold. Without this, deep links into mysetlists.net are
        // dropped on a cold start.
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    /// Custom-scheme URLs (mysetlists://) and OAuth callbacks arriving while
    /// the app is already running.
    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    /// Universal links (applinks:mysetlists.net).
    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
