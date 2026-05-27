import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Onboarding } from "./pages/Onboarding";
import { Dashboard } from "./pages/Dashboard";
import { Menu } from "./pages/Menu";
import { Tables } from "./pages/Tables";
import { Products } from "./pages/Products";
import { Billing } from "./pages/Billing";
import { Orders } from "./pages/Orders";
import { Settings } from "./pages/Settings";
import { KitchenLogin } from "./pages/KitchenLogin";
import { KitchenDisplay } from "./pages/KitchenDisplay";
import { Reports } from "./pages/Reports";
import { SidebarLayout } from "./components/Sidebar";

const PlaceholderPage: React.FC<{ name: string }> = ({ name }) => {
  return (
    <SidebarLayout>
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center max-w-xl mx-auto shadow-sm my-12">
        <h3 className="text-xl font-bold text-slate-800">{name} Panel</h3>
        <p className="text-slate-500 mt-2 text-sm">
          The {name} panel is currently under construction and will be implemented in the next phase.
        </p>
      </div>
    </SidebarLayout>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <ProtectedRoute mode="public-only">
                <Login />
              </ProtectedRoute>
            }
          />
          <Route
            path="/register"
            element={
              <ProtectedRoute mode="public-only">
                <Register />
              </ProtectedRoute>
            }
          />

          {/* Onboarding Route */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute mode="onboarding">
                <Onboarding />
              </ProtectedRoute>
            }
          />

          {/* Protected Business App Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute mode="authenticated">
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Restaurant Subpages */}
          <Route
            path="/orders"
            element={
              <ProtectedRoute mode="authenticated">
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/menu"
            element={
              <ProtectedRoute mode="authenticated">
                <Menu />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tables"
            element={
              <ProtectedRoute mode="authenticated">
                <Tables />
              </ProtectedRoute>
            }
          />

          {/* Retail Subpages */}
          <Route
            path="/billing"
            element={
              <ProtectedRoute mode="authenticated">
                <Billing />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute mode="authenticated">
                <Products />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute mode="authenticated">
                <PlaceholderPage name="Customers Directory" />
              </ProtectedRoute>
            }
          />

          {/* Shared Subpages */}
          <Route
            path="/reports"
            element={
              <ProtectedRoute mode="authenticated">
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute mode="authenticated">
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Kitchen Display System — PIN-gated, no Firebase auth required */}
          <Route path="/kitchen/login" element={<KitchenLogin />} />
          <Route path="/kitchen" element={<KitchenDisplay />} />

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
export { PlaceholderPage };

