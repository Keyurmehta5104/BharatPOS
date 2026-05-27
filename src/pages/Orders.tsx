import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { SidebarLayout } from "../components/Sidebar";
import {
  Banknote,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Receipt,
  Search,
  ShoppingBag,
  Smartphone,
  X
} from "lucide-react";

interface OrderItem {
  id?: string;
  name: string;
  price: number;
  qty: number;
  unit?: string;
}

interface OrderRecord {
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
  customerName?: string;
  customerPhone?: string;
  orderId?: string;
}

type RestaurantFilterPeriod = "today" | "week" | "month";
type RetailQuickRange = "today" | "yesterday" | "last7" | "last30" | "custom";

const paymentIcon = (method: string) => {
  if (method === "UPI") return <Smartphone className="h-3.5 w-3.5" />;
  if (method === "Card") return <CreditCard className="h-3.5 w-3.5" />;
  return <Banknote className="h-3.5 w-3.5" />;
};

const paymentColor = (method: string) => {
  if (method === "UPI") return "bg-purple-100 text-purple-700 border-purple-200";
  if (method === "Card") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);

const formatDateTime = (iso: string) => {
  const date = new Date(iso);
  return {
    date: date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }),
    time: date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    })
  };
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDayBounds = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const getRetailDateRange = (range: RetailQuickRange, customStart: string, customEnd: string) => {
  const now = new Date();

  if (range === "today") {
    return getDayBounds(now);
  }

  if (range === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return getDayBounds(yesterday);
  }

  if (range === "last7") {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (range === "last30") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const start = customStart ? new Date(`${customStart}T00:00:00`) : new Date("1970-01-01T00:00:00");
  const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : new Date(`${toDateInputValue(now)}T23:59:59.999`);
  return { start, end };
};

const isInRestaurantPeriod = (iso: string, period: RestaurantFilterPeriod) => {
  const date = new Date(iso);
  const now = new Date();

  if (period === "today") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  }

  if (period === "week") {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    return date >= weekStart;
  }

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
};

const getRetailRangeLabel = (range: RetailQuickRange, customStart: string, customEnd: string) => {
  if (range === "today") return "Today";
  if (range === "yesterday") return "Yesterday";
  if (range === "last7") return "Last 7 Days";
  if (range === "last30") return "Last 30 Days";
  if (customStart && customEnd) return `${customStart}_to_${customEnd}`;
  if (customStart) return `${customStart}_onwards`;
  if (customEnd) return `until_${customEnd}`;
  return "Custom";
};

const downloadCsv = (filename: string, rows: string[][]) => {
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell ?? "").replace(/"/g, "\"\"")}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const RetailSalesHistory: React.FC<{ orders: OrderRecord[]; loading: boolean }> = ({ orders, loading }) => {
  const today = useMemo(() => new Date(), []);
  const [search, setSearch] = useState("");
  const [selectedRange, setSelectedRange] = useState<RetailQuickRange>("today");
  const [customStart, setCustomStart] = useState(toDateInputValue(today));
  const [customEnd, setCustomEnd] = useState(toDateInputValue(today));
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const { start, end } = getRetailDateRange(selectedRange, customStart, customEnd);
    const sorted = [...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return sorted.filter((order) => {
      const orderDate = new Date(order.createdAt);
      if (orderDate < start || orderDate > end) {
        return false;
      }

      const searchText = search.trim().toLowerCase();
      if (!searchText) {
        return true;
      }

      return (
        (order.orderId || "").toLowerCase().includes(searchText) ||
        (order.customerName || "").toLowerCase().includes(searchText)
      );
    });
  }, [orders, selectedRange, customStart, customEnd, search]);

  const selectedOrder = useMemo(
    () => filteredOrders.find((order) => order.id === selectedOrderId) || null,
    [filteredOrders, selectedOrderId]
  );

  useEffect(() => {
    if (!selectedOrderId) return;
    if (!filteredOrders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(null);
    }
  }, [filteredOrders, selectedOrderId]);

  const summary = useMemo(() => {
    const totals = filteredOrders.reduce(
      (acc, order) => {
        acc.totalRevenue += order.grandTotal || 0;
        acc.totalDiscount += order.discount || 0;
        acc.paymentCounts[order.paymentMethod] = (acc.paymentCounts[order.paymentMethod] || 0) + 1;
        return acc;
      },
      {
        totalRevenue: 0,
        totalDiscount: 0,
        paymentCounts: {} as Record<string, number>
      }
    );

    const mostUsedPaymentMethod =
      Object.entries(totals.paymentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    return {
      totalBills: filteredOrders.length,
      totalRevenue: totals.totalRevenue,
      totalDiscount: totals.totalDiscount,
      mostUsedPaymentMethod
    };
  }, [filteredOrders]);

  const exportSales = () => {
    const rows: string[][] = [
      [
        "Bill #",
        "Customer Name",
        "Customer Phone",
        "Items Count",
        "Subtotal",
        "Discount",
        "Tax",
        "Grand Total",
        "Payment Method",
        "Date",
        "Time"
      ],
      ...filteredOrders.map((order) => {
        const { date, time } = formatDateTime(order.createdAt);
        return [
          order.orderId || order.id,
          order.customerName || "General Walk-In",
          order.customerPhone || "",
          String(order.items?.length || 0),
          (order.subtotal || 0).toFixed(2),
          (order.discount || 0).toFixed(2),
          (order.tax || 0).toFixed(2),
          (order.grandTotal || 0).toFixed(2),
          order.paymentMethod,
          date,
          time
        ];
      })
    ];

    const rangeLabel = getRetailRangeLabel(selectedRange, customStart, customEnd).replace(/\s+/g, "-");
    downloadCsv(`Sales-${rangeLabel}.csv`, rows);
  };

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }

          .thermal-print-root,
          .thermal-print-root * {
            visibility: visible;
          }

          .thermal-print-root {
            position: absolute;
            inset: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white;
          }

          .hide-on-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="space-y-6">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Sales History</h2>
            <p className="text-sm text-slate-500 mt-1">
              Review completed retail bills, reprint receipts, and export filtered sales.
            </p>
          </div>

          <button
            type="button"
            onClick={exportSales}
            disabled={filteredOrders.length === 0}
            className="hide-on-print inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 shadow-sm border-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Bills</p>
            <p className="mt-2 text-3xl font-black text-slate-900">{summary.totalBills}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Revenue</p>
            <p className="mt-2 text-3xl font-black text-saffron">{formatCurrency(summary.totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Discount Given</p>
            <p className="mt-2 text-3xl font-black text-emerald-600">{formatCurrency(summary.totalDiscount)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Top Payment Mode</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-700">
              {summary.mostUsedPaymentMethod !== "N/A" && paymentIcon(summary.mostUsedPaymentMethod)}
              <span>{summary.mostUsedPaymentMethod}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 md:p-5 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by bill number or customer name..."
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron bg-slate-50/60 text-slate-900"
              />
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-1 overflow-x-auto">
              {[
                { key: "today", label: "Today" },
                { key: "yesterday", label: "Yesterday" },
                { key: "last7", label: "Last 7 Days" },
                { key: "last30", label: "Last 30 Days" },
                { key: "custom", label: "Custom Range" }
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSelectedRange(option.key as RetailQuickRange)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-all border-0 cursor-pointer ${
                    selectedRange === option.key
                      ? "bg-white text-saffron shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Filter Window</label>
              <div className="mt-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Calendar className="h-4 w-4 text-saffron" />
                <span>{getRetailRangeLabel(selectedRange, customStart, customEnd)}</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Start Date</label>
              <input
                type="date"
                value={customStart}
                onChange={(event) => {
                  setSelectedRange("custom");
                  setCustomStart(event.target.value);
                }}
                className="mt-1.5 w-full border-0 bg-transparent p-0 text-sm font-semibold text-slate-800 focus:outline-none"
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">End Date</label>
              <input
                type="date"
                value={customEnd}
                onChange={(event) => {
                  setSelectedRange("custom");
                  setCustomEnd(event.target.value);
                }}
                className="mt-1.5 w-full border-0 bg-transparent p-0 text-sm font-semibold text-slate-800 focus:outline-none"
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Sort Order</label>
              <p className="mt-1.5 text-sm font-semibold text-slate-700">Latest first</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-saffron border-t-transparent" />
                <p className="text-sm font-medium">Loading sales history...</p>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="px-6 py-24 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
                <Receipt className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">No sales found</h3>
              <p className="mt-2 text-sm text-slate-400 max-w-md mx-auto">
                No completed bills match the selected date range and search filters yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Bill #</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Customer Name</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Items</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Subtotal</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Discount</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Tax</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Grand Total</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Payment Method</th>
                    <th className="px-5 py-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => {
                    const { date, time } = formatDateTime(order.createdAt);
                    const itemCount = order.items?.length || 0;

                    return (
                      <tr
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-5 py-4">
                          <span className="font-mono text-sm font-bold text-slate-700">{order.orderId || order.id}</span>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{order.customerName || "General Walk-In"}</p>
                            <p className="text-xs text-slate-400">{order.customerPhone || "No phone saved"}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-700">{itemCount}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-700">{formatCurrency(order.subtotal || 0)}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-emerald-600">{formatCurrency(order.discount || 0)}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-700">{formatCurrency(order.tax || 0)}</td>
                        <td className="px-5 py-4 text-sm font-bold text-saffron">{formatCurrency(order.grandTotal || 0)}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${paymentColor(order.paymentMethod)}`}>
                            {paymentIcon(order.paymentMethod)}
                            {order.paymentMethod}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm text-slate-700 font-medium">{date}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            {time}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="hide-on-print absolute inset-0 bg-slate-950/50" onClick={() => setSelectedOrderId(null)} />

            <div className="relative z-10 h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl thermal-print-root">
              <div className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Retail Bill Detail</p>
                    <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedOrder.orderId || selectedOrder.id}</h3>
                    <p className="mt-1 text-sm text-slate-500">Tap print to reprint this sale as a thermal-style receipt.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId(null)}
                    className="rounded-lg border-0 bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-6 px-6 py-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Customer Details</p>
                    <p className="mt-2 text-base font-bold text-slate-900">{selectedOrder.customerName || "General Walk-In"}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedOrder.customerPhone || "Phone not available"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bill Information</p>
                    <p className="mt-2 text-sm font-semibold text-slate-800">
                      {formatDateTime(selectedOrder.createdAt).date} at {formatDateTime(selectedOrder.createdAt).time}
                    </p>
                    <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${paymentColor(selectedOrder.paymentMethod)}`}>
                      {paymentIcon(selectedOrder.paymentMethod)}
                      {selectedOrder.paymentMethod}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h4 className="text-sm font-bold text-slate-800">Full Bill Breakdown</h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px]">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Item</th>
                          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Qty</th>
                          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Unit Price</th>
                          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedOrder.items.map((item, index) => (
                          <tr key={`${item.name}-${index}`}>
                            <td className="px-4 py-3">
                              <div className="text-sm font-semibold text-slate-800">{item.name}</div>
                              <div className="text-xs text-slate-400">{item.unit || "pcs"}</div>
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-700">{item.qty}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-700">{formatCurrency(item.price)}</td>
                            <td className="px-4 py-3 text-sm font-bold text-slate-900">{formatCurrency(item.price * item.qty)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Subtotal</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(selectedOrder.subtotal || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-emerald-600">
                      <span>Discount</span>
                      <span>{formatCurrency(selectedOrder.discount || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>Tax</span>
                      <span className="font-semibold text-slate-900">{formatCurrency(selectedOrder.tax || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-dashed border-slate-300 pt-3 text-base font-black text-slate-900">
                      <span>Grand Total</span>
                      <span className="text-saffron">{formatCurrency(selectedOrder.grandTotal || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 font-mono text-[12px] text-slate-800 shadow-sm">
                  <div className="border-b border-dashed border-slate-300 pb-3 text-center">
                    <h4 className="text-base font-black tracking-wide text-slate-900">BHARATPOS RETAIL</h4>
                    <p className="mt-1 text-[11px] text-slate-500">Thermal receipt reprint</p>
                  </div>
                  <div className="space-y-2 border-b border-dashed border-slate-300 py-3">
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Bill #</span>
                      <span className="font-bold text-right">{selectedOrder.orderId || selectedOrder.id}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Customer</span>
                      <span className="font-bold text-right">{selectedOrder.customerName || "General Walk-In"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Phone</span>
                      <span className="font-bold text-right">{selectedOrder.customerPhone || "-"}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500">Date</span>
                      <span className="font-bold text-right">
                        {formatDateTime(selectedOrder.createdAt).date} {formatDateTime(selectedOrder.createdAt).time}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 border-b border-dashed border-slate-300 py-3">
                    {selectedOrder.items.map((item, index) => (
                      <div key={`thermal-${item.name}-${index}`} className="flex justify-between gap-4">
                        <div>
                          <p className="font-bold">{item.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.qty} x {formatCurrency(item.price)}
                          </p>
                        </div>
                        <span className="font-bold">{formatCurrency(item.price * item.qty)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1 pt-3">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span className="font-bold">{formatCurrency(selectedOrder.subtotal || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount</span>
                      <span className="font-bold">{formatCurrency(selectedOrder.discount || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span className="font-bold">{formatCurrency(selectedOrder.tax || 0)}</span>
                    </div>
                    <div className="flex justify-between border-t border-dashed border-slate-300 pt-2 text-base">
                      <span className="font-black">Grand Total</span>
                      <span className="font-black">{formatCurrency(selectedOrder.grandTotal || 0)}</span>
                    </div>
                    <div className="mt-2 text-center text-[11px] text-slate-500">
                      Paid via {selectedOrder.paymentMethod}
                    </div>
                  </div>
                </div>
              </div>

              <div className="hide-on-print border-t border-slate-200 bg-slate-50 px-6 py-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 rounded-xl bg-saffron px-4 py-3 text-sm font-bold text-white shadow-md shadow-saffron/15 hover:bg-saffron-hover border-0 cursor-pointer"
                  >
                    Print Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Reprint Thermal Receipt
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

const RestaurantOrdersHistory: React.FC<{ orders: OrderRecord[]; loading: boolean }> = ({ orders, loading }) => {
  const [filter, setFilter] = useState<RestaurantFilterPeriod>("today");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = orders.filter((order) => isInRestaurantPeriod(order.createdAt, filter));
    if (search.trim()) {
      const searchText = search.toLowerCase();
      result = result.filter(
        (order) =>
          (order.tableNumber || "").toLowerCase().includes(searchText) ||
          (order.orderId || "").toLowerCase().includes(searchText) ||
          (order.customerName || "").toLowerCase().includes(searchText)
      );
    }
    return result;
  }, [orders, filter, search]);

  const totalRevenue = useMemo(
    () => filtered.reduce((sum, order) => sum + (order.grandTotal || 0), 0),
    [filtered]
  );

  const filterLabels: { key: RestaurantFilterPeriod; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This Week" },
    { key: "month", label: "This Month" }
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Order History</h2>
          <p className="mt-0.5 text-sm text-slate-500">All completed orders from your restaurant</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-saffron/20 bg-saffron/10 px-4 py-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-saffron">
              {filterLabels.find((item) => item.key === filter)?.label} Revenue
            </p>
            <p className="text-xl font-bold text-saffron">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orders</p>
            <p className="text-xl font-bold text-slate-700">{filtered.length}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {filterLabels.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all border-0 cursor-pointer ${
                  filter === item.key ? "bg-white text-saffron shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="relative w-full flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by table or order..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-saffron border-t-transparent" />
              <p className="text-sm font-medium">Loading orders...</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <Receipt className="h-10 w-10 text-slate-300" />
            </div>
            <h3 className="mb-1 text-lg font-bold text-slate-700">No orders found</h3>
            <p className="max-w-sm text-sm text-slate-400">
              {search
                ? `No orders matched "${search}". Try a different search term.`
                : `No completed orders for ${filterLabels.find((item) => item.key === filter)?.label.toLowerCase()}. Orders will appear here after checkout.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Order #</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Table</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Items</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Total</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Payment</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Date & Time</th>
                  <th className="w-8 px-5 py-3.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((order) => {
                  const isExpanded = expandedId === order.id;
                  const { date, time } = formatDateTime(order.createdAt);
                  const orderNumber = orders.length - orders.findIndex((item) => item.id === order.id);

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        onClick={() => setExpandedId(isExpanded ? null : order.id)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50 ${isExpanded ? "bg-saffron/5" : ""}`}
                      >
                        <td className="px-5 py-4">
                          <span className="font-mono text-sm font-bold text-slate-700">#{String(orderNumber).padStart(4, "0")}</span>
                        </td>
                        <td className="px-5 py-4">
                          {order.tableNumber ? (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-dark-panel text-xs font-bold text-white">
                                {order.tableNumber.startsWith("VIP") ? "V" : order.tableNumber.slice(0, 2)}
                              </span>
                              {order.tableNumber.startsWith("VIP") || order.tableNumber.startsWith("Table")
                                ? order.tableNumber
                                : `Table ${order.tableNumber}`}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            <ShoppingBag className="h-3.5 w-3.5" />
                            {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? "s" : ""}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm font-bold text-slate-800">{formatCurrency(order.grandTotal || 0)}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${paymentColor(order.paymentMethod)}`}>
                            {paymentIcon(order.paymentMethod)}
                            {order.paymentMethod}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Completed
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-700">{date}</span>
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                              <Clock className="h-3 w-3" />
                              {time}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                              isExpanded ? "bg-saffron text-white" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-saffron/5">
                          <td colSpan={8} className="px-5 pb-5 pt-1">
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                              <div className="border-b border-slate-100 px-5 py-4">
                                <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Order Items</h4>
                                <div className="space-y-2">
                                  {(order.items || []).map((item, index) => (
                                    <div key={`${item.name}-${index}`} className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                                          {item.qty}x
                                        </span>
                                        <span className="text-sm font-medium text-slate-700">{item.name}</span>
                                      </div>
                                      <div className="flex items-center gap-4">
                                        <span className="text-xs text-slate-400">
                                          {formatCurrency(item.price)} x {item.qty}
                                        </span>
                                        <span className="w-20 text-right text-sm font-semibold text-slate-700">
                                          {formatCurrency(item.price * item.qty)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="bg-slate-50 px-5 py-4">
                                <div className="ml-auto max-w-xs space-y-1.5">
                                  <div className="flex justify-between text-sm text-slate-600">
                                    <span>Subtotal</span>
                                    <span>{formatCurrency(order.subtotal || 0)}</span>
                                  </div>
                                  {(order.discount || 0) > 0 && (
                                    <div className="flex justify-between text-sm text-emerald-600">
                                      <span>Discount</span>
                                      <span>- {formatCurrency(order.discount || 0)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-sm text-slate-500">
                                    <span>Tax</span>
                                    <span>{formatCurrency(order.tax || 0)}</span>
                                  </div>
                                  <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-800">
                                    <span>Grand Total</span>
                                    <span className="text-saffron">{formatCurrency(order.grandTotal || 0)}</span>
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

      {filtered.length > 0 && (
        <p className="mt-4 text-center text-xs text-slate-400">
          Showing {filtered.length} order{filtered.length !== 1 ? "s" : ""} · Click any row to view details
        </p>
      )}
    </div>
  );
};

export const Orders: React.FC = () => {
  const { user, business } = useAuth();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const completedOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (!order.status) {
          return true;
        }
        return order.status.toLowerCase() === "completed";
      }),
    [orders]
  );

  useEffect(() => {
    if (!user) return;

    const ordersQuery = query(collection(db, "businesses", user.uid, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      const records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as OrderRecord));
      setOrders(records);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <SidebarLayout>
      {business?.type === "retail" ? (
        <RetailSalesHistory orders={completedOrders} loading={loading} />
      ) : (
        <RestaurantOrdersHistory orders={completedOrders} loading={loading} />
      )}
    </SidebarLayout>
  );
};
