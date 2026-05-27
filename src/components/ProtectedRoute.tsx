import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  mode: "authenticated" | "onboarding" | "public-only";
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, mode }) => {
  const { user, business, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center bg-slate-50 min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-saffron border-t-transparent"></div>
          <p className="text-slate-500 font-medium text-sm">Loading BharatPOS...</p>
        </div>
      </div>
    );
  }

  if (mode === "public-only") {
    if (user) {
      if (business) {
        return <Navigate to="/dashboard" replace />;
      }
      return <Navigate to="/onboarding" replace />;
    }
    return <>{children}</>;
  }

  if (mode === "onboarding") {
    if (!user) {
      return <Navigate to="/login" replace />;
    }
    if (business) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  // mode === "authenticated"
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!business) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};
