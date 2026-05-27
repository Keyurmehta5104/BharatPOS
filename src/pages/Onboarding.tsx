import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  Store,
  Utensils,
  ArrowRight,
  ArrowLeft,
  Building,
  User,
  Phone,
  MapPin,
  Loader2,
  AlertCircle
} from "lucide-react";

export const Onboarding: React.FC = () => {
  const { user, refreshBusiness } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState("");
  const [ownerName, setOwnerName] = useState(user?.displayName || "");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [businessType, setBusinessType] = useState<"restaurant" | "retail" | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleNext = () => {
    if (step === 1) {
      if (!businessName || !ownerName || !phone || !city) {
        setError("Please fill in all the details.");
        return;
      }
      setError("");
      setStep(2);
    }
  };

  const handleBack = () => {
    setError("");
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!businessType) {
      setError("Please select a business type.");
      return;
    }
    if (!user) {
      setError("Authentication session lost. Please log in again.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const businessData = {
        name: businessName,
        ownerName: ownerName,
        phone: phone,
        city: city,
        type: businessType,
        plan: "free",
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, "businesses", user.uid), businessData);
      await refreshBusiness();
      navigate("/dashboard");
    } catch (err: any) {
      console.error("Onboarding failed:", err);
      setError(`Failed to save onboarding details: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-center gap-2">
        <div className="h-8 w-8 bg-saffron rounded-lg flex items-center justify-center">
          <span className="text-white font-black text-lg">B</span>
        </div>
        <span className="text-xl font-bold tracking-tight text-slate-900">
          Bharat<span className="text-saffron">POS</span>
        </span>
      </div>

      {/* Main Card */}
      <div className="max-w-xl w-full mx-auto bg-white rounded-2xl shadow-xl shadow-slate-100 border border-slate-100 p-8 sm:p-10 my-8">
        {/* Step Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            <span>Step {step} of 2</span>
            <span>{step === 1 ? "Business Details" : "Select Business Mode"}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-saffron transition-all duration-300"
              style={{ width: step === 1 ? "50%" : "100%" }}
            ></div>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Details */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Let's set up your business</h2>
              <p className="text-sm text-slate-500 mt-1">Please provide the core info about your business.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Business / Store Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    required
                    className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron bg-slate-50/50 text-slate-900 text-sm transition-all"
                    placeholder="e.g. Maharaja Restaurant"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Owner's Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="h-5 w-5" />
                  </div>
                  <input
                    type="text"
                    required
                    className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron bg-slate-50/50 text-slate-900 text-sm transition-all"
                    placeholder="Owner's Name"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Phone className="h-5 w-5" />
                    </div>
                    <input
                      type="tel"
                      required
                      className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron bg-slate-50/50 text-slate-900 text-sm transition-all"
                      placeholder="e.g. +91 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    City
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <input
                      type="text"
                      required
                      className="block w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron bg-slate-50/50 text-slate-900 text-sm transition-all"
                      placeholder="e.g. Mumbai"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={handleNext}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg text-white font-semibold text-sm bg-saffron hover:bg-saffron-hover shadow-lg shadow-saffron/20 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                Continue to Business Type
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Business Type selection */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Select business type</h2>
              <p className="text-sm text-slate-500 mt-1">Choose the interface profile that suits your operations.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {/* Restaurant Card */}
              <button
                type="button"
                onClick={() => setBusinessType("restaurant")}
                className={`p-6 rounded-xl border-2 text-left transition-all cursor-pointer relative group flex flex-col justify-between min-h-[160px] ${
                  businessType === "restaurant"
                    ? "border-saffron bg-saffron/5 shadow-md shadow-saffron/5"
                    : "border-slate-200 hover:border-slate-300 bg-white hover:-translate-y-1"
                }`}
              >
                <div>
                  <div
                    className={`p-3 rounded-lg w-fit ${
                      businessType === "restaurant" ? "bg-saffron/20 text-saffron" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Utensils className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 mt-4 flex items-center gap-1.5">Restaurant</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Manage tables, orders, KOT routing and F&B billing.
                  </p>
                </div>
                {businessType === "restaurant" && (
                  <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-saffron flex items-center justify-center text-white text-[10px] font-bold">
                    ✓
                  </span>
                )}
              </button>

              {/* Retail Card */}
              <button
                type="button"
                onClick={() => setBusinessType("retail")}
                className={`p-6 rounded-xl border-2 text-left transition-all cursor-pointer relative group flex flex-col justify-between min-h-[160px] ${
                  businessType === "retail"
                    ? "border-blue-500 bg-blue-50/50 shadow-md shadow-blue-500/5"
                    : "border-slate-200 hover:border-slate-300 bg-white hover:-translate-y-1"
                }`}
              >
                <div>
                  <div
                    className={`p-3 rounded-lg w-fit ${
                      businessType === "retail" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Store className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 mt-4 flex items-center gap-1.5">Retail Shop</h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                    Manage products, quick barcode billing and inventory.
                  </p>
                </div>
                {businessType === "retail" && (
                  <span className="absolute top-3 right-3 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-[10px] font-bold">
                    ✓
                  </span>
                )}
              </button>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="w-1/3 flex justify-center items-center gap-2 py-3 px-4 border border-slate-200 rounded-lg text-slate-600 font-semibold text-sm bg-white hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !businessType}
                className="w-2/3 flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg text-white font-semibold text-sm bg-saffron hover:bg-saffron-hover shadow-lg shadow-saffron/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving Details...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Footer */}
      <div className="text-center text-xs text-slate-400">
        &copy; {new Date().getFullYear()} BharatPOS. All rights reserved.
      </div>
    </div>
  );
};
