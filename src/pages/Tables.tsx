import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { SidebarLayout } from "../components/Sidebar";
import {
  Plus,
  Edit2,
  Trash2,
  Users,
  CheckCircle,
  Clock,
  CreditCard,
  ArrowLeft,
  Minus,
  Printer,
  Utensils,
  Layers,
  AlertCircle,
  X,
  Search,
  Loader2,
  Flame
} from "lucide-react";

interface Table {
  id: string;
  tableNumber: string;
  capacity: number;
  section: "Main Hall" | "Outdoor" | "VIP";
  status: "Available" | "Occupied" | "Reserved";
  currentOrderAmount?: number;
  activeOrderItems?: CartItem[];
  kotCount?: number;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  sentToKitchen?: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  type: "Veg" | "Non-Veg";
  imageUrl?: string;
  status: "Available" | "Unavailable";
}

interface KOT {
  id?: string;
  kotNumber: number;
  tableNumber: string;
  tableId?: string;
  items: { id?: string; name: string; qty: number; status?: string }[];
  timestamp: string;
  orderSequence?: number;
  isAdditional?: boolean;
  status?: string;
}

export const Tables: React.FC = () => {
  const { user } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Active KOTs
  const [activeKots, setActiveKots] = useState<KOT[]>([]);

  // Grid / Setup States
  const [showTableModal, setShowTableModal] = useState<boolean>(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [tableNumber, setTableNumber] = useState<string>("");
  const [tableCapacity, setTableCapacity] = useState<string>("");
  const [tableSection, setTableSection] = useState<"Main Hall" | "Outdoor" | "VIP">("Main Hall");
  const [tableSubmitLoading, setTableSubmitLoading] = useState<boolean>(false);

  // Active Ordering view
  const [activeTableForOrdering, setActiveTableForOrdering] = useState<Table | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [menuSearch, setMenuSearch] = useState<string>("");

  // KOT print preview modal
  const [activeKOTPreview, setActiveKOTPreview] = useState<KOT | null>(null);

  // Bill Generation modal
  const [activeBillingTable, setActiveBillingTable] = useState<Table | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "UPI" | "Card">("Cash");
  const [checkoutLoading, setCheckoutLoading] = useState<boolean>(false);

  // Deletions
  const [deletingTableId, setDeletingTableId] = useState<string | null>(null);

  // 1. Listen to Tables, Categories and Menu Items
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // Fetch Tables
    const tablesQuery = query(
      collection(db, "businesses", user.uid, "tables")
    );
    const unsubscribeTables = onSnapshot(tablesQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Table[];
      // Sort tables alphanumerically
      list.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber, undefined, { numeric: true }));
      setTables(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to load tables.");
      setLoading(false);
    });

    // Fetch Categories
    const categoriesQuery = query(
      collection(db, "businesses", user.uid, "menuCategories"),
      orderBy("sortOrder", "asc")
    );
    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
      const catsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name
      })) as Category[];
      setCategories(catsList);
      if (catsList.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(catsList[0].id);
      }
    });

    // Fetch Menu Items
    const itemsQuery = query(
      collection(db, "businesses", user.uid, "menuItems")
    );
    const unsubscribeItems = onSnapshot(itemsQuery, (snapshot) => {
      const itemsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as MenuItem[];
      setMenuItems(itemsList.filter((item) => item.status === "Available"));
    });

    return () => {
      unsubscribeTables();
      unsubscribeCategories();
      unsubscribeItems();
    };
  }, [user]);

  // 1b. Listen for active KOTs to compute statuses
  useEffect(() => {
    if (!user) return;
    const kotsQuery = query(
      collection(db, "businesses", user.uid, "kots")
    );
    const unsubscribeKots = onSnapshot(kotsQuery, (snapshot) => {
      const kotsList = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as KOT))
        .filter(k => k.status !== "completed");
      setActiveKots(kotsList);
    });
    return () => unsubscribeKots();
  }, [user]);

  // 2. Add / Edit Table submit
  const handleTableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber || !tableCapacity || !user) return;

    setTableSubmitLoading(true);
    try {
      const tableData = {
        tableNumber,
        capacity: Number(tableCapacity),
        section: tableSection,
        status: editingTable ? editingTable.status : "Available",
        currentOrderAmount: editingTable ? (editingTable.currentOrderAmount || 0) : 0,
        activeOrderItems: editingTable ? (editingTable.activeOrderItems || []) : []
      };

      if (editingTable) {
        const tableRef = doc(db, "businesses", user.uid, "tables", editingTable.id);
        await updateDoc(tableRef, tableData);
      } else {
        const tablesRef = collection(db, "businesses", user.uid, "tables");
        await addDoc(tablesRef, tableData);
      }

      setShowTableModal(false);
      setEditingTable(null);
      setTableNumber("");
      setTableCapacity("");
      setTableSection("Main Hall");
    } catch (err) {
      console.error(err);
      setError("Failed to save table.");
    } finally {
      setTableSubmitLoading(false);
    }
  };

  // 3. Delete Table submit
  const handleTableDelete = async () => {
    if (!deletingTableId || !user) return;
    try {
      const tableRef = doc(db, "businesses", user.uid, "tables", deletingTableId);
      await deleteDoc(tableRef);
    } catch (err) {
      console.error(err);
      alert("Failed to delete table.");
    } finally {
      setDeletingTableId(null);
    }
  };

  // 4. Cart Operations
  const addToCart = (item: MenuItem) => {
    const existing = cart.find((c) => c.id === item.id);
    if (existing) {
      setCart(cart.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      setCart([...cart, { id: item.id, name: item.name, price: item.price, qty: 1 }]);
    }
  };

  const updateCartQty = (id: string, delta: number) => {
    const item = cart.find((c) => c.id === id);
    if (!item) return;

    if (item.qty + delta <= 0) {
      setCart(cart.filter((c) => c.id !== id));
    } else {
      setCart(cart.map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c)));
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((c) => c.id !== id));
  };

  // Cart Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cartTax = cartSubtotal * 0.05; // 5% Food Tax
  const cartTotal = cartSubtotal + cartTax;

  // 5. Send KOT to Kitchen
  const handleSendToKitchen = async () => {
    if (!activeTableForOrdering || cart.length === 0 || !user) return;

    try {
      const newItems = cart.filter(c => !c.sentToKitchen);
      if (newItems.length === 0) {
        alert("No new items to send. All items already sent to kitchen.");
        return;
      }

      const tableKotCount = (activeTableForOrdering.kotCount || 0) + 1;
      const isAdditional = tableKotCount > 1;

      const kotNumber = Date.now() % 100000;
      const kotData: KOT = {
        kotNumber,
        tableNumber: activeTableForOrdering.tableNumber,
        items: newItems.map((c) => ({ id: c.id, name: c.name, qty: c.qty, status: "pending" })),
        timestamp: new Date().toISOString(),
        orderSequence: tableKotCount,
        isAdditional
      };

      // 1. Write KOT document to Firestore
      const kotsRef = collection(db, "businesses", user.uid, "kots");
      await addDoc(kotsRef, {
        ...kotData,
        tableId: activeTableForOrdering.id,
        tableName: activeTableForOrdering.tableNumber,
        status: "New",
        startedAt: null,
        readyAt: null,
        createdAt: new Date().toISOString()
      });

      // 2. Mark cart items as sentToKitchen
      const updatedCart = cart.map(c => ({ ...c, sentToKitchen: true }));

      // 3. Update Table
      const tableRef = doc(db, "businesses", user.uid, "tables", activeTableForOrdering.id);
      await updateDoc(tableRef, {
        status: "Occupied",
        currentOrderAmount: cartTotal,
        activeOrderItems: updatedCart,
        kotCount: tableKotCount
      });

      // 4. Open Print KOT Preview Dialog
      setActiveKOTPreview(kotData);
      
      // 5. Return to table list
      setActiveTableForOrdering(null);
      setCart([]);
    } catch (err) {
      console.error(err);
      alert("Failed to submit order to kitchen.");
    }
  };

  // 6. Complete Bill checkout payment logger
  const handleCompletePayment = async () => {
    if (!activeBillingTable || !user) return;

    setCheckoutLoading(true);
    try {
      const subtotal = activeBillingTable.activeOrderItems?.reduce((sum, item) => sum + item.price * item.qty, 0) || 0;
      const tax = subtotal * 0.05;
      const grandTotal = subtotal + tax;

      // 1. Save completed order document
      const ordersRef = collection(db, "businesses", user.uid, "orders");
      await addDoc(ordersRef, {
        tableNumber: activeBillingTable.tableNumber,
        items: activeBillingTable.activeOrderItems || [],
        subtotal,
        tax,
        grandTotal,
        paymentMethod,
        createdAt: new Date().toISOString()
      });

      // 1b. Mark related KOTs as completed
      const kotsQuery = query(
        collection(db, "businesses", user.uid, "kots"),
        where("tableId", "==", activeBillingTable.id),
        where("status", "in", ["New", "In Progress", "Ready"])
      );
      const kotsSnapshot = await getDocs(kotsQuery);
      if (!kotsSnapshot.empty) {
        const batch = writeBatch(db);
        kotsSnapshot.docs.forEach(d => {
          batch.update(d.ref, { status: "completed" });
        });
        await batch.commit();
      }

      // 2. Set Table status back to Available
      const tableRef = doc(db, "businesses", user.uid, "tables", activeBillingTable.id);
      await updateDoc(tableRef, {
        status: "Available",
        currentOrderAmount: 0,
        activeOrderItems: []
      });

      setActiveBillingTable(null);
    } catch (err) {
      console.error(err);
      alert("Failed to complete checkout. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  // 7. Update status to Reserved
  const toggleReserveTable = async (table: Table) => {
    if (!user) return;
    const nextStatus = table.status === "Reserved" ? "Available" : "Reserved";
    try {
      const tableRef = doc(db, "businesses", user.uid, "tables", table.id);
      await updateDoc(tableRef, { status: nextStatus });
    } catch (err) {
      console.error(err);
      alert("Failed to change reservation status.");
    }
  };

  // Trigger Helpers
  const triggerOrderTable = (table: Table) => {
    setActiveTableForOrdering(table);
    // Load existing items if table is occupied
    if (table.status === "Occupied" && table.activeOrderItems) {
      setCart(table.activeOrderItems);
    } else {
      setCart([]);
    }
  };

  const openAddTable = () => {
    setEditingTable(null);
    setTableNumber("");
    setTableCapacity("");
    setTableSection("Main Hall");
    setShowTableModal(true);
  };

  const openEditTable = (table: Table) => {
    setEditingTable(table);
    setTableNumber(table.tableNumber);
    setTableCapacity(table.capacity.toString());
    setTableSection(table.section);
    setShowTableModal(true);
  };

  // Filter items in cart selector
  const filteredMenuItems = menuItems.filter(
    (item) =>
      item.categoryId === selectedCategoryId &&
      item.name.toLowerCase().includes(menuSearch.toLowerCase())
  );

  // Group tables by section
  const sections = ["Main Hall", "Outdoor", "VIP"] as const;

  // Render 1: Ordering cart view
  if (activeTableForOrdering) {
    return (
      <SidebarLayout>
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
          {/* Left panel: Catalog Selector */}
          <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-hidden h-full">
            {/* Catalog Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0 gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTableForOrdering(null)}
                  className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 border-0 bg-transparent cursor-pointer"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">
                    Order for {activeTableForOrdering.tableNumber.startsWith("Table") || activeTableForOrdering.tableNumber.startsWith("VIP")
                      ? activeTableForOrdering.tableNumber
                      : `Table ${activeTableForOrdering.tableNumber}`}
                  </h3>
                  <span className="text-[10px] bg-saffron/10 text-saffron font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {activeTableForOrdering.section} &middot; Max {activeTableForOrdering.capacity} seats
                  </span>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative w-48 sm:w-64">
                <Search className="absolute inset-y-0 left-0 pl-3 h-5 w-5 text-slate-400 my-auto" />
                <input
                  type="text"
                  placeholder="Search item name..."
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-saffron/20 text-slate-900 bg-slate-50/50"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Horizontal Categories Tabs scroll */}
            <div className="flex items-center gap-2 overflow-x-auto py-3 border-b border-slate-100 shrink-0 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all border shrink-0 cursor-pointer ${
                    selectedCategoryId === cat.id
                      ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                      : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-600"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu Items selection grid scroll */}
            <div className="flex-1 overflow-y-auto pt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 pr-1">
              {filteredMenuItems.length === 0 ? (
                <div className="col-span-full py-16 text-center text-slate-400">
                  <Utensils className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-xs">No active menu items in this category.</p>
                </div>
              ) : (
                filteredMenuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="p-4 rounded-xl border border-slate-200 hover:border-saffron bg-white text-left transition-all hover:shadow-md cursor-pointer flex flex-col justify-between h-[150px] relative group"
                  >
                    <div>
                      {/* Veg / Non-Veg Indicator */}
                      <span
                        className={`absolute top-3 right-3 h-4 w-4 rounded border flex items-center justify-center ${
                          item.type === "Veg" ? "border-emerald-500 bg-emerald-50" : "border-red-500 bg-red-50"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${item.type === "Veg" ? "bg-emerald-500" : "bg-red-500"}`}></span>
                      </span>

                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="h-12 w-12 object-cover rounded-lg border border-slate-100 mb-2"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 mb-2">
                          <Utensils className="h-4 w-4" />
                        </div>
                      )}

                      <h4 className="font-bold text-slate-900 text-xs truncate w-full mt-1">{item.name}</h4>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 w-full shrink-0">
                      <span className="font-black text-slate-900 text-xs">₹{item.price.toFixed(2)}</span>
                      <span className="text-[9px] font-bold text-saffron bg-saffron/15 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        + Add
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right panel: Cart Checkout summary */}
          <div className="w-full lg:w-96 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden h-full">
            {/* Cart Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h4 className="font-bold text-slate-800 text-sm">Order Summary</h4>
              <span className="text-xs font-bold text-slate-500 bg-white border px-2 py-0.5 rounded-md">
                {cart.reduce((sum, i) => sum + i.qty, 0)} Items
              </span>
            </div>

            {/* Cart Items list scroll */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-16">
                  <Layers className="h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-xs">Your order cart is empty.</p>
                  <p className="text-[10px] text-slate-400 mt-1">Click on menu items to compile your order.</p>
                </div>
              ) : (
                cart.map((item) => {
                  let itemStatus = "pending";
                  if (item.sentToKitchen && activeTableForOrdering) {
                    const tableKots = activeKots.filter(k => k.tableId === activeTableForOrdering.id);
                    const kotItems = tableKots.flatMap(k => k.items || []);
                    const matchItems = kotItems.filter(i => i.id === item.id);
                    if (matchItems.length > 0) {
                      if (matchItems.some(i => i.status === "cooking")) itemStatus = "cooking";
                      else if (matchItems.every(i => i.status === "ready")) itemStatus = "ready";
                      else itemStatus = "pending";
                    }
                  }

                  return (
                  <div key={item.id} className="py-3 flex justify-between items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-xs text-slate-900 truncate">{item.name}</p>
                        {item.sentToKitchen && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                            itemStatus === "ready" ? "bg-emerald-100 text-emerald-700" :
                            itemStatus === "cooking" ? "bg-amber-100 text-amber-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>
                            {itemStatus === "ready" && <CheckCircle className="h-2.5 w-2.5" />}
                            {itemStatus === "cooking" && <Flame className="h-2.5 w-2.5" />}
                            {itemStatus === "pending" && <Clock className="h-2.5 w-2.5" />}
                            {itemStatus === "ready" ? "Ready" : itemStatus === "cooking" ? "Cooking" : "Pending"}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">₹{item.price.toFixed(2)} each</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Quantity Selector */}
                      <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, -1)}
                          className="p-1 text-slate-500 hover:bg-slate-200 border-0 cursor-pointer text-xs"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="px-2 text-xs font-bold text-slate-800">{item.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, 1)}
                          className="p-1 text-slate-500 hover:bg-slate-200 border-0 cursor-pointer text-xs"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 border-0 bg-transparent cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {/* Cart Totals panel */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 shrink-0 space-y-3">
              <div className="space-y-1.5 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-800">₹{cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Food Tax (5%)</span>
                  <span className="font-semibold text-slate-800">₹{cartTax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold border-t border-dashed border-slate-200 pt-2 text-sm">
                  <span>Grand Total</span>
                  <span className="text-saffron">₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendToKitchen}
                disabled={cart.length === 0}
                className="w-full py-3 bg-saffron hover:bg-saffron-hover text-white font-bold text-sm rounded-lg shadow-lg shadow-saffron/15 flex items-center justify-center gap-2 cursor-pointer transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
              >
                <Utensils className="h-4 w-4" />
                Send to Kitchen (KOT)
              </button>
            </div>
          </div>
        </div>
      </SidebarLayout>
    );
  }

  // Render 2: Default Table layout grid list
  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Error warning banner */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto text-xs font-bold text-red-500 hover:text-red-700 border-0 cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* Header toolbar row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Table Management</h2>
            <p className="text-xs text-slate-400 mt-1">Configure layout zones and control live table order tickets.</p>
          </div>

          <button
            onClick={openAddTable}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-saffron-hover shadow-md shadow-saffron/15 transition-all border-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add Table
          </button>
        </div>

        {/* Section categories list */}
        {loading ? (
          <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-saffron" />
              <p className="text-slate-400 text-sm font-medium">Loading layout tables...</p>
            </div>
          </div>
        ) : tables.length === 0 ? (
          /* Empty tables view */
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="h-16 w-16 bg-saffron/10 text-saffron rounded-full flex items-center justify-center mx-auto mb-4">
              <Layers className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No tables created yet</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
              Add table markers to arrange your floor space mapping, track occupied orders, and run direct kitchen routing.
            </p>
            <button
              onClick={openAddTable}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-saffron-hover shadow-lg shadow-saffron/20 border-0 cursor-pointer transition-all"
            >
              Configure First Table
            </button>
          </div>
        ) : (
          /* Grouped Tables list layout */
          <div className="space-y-8">
            {sections.map((section) => {
              const sectionTables = tables.filter((t) => t.section === section);
              if (sectionTables.length === 0) return null;

              return (
                <div key={section} className="space-y-4">
                  <div className="flex items-center gap-3 pb-2 border-b border-slate-200">
                    <h3 className="font-extrabold text-slate-800 text-sm tracking-wide uppercase">{section}</h3>
                    <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                      {sectionTables.length} Tables
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                    {sectionTables.map((table) => {
                      const isOccupied = table.status === "Occupied";
                      const isReserved = table.status === "Reserved";
                      const isAvailable = table.status === "Available";

                      const tableKots = activeKots.filter(k => k.tableId === table.id);
                      const kotItems = tableKots.flatMap(k => k.items || []);
                      const pendingCount = kotItems.filter(i => i.status === "pending").length;
                      const cookingCount = kotItems.filter(i => i.status === "cooking").length;
                      const readyCount = kotItems.filter(i => i.status === "ready").length;
                      const allItemsReady = kotItems.length > 0 && pendingCount === 0 && cookingCount === 0;

                      return (
                        <div
                          key={table.id}
                          className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden relative group hover:shadow-md transition-all min-h-[180px]"
                        >
                          {/* Top Status Header bar */}
                          <div className={`h-1.5 w-full shrink-0 ${
                            isAvailable ? "bg-emerald-500" : isOccupied ? "bg-red-500" : "bg-amber-500"
                          }`}></div>

                          {/* Body Content */}
                          <div className="p-5 flex-1 flex flex-col min-w-0">
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <h4 className="font-extrabold text-slate-900 text-lg truncate">
                                  {table.tableNumber.startsWith("Table") || table.tableNumber.startsWith("VIP")
                                    ? table.tableNumber
                                    : `Table ${table.tableNumber}`}
                                </h4>
                                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Users className="h-3.5 w-3.5" />
                                  Capacity: {table.capacity} Seats
                                </p>
                              </div>

                              {/* Edit / Delete actions in hover state */}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
                                <button
                                  onClick={() => openEditTable(table)}
                                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 border-0 bg-transparent cursor-pointer"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setDeletingTableId(table.id)}
                                  className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 border-0 bg-transparent cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Middle occupancy stats */}
                            <div className="mt-2.5">
                              {isOccupied ? (
                                <div className="space-y-2 w-full">
                                  <div className="flex items-center justify-between text-xs bg-red-50/50 p-2 rounded-lg border border-red-100">
                                    <span className="font-bold text-red-700 flex items-center gap-1.5">
                                      <Clock className="h-3.5 w-3.5 animate-pulse" />
                                      Occupied
                                    </span>
                                    <span className="font-extrabold text-slate-900 text-sm">
                                      ₹{(table.currentOrderAmount || 0).toFixed(2)}
                                    </span>
                                  </div>
                                  {(pendingCount > 0 || cookingCount > 0 || readyCount > 0) && (
                                    <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                                      {readyCount > 0 && <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>{readyCount} ready</span>}
                                      {cookingCount > 0 && <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100"><span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>{cookingCount} cooking</span>}
                                      {pendingCount > 0 && <span className="flex items-center gap-1 text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200"><span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>{pendingCount} pending</span>}
                                    </div>
                                  )}
                                </div>
                              ) : isReserved ? (
                                <div className="flex items-center text-xs bg-amber-50 text-amber-700 p-2 rounded-lg border border-amber-100 font-bold gap-1.5 w-fit">
                                  <Clock className="h-3.5 w-3.5" />
                                  Reserved
                                </div>
                              ) : (
                                <div className="flex items-center text-xs bg-emerald-50 text-emerald-700 p-2 rounded-lg border border-emerald-100 font-bold gap-1.5 w-fit">
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Available
                                </div>
                              )}
                            </div>

                            {/* Order Ready Badge */}
                            {allItemsReady && isOccupied && (
                              <div className="flex items-center gap-1.5 mt-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold px-3 py-1 w-fit rounded-full animate-pulse">
                                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                                Order Ready! 🍽️
                              </div>
                            )}

                            {/* Bottom Card Actions */}
                            <div className="flex gap-2 mt-auto pt-3 border-t border-slate-100 shrink-0">
                              {isOccupied ? (
                                <>
                                  <button
                                    onClick={() => triggerOrderTable(table)}
                                    className="flex-1 h-10 flex items-center justify-center border border-slate-200 rounded-lg text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer transition-colors"
                                  >
                                    Add Items
                                  </button>
                                  <button
                                    onClick={() => setActiveBillingTable(table)}
                                    className="flex-1 h-10 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-700 border border-red-100 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                                  >
                                    Generate Bill
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => triggerOrderTable(table)}
                                    className="flex-1 h-10 flex items-center justify-center bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold cursor-pointer transition-colors border-0"
                                  >
                                    Take Order
                                  </button>
                                  <button
                                    onClick={() => toggleReserveTable(table)}
                                    className={`flex-1 h-10 flex items-center justify-center border rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                      isReserved
                                        ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                                        : "border-slate-200 text-slate-500 hover:bg-slate-50 bg-white"
                                    }`}
                                  >
                                    {isReserved ? "Release" : "Reserve"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. TABLE ADD / EDIT MODAL */}
      {showTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowTableModal(false)}></div>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative z-10 border border-slate-100 mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingTable ? "Edit Table Details" : "Add Layout Table"}
            </h3>

            <form onSubmit={handleTableSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Table Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T-1"
                  className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Seat Capacity</label>
                <input
                  type="number"
                  required
                  placeholder="4"
                  className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                  value={tableCapacity}
                  onChange={(e) => setTableCapacity(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Floor Section</label>
                <select
                  required
                  className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                  value={tableSection}
                  onChange={(e) => setTableSection(e.target.value as any)}
                >
                  <option value="Main Hall">Main Hall</option>
                  <option value="Outdoor">Outdoor</option>
                  <option value="VIP">VIP</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowTableModal(false)}
                  disabled={tableSubmitLoading}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tableSubmitLoading || !tableNumber || !tableCapacity}
                  className="px-4 py-2 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-saffron-hover shadow-md shadow-saffron/10 border-0 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {tableSubmitLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Table"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. KOT KITCHEN TICKET PRINT PREVIEW */}
      {activeKOTPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setActiveKOTPreview(null)}></div>

          {/* Ticket Body */}
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm relative z-10 border border-slate-100 overflow-hidden mx-4">
            <div className="p-4 bg-slate-100 flex items-center justify-between shrink-0">
              <span className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">Kitchen Order Ticket</span>
              <button
                onClick={() => setActiveKOTPreview(null)}
                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 border-0 bg-transparent cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Receipt Styling */}
            <div className="p-6 font-mono text-xs text-slate-700 space-y-4">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h3 className="font-extrabold text-slate-900 text-sm">BHARATPOS KITCHEN</h3>
                <p className="text-[10px] text-slate-400 mt-1">Table Routing Slip</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">KOT ID:</span>
                  <span className="font-bold text-slate-900">#KOT-{activeKOTPreview.kotNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Table:</span>
                  <span className="font-bold text-slate-900">
                    {activeKOTPreview.tableNumber.startsWith("Table") || activeKOTPreview.tableNumber.startsWith("VIP")
                      ? activeKOTPreview.tableNumber
                      : `Table ${activeKOTPreview.tableNumber}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Time:</span>
                  <span className="font-bold text-slate-900">
                    {new Date(activeKOTPreview.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="border-t border-b border-dashed border-slate-300 py-3 space-y-2">
                <div className="flex justify-between font-bold text-slate-800 text-[10px]">
                  <span>ITEM NAME</span>
                  <span>QTY</span>
                </div>
                {activeKOTPreview.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between font-semibold text-slate-900 text-sm">
                    <span>{i.name}</span>
                    <span>x{i.qty}</span>
                  </div>
                ))}
              </div>

              <div className="text-center text-[9px] text-slate-400 pt-1">
                KOT Printed Successfully &middot; Routing Complete
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 border-t border-slate-100 flex gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setActiveKOTPreview(null)}
                className="w-1/3 py-2 border border-slate-200 rounded-lg text-slate-600 font-semibold text-sm hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setActiveKOTPreview(null);
                }}
                className="w-2/3 py-2 bg-saffron hover:bg-saffron-hover text-white font-bold text-sm rounded-lg shadow-md shadow-saffron/10 flex items-center justify-center gap-2 cursor-pointer border-0"
              >
                <Printer className="h-4 w-4" />
                Print Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. BILLING & PAYOUT MODAL */}
      {activeBillingTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setActiveBillingTable(null)}></div>

          {/* Modal Panel */}
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md relative z-10 border border-slate-100 overflow-hidden mx-4">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <h3 className="font-extrabold text-slate-800 text-sm">
                Generate Bill - {activeBillingTable.tableNumber.startsWith("Table") || activeBillingTable.tableNumber.startsWith("VIP")
                  ? activeBillingTable.tableNumber
                  : `Table ${activeBillingTable.tableNumber}`}
              </h3>
              <button
                onClick={() => setActiveBillingTable(null)}
                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 border-0 bg-transparent cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Bill Info */}
            <div className="p-6 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
              <div className="border-b pb-3 space-y-2">
                {activeBillingTable.activeOrderItems?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{item.name}</span>
                      <span className="text-slate-400 ml-1">x{item.qty}</span>
                    </div>
                    <span className="font-bold text-slate-900">₹{(item.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Checkout Calculation */}
              <div className="space-y-1.5 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-800">
                    ₹
                    {(
                      activeBillingTable.activeOrderItems?.reduce((sum, item) => sum + item.price * item.qty, 0) ||
                      0
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Food GST (5%)</span>
                  <span className="font-bold text-slate-800">
                    ₹
                    {(
                      (activeBillingTable.activeOrderItems?.reduce((sum, item) => sum + item.price * item.qty, 0) ||
                        0) * 0.05
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-black text-slate-900 text-sm pt-2 border-t border-dashed border-slate-200">
                  <span>Total Amount Due</span>
                  <span className="text-saffron">
                    ₹
                    {(
                      (activeBillingTable.activeOrderItems?.reduce((sum, item) => sum + item.price * item.qty, 0) ||
                        0) * 1.05
                    ).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Payment selector */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-bold text-slate-400 uppercase">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Cash", "UPI", "Card"] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                        paymentMethod === method
                          ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                          : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600"
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="p-4 border-t border-slate-100 flex gap-3 shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => setActiveBillingTable(null)}
                disabled={checkoutLoading}
                className="w-1/3 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-semibold text-sm hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleCompletePayment}
                disabled={checkoutLoading}
                className="w-2/3 py-2.5 bg-saffron hover:bg-saffron-hover text-white font-bold text-sm rounded-lg shadow-md shadow-saffron/10 flex items-center justify-center gap-2 cursor-pointer border-0 disabled:opacity-50"
              >
                {checkoutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CreditCard className="h-4 w-4" />
                    Pay & Free Table
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. DELETE TABLE CONFIRMATION DIALOG */}
      {deletingTableId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeletingTableId(null)}></div>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative z-10 border border-slate-100 mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Table Marker?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to delete this table layout marker? This action is permanent and cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeletingTableId(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTableDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 shadow-md shadow-red-600/10 border-0 cursor-pointer"
              >
                Delete Table
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
};
