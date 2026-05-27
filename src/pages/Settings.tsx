import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { SidebarLayout } from "../components/Sidebar";
import {
  Building2,
  ChefHat,
  Key,
  Copy,
  Check,
  Eye,
  EyeOff,
  Save,
  Loader2,
  Monitor,
  ExternalLink
} from "lucide-react";

export const Settings: React.FC = () => {
  const { user, business } = useAuth();
  const isRestaurant = business?.type === "restaurant";

  // PIN state
  const [currentPin, setCurrentPin] = useState("****");
  const [newPin, setNewPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);
  const [pinError, setPinError] = useState("");

  // UID copy state
  const [uidCopied, setUidCopied] = useState(false);

  // Load existing PIN
  useEffect(() => {
    if (!user || !isRestaurant) return;
    const fetchPin = async () => {
      try {
        const ref = doc(db, "businesses", user.uid, "settings", "kitchen");
        const snap = await getDoc(ref);
        if (snap.exists() && snap.data()?.pin) {
          setCurrentPin(snap.data().pin);
        } else {
          setCurrentPin("1234");
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchPin();
  }, [user, isRestaurant]);

  const handleSavePin = async () => {
    if (!user) return;
    setPinError("");

    if (!/^\d{4}$/.test(newPin)) {
      setPinError("PIN must be exactly 4 digits.");
      return;
    }

    setPinLoading(true);
    try {
      const ref = doc(db, "businesses", user.uid, "settings", "kitchen");
      await setDoc(ref, { pin: newPin }, { merge: true });
      setCurrentPin(newPin);
      setNewPin("");
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 3000);
    } catch (e) {
      console.error(e);
      setPinError("Failed to save PIN. Please try again.");
    } finally {
      setPinLoading(false);
    }
  };

  const handleCopyUid = () => {
    if (!user) return;
    navigator.clipboard.writeText(user.uid);
    setUidCopied(true);
    setTimeout(() => setUidCopied(false), 2000);
  };

  const kitchenLoginUrl = `${window.location.origin}/kitchen/login`;

  return (
    <SidebarLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="mb-2">
          <h2 className="text-2xl font-bold text-slate-800">Settings</h2>
          <p className="text-sm text-slate-500 mt-0.5">Manage your business configuration</p>
        </div>

        {/* Business Profile */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
            <div className="h-9 w-9 bg-saffron/10 rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-saffron" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Business Profile</h3>
              <p className="text-xs text-slate-400">Your registered business details</p>
            </div>
          </div>

          <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Business Name", value: business?.name },
              { label: "Owner Name", value: business?.ownerName },
              { label: "Phone", value: business?.phone },
              { label: "City", value: business?.city },
              { label: "Business Type", value: business?.type === "restaurant" ? "🍽️ Restaurant" : "🛒 Retail Shop" },
              { label: "Plan", value: business?.plan || "Standard" }
            ].map((field) => (
              <div key={field.label}>
                <p className="text-xs text-slate-400 font-medium mb-0.5">{field.label}</p>
                <p className="text-sm font-semibold text-slate-700">{field.value || "—"}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Kitchen Settings — Restaurant Only */}
        {isRestaurant && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <div className="h-9 w-9 bg-amber-50 rounded-lg flex items-center justify-center">
                <ChefHat className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Kitchen Display System</h3>
                <p className="text-xs text-slate-400">Configure your kitchen display settings</p>
              </div>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Current PIN display */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Current Kitchen PIN
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex gap-2">
                    {(showPin ? currentPin : "••••").split("").map((char, i) => (
                      <div
                        key={i}
                        className="h-11 w-11 bg-slate-900 rounded-xl flex items-center justify-center text-white font-mono text-lg font-bold border border-slate-700"
                      >
                        {char}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowPin(!showPin)}
                    className="ml-2 p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border-0 bg-transparent"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Change PIN */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  Change PIN
                </label>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <input
                      type="number"
                      maxLength={4}
                      placeholder="Enter new 4-digit PIN"
                      value={newPin}
                      onChange={(e) => {
                        const v = e.target.value.slice(0, 4);
                        setNewPin(v);
                        setPinError("");
                      }}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron font-mono tracking-widest"
                    />
                    {pinError && (
                      <p className="text-xs text-red-500 mt-1.5">{pinError}</p>
                    )}
                  </div>
                  <button
                    onClick={handleSavePin}
                    disabled={pinLoading || !newPin}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer border-0 ${
                      pinSaved
                        ? "bg-emerald-500 text-white"
                        : "bg-saffron text-white hover:bg-saffron-hover disabled:opacity-40"
                    }`}
                  >
                    {pinLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : pinSaved ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {pinSaved ? "Saved!" : "Save PIN"}
                  </button>
                </div>
              </div>

              {/* Business UID for Kitchen */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                <div className="flex items-start gap-2 mb-3">
                  <Key className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-600">Your Business ID</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Share this with your kitchen staff. They'll need it to log into the Kitchen Display.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono text-slate-700 break-all">
                    {user?.uid}
                  </code>
                  <button
                    onClick={handleCopyUid}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                      uidCopied
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-800 text-white hover:bg-slate-700"
                    }`}
                  >
                    {uidCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {uidCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Kitchen Display Link */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-2 mb-3">
                  <Monitor className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700">Kitchen Display URL</p>
                    <p className="text-xs text-amber-600/70 mt-0.5">
                      Open this link on your kitchen tablet to access the display.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2 text-xs font-mono text-amber-700 break-all">
                    {kitchenLoginUrl}
                  </code>
                  <a
                    href="/kitchen/login"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* App Info */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 bg-saffron rounded-lg flex items-center justify-center">
                <span className="text-white font-black text-base">B</span>
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">BharatPOS</p>
                <p className="text-xs text-slate-400">Version 1.0.0 — Day 6 Build</p>
              </div>
            </div>
            <span className="text-xs text-slate-400">Made in 🇮🇳 India</span>
          </div>
        </div>
      </div>
    </SidebarLayout>
  );
};
