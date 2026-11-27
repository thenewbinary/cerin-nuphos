import Foundation
import PostHog

/// Product events only: no automatic view/tap capture, replay, prompts or URLs.
/// Identity is the same backend user ID used by Desktop and server events.
@MainActor
final class Analytics {
    static let shared = Analytics()

    private let bundle: Bundle
    private var started = false
    private var userID: String?
    private var active = false
    private var currentScreen: (name: String, teamID: String?)?

    init(bundle: Bundle = .main) {
        self.bundle = bundle
    }

    private var projectToken: String? {
        guard let value = bundle.object(forInfoDictionaryKey: "PostHogProjectToken") as? String else { return nil }
        let token = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty, !(token.hasPrefix("$(") && token.hasSuffix(")")) else { return nil }
        return token
    }

    private var postHogHost: String {
        guard let host = (bundle.object(forInfoDictionaryKey: "PostHogHost") as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines), !host.isEmpty else {
            return "https://us.i.posthog.com"
        }
        return host
    }

    private var enabled: Bool {
        #if DEBUG
        return false
        #else
        // Self-hosted users must never be sent to Cerin Cloud analytics.
        return CerinAPI.baseURL == CerinAPI.defaultBaseURL
        #endif
    }

    func identify(_ user: CerinUser) {
        guard enabled, !user.id.isEmpty, let projectToken = projectToken else { reset(); return }
        guard userID != user.id else { return }
        if !started {
            let config = PostHogConfig(projectToken: projectToken, host: postHogHost)
            config.captureApplicationLifecycleEvents = false
            config.captureScreenViews = false
            config.enableSwizzling = false
            config.preloadFeatureFlags = false
            #if os(iOS)
            config.surveys = false
            config.sessionReplay = false
            #endif
            PostHogSDK.shared.setup(config)
            // Discard a persisted SDK identity before attaching the verified session.
            PostHogSDK.shared.reset()
            started = true
        } else if userID != nil {
            reset()
        }
        userID = user.id
        #if os(iOS)
        let platform = "ios"
        #elseif os(macOS)
        let platform = "macos"
        #else
        let platform = "visionos"
        #endif
        PostHogSDK.shared.register(["platform": platform, "client": "cerin-ios"])
        PostHogSDK.shared.identify(user.id)
        if active { foreground() }
    }

    func reset() {
        if started { PostHogSDK.shared.reset() }
        userID = nil
        currentScreen = nil
    }

    /// Root scene owns this signal. Restoring/login completion also emits an
    /// active event if the app is already foregrounded, after identify finishes.
    func setActive(_ value: Bool) {
        guard active != value else { return }
        active = value
        if value { foreground() }
        else if started { PostHogSDK.shared.flush() }
    }

    private func foreground() {
        track("app_active", teamID: currentScreen?.teamID)
        if let currentScreen { captureScreen(currentScreen.name, teamID: currentScreen.teamID) }
    }

    func screen(_ name: String, teamID: String? = nil) {
        guard enabled, started, userID != nil else { return }
        guard currentScreen?.name != name || currentScreen?.teamID != teamID else { return }
        currentScreen = (name, teamID)
        if active { captureScreen(name, teamID: teamID) }
    }

    private func captureScreen(_ name: String, teamID: String?) {
        guard enabled, started, userID != nil else { return }
        // Standard $screen feeds PostHog's existing pageview-or-screen DAU.
        PostHogSDK.shared.screen(name, properties: teamID.map { ["team_id": $0] })
    }

    /// Call sites pass only curated, non-content properties and explicit team
    /// context, so a delayed chat action cannot inherit another screen's team.
    func track(_ event: String, teamID: String? = nil, properties: [String: Any] = [:]) {
        guard enabled, started, userID != nil else { return }
        var properties = properties
        if let teamID { properties["team_id"] = teamID }
        PostHogSDK.shared.capture(event, properties: properties)
    }
}
