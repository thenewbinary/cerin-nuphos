import Foundation

/// A platform.cerin.ai page the app shows itself. Links tapped in a chat and links
/// that open the app both go through here, so the two agree on what opens
/// in-app and what leaves for Safari.
enum AppLink: Equatable {
    case session(teamId: String, sessionId: String)
    case plan(PlanLink.Target)
    case conversations

    /// The page `url` points at: a platform.cerin.ai URL, a bare path, or the
    /// `cerin://open?url=<page>` hand-off platform.cerin.ai uses to open the app.
    /// Nil for pages the app has no screen for.
    init?(_ url: URL) {
        let page = Self.unwrapped(url)
        if let link = SessionLink.target(in: page) {
            self = .session(teamId: link.teamId, sessionId: link.sessionId)
        } else if let plan = PlanLink.target(in: page) {
            self = .plan(plan)
        } else if page == SessionLink.conversations || page == SessionLink.legacyConversations {
            self = .conversations
        } else {
            return nil
        }
    }

    /// The page inside a `cerin://open` link; any other URL as it is. The
    /// page still has to pass the exact-origin checks of the targets above.
    private static func unwrapped(_ url: URL) -> URL {
        let schemes = ["cerin", "nuphos"]
        guard schemes.contains(url.scheme ?? ""), url.host() == "open",
              let page = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?.first(where: { $0.name == "url" })?.value
                .flatMap(URL.init(string:)),
              !schemes.contains(page.scheme ?? "") else { return url }
        return page
    }
}
