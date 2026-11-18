import SwiftUI
import Charts

struct OverviewView: View {
    @Environment(Store.self) private var store

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Net worth").font(.subheadline).foregroundStyle(.secondary)
                        Text(store.netWorthNow.usd).font(.system(size: 36, weight: .bold, design: .rounded))
                            .contentTransition(.numericText())
                        NetWorthChart(points: store.netWorth)
                            .frame(height: 180)
                            .padding(.top, 8)
                    }
                    .padding(.vertical, 8)
                }

                if store.banks.isEmpty && !store.isLoading {
                    ContentUnavailableView {
                        Label("No accounts yet", systemImage: "building.columns")
                    } description: {
                        Text("Connect a bank to see balances and activity.")
                    } actions: {
                        Button("Connect a bank") { Task { await store.openLink() } }
                            .buttonStyle(.borderedProminent)
                    }
                }

                ForEach(store.banks) { bank in
                    Section {
                        if bank.needsRelink {
                            Button {
                                Task { await store.openLink(relinking: bank.id) }
                            } label: {
                                Label("Login expired. Tap to reconnect.", systemImage: "exclamationmark.triangle.fill")
                                    .foregroundStyle(.orange)
                            }
                        }
                        ForEach(bank.accounts) { account in
                            AccountRow(account: account)
                        }
                    } header: {
                        Text(bank.institutionName ?? "Bank")
                    }
                }
            }
            .navigationTitle("Overview")
            .refreshable { await store.refresh() }
            .overlay { if store.isLoading && store.banks.isEmpty { ProgressView() } }
        }
    }
}

struct AccountRow: View {
    let account: Account

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(account.name).font(.body)
                Text([account.subtype?.capitalized, account.mask.map { "••\($0)" }].compactMap { $0 }.joined(separator: " · "))
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(account.signedBalance.usd)
                    .font(.body.monospacedDigit())
                    .foregroundStyle(account.isLiability ? .red : .primary)
                if let avail = account.availableBalance, !account.isLiability, avail != account.currentBalance {
                    Text("\(avail.usd) available").font(.caption).foregroundStyle(.secondary)
                }
            }
        }
    }
}

struct NetWorthChart: View {
    let points: [NetWorthPoint]

    var body: some View {
        if points.count < 2 {
            Text("Your net worth chart fills in day by day after you connect a bank.")
                .font(.footnote).foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            let lo = points.map(\.netWorth).min() ?? 0
            let hi = points.map(\.netWorth).max() ?? 0
            let pad = Swift.max((hi - lo) * 0.1, 1)
            Chart(points) { p in
                AreaMark(x: .value("Date", p.day), yStart: .value("Min", lo - pad), yEnd: .value("Net worth", p.netWorth))
                    .foregroundStyle(.linearGradient(colors: [.accentColor.opacity(0.3), .clear], startPoint: .top, endPoint: .bottom))
                LineMark(x: .value("Date", p.day), y: .value("Net worth", p.netWorth))
                    .interpolationMethod(.monotone)
            }
            .chartYScale(domain: (lo - pad)...(hi + pad))
            .chartYAxis { AxisMarks { v in AxisGridLine(); AxisValueLabel { if let d = v.as(Double.self) { Text(d.usdShort) } } } }
        }
    }
}
