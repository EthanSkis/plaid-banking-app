import SwiftUI

struct SettingsView: View {
    @Environment(Session.self) private var session
    @Environment(Store.self) private var store
    @State private var bankToRemove: Bank?
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            List {
                Section("Connected banks") {
                    ForEach(store.banks) { bank in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(bank.institutionName ?? "Bank")
                                Text(bank.needsRelink ? "Needs reconnect" : "\(bank.accounts.count) accounts")
                                    .font(.caption)
                                    .foregroundStyle(bank.needsRelink ? .orange : .secondary)
                            }
                            Spacer()
                            if bank.needsRelink {
                                Button("Fix") { Task { await store.openLink(relinking: bank.id) } }
                            }
                        }
                        .swipeActions {
                            Button("Remove", role: .destructive) { bankToRemove = bank }
                        }
                    }
                    Button {
                        Task { await store.openLink() }
                    } label: {
                        if store.isLinking { ProgressView() } else { Label("Connect a bank", systemImage: "plus") }
                    }
                    .disabled(store.isLinking)
                }

                Section {
                    Button("Sign out") { session.signOut() }
                    Button("Delete account and all data", role: .destructive) { confirmDelete = true }
                }
            }
            .navigationTitle("Settings")
            .confirmationDialog("Remove \(bankToRemove?.institutionName ?? "bank")?",
                                isPresented: Binding(get: { bankToRemove != nil }, set: { if !$0 { bankToRemove = nil } }),
                                titleVisibility: .visible) {
                Button("Remove", role: .destructive) {
                    if let b = bankToRemove { Task { await store.removeBank(b) } }
                }
            } message: {
                Text("Disconnects it from Plaid and deletes its transactions from this app.")
            }
            .confirmationDialog("Delete everything?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete account", role: .destructive) {
                    Task {
                        do { try await session.deleteAccount() }
                        catch { store.errorMessage = error.localizedDescription }
                    }
                }
            } message: {
                Text("Disconnects every bank and permanently deletes all your data. This can't be undone.")
            }
        }
    }
}
