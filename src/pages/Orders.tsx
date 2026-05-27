import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import {
  collection,
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { SidebarLayout } from "../components/Sidebar";
import {
  ShoppingBag,
  Search,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle2,
  Clock,
  Receipt
} from "lucide-react";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

interface Order {
  id: string;
  tableNumber?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount?: number;
  grandTotal: number;
  paymentMethod: "Cash" | "UPI" | "Card";
  createdAt: string;
  status?: string;
  // Retail fields
  customerName?: string;
  orderId?: string;
}

type FilterPeriod = "today" | "week" | "month";

const paymentIcon = (method: string) => {
  if (method === "UPI") return <Smartphone className="h-3.5 w-3.5" />;
  if (method === "Card") return <CreditCard className="h-3.5 w-3.5" />;
  return <Banknote className="h-3.5 w-3.5" />;
};

const paymentColor = (method: string) => {
  if (method === "UPI") return "bg-purple-100 text-purple-700 border-purple-200";
  if (method === "Card") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-green-100 text-green-700 border-green-200";
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
  };
};

const isInPeriod = (iso: string, period: FilterPeriod): boolean => {
  const d = new Date(iso);
  const now = new Date();

  if (period === "today") {
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }
  if (period === "week") {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return d >= weekStart;
  }
  // month
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

export const Orders: React.FC = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterPeriod>("today");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "businesses", user.uid, "orders"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const data: Order[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      setOrders(data);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const filtered = useMemo(() => {
    let result = orders.filter((o) => isInPeriod(o.createdAt, filter));
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (o) =>
          `#${orders.length - orders.indexOf(o)}`.includes(s) ||
          (o.tableNumber || "").toLowerCase().includes(s) ||
          (o.orderId || "").toLowerCase().includes(s) ||
          (o.customerName || "").toLowerCase().includes(s)
      );
    }
    return result;
  }, [orders, filter, search]);

  const totalRevenue = useMemo(
    () => filtered.reduce((sum, o) => sum + (o.grandTotal || 0), 0),
    [filtered]
  );

  const filterLabels: { key: FilterPeriod; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" }
  ];

  return (
    <SidebarLayout>
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Order History</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              All completed orders from your restaurant
            </p>
          </div>

          {/* Summary Chip */}
          <div className="flex items-center gap-3">
            <div className="bg-saffron/10 border border-saffron/20 rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-saffron font-semibold uppercase tracking-wide">
                {filterLabels.find((f) => f.key === filter)?.label} Revenue
              </p>
              <p className="text-xl font-bold text-saffron">
                ₹{totalRevenue.toFixed(0)}
              </p>
            </div>
            <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-2 text-center">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Orders</p>
              <p className="text-xl font-bold text-slate-700">{filtered.length}</p>
            </div>
          </div>
        </div>

        {/* Filters + Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Filter Pills */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {filterLabels.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border-0 ${
                    filter === f.key
                      ? "bg-white text-saffron shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by table or order…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron bg-slate-50"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-saffron border-t-transparent" />
                <p className="text-sm font-medium">Loading orders…</p>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-24 text-center px-6">
              <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Receipt className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-1">No orders found</h3>
              <p className="text-slate-400 text-sm max-w-sm">
                {search
                  ? `No orders matched "${search}". Try a different search term.`
                  : `No completed orders for ${filterLabels.find((f) => f.key === filter)?.label.toLowerCase()}. Orders will appear here after checkout.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Order #
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Table
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Date & Time
                    </th>
                    <th className="px-5 py-3.5 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((order) => {
                    const isExpanded = expandedId === order.id;
                    const { date, time } = formatDateTime(order.createdAt);
                    const orderNumber = orders.length - orders.findIndex((o) => o.id === order.id);

                    return (
                      <React.Fragment key={order.id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : order.id)}
                          className={`cursor-pointer transition-colors hover:bg-slate-50 ${
                            isExpanded ? "bg-saffron/5" : ""
                          }`}
                        >
                          {/* Order # */}
                          <td className="px-5 py-4">
                            <span className="font-mono font-bold text-slate-700 text-sm">
                              #{String(orderNumber).padStart(4, "0")}
                            </span>
                          </td>

                          {/* Table */}
                          <td className="px-5 py-4">
                            {order.tableNumber ? (
                              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                                <span className="h-6 w-6 rounded-md bg-dark-panel text-white text-xs flex items-center justify-center font-bold">
                                  {order.tableNumber.startsWith("VIP") ? "V" : order.tableNumber.slice(0, 2)}
                                </span>
                                {order.tableNumber.startsWith("VIP") || order.tableNumber.startsWith("Table")
                                  ? order.tableNumber
                                  : `Table ${order.tableNumber}`}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )}
                          </td>

                          {/* Items count */}
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-full">
                              <ShoppingBag className="h-3.5 w-3.5" />
                              {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}
                            </span>
                          </td>

                          {/* Total */}
                          <td className="px-5 py-4">
                            <span className="font-bold text-slate-800 text-sm">
                              ₹{(order.grandTotal || 0).toFixed(0)}
                            </span>
                          </td>

                          {/* Payment */}
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${paymentColor(
                                order.paymentMethod
                              )}`}
                            >
                              {paymentIcon(order.paymentMethod)}
                              {order.paymentMethod}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Completed
                            </span>
                          </td>

                          {/* Date & Time */}
                          <td className="px-5 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-slate-700">{date}</span>
                              <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="h-3 w-3" />
                                {time}
                              </span>
                            </div>
                          </td>

                          {/* Expand toggle */}
                          <td className="px-3 py-4">
                            <div
                              className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                                isExpanded
                                  ? "bg-saffron text-white"
                                  : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                              }`}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                          <tr className="bg-saffron/5">
                            <td colSpan={8} className="px-5 pb-5 pt-1">
                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                {/* Items Table */}
                                <div className="px-5 py-4 border-b border-slate-100">
                                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                    Order Items
                                  </h4>
                                  <div className="space-y-2">
                                    {(order.items || []).map((item, i) => (
                                      <div
                                        key={i}
                                        className="flex items-center justify-between"
                                      >
                                        <div className="flex items-center gap-3">
                                          <span className="h-6 w-6 rounded-full bg-slate-100 text-slate-500 text-xs flex items-center justify-center font-bold">
                                            {item.qty}×
                                          </span>
                                          <span className="text-sm font-medium text-slate-700">
                                            {item.name}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <span className="text-xs text-slate-400">
                                            ₹{item.price} × {item.qty}
                                          </span>
                                          <span className="text-sm font-semibold text-slate-700 w-20 text-right">
                                            ₹{(item.price * item.qty).toFixed(0)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Totals */}
                                <div className="px-5 py-4 bg-slate-50">
                                  <div className="max-w-xs ml-auto space-y-1.5">
                                    <div className="flex justify-between text-sm text-slate-600">
                                      <span>Subtotal</span>
                                      <span>₹{(order.subtotal || 0).toFixed(0)}</span>
                                    </div>
                                    {(order.discount || 0) > 0 && (
                                      <div className="flex justify-between text-sm text-emerald-600">
                                        <span>Discount</span>
                                        <span>− ₹{(order.discount || 0).toFixed(0)}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between text-sm text-slate-500">
                                      <span>Tax</span>
                                      <span>₹{(order.tax || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-2 mt-2">
                                      <span>Grand Total</span>
                                      <span className="text-saffron">
                                        ₹{(order.grandTotal || 0).toFixed(0)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer note */}
        {filtered.length > 0 && (
          <p className="text-center text-xs text-slate-400 mt-4">
            Showing {filtered.length} order{filtered.length !== 1 ? "s" : ""} · Click any row to view details
          </p>
        )}
      </div>
    </SidebarLayout>
  );
};
