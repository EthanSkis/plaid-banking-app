import Foundation

struct APIError: LocalizedError {
    let status: Int
    let message: String
    let code: String?
    var errorDescription: String? { message }
}

private struct ErrorBody: Decodable { let error: String; let code: String? }
struct OKResponse: Decodable { let ok: Bool }

/// Thin async/await client for the Vercel backend.
final class API: @unchecked Sendable {
    static let shared = API()

    var token: String?
    var onUnauthorized: (() -> Void)?

    private let session: URLSession = {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 60 // first sync after linking a bank can take a while
        c.urlCache = nil
        return URLSession(configuration: c)
    }()

    func request<T: Decodable>(
        _ method: String,
        _ path: String,
        query: [URLQueryItem] = [],
        body: (any Encodable)? = nil
    ) async throws -> T {
        var comps = URLComponents(url: Config.apiBaseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
        if !query.isEmpty { comps.queryItems = query }
        var req = URLRequest(url: comps.url!)
        req.httpMethod = method
        if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONEncoder().encode(body)
        }

        let (data, resp) = try await session.data(for: req)
        let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            if status == 401, token != nil { onUnauthorized?() }
            let err = try? JSONDecoder().decode(ErrorBody.self, from: data)
            throw APIError(status: status, message: err?.error ?? "Request failed (\(status))", code: err?.code)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
