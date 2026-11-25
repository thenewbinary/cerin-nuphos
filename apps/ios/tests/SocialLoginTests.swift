import Foundation

@main struct SocialLoginTests {
    static func main() throws {
        let state = "expected-state"
        let code = String(repeating: "c", count: 43)
        func parse(_ query: String) -> CerinWeb.CallbackResult? {
            CerinWeb.parseCallback(URL(string: "cerin://google-callback?\(query)")!, expectedState: state)
        }
        precondition(parse("state=\(state)&code=\(code)") == .code(code))
        precondition(parse("state=wrong&code=\(code)") == nil)
        precondition(parse("code=\(code)") == nil)
        precondition(parse("state=\(state)&token=secret") == nil)
        precondition(parse("state=\(state)&code=") == nil)
        precondition(parse("state=\(state)&error=sign_in_failed") == .failure("Sign-in did not complete. Please try again."))
        precondition(parse("state=\(state)&code=\(code)&error=cancelled") == .failure("Sign-in did not complete. Please try again."))
        precondition(parse("state=\(state)&code=\(code)&authuser=0") == .code(code))
        precondition(parse("state=\(state)&code=\(code)#") == .code(code))
        precondition(CerinWeb.parseCallback(URL(string: "cerin://google-callback/?state=\(state)&code=\(code)")!, expectedState: state) == .code(code))
        precondition(CerinWeb.parseCallback(URL(string: "cerin://other?state=\(state)&code=\(code)")!, expectedState: state) == nil)
        let verifier = try CerinWeb.randomSecret()
        precondition(verifier.count == 43)
        precondition(CerinWeb.challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk") == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
        let url = CerinWeb.loginURL(baseURL: URL(string: "https://api.example.com")!, handle: "handle", provider: .google)
        precondition(url.absoluteString == "https://api.example.com/auth/social/google/start?handle=handle")
        let apple = CerinWeb.loginURL(baseURL: URL(string: "https://self.example.com")!, handle: "a+b&c", provider: .apple)
        precondition(apple.path == "/auth/social/apple/start")
        let items = URLComponents(url: apple, resolvingAgainstBaseURL: false)!.queryItems!
        precondition(items == [URLQueryItem(name: "handle", value: "a+b&c")])
        precondition(CerinWeb.providers(header: "google,apple") == [.apple, .google])
        precondition(CerinWeb.providers(header: " google,unknown,google ") == [.google])
        precondition(CerinWeb.providers(header: "") == [])
        precondition(CerinWeb.providers(header: nil) == [.google])
        precondition(CerinWeb.providers(header: "oidc,google") == [.google, .oidc])
        precondition(CerinWeb.options(providers: "oidc", oidcName: "Acme SSO") == .init(providers: [.oidc], oidcName: "Acme SSO"))
        precondition(CerinWeb.options(providers: "oidc", oidcName: nil).oidcName == "SSO")
        precondition(CerinWeb.options(providers: "oidc", oidcName: "  ").oidcName == "SSO")
        let oidc = CerinWeb.loginURL(baseURL: URL(string: "https://cerin.example.com")!, handle: "h", provider: .oidc)
        precondition(oidc.absoluteString == "https://cerin.example.com/auth/social/oidc/start?handle=h")
        print("Social login callback and PKCE checks passed")
    }
}
