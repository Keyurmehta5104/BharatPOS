import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  Utensils,
  Layers,
  BarChart3,
  Settings,
  Users,
  Receipt,
  LogOut,
  Menu,
  X,
  User
} from "lucide-react";

interface SidebarProps {
  children: React.ReactNode;
}

export const SidebarLayout: React.FC<SidebarProps> = ({ children }) => {
  const { business, user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!business) return null;

  const isRestaurant = business.type === "restaurant";

  const restaurantLinks = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Orders", path: "/orders", icon: ShoppingBag },
    { name: "Menu", path: "/menu", icon: Utensils },
    { name: "Tables", path: "/tables", icon: Layers },
    { name: "Reports", path: "/reports", icon: BarChart3 },
    { name: "Settings", path: "/settings", icon: Settings }
  ];

  const retailLinks = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Billing", path: "/billing", icon: Receipt },
    { name: "Products", path: "/products", icon: ShoppingBag },
    { name: "Customers", path: "/customers", icon: Users },
    { name: "Reports", path: "/reports", icon: BarChart3 },
    { name: "Settings", path: "/settings", icon: Settings }
  ];

  const links = isRestaurant ? restaurantLinks : retailLinks;

  const toggleMobile = () => setMobileOpen(!mobileOpen);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-dark-panel text-white justify-between">
      <div>
        {/* Header Branding */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-9 w-9 bg-saffron rounded-lg flex items-center justify-center shadow-md shadow-saffron/20">
              <span className="text-white font-black text-lg">B</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Bharat<span className="text-saffron">POS</span>
            </span>
          </div>

          {/* Business Info Card */}
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
            <h4 className="font-semibold text-sm text-white truncate">{business.name}</h4>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 mt-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isRestaurant
                  ? "bg-saffron/10 text-saffron border border-saffron/20"
                  : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
              }`}
            >
              {isRestaurant ? "🍽️ Restaurant" : "🛒 Retail Shop"}
            </span>
          </div>
        </div>

        {/* Links Navigation */}
        <nav className="p-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;

            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-saffron text-white shadow-lg shadow-saffron/10 font-bold"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${isActive ? "text-white" : "text-slate-400 group-hover:text-white"}`}
                />
                {link.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User profile & Logout */}
      <div className="p-4 border-t border-slate-800 space-y-4">
        <div className="flex items-center gap-3 px-2">
          <div className="h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-300 border border-slate-700">
            <User className="h-5 w-5" />
          </div>
          <div className="overflow-hidden">
            <h5 className="text-sm font-semibold text-white truncate">{business.ownerName}</h5>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all cursor-pointer border-0"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden md:block md:w-64 shrink-0 h-screen sticky top-0 border-r border-slate-200">
        {sidebarContent}
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between bg-dark-panel p-4 border-b border-slate-800 text-white relative z-20">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 bg-saffron rounded-lg flex items-center justify-center">
            <span className="text-white font-black text-base">B</span>
          </div>
          <span className="text-lg font-bold tracking-tight">
            Bharat<span className="text-saffron">POS</span>
          </span>
          <span
            className={`ml-2 inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
              isRestaurant ? "bg-saffron/20 text-saffron" : "bg-blue-500/20 text-blue-400"
            }`}
          >
            {isRestaurant ? "Rest" : "Ret"}
          </span>
        </div>

        <button
          onClick={toggleMobile}
          className="p-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 text-white cursor-pointer border-0"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          {/* Background backdrop */}
          <div className="fixed inset-0 bg-black/50" onClick={toggleMobile}></div>

          {/* Menu container */}
          <aside className="relative w-64 max-w-xs h-full bg-dark-panel shadow-2xl z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{business.name}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Welcome back, {business.ownerName} &middot; {business.city}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                  isRestaurant
                    ? "bg-saffron/10 text-saffron border-saffron/20"
                    : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                }`}
              >
                {isRestaurant ? "Restaurant Mode" : "Retail Shop Mode"}
              </span>
            </div>
          </div>
        </header>

        {/* Content Box */}
        <main className="flex-1 p-6 md:p-8 bg-slate-50">{children}</main>
      </div>
    </div>
  );
};
