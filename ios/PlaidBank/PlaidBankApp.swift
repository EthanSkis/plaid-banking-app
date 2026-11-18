import SwiftUI

@main
struct PlaidBankApp: App {
    @State private var session = Session()
    @State private var store = Store()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(session)
                .environment(store)
        }
    }
}
