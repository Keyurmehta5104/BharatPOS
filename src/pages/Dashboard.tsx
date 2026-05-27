import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { SidebarLayout } from "../components/Sidebar";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Link } from "react-router-dom";
import {
  Utensils,
  Store,
  Plus,
  ClipboardList,
  Layers,
  BarChart3,
  Users,
  CreditCard,
  ShoppingBag,
  Loader2,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { seedRestaurantData, seedRetailData } from "../lib/demoData";

interface DashboardProps {
  onShowToast: (message: string, type: "success" | "error") => void;
}

export const Dashboard: React.FC = () => {
  const { business } = useAuth();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!business) return null;

  const isRestaurant = business.type === "restaurant";

  return (
    <SidebarLayout>
      {isRestaurant ? (
        <RestaurantDashboard onShowToast={(msg, type) => setToast({ message: msg, type })} />
      ) : (
        <RetailDashboard onShowToast={(msg, type) => setToast({ message: msg, type })} />
      )}

      {/* Floating success/error toast notifications */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-white animate-slide-in transition-all duration-300 ${
            toast.type === "success"
              ? "bg-slate-900/95 border-emerald-500/30 shadow-emerald-500/5"
              : "bg-red-950/95 border-red-500/30 shadow-red-500/5"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          )}
          <span className="text-xs font-bold tracking-wide">{toast.message}</span>
        </div>
      )}
    </SidebarLayout>
  );
};

const RestaurantDashboard: React.FC<DashboardProps> = ({ onShowToast }) => {
  const { user } = useAuth();
  const [salesToday, setSalesToday] = useState<number>(0);
  const [ordersCompletedToday, setOrdersCompletedToday] = useState<number>(0);
  const [activeTablesCount, setActiveTablesCount] = useState<number>(0);
  const [totalTablesCount, setTotalTablesCount] = useState<number>(0);
  const [pendingKOTsCount, setPendingKOTsCount] = useState<number>(0);
  const [avgOrderValue, setAvgOrderValue] = useState<number>(0);
  const [totalCategoriesCount, setTotalCategoriesCount] = useState<number>(0);
  const [seeding, setSeeding] = useState<boolean>(false);

  useEffect(() => {
    if (!user) return;

    // 1. Listen to Completed Orders
    const ordersQuery = query(collection(db, "businesses", user.uid, "orders"));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let totalSales = 0;
      let orderCount = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const orderDate = new Date(data.createdAt || Date.now());
        if (orderDate.getTime() >= today.getTime()) {
          totalSales += data.grandTotal || 0;
          orderCount += 1;
        }
      });

      setSalesToday(totalSales);
      setOrdersCompletedToday(orderCount);
      setAvgOrderValue(orderCount > 0 ? totalSales / orderCount : 0);
    });

    // 2. Listen to Occupied Tables
    const tablesQuery = query(collection(db, "businesses", user.uid, "tables"));
    const unsubscribeTables = onSnapshot(tablesQuery, (snapshot) => {
      let occupiedCount = 0;
      snapshot.docs.forEach((doc) => {
        if (doc.data().status === "Occupied") {
          occupiedCount += 1;
        }
      });
      setActiveTablesCount(occupiedCount);
      setTotalTablesCount(snapshot.docs.length);
    });

    // 3. Listen to Pending KOTs
    const kotsQuery = query(
      collection(db, "businesses", user.uid, "kots"),
      where("status", "==", "pending")
    );
    const unsubscribeKots = onSnapshot(kotsQuery, (snapshot) => {
      setPendingKOTsCount(snapshot.docs.length);
    });

    // 4. Listen to Menu Categories
    const categoriesQuery = query(collection(db, "businesses", user.uid, "menuCategories"));
    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
      setTotalCategoriesCount(snapshot.docs.length);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeTables();
      unsubscribeKots();
      unsubscribeCategories();
    };
  }, [user]);

  const showLoadDemo = totalCategoriesCount === 0 && totalTablesCount === 0;

  const handleLoadDemo = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedRestaurantData(user.uid);
      onShowToast("Restaurant demo data loaded successfully!", "success");
    } catch (error: any) {
      console.error(error);
      onShowToast(error?.message || "Failed to load demo data.", "error");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Utensils className="h-40 w-40 text-saffron" />
        </div>
        <div className="relative z-10 max-w-lg">
          <span className="bg-saffron text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
            Restaurant Mode Active
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-3 text-white">
            Welcome to your Restaurant Control Center
          </h2>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Manage your kitchen orders, tables, billings, and reports in real-time. Start by adding items to your menu
            or opening layout tables.
          </p>
          {showLoadDemo && (
            <button
              onClick={handleLoadDemo}
              disabled={seeding}
              className="mt-5 flex items-center gap-2 px-3 py-1.5 border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {seeding ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading demo data...
                </>
              ) : (
                "Load Demo Data"
              )}
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Sales</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{salesToday.toFixed(2)}</h3>
            <p className="text-xs text-slate-500 mt-1">{ordersCompletedToday} Orders completed</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Tables</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {activeTablesCount} / {totalTablesCount}
            </h3>
            <p className="text-xs text-slate-500 mt-1">{activeTablesCount} Occupied tables</p>
          </div>
          <div className="p-3 bg-saffron/10 text-saffron rounded-lg">
            <Layers className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pending KOTs</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{pendingKOTsCount}</h3>
            <p className="text-xs text-slate-500 mt-1">Orders in kitchen</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <ClipboardList className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Avg Order Value</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{avgOrderValue.toFixed(2)}</h3>
            <p className="text-xs text-slate-500 mt-1">This month</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <BarChart3 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Empty State / Checklist */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-xl mx-auto shadow-sm">
        <div className="h-16 w-16 bg-saffron/10 text-saffron rounded-full flex items-center justify-center mx-auto mb-4">
          <Utensils className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Configure your Restaurant floor!</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Navigate to table management to set up table grids, seat capacities, and zones, or add items to your digital menu catalog.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/tables"
            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer no-underline"
          >
            Configure Tables
          </Link>
          <Link
            to="/menu"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-saffron-hover shadow-md shadow-saffron/10 cursor-pointer border-0 no-underline"
          >
            Create Menu Card
            <Plus className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};

const RetailDashboard: React.FC<DashboardProps> = ({ onShowToast }) => {
  const { user } = useAuth();
  const [salesToday, setSalesToday] = useState<number>(0);
  const [ordersCompletedToday, setOrdersCompletedToday] = useState<number>(0);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [totalCustomersCount, setTotalCustomersCount] = useState<number>(0);
  const [totalCategoriesCount, setTotalCategoriesCount] = useState<number>(0);
  const [seeding, setSeeding] = useState<boolean>(false);

  useEffect(() => {
    if (!user) return;

    // 1. Today's Completed Sales (from orders)
    const ordersQuery = query(collection(db, "businesses", user.uid, "orders"));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let totalSales = 0;
      let orderCount = 0;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const orderDate = new Date(data.createdAt || Date.now());
        if (orderDate.getTime() >= today.getTime()) {
          totalSales += data.grandTotal || 0;
          orderCount += 1;
        }
      });

      setSalesToday(totalSales);
      setOrdersCompletedToday(orderCount);
    });

    // 2. Total Products & Low Stock
    const productsQuery = query(collection(db, "businesses", user.uid, "products"));
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      let lowStock = 0;
      snapshot.docs.forEach((doc) => {
        if ((doc.data().stock || 0) < 10) {
          lowStock += 1;
        }
      });
      setTotalProductsCount(snapshot.docs.length);
      setLowStockCount(lowStock);
    });

    // 3. Total Customers
    const customersQuery = query(collection(db, "businesses", user.uid, "customers"));
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      setTotalCustomersCount(snapshot.docs.length);
    });

    // 4. Listen to Menu Categories
    const categoriesQuery = query(collection(db, "businesses", user.uid, "menuCategories"));
    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
      setTotalCategoriesCount(snapshot.docs.length);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeProducts();
      unsubscribeCustomers();
      unsubscribeCategories();
    };
  }, [user]);

  const showLoadDemo = totalProductsCount === 0 && totalCategoriesCount === 0;

  const handleLoadDemo = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      await seedRetailData(user.uid);
      onShowToast("Retail demo data loaded successfully!", "success");
    } catch (error: any) {
      console.error(error);
      onShowToast(error?.message || "Failed to load demo data.", "error");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Store className="h-40 w-40 text-blue-400" />
        </div>
        <div className="relative z-10 max-w-lg">
          <span className="bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
            Retail Mode Active
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-3 text-white">
            Welcome to your Retail Shop Dashboard
          </h2>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            Scan barcodes, check store inventory, manage customers, and execute high-speed checkout payments. Start by
            logging your products.
          </p>
          {showLoadDemo && (
            <button
              onClick={handleLoadDemo}
              disabled={seeding}
              className="mt-5 flex items-center gap-2 px-3 py-1.5 border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              {seeding ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading demo data...
                </>
              ) : (
                "Load Demo Data"
              )}
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Sales</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">₹{salesToday.toFixed(2)}</h3>
            <p className="text-xs text-slate-500 mt-1">{ordersCompletedToday} Transactions completed</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CreditCard className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Products</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalProductsCount}</h3>
            <p className="text-xs text-slate-500 mt-1">Items in inventory</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <ShoppingBag className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Low Stock Items</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{lowStockCount}</h3>
            <p className="text-xs text-slate-500 mt-1">Requires refilling</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <ClipboardList className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Registered Customers</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalCustomersCount}</h3>
            <p className="text-xs text-slate-500 mt-1">Loyalty profile count</p>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Users className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Empty State / Checklist */}
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-xl mx-auto shadow-sm">
        <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Store className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Manage Your Store Inventory!</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          Navigate to catalog setup to register product items, track stock levels, and launch the POS checkout billing pane.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/billing"
            className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer no-underline"
          >
            POS Billing Screen
          </Link>
          <Link
            to="/products"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-750 shadow-md shadow-blue-500/10 cursor-pointer border-0 no-underline"
          >
            Add Product Item
            <Plus className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
