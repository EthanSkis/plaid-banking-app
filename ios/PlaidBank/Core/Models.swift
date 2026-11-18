import Foundation

struct Bank: Decodable, Identifiable {
    let id: String
    let institutionName: String?
    let status: String          // ok | login_required | error
    let errorCode: String?
    let lastSyncedAt: String?
    let accounts: [Account]
    var needsRelink: Bool { status == "login_required" }
}

struct Account: Decodable, Identifiable {
    let id: String
    let itemId: String
    let name: String
    let officialName: String?
    let mask: String?
    let type: String
    let subtype: String?
    let currentBalance: Double?
    let availableBalance: Double?
    let creditLimit: Double?
    let currency: String?
    /// Plaid reports credit/loan balances as positive amounts owed.
    var isLiability: Bool { type == "credit" || type == "loan" }
    var signedBalance: Double { (currentBalance ?? 0) * (isLiability ? -1 : 1) }
}

struct AccountsResponse: Decodable { let items: [Bank] }

struct Txn: Decodable, Identifiable {
    let id: String
    let accountId: String
    let accountName: String
    /// Plaid convention: positive = money out. Use `displayAmount` in UI.
    let amount: Double
    let currency: String?
    let date: String
    let name: String
    let merchantName: String?
    let category: String?
    let pending: Bool
    let logoUrl: String?
    var displayAmount: Double { -amount }
    var title: String { merchantName ?? name }
}

struct TxnPage: Decodable { let transactions: [Txn]; let nextCursor: String? }

struct NetWorthPoint: Decodable, Identifiable {
    let date: String
    let assets: Double
    let liabilities: Double
    let netWorth: Double
    var id: String { date }
    var day: Date { Day.parse(date) }
}
struct NetWorthResponse: Decodable { let series: [NetWorthPoint] }

struct MonthFlow: Decodable, Identifiable {
    let month: String   // YYYY-MM
    let income: Double
    let spending: Double
    var id: String { month }
    var start: Date { Day.parse(month + "-01") }
    var net: Double { income - spending }
}
struct CategoryTotal: Decodable, Identifiable {
    let category: String
    let total: Double
    var id: String { category }
    var label: String { category.replacingOccurrences(of: "_", with: " ").capitalized }
}
struct CashflowResponse: Decodable { let monthly: [MonthFlow]; let categories: [CategoryTotal] }

struct RecurringCharge: Decodable, Identifiable {
    let name: String
    let frequency: String
    let averageAmount: Double
    let lastAmount: Double
    let lastDate: String
    let nextExpectedDate: String
    let occurrences: Int
    let monthlyCost: Double
    let active: Bool
    var id: String { name + frequency }
}
struct RecurringResponse: Decodable { let recurring: [RecurringCharge]; let monthlyTotal: Double }

enum Day {
    private static let f: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()
    static func parse(_ s: String) -> Date { f.date(from: s) ?? .distantPast }
}

extension Double {
    var usd: String { formatted(.currency(code: "USD")) }
    var usdShort: String { formatted(.currency(code: "USD").precision(.fractionLength(0))) }
}
