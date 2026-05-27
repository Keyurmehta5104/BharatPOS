import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { SidebarLayout } from "../components/Sidebar";
import {
  BarChart3,
  Download,
  Calendar,
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  Clock,
  AlertTriangle,
  Package,
  CheckCircle2
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

interface OrderItem {
  name: string;
  price: number;
  qty: number;
  categoryId?: string;
  category?: string;
}

interface Order {
  id: string;
  createdAt: string;
  grandTotal: number;
  paymentMethod: string;
  items: OrderItem[];
}

interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
}

type DateFilter = "Today" | "This Week" | "This Month" | "Custom";

const COLORS = ["#F97316", "#3B82F6", "#10B981", "#8B5CF6", "#EC4899", "#F43F5E", "#14B8A6"];

export const Reports: React.FC = () => {
  const { user, business } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [dateFilter, setDateFilter] = useState<DateFilter>("Today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const isRestaurant = business?.type === "restaurant";

  useEffect(() => {
    if (!user) return;

    const ordersQuery = query(
      collection(db, "businesses", user.uid, "orders"),
      orderBy("createdAt", "desc")
    );

    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(data);
      if (isRestaurant) setLoading(false);
    });

    let unsubProducts = () => {};
    if (!isRestaurant) {
      const productsQuery = query(collection(db, "businesses", user.uid, "inventory"));
      unsubProducts = onSnapshot(productsQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
        setProducts(data);
        setLoading(false);
      });
    }

    return () => {
      unsubOrders();
      unsubProducts();
    };
  }, [user, isRestaurant]);

  // Date Filtering Logic
  const filteredOrders = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (dateFilter === "Today") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (dateFilter === "This Week") {
      const day = start.getDay() || 7; 
      start.setDate(start.getDate() - day + 1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (dateFilter === "This Month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (dateFilter === "Custom") {
      if (customStartDate) start = new Date(customStartDate + "T00:00:00");
      else start = new Date(0);
      if (customEndDate) end = new Date(customEndDate + "T23:59:59");
      else end = new Date();
    }

    return orders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= start && d <= end;
    });
  }, [orders, dateFilter, customStartDate, customEndDate]);

  // Metric Calculations
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  const totalOrders = filteredOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Chart Data Calculations
  const {
    salesOverTime,
    topItems,
    categorySales,
    ordersByHour,
    paymentMethods,
    topSellingProductName,
    mostBusyHourName
  } = useMemo(() => {
    // 1. Sales Over Time & 4. Orders by Hour
    const timeMap: Record<string, number> = {};
    const hourMap: Record<string, number> = {};
    
    // 2. Top 5 Items
    const itemMap: Record<string, number> = {};
    
    // 3. Category Sales
    const catMap: Record<string, number> = {};
    
    // 5. Payment Methods
    const payMap: Record<string, number> = { "Cash": 0, "UPI": 0, "Card": 0 };

    filteredOrders.forEach(o => {
      const d = new Date(o.createdAt);
      
      // Sales Over Time key (Hour if Today, Date otherwise)
      const timeKey = dateFilter === "Today" 
        ? `${d.getHours()}:00` 
        : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        
      timeMap[timeKey] = (timeMap[timeKey] || 0) + (o.grandTotal || 0);

      // Orders by hour
      const hourStr = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      hourMap[hourStr] = (hourMap[hourStr] || 0) + 1;

      // Payment methods
      const method = o.paymentMethod || "Cash";
      payMap[method] = (payMap[method] || 0) + (o.grandTotal || 0);

      // Items & Categories
      (o.items || []).forEach(item => {
        itemMap[item.name] = (itemMap[item.name] || 0) + item.qty;
        
        // Sometimes categoryId is used, or category name. Default to 'Uncategorized'
        const catName = item.category || item.categoryId || "Uncategorized";
        catMap[catName] = (catMap[catName] || 0) + (item.price * item.qty);
      });
    });

    const salesOverTime = Object.entries(timeMap).map(([time, revenue]) => ({ time, revenue }));
    
    const topItems = Object.entries(itemMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
      
    const categorySales = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .filter(c => c.value > 0);

    const ordersByHour = Object.entries(hourMap)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => {
        // basic sort by time for 12hr format is tricky, but works enough for grouping
        return new Date(`1970/01/01 ${a.hour}`).getTime() - new Date(`1970/01/01 ${b.hour}`).getTime();
      });

    const paymentMethods = Object.entries(payMap)
      .map(([name, value]) => ({ name, value }))
      .filter(p => p.value > 0);

    let topSellingProductName = "-";
    if (topItems.length > 0) topSellingProductName = topItems[0].name;

    let mostBusyHourName = "-";
    let maxHour = 0;
    Object.entries(hourMap).forEach(([h, c]) => {
      if (c > maxHour) {
        maxHour = c;
        mostBusyHourName = `${h} (${c} orders)`;
      }
    });

    return {
      salesOverTime,
      topItems,
      categorySales,
      ordersByHour,
      paymentMethods,
      topSellingProductName,
      mostBusyHourName
    };
  }, [filteredOrders, dateFilter]);

  // Low Stock Computation
  const lowStockProducts = useMemo(() => {
    if (isRestaurant) return [];
    return products.filter(p => p.stock <= 10).sort((a, b) => a.stock - b.stock);
  }, [products, isRestaurant]);

  // Export CSV Function
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) {
      alert("No data to export for selected period.");
      return;
    }

    const headers = ["Order ID", "Date", "Time", "Items", "Subtotal", "Tax", "Grand Total", "Payment Method"];
    
    const rows = filteredOrders.map(o => {
      const d = new Date(o.createdAt);
      const itemsStr = (o.items || []).map(i => `${i.qty}x ${i.name}`).join(" | ");
      return [
        o.id,
        d.toLocaleDateString('en-GB'),
        d.toLocaleTimeString(),
        `"${itemsStr}"`,
        ((o as any).subtotal || 0).toFixed(2),
        ((o as any).tax || 0).toFixed(2),
        (o.grandTotal || 0).toFixed(2),
        o.paymentMethod || "-"
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    
    const dateStr = dateFilter === "Custom" ? `${customStartDate}_${customEndDate}` : dateFilter.replace(/\s+/g, "");
    link.setAttribute("download", `BharatPOS-Report-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const CustomTooltip = ({ active, payload, label, isCurrency = false }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl">
          <p className="text-slate-300 font-bold mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm font-semibold" style={{ color: entry.color }}>
              {entry.name}: {isCurrency ? '₹' : ''}{Number(entry.value).toFixed(isCurrency ? 2 : 0)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <SidebarLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-saffron border-t-transparent"></div>
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="space-y-6 max-w-7xl mx-auto pb-10">
        
        {/* Header & Filters */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-saffron" />
              Business Reports
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Analytics and insights for your {isRestaurant ? "restaurant" : "retail store"}.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center p-1 bg-slate-100 rounded-lg">
              {(["Today", "This Week", "This Month", "Custom"] as DateFilter[]).map(filter => (
                <button
                  key={filter}
                  onClick={() => setDateFilter(filter)}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all border-0 cursor-pointer ${
                    dateFilter === filter
                      ? "bg-white text-saffron shadow-sm"
                      : "text-slate-500 hover:text-slate-700 bg-transparent"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {dateFilter === "Custom" && (
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={customStartDate} 
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input 
                  type="date" 
                  value={customEndDate} 
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-slate-50"
                />
              </div>
            )}

            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black transition-colors border-0 cursor-pointer shadow-md"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-saffron/10 text-saffron flex items-center justify-center shrink-0">
              <IndianRupee className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Revenue</p>
              <p className="text-2xl font-black text-slate-800">₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total {isRestaurant ? "Orders" : "Transactions"}</p>
              <p className="text-2xl font-black text-slate-800">{totalOrders}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Avg {isRestaurant ? "Order" : "Transaction"} Value</p>
              <p className="text-2xl font-black text-slate-800">₹{avgOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center shrink-0">
              {isRestaurant ? <Clock className="h-6 w-6" /> : <Package className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                {isRestaurant ? "Most Busy Hour" : "Top Selling Product"}
              </p>
              <p className="text-lg font-black text-slate-800 truncate" title={isRestaurant ? mostBusyHourName : topSellingProductName}>
                {isRestaurant ? mostBusyHourName : topSellingProductName}
              </p>
            </div>
          </div>
        </div>

        {/* Charts Area */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white p-16 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center">
            <div className="h-20 w-20 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4">
              <Calendar className="h-10 w-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No data available</h3>
            <p className="text-slate-500 max-w-sm text-sm">
              There are no completed orders or transactions in the selected date range. Try selecting a different period.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Sales Over Time */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
              <h3 className="text-base font-bold text-slate-800 mb-6">Sales Over Time</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesOverTime}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                    <YAxis tickFormatter={(val) => `₹${val}`} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dx={-10} />
                    <RechartsTooltip content={<CustomTooltip isCurrency={true} />} />
                    <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#F97316" strokeWidth={3} dot={{ r: 4, fill: '#F97316', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top 5 Products / Items */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-base font-bold text-slate-800 mb-6">Top 5 {isRestaurant ? "Menu Items" : "Products"}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topItems} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} width={100} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
                    <Bar dataKey="qty" name="Qty Sold" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                      {topItems.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sales by Category */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-base font-bold text-slate-800 mb-6">Sales by Category</h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categorySales}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      labelLine={false}
                    >
                      {categorySales.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip isCurrency={true} />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Orders by Hour (Restaurant Only) */}
            {isRestaurant && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="text-base font-bold text-slate-800 mb-6">Orders by Hour</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ordersByHour}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dx={-10} allowDecimals={false} />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
                      <Bar dataKey="count" name="Orders" fill="#8B5CF6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Payment Methods */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-base font-bold text-slate-800 mb-6">Payment Methods</h3>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethods}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                    >
                      <Cell fill="#10B981" /> {/* Cash */}
                      <Cell fill="#3B82F6" /> {/* UPI */}
                      <Cell fill="#F97316" /> {/* Card */}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip isCurrency={true} />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
          </div>
        )}

        {/* Low Stock Report (Retail Only) */}
        {!isRestaurant && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
            <div className="p-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h3 className="font-bold text-slate-800">Low Stock Report</h3>
              <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full ml-2">
                {lowStockProducts.length} Items
              </span>
            </div>
            
            {lowStockProducts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="h-12 w-12 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-slate-800">All Stock Healthy</h4>
                <p className="text-sm text-slate-500 mt-1">No products are currently under the 10 unit threshold.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3">Product Name</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Stock Level</th>
                      <th className="px-6 py-3">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lowStockProducts.map(product => {
                      const isOut = product.stock <= 0;
                      return (
                        <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-slate-800">{product.name}</td>
                          <td className="px-6 py-4 text-slate-500">{product.category}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${
                              isOut ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                            }`}>
                              {product.stock} left
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{product.unit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </SidebarLayout>
  );
};
