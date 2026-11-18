import SwiftUI

struct RootView: View {
    @Environment(Session.self) private var session
    @Environment(Store.self) private var store

    var body: some View {
        Group {
            if session.isSignedIn {
                TabView {
                    OverviewView().tabItem { Label("Overview", systemImage: "chart.line.uptrend.xyaxis") }
                    TransactionsView().tabItem { Label("Activity", systemImage: "list.bullet.rectangle") }
                    InsightsView().tabItem { Label("Cash Flow", systemImage: "chart.bar.xaxis") }
                    SubscriptionsView().tabItem { Label("Recurring", systemImage: "repeat") }
                    SettingsView().tabItem { Label("Settings", systemImage: "gearshape") }
                }
                .task { await store.loadAll() }
            } else {
                SignInView()
            }
        }
        .onChange(of: session.isSignedIn) { _, signedIn in if !signedIn { store.reset() } }
        .alert("Something went wrong", isPresented: Binding(
            get: { store.errorMessage != nil },
            set: { if !$0 { store.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(store.errorMessage ?? "")
        }
    }
}
