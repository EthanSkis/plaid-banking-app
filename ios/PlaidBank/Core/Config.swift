import Foundation

enum Config {
    /// Set API_HOST in ios/Local.xcconfig (host only, no https:// because xcconfig treats // as a comment).
    static let apiBaseURL: URL = {
        guard let host = Bundle.main.object(forInfoDictionaryKey: "API_HOST") as? String,
              !host.isEmpty, let url = URL(string: "https://\(host)") else {
            fatalError("API_HOST missing. Copy ios/Local.xcconfig.example to ios/Local.xcconfig and set it.")
        }
        return url
    }()
}
