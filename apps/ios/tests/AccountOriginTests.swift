import Foundation

@main struct AccountOriginTests {
    static func main() {
        CerinAPI.rememberOrigin("https://first.example.com", token: "synthetic-first")
        CerinAPI.rememberOrigin("https://second.example.com", token: "synthetic-second")
        precondition(CerinAPI.baseURL(for: "synthetic-first").host == "first.example.com")
        precondition(CerinAPI.baseURL(for: "synthetic-second").host == "second.example.com")
        precondition(!CerinAPI.rememberOrigin("https://second.example.com", token: "synthetic-first"))
        precondition(CerinAPI.baseURL(for: "synthetic-first").host == "first.example.com")
        precondition(CerinAPI.baseURL(for: nil) == CerinAPI.baseURL)
        print("Account request origin isolation passed")
    }
}
