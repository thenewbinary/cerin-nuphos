import Foundation
import PostHog

// Only the endpoint boundary is replaced; exercise the production wrapper.
@MainActor enum CerinAPI {
    static let defaultBaseURL = URL(string: "https://platform.cerin.ai")!
    static var baseURL = defaultBaseURL
}

private func makeAnalyticsBundle(token: String?, host: String? = nil) -> Bundle {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("analytics-\(UUID().uuidString).bundle")
    try! FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    var info: [String: Any] = ["CFBundleIdentifier": "ai.cerin.tests.analytics"]
    if let token { info["PostHogProjectToken"] = token }
    if let host { info["PostHogHost"] = host }
    let data = try! PropertyListSerialization.data(fromPropertyList: info, format: .xml, options: 0)
    try! data.write(to: directory.appendingPathComponent("Info.plist"))
    return Bundle(path: directory.path)!
}

@main struct AnalyticsTests {
    @MainActor static func main() {
        let unconfiguredBundles = [
            makeAnalyticsBundle(token: nil),
            makeAnalyticsBundle(token: ""),
            makeAnalyticsBundle(token: "$(POSTHOG_PROJECT_TOKEN)"),
        ]
        let configuredBundle = makeAnalyticsBundle(token: "phc_test", host: "")
        defer {
            for bundle in unconfiguredBundles + [configuredBundle] {
                try? FileManager.default.removeItem(at: bundle.bundleURL)
            }
        }
        let analytics = Analytics(bundle: configuredBundle)
        let sdk = PostHogSDK.shared
        let alice = CerinUser(id: "alice", email: "private@example.com", name: "Private", username: "private", avatarURL: "")
        let bob = CerinUser(id: "bob", email: "", name: "", username: "", avatarURL: "")
        for bundle in unconfiguredBundles {
            let unconfigured = Analytics(bundle: bundle)
            unconfigured.setActive(true)
            unconfigured.identify(alice)
            unconfigured.screen("agent")
            unconfigured.track("agent_message_sent")
            unconfigured.setActive(false)
            unconfigured.reset()
            precondition(sdk.configs.isEmpty && sdk.events.isEmpty, "Missing, empty and unexpanded tokens must stay offline")
        }
        analytics.setActive(true)
        analytics.screen("agent")
        analytics.track("agent_message_sent")
        precondition(sdk.configs.isEmpty && sdk.events.isEmpty, "No anonymous or unvalidated-session events")

        CerinAPI.baseURL = URL(string: "https://self-hosted.example.com")!
        analytics.identify(alice)
        analytics.screen("agent")
        precondition(sdk.configs.isEmpty && sdk.events.isEmpty, "Self-hosted must never start Cloud telemetry")
        CerinAPI.baseURL = CerinAPI.defaultBaseURL
        analytics.identify(alice)
        #if DEBUG
        analytics.screen("agent")
        analytics.track("login")
        precondition(sdk.configs.isEmpty && sdk.events.isEmpty, "Debug builds must stay offline")
        print("Analytics Debug isolation passed")
        #else
        precondition(sdk.configs.count == 1)
        let config = sdk.configs[0]
        precondition(config.projectToken == "phc_test" && config.host == "https://us.i.posthog.com")
        precondition(!config.captureApplicationLifecycleEvents && !config.captureScreenViews && !config.enableSwizzling)
        precondition(!config.preloadFeatureFlags)
        precondition(sdk.events.map(\.name) == ["app_active"] && sdk.events.last?.user == "alice", "Identify before foreground event")
        analytics.identify(alice)
        analytics.setActive(true)
        precondition(sdk.events.count == 1, "Duplicate auth/scene notifications do not inflate activity")
        analytics.screen("agent", teamID: "team-a")
        analytics.screen("agent", teamID: "team-a")
        precondition(sdk.events.count == 2 && sdk.events.last?.name == "$screen")
        precondition(sdk.events.last?.properties["team_id"] as? String == "team-a")
        analytics.setActive(false)
        analytics.screen("chat", teamID: "team-b")
        precondition(sdk.events.count == 2, "No screenviews in background")
        analytics.setActive(true)
        precondition(sdk.events.suffix(2).map(\.name) == ["app_active", "$screen"], "Return emits a fresh screen for cross-day DAU")
        precondition(sdk.events.last?.properties["team_id"] as? String == "team-b")
        // SwiftUI navigation is checked separately on the simulator. Once its
        // root-content onAppear restores the list, neither foregrounding nor
        // reopening a chat in the same team may retain/deduplicate the old chat.
        for page in ["agent", "inbox"] {
            analytics.screen(page, teamID: "team-b")
            analytics.screen("chat", teamID: "team-b")
            analytics.screen(page, teamID: "team-b")
            analytics.setActive(false)
            analytics.setActive(true)
            precondition(sdk.events.last?.properties["$screen_name"] as? String == page)
            let count = sdk.events.count
            analytics.screen("chat", teamID: "team-b")
            precondition(sdk.events.count == count + 1)
            precondition(sdk.events.last?.properties["$screen_name"] as? String == "chat")
        }
        analytics.track("agent_plan_approved", teamID: "team-a", properties: ["plan_id": "plan-1"])
        precondition(sdk.events.last?.properties["team_id"] as? String == "team-a", "Delayed operations retain their own team")
        precondition(sdk.events.last?.properties["client"] as? String == "cerin-ios")
        precondition(sdk.events.allSatisfy { $0.properties["email"] == nil && $0.properties["name"] == nil })
        analytics.reset()
        let signedOutCount = sdk.events.count
        analytics.track("agent_message_sent", teamID: "team-a")
        analytics.screen("chat", teamID: "team-a")
        precondition(sdk.events.count == signedOutCount, "No post-logout attribution to old user")
        analytics.identify(bob)
        precondition(sdk.events.count == signedOutCount + 1 && sdk.events.last?.user == "bob")
        precondition(sdk.events.last?.properties["team_id"] == nil, "Old screen/team cleared on logout")
        analytics.identify(alice)
        precondition(sdk.events.last?.user == "alice" && sdk.resets >= 3, "Direct account switches reset identity")
        CerinAPI.baseURL = URL(string: "https://self-hosted.example.com")!
        let cloudCount = sdk.events.count
        analytics.track("login")
        analytics.setActive(false)
        analytics.setActive(true)
        precondition(sdk.events.count == cloudCount, "Endpoint changes gate every capture")
        print("Analytics identity, foreground, screen, team and endpoint tests passed")
        #endif
    }
}
