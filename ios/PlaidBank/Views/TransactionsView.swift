import SwiftUI

@MainActor @Observable
final class TransactionsModel {
    var items: [Txn] = []
    var nextCursor: String?
    var isLoading = false
    var search = ""
    private var generation = 0

    func reload() async {
        generation += 1
        items = []
        nextCursor = nil
        await loadMore(reset: true)
    }

    func loadMore(reset: Bool = false) async {
        guard reset || (!isLoading && nextCursor != nil) else { return }
        let gen = generation
        isLoading = true
        defer { isLoading = false }
        var query = [URLQueryItem(name: "limit", value: "50")]
        if let c = nextCursor { query.append(.init(name: "cursor", value: c)) }
        let q = search.trimmingCharacters(in: .whitespaces)
        if !q.isEmpty { query.append(.init(name: "q", value: q)) }
        do {
            let page: TxnPage = try await API.shared.request("GET", "/api/transactions", query: query)
            guard gen == generation else { return } // search changed mid-flight
            items += page.transactions
            nextCursor = page.nextCursor
        } catch {}
    }
}

struct TransactionsView: View {
    @Environment(Store.self) private var store
    @State private var model = TransactionsModel()

    var body: some View {
        NavigationStack {
            List {
                ForEach(grouped) { group in
                    Section(Day.parse(group.id).formatted(date: .abbreviated, time: .omitted)) {
                        ForEach(group.txns) { TxnRow(txn: $0) }
                    }
                }
                if model.nextCursor != nil {
                    ProgressView().frame(maxWidth: .infinity)
                        .task { await model.loadMore() }
                }
            }
            .overlay {
                if model.items.isEmpty && !model.isLoading {
                    ContentUnavailableView(model.search.isEmpty ? "No transactions" : "No results",
                                           systemImage: "magnifyingglass")
                }
            }
            .navigationTitle("Activity")
            .searchable(text: $model.search, prompt: "Merchant or description")
            .task(id: [model.search] + store.banks.map(\.id)) {
                try? await Task.sleep(for: .milliseconds(300)) // debounce
                await model.reload()
            }
            .refreshable {
                await store.refresh()
                await model.reload()
            }
        }
    }

    private struct DayGroup: Identifiable { let id: String; let txns: [Txn] }

    private var grouped: [DayGroup] {
        var order: [String] = []
        var map: [String: [Txn]] = [:]
        for t in model.items {
            if map[t.date] == nil { order.append(t.date) }
            map[t.date, default: []].append(t)
        }
        return order.map { DayGroup(id: $0, txns: map[$0] ?? []) }
    }
}

struct TxnRow: View {
    let txn: Txn

    var body: some View {
        HStack(spacing: 12) {
            AsyncImage(url: txn.logoUrl.flatMap { URL(string: $0) }) { img in
                img.resizable().scaledToFit()
            } placeholder: {
                Image(systemName: "creditcard").foregroundStyle(.secondary)
            }
            .frame(width: 32, height: 32)
            .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 2) {
                Text(txn.title).lineLimit(1)
                Text([txn.category?.replacingOccurrences(of: "_", with: " ").capitalized, txn.accountName]
                        .compactMap { $0 }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(.secondary).lineLimit(1)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(txn.displayAmount.usd)
                    .font(.body.monospacedDigit())
                    .foregroundStyle(txn.displayAmount > 0 ? .green : .primary)
                if txn.pending { Text("Pending").font(.caption2).foregroundStyle(.secondary) }
            }
        }
    }
}
