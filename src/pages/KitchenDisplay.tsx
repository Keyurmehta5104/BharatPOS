import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  getDoc
} from "firebase/firestore";
import { db } from "../lib/firebase";
import {
  ChefHat,
  Clock,
  LogOut,
  Flame,
  CheckCircle2,
  Timer,
  Utensils
} from "lucide-react";

interface KOTItem {
  name: string;
  qty: number;
  status?: "pending" | "cooking" | "ready";
}

interface KOT {
  id: string;
  tableId?: string;
  tableName?: string;
  tableNumber?: string;
  items: KOTItem[];
  status: "New" | "In Progress" | "Ready";
  kotNumber: number;
  createdAt: string;
  startedAt?: string | null;
  readyAt?: string | null;
}

const getElapsed = (iso: string): string => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
};

const isNew = (iso: string): boolean => {
  return Date.now() - new Date(iso).getTime() < 30000; // < 30 seconds old
};

const statusConfig = {
  New: {
    label: "New Order",
    badgeClass: "bg-red-500/20 text-red-400 border-red-500/30",
    cardBorder: "border-red-500/30",
    cardGlow: "shadow-red-500/10",
    actionLabel: "Start Cooking",
    actionClass: "bg-amber-500 hover:bg-amber-600 text-white",
    actionIcon: Flame,
    nextStatus: "In Progress" as const
  },
  "In Progress": {
    label: "In Progress",
    badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    cardBorder: "border-amber-500/30",
    cardGlow: "shadow-amber-500/10",
    actionLabel: "Mark Ready",
    actionClass: "bg-emerald-500 hover:bg-emerald-600 text-white",
    actionIcon: CheckCircle2,
    nextStatus: "Ready" as const
  },
  Ready: {
    label: "Ready! 🎉",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    cardBorder: "border-emerald-500/40",
    cardGlow: "shadow-emerald-500/10",
    actionLabel: null,
    actionClass: "",
    actionIcon: CheckCircle2,
    nextStatus: null
  }
};

export const KitchenDisplay: React.FC = () => {
  const navigate = useNavigate();
  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("Kitchen Display");
  const [kots, setKots] = useState<KOT[]>([]);
  const [activeTableIds, setActiveTableIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Tick clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Guard: verify session
  useEffect(() => {
    const session = sessionStorage.getItem("kitchenSession");
    if (!session) {
      navigate("/kitchen/login", { replace: true });
      return;
    }
    try {
      const s = JSON.parse(session);
      if (!s.verified || !s.ownerUid) {
        navigate("/kitchen/login", { replace: true });
        return;
      }
      setOwnerUid(s.ownerUid);
    } catch (_) {
      navigate("/kitchen/login", { replace: true });
    }
  }, [navigate]);

  // Load business name
  useEffect(() => {
    if (!ownerUid) return;
    const fetchName = async () => {
      try {
        const ref = doc(db, "businesses", ownerUid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setBusinessName(snap.data()?.name || "Kitchen Display");
        }
      } catch (_) {}
    };
    fetchName();
  }, [ownerUid]);

  // Subscribe to active tables (to hide KOTs if a table is cleared)
  useEffect(() => {
    if (!ownerUid) return;
    const q = query(collection(db, "businesses", ownerUid, "tables"));
    const unsub = onSnapshot(q, (snap) => {
      const occupiedIds = new Set<string>();
      snap.docs.forEach((doc) => {
        if (doc.data().status === "Occupied") occupiedIds.add(doc.id);
      });
      setActiveTableIds(occupiedIds);
    });
    return () => unsub();
  }, [ownerUid]);

  // Subscribe to KOTs
  useEffect(() => {
    if (!ownerUid) return;

    const q = query(
      collection(db, "businesses", ownerUid, "kots"),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const data: KOT[] = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as KOT))
        .filter((k) => (k.status as string) !== "completed"); // hide completed KOTs
      setKots(data);
      setLoading(false);
    });

    return () => unsub();
  }, [ownerUid]);

  const handleItemStatusChange = async (kot: KOT, index: number) => {
    if (!ownerUid) return;
    const newItems = [...kot.items];
    const currentStatus = newItems[index].status || "pending";
    if (currentStatus === "ready") return; // Stays at ready
    
    const nextStatus = currentStatus === "pending" ? "cooking" : "ready";
    newItems[index].status = nextStatus;
    
    const updates: Record<string, any> = { items: newItems };
    const anyCooking = newItems.some(i => i.status === "cooking" || i.status === "ready");
    if (kot.status === "New" && anyCooking) {
      updates.status = "In Progress";
      updates.startedAt = new Date().toISOString();
    }
    
    try {
      const kotRef = doc(db, "businesses", ownerUid, "kots", kot.id);
      await updateDoc(kotRef, { items: newItems });
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotifyWaiter = async (kot: KOT) => {
    if (!ownerUid) return;
    setUpdatingId(kot.id);
    try {
      const kotRef = doc(db, "businesses", ownerUid, "kots", kot.id);
      await updateDoc(kotRef, { 
        status: "Ready",
        readyAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleExit = () => {
    sessionStorage.removeItem("kitchenSession");
    navigate("/kitchen/login", { replace: true });
  };

  // Filter KOTs: Only show if table is currently Occupied (or if tableId is missing for older KOTs)
  const displayKots = kots.filter(k => !k.tableId || activeTableIds.has(k.tableId));

  // Sort: New first, then In Progress, then Ready; within each group oldest first
  const sortedKots = [...displayKots].sort((a, b) => {
    const order = { New: 0, "In Progress": 1, Ready: 2 };
    const statusDiff = order[a.status] - order[b.status];
    if (statusDiff !== 0) return statusDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const newCount = displayKots.filter((k) => k.status === "New").length;
  const inProgressCount = displayKots.filter((k) => k.status === "In Progress").length;
  const readyCount = displayKots.filter((k) => k.status === "Ready").length;

  return (
    <div className="min-h-screen bg-[#0A0F1C] text-white flex flex-col">
      {/* Header */}
      <header className="bg-[#0F172A] border-b border-slate-800 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-20 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-saffron rounded-xl flex items-center justify-center shadow-lg shadow-saffron/20">
            <ChefHat className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-white text-sm md:text-base">
                Bharat<span className="text-saffron">POS</span>
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300 text-sm font-medium hidden sm:inline truncate max-w-[200px]">
                {businessName}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Kitchen Display</p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          {/* Status summary */}
          <div className="hidden sm:flex items-center gap-2">
            {newCount > 0 && (
              <span className="flex items-center gap-1 bg-red-500/15 border border-red-500/20 text-red-400 text-xs font-bold px-2.5 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                {newCount} New
              </span>
            )}
            {inProgressCount > 0 && (
              <span className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/20 text-amber-400 text-xs font-bold px-2.5 py-1 rounded-full">
                {inProgressCount} Cooking
              </span>
            )}
            {readyCount > 0 && (
              <span className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-full">
                {readyCount} Ready
              </span>
            )}
          </div>

          {/* Clock */}
          <div className="flex items-center gap-1.5 text-slate-300 text-sm font-mono font-semibold bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700/50">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            {currentTime.toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true
            })}
          </div>

          {/* Exit */}
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-slate-700 hover:border-red-500/30 bg-transparent"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-saffron border-t-transparent" />
              <p className="text-sm font-medium">Loading kitchen orders…</p>
            </div>
          </div>
        ) : sortedKots.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
            <div className="h-24 w-24 bg-slate-800/60 rounded-full flex items-center justify-center mb-6 border border-slate-700">
              <Utensils className="h-12 w-12 text-slate-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-300 mb-2">All Quiet in the Kitchen</h3>
            <p className="text-slate-500 text-sm max-w-xs">
              No active orders right now. New KOTs will appear here in real-time when waiters place orders.
            </p>
            <div className="flex items-center gap-2 mt-4 text-slate-600 text-xs">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live — Watching for orders
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedKots.map((kot) => {
              const cfg = statusConfig[kot.status];
              const tableDisplay = kot.tableName || kot.tableNumber || "?";
              const isNewKot = isNew(kot.createdAt);
              const isUpdating = updatingId === kot.id;

              return (
                <div
                  key={kot.id}
                  className={`relative bg-slate-800/60 rounded-2xl border-2 ${cfg.cardBorder} shadow-xl ${cfg.cardGlow} overflow-hidden transition-all ${
                    isNewKot && kot.status === "New"
                      ? "ring-2 ring-red-500/40 ring-offset-2 ring-offset-[#0A0F1C]"
                      : ""
                  }`}
                  style={
                    isNewKot && kot.status === "New"
                      ? { animation: "newKotPulse 2s ease-in-out infinite" }
                      : {}
                  }
                >
                  <style>{`
                    @keyframes newKotPulse {
                      0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.3), 0 20px 40px rgba(239,68,68,0.05); }
                      50% { box-shadow: 0 0 0 6px rgba(239,68,68,0), 0 20px 40px rgba(239,68,68,0.1); }
                    }
                  `}</style>

                  {/* Card Top Color Bar */}
                  <div
                    className={`h-1 w-full ${
                      kot.status === "New"
                        ? "bg-red-500"
                        : kot.status === "In Progress"
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                  />

                  <div className="p-4">
                    {/* Header Row */}
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.badgeClass}`}
                      >
                        {kot.status === "New" && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
                        )}
                        {cfg.label}
                      </span>
                      <span className="text-slate-500 text-xs font-mono">
                        KOT #{kot.kotNumber}
                      </span>
                    </div>

                    {/* Table Number & KOT Numbering */}
                    <div className="mb-4 py-3 bg-slate-900/60 rounded-xl border border-slate-700/40 text-center">
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-0.5">
                        Table
                      </p>
                      <p className="text-4xl font-black text-white leading-none">
                        {tableDisplay}
                      </p>
                      {(kot as any).orderSequence && (
                        <p className="text-xs font-bold mt-2 text-saffron">
                          KOT #{(kot as any).orderSequence} {(kot as any).isAdditional && "• Additional Order"}
                        </p>
                      )}
                    </div>

                    {/* Items List */}
                    <div className="space-y-2 mb-4">
                      {(kot.items || []).map((item, i) => {
                        const iStatus = item.status || "pending";
                        const bgTint = iStatus === "pending" ? "bg-transparent" : iStatus === "cooking" ? "bg-amber-950/20" : "bg-emerald-950/20";
                        const barColor = iStatus === "pending" ? "bg-slate-500" : iStatus === "cooking" ? "bg-amber-500" : "bg-emerald-500";
                        return (
                          <div
                            key={i}
                            onClick={() => handleItemStatusChange(kot, i)}
                            className={`flex items-center justify-between rounded-lg overflow-hidden cursor-pointer hover:brightness-110 transition-all duration-200 border border-slate-800/50 ${bgTint}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-1 h-full min-h-[44px] ${barColor} transition-colors duration-200`} />
                              <div className="py-2">
                                <span className={`text-sm font-bold ${iStatus === "ready" ? "text-slate-400" : "text-slate-200"}`}>
                                  {item.name}
                                </span>
                                <span className="ml-2 text-xs font-bold text-slate-400 bg-slate-800/50 px-1.5 py-0.5 rounded">
                                  × {item.qty}
                                </span>
                              </div>
                            </div>
                            <div className="pr-3 flex items-center justify-center">
                              {iStatus === "pending" && (
                                <div className="h-5 w-5 rounded-full border-2 border-slate-600 transition-all duration-200" />
                              )}
                              {iStatus === "cooking" && (
                                <Flame className="h-5 w-5 text-amber-500 animate-pulse transition-all duration-200" />
                              )}
                              {iStatus === "ready" && (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 animate-[bounce_0.3s_ease-in-out] transition-all duration-200" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Time elapsed */}
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs mb-4">
                      <Timer className="h-3.5 w-3.5" />
                      <span className="font-medium" key={currentTime.getSeconds()}>
                        {getElapsed(kot.createdAt)}
                      </span>
                      {kot.status === "In Progress" && kot.startedAt && (
                        <span className="text-slate-600">
                          · Cooking for {getElapsed(kot.startedAt).replace(" ago", "")}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar & Action Button */}
                    {kot.status !== "Ready" && (
                      <div className="mt-2 pt-4 border-t border-slate-700/50">
                        {(() => {
                          const items = kot.items || [];
                          const total = items.length;
                          const readyCount = items.filter(i => i.status === "ready").length;
                          const allReady = readyCount === total && total > 0;
                          const progressPercent = total === 0 ? 0 : Math.round((readyCount / total) * 100);
                          
                          return (
                            <div className="space-y-3">
                              <div className="flex justify-between text-xs font-bold text-slate-400">
                                <span>{readyCount}/{total} items ready</span>
                                <span>{progressPercent}%</span>
                              </div>
                              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full transition-all duration-500 ${allReady ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                                  style={{ width: `${progressPercent}%` }} 
                                />
                              </div>
                              
                              <button
                                onClick={() => handleNotifyWaiter(kot)}
                                disabled={!allReady || isUpdating}
                                className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-300 border-0 flex justify-center items-center gap-2 ${
                                  allReady 
                                    ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)] cursor-pointer" 
                                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                                }`}
                              >
                                {isUpdating ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                ) : allReady ? (
                                  <>Notify Waiter <CheckCircle2 className="h-4 w-4" /></>
                                ) : (
                                  "Waiting for items..."
                                )}
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Ready state footer */}
                    {kot.status === "Ready" && (
                      <div className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold text-sm">
                          Ready for pickup!
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-3 px-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-600">
        <span>BharatPOS Kitchen Display</span>
        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live · {kots.length} active KOT{kots.length !== 1 ? "s" : ""}</span>
        </div>
      </footer>
    </div>
  );
};
