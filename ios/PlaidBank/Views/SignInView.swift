import SwiftUI
import AuthenticationServices

struct SignInView: View {
    @Environment(Session.self) private var session
    @State private var error: String?
    @State private var busy = false

    var body: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "building.columns.fill")
                .font(.system(size: 64))
                .foregroundStyle(.tint)
            Text("Ledger").font(.largeTitle.bold())
            Text("All your accounts, one place.").foregroundStyle(.secondary)
            Spacer()
            if busy { ProgressView() }
            SignInWithAppleButton(.signIn) { request in
                request.requestedScopes = [] // we don't need name or email
            } onCompletion: { result in
                handle(result)
            }
            .signInWithAppleButtonStyle(.black)
            .frame(height: 52)
            .disabled(busy)
            if let error { Text(error).font(.footnote).foregroundStyle(.red) }
        }
        .padding(24)
    }

    private func handle(_ result: Result<ASAuthorization, Error>) {
        switch result {
        case .failure(let e):
            if (e as? ASAuthorizationError)?.code != .canceled { error = e.localizedDescription }
        case .success(let auth):
            guard let cred = auth.credential as? ASAuthorizationAppleIDCredential,
                  let data = cred.identityToken, let token = String(data: data, encoding: .utf8) else {
                error = "Apple didn't return an identity token."
                return
            }
            busy = true
            Task {
                defer { busy = false }
                do { try await session.signIn(identityToken: token) }
                catch { self.error = error.localizedDescription }
            }
        }
    }
}
