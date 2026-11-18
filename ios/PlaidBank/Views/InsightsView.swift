import SwiftUI
import Charts

struct InsightsView: View {
    @Environment(Store.self) private var store

    var body: some View {
        NavigationStack {
            List {
                if let cf = store.cashflow, !cf.monthly.isEmpty {
                    Section("Income vs. spending") {
                        Chart {
                            ForEach(cf.monthly) { m in
                                BarMark(x: .value("Month", m.start, unit: .month), y: .value("Amount", m.income))
                                    .foregroundStyle(by: .value("Type", "Income"))
                                    .position(by: .value("Type", "Income"))
                                BarMark(x: .value("Month", m.start, unit: .month), y: .value("Amount", m.spending))
                                    .foregroundStyle(by: .value("Type", "Spending"))
                                    .position(by: .value("Type", "Spending"))
                            }
                        }
                        .chartForegroundStyleScale(["Income": Color.green, "Spending": Color.red.opacity(0.8)])
                        .chartYAxis { AxisMarks { v in AxisGridLine(); AxisValueLabel { if let d = v.as(Double.self) { Text(d.usdShort) } } } }
                        .frame(height: 220)
                        .padding(.vertical, 8)
                    }

                    Section("By month") {
                        ForEach(Array(cf.monthly.reversed())) { m in
                            HStack {
                                Text(m.start.formatted(.dateTime.month(.wide).year()))
                                Spacer()
                                Text((m.net >= 0 ? "+" : "") + m.net.usd)
                                    .font(.body.monospacedDigit())
                                    .foregroundStyle(m.net >= 0 ? .green : .red)
                            }
                        }
                    }

                    if !cf.categories.isEmpty {
                        Section("Top spending this month") {
                            Chart(cf.categories) { c in
                                BarMark(x: .value("Total", c.total), y: .value("Category", c.label))
                                    .annotation(position: .trailing) { Text(c.total.usdShort).font(.caption2) }
                            }
                            .chartXAxis(.hidden)
                            .frame(height: CGFloat(cf.categories.count) * 32)
                        }
                    }
                } else if !store.isLoading {
                    ContentUnavailableView("No data yet", systemImage: "chart.bar",
                                           description: Text("Connect a bank and transactions will show up here."))
                }
            }
            .navigationTitle("Cash Flow")
            .refreshable { await store.refresh() }
        }
    }
}
