import Foundation
import Observation

@MainActor @Observable
final class Session {
    private(set) var isSignedIn: Bool

    init() {
        let token = Keychain.read("session")
        API.shared.token = token
        isSignedIn = token != nil
        API.shared.onUnauthorized = { [weak self] in
            Task { @MainActor in self?.signOut() }
        }
    }

    func signIn(identityToken: String) async throws {
        struct Res: Decodable { let token: String }
        let res: Res = try await API.shared.request("POST", "/api/auth/apple", body: ["identityToken": identityToken])
        Keychain.save(res.token, for: "session")
        API.shared.token = res.token
        isSignedIn = true
    }

    func signOut() {
        Keychain.delete("session")
        API.shared.token = nil
        isSignedIn = false
    }

    func deleteAccount() async throws {
        let _: OKResponse = try await API.shared.request("DELETE", "/api/me")
        signOut()
    }
}
