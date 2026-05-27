import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { ChefHat, Loader2, AlertCircle, ArrowRight } from "lucide-react";

export const KitchenLogin: React.FC = () => {
  const navigate = useNavigate();

  const [businessId, setBusinessId] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null)
  ];

  // If already logged in, redirect to kitchen
  useEffect(() => {
    const session = sessionStorage.getItem("kitchenSession");
    if (session) {
      try {
        const s = JSON.parse(session);
        if (s.verified && s.ownerUid) {
          navigate("/kitchen", { replace: true });
        }
      } catch (_) {}
    }
  }, [navigate]);

  const handlePinChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newPin = [...pin];
    newPin[index] = digit;
    setPin(newPin);
    setError("");

    // Auto-advance
    if (digit && index < 3) {
      pinRefs[index + 1].current?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      pinRefs[index - 1].current?.focus();
    }
  };

  const handlePinPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (pasted.length === 4) {
      setPin(pasted.split(""));
      pinRefs[3].current?.focus();
    }
    e.preventDefault();
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleLogin = async () => {
    const enteredPin = pin.join("");
    setError("");

    if (!businessId.trim()) {
      setError("Please enter your Business ID.");
      return;
    }
    if (enteredPin.length !== 4) {
      setError("Please enter all 4 PIN digits.");
      return;
    }

    setLoading(true);
    try {
      // Read kitchen PIN directly from Firestore (no auth needed with updated rules)
      let expectedPin = "1234";
      try {
        const kitchenRef = doc(db, "businesses", businessId.trim(), "settings", "kitchen");
        const snap = await getDoc(kitchenRef);
        if (snap.exists() && snap.data()?.pin) {
          expectedPin = snap.data().pin;
        }
      } catch (readErr: any) {
        // If Firestore read fails (e.g. wrong UID), treat as invalid business
        if (readErr.code === "permission-denied") {
          setError("Business ID not found or access denied. Check the ID and try again.");
          triggerShake();
          setLoading(false);
          return;
        }
        // Any other read error: fall back to default PIN 1234
        console.warn("Could not read kitchen settings, using default PIN", readErr.code);
      }

      // Verify PIN
      if (enteredPin !== expectedPin) {
        setError("Incorrect PIN. Please try again.");
        triggerShake();
        setPin(["", "", "", ""]);
        pinRefs[0].current?.focus();
        setLoading(false);
        return;
      }

      // Save session and navigate
      sessionStorage.setItem(
        "kitchenSession",
        JSON.stringify({ ownerUid: businessId.trim(), verified: true })
      );
      navigate("/kitchen", { replace: true });

    } catch (err: any) {
      console.error("Kitchen login error:", err.code, err.message);
      setError(`Error: ${err.code || "Something went wrong. Please try again."}`);
      triggerShake();
      setLoading(false);
    }
  };



  const isReady = businessId.trim().length > 0 && pin.every((d) => d !== "");

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
      {/* Background pattern */}
      <div
        className="fixed inset-0 opacity-5"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #F97316 1px, transparent 0)`,
          backgroundSize: "32px 32px"
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 bg-saffron rounded-2xl shadow-lg shadow-saffron/30 mb-4">
            <ChefHat className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Bharat<span className="text-saffron">POS</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">Kitchen Display System</p>
        </div>

        {/* Card */}
        <div
          className={`bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 shadow-2xl transition-transform ${
            shake ? "animate-bounce" : ""
          }`}
          style={
            shake
              ? {
                  animation: "shake 0.5s ease-in-out"
                }
              : {}
          }
        >
          <style>{`
            @keyframes shake {
              0%, 100% { transform: translateX(0); }
              20% { transform: translateX(-8px); }
              40% { transform: translateX(8px); }
              60% { transform: translateX(-6px); }
              80% { transform: translateX(6px); }
            }
          `}</style>

          {/* Business ID */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              Business ID
            </label>
            <input
              type="text"
              value={businessId}
              onChange={(e) => {
                setBusinessId(e.target.value);
                setError("");
              }}
              placeholder="Paste your Business ID here"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-saffron/40 focus:border-saffron font-mono"
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Ask the restaurant owner for their Business ID (found in Settings → Kitchen Display).
            </p>
          </div>

          {/* PIN boxes */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Kitchen PIN
            </label>
            <div className="flex gap-3 justify-center" onPaste={handlePinPaste}>
              {pin.map((digit, i) => (
                <input
                  key={i}
                  ref={pinRefs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  className={`h-14 w-14 text-center text-2xl font-bold rounded-xl border-2 bg-slate-900 text-white focus:outline-none transition-all ${
                    digit
                      ? "border-saffron text-saffron"
                      : "border-slate-600 focus:border-saffron/60"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              Default PIN is <span className="text-slate-300 font-mono">1234</span>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={!isReady || loading}
            className="w-full flex items-center justify-center gap-2 bg-saffron hover:bg-saffron-hover disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-all cursor-pointer border-0 shadow-lg shadow-saffron/20"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                Enter Kitchen Display
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          BharatPOS Kitchen Display · Secure PIN Access
        </p>
      </div>
    </div>
  );
};
