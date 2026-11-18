import SwiftUI

struct SubscriptionsView: View {
    @Environment(Store.self) private var store

    var body: some View {
        NavigationStack {
            List {
                if let r = store.recurring {
                    Section {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Recurring charges per month").font(.subheadline).foregroundStyle(.secondary)
                            Text(r.monthlyTotal.usd).font(.system(size: 32, weight: .bold, design: .rounded))
                            Text("\(r.monthlyTotal * 12, format: .currency(code: "USD").precision(.fractionLength(0))) a year")
                                .font(.footnote).foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 6)
                    }
                    let active = r.recurring.filter(\.active)
                    let lapsed = r.recurring.filter { !$0.active }
                    if !active.isEmpty {
                        Section("Active") { ForEach(active) { RecurringRow(item: $0) } }
                    }
                    if !lapsed.isEmpty {
                        Section("Stopped or lapsed") { ForEach(lapsed) { RecurringRow(item: $0).opacity(0.6) } }
                    }
                    if r.recurring.isEmpty {
                        ContentUnavailableView("Nothing recurring found", systemImage: "repeat",
                                               description: Text("Needs at least a few months of history to spot patterns."))
                    }
                }
            }
            .navigationTitle("Recurring")
            .refreshable { await store.refresh() }
        }
    }
}

struct RecurringRow: View {
    let item: RecurringCharge

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(item.name)
                Text(item.active
                     ? "\(item.frequency.capitalized) · next ~\(Day.parse(item.nextExpectedDate).formatted(.dateTime.month().day()))"
                     : "\(item.frequency.capitalized) · last \(Day.parse(item.lastDate).formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            Text(item.lastAmount.usd).font(.body.monospacedDigit())
        }
    }
}
