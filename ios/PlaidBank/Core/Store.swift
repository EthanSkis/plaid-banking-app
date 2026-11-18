import Foundation
import Observation
import LinkKit
import UIKit

@MainActor @Observable
final class Store {
    var banks: [Bank] = []
    var netWorth: [NetWorthPoint] = []
    var cashflow: CashflowResponse?
    var recurring: RecurringResponse?
    var isLoading = false
    var isLinking = false
    var errorMessage: String?

    /// LinkKit's handler must stay alive while Link is on screen.
    private var linkHandler: (any Handler)?

    var accounts: [Account] { banks.flatMap(\.accounts) }
    var netWorthNow: Double { accounts.reduce(0) { $0 + $1.signedBalance } }

    func loadAll() async {
        isLoading = true
        defer { isLoading = false }
        do {
            async let a: AccountsResponse = API.shared.request("GET", "/api/accounts")
            async let n: NetWorthResponse = API.shared.request("GET", "/api/insights/networth")
            async let c: CashflowResponse = API.shared.request("GET", "/api/insights/cashflow")
            async let r: RecurringResponse = API.shared.request("GET", "/api/insights/recurring")
            banks = try await a.items
            netWorth = try await n.series
            cashflow = try await c
            recurring = try await r
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Pull fresh data from Plaid, then reload.
    func refresh() async {
        do {
            struct Res: Decodable {}
            let _: Res = try await API.shared.request("POST", "/api/sync")
        } catch {
            errorMessage = error.localizedDescription
        }
        await loadAll()
    }

    // MARK: Plaid Link

    /// Opens Plaid Link. Pass a bank's id to fix a broken login (update mode) instead of adding a new bank.
    func openLink(relinking itemId: String? = nil) async {
        isLinking = true
        defer { isLinking = false }
        do {
            struct Req: Encodable { let itemId: String? }
            struct Res: Decodable { let linkToken: String }
            let res: Res = try await API.shared.request("POST", "/api/link/token", body: Req(itemId: itemId))

            var config = LinkTokenConfiguration(token: res.linkToken) { [weak self] success in
                Task { @MainActor in await self?.linkSucceeded(publicToken: success.publicToken, relinking: itemId) }
            }
            config.onExit = { [weak self] exit in
                Task { @MainActor in
                    if let err = exit.error { self?.errorMessage = err.displayMessage ?? err.errorMessage }
                    self?.linkHandler = nil
                }
            }

            switch Plaid.create(config) {
            case .success(let handler):
                linkHandler = handler
                guard let top = Self.topViewController() else { return }
                handler.open(presentUsing: .viewController(top))
            case .failure(let error):
                errorMessage = "Couldn't start Plaid Link: \(error)"
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func linkSucceeded(publicToken: String, relinking itemId: String?) async {
        linkHandler = nil
        isLoading = true
        do {
            if itemId == nil {
                // New bank: swap the public token for an access token (server side only).
                struct Req: Encodable { let publicToken: String }
                struct Res: Decodable { let itemId: String }
                let _: Res = try await API.shared.request("POST", "/api/link/exchange", body: Req(publicToken: publicToken))
                await loadAll()
            } else {
                // Update mode: access token is unchanged, don't exchange. Just resync.
                await refresh()
            }
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    func removeBank(_ bank: Bank) async {
        do {
            let _: OKResponse = try await API.shared.request("DELETE", "/api/items/\(bank.id)")
            await loadAll()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func reset() {
        banks = []; netWorth = []; cashflow = nil; recurring = nil
    }

    private static func topViewController() -> UIViewController? {
        let root = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?.rootViewController
        var top = root
        while let presented = top?.presentedViewController { top = presented }
        return top
    }
}
