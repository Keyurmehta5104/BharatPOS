import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { registerUser } from "../lib/auth";
import { useAuth } from "../context/AuthContext";
import { Store, Utensils, Mail, Lock, User, AlertCircle, Loader2 } from "lucide-react";

export const Register: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshBusiness } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await registerUser(email, password, name);
      await refreshBusiness();
      navigate("/onboarding");
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/weak-password") {
        setError("Password is too weak. Please use a stronger password.");
      } else {
        setError("Failed to create account. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Left panel: Branding */}
      <div className="hidden md:flex md:w-1/2 bg-dark-panel p-12 text-white flex-col justify-between relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-saffron/10 blur-[120px]"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-500/10 blur-[120px]"></div>

        {/* Top: Branding */}
        <div className="flex items-center gap-2 relative z-10">
          <div className="h-10 w-10 bg-saffron rounded-xl flex items-center justify-center shadow-lg shadow-saffron/20">
            <span className="text-white font-black text-xl">B</span>
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Bharat<span className="text-saffron">POS</span>
          </span>
        </div>

        {/* Middle: Content */}
        <div className="max-w-md relative z-10">
          <span className="text-saffron text-sm font-semibold tracking-wider uppercase mb-3 block">
            Made for India
          </span>
          <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-6">
            Empower Your Business With Smarter Billing
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed mb-8">
            BharatPOS offers a versatile, dual-mode system built for fast-paced retail shops and table-managed restaurants. Switch configurations with a single tap.
          </p>

          <div className="space-y-4">
            <div className="flex gap-4 items-start bg-slate-800/40 p-4 rounded-xl border border-slate-700/30">
              <div className="p-2 bg-saffron/20 rounded-lg text-saffron mt-1">
                <Utensils className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Restaurant Mode</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Order tracking, table layouts, KOT management, and kitchen routing.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start bg-slate-800/40 p-4 rounded-xl border border-slate-700/30">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 mt-1">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Retail Mode</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Barcoding, inventory tracking, fast checkout, and customer profiles.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom footer */}
        <div className="text-slate-500 text-sm relative z-10">
          &copy; {new Date().getFullYear()} BharatPOS. All rights reserved.
        </div>
      </div>

      {/* Right panel: Register Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-12 md:p-16 bg-white">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="text-center md:text-left">
            {/* Logo for mobile */}
            <div className="flex items-center gap-2 justify-center md:justify-start mb-6 md:hidden">
              <div className="h-8 w-8 bg-saffron rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-lg">B</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-dark-panel">
                Bharat<span className="text-saffron">POS</span>
              </span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Create an account
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Start setting up your business with BharatPOS today.
            </p>
          </div>

          {/* Form */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="name">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-5 w-5" />
                  </div>
                  <input
                    id="name"
                    type="text"
                    required
                    className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron bg-slate-50/50 text-slate-900 text-sm transition-all"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="email">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    required
                    className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron bg-slate-50/50 text-slate-900 text-sm transition-all"
                    placeholder="you@business.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron bg-slate-50/50 text-slate-900 text-sm transition-all"
                    placeholder="•••••••• (min 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg text-white font-semibold text-sm bg-saffron hover:bg-saffron-hover shadow-lg shadow-saffron/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-saffron transition-all disabled:opacity-75 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Free Account"
                )}
              </button>
            </div>
          </form>

          {/* Footer Link */}
          <div className="text-center md:text-left mt-6">
            <p className="text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-saffron hover:text-saffron-hover transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
