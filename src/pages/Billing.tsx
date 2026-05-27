import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { collection, doc, addDoc, updateDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { SidebarLayout } from "../components/Sidebar";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Printer,
  X,
  Layers,
  AlertCircle,
  Percent,
  ImageIcon,
  Loader2
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: number;
  stock: number;
  unit: "pcs" | "kg" | "ltr";
  barcode?: string;
  imageUrl?: string;
  status: "Active" | "Inactive";
}

interface Category {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  unit: "pcs" | "kg" | "ltr";
  stock: number;
}

interface OrderReceipt {
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: { name: string; price: number; qty: number; unit: string }[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: string;
  timestamp: string;
}

export const Billing: React.FC = () => {
  const { user, business } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Catalog search / filter
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Customer selection
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);

  // Discount selectors
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [discountValue, setDiscountValue] = useState<string>("");

  // Payment Selection
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "UPI" | "Card">("Cash");
  const [saleLoading, setSaleLoading] = useState<boolean>(false);

  // Receipt Preview
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  // 1. Listen to Products, Categories and Customers
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // Fetch Products (Active only)
    const productsQuery = query(collection(db, "businesses", user.uid, "products"));
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(list.filter((p) => p.status === "Active"));
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to fetch products list.");
      setLoading(false);
    });

    // Fetch Categories
    const categoriesQuery = query(collection(db, "businesses", user.uid, "menuCategories"), orderBy("sortOrder", "asc"));
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

    // Fetch Customers
    const customersQuery = query(collection(db, "businesses", user.uid, "customers"));
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      const custList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Customer[];
      setCustomers(custList);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
      unsubscribeCustomers();
    };
  }, [user]);

  // 2. Cart Operations
  const addToCart = (product: Product) => {
    if (product.stock === 0) return;

    const existing = cart.find((c) => c.id === product.id);
    if (existing) {
      if (existing.qty >= product.stock) {
        alert("Cannot add more. Insufficient stock quantity.");
        return;
      }
      setCart(cart.map((c) => (c.id === product.id ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      setCart([...cart, { id: product.id, name: product.name, price: product.price, qty: 1, unit: product.unit, stock: product.stock }]);
    }
  };

  const updateCartQty = (id: string, delta: number) => {
    const item = cart.find((c) => c.id === id);
    if (!item) return;

    if (item.qty + delta <= 0) {
      setCart(cart.filter((c) => c.id !== id));
    } else {
      if (delta > 0 && item.qty >= item.stock) {
        alert("Cannot increment. Limit of available stock reached.");
        return;
      }
      setCart(cart.map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c)));
    }
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((c) => c.id !== id));
  };

  // 3. Cart Calculations
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  
  // Calculate discount
  const val = Number(discountValue) || 0;
  const computedDiscount = discountType === "percent" ? (cartSubtotal * val) / 100 : val;
  
  const discountedSubtotal = Math.max(0, cartSubtotal - computedDiscount);
  const cartTax = discountedSubtotal * 0.18; // 18% Retail GST
  const cartTotal = discountedSubtotal + cartTax;

  // 4. Customer Selection helpers
  const handleSelectCustomer = (cust: Customer) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    setCustomerSearchQuery("");
    setShowCustomerDropdown(false);
  };

  const clearCustomer = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerSearchQuery("");
  };

  // Filter customers for dropdown
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      c.phone.includes(customerSearchQuery)
  );

  // 5. Complete Sale Action
  const handleCompleteSale = async () => {
    if (cart.length === 0 || !user) return;

    setSaleLoading(true);
    try {
      const orderId = `SALE-${Date.now()}`;
      const orderItems = cart.map((c) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        qty: c.qty,
        unit: c.unit
      }));

      // 1. Save order to Firestore
      const ordersRef = collection(db, "businesses", user.uid, "orders");
      await addDoc(ordersRef, {
        orderId,
        customerName: customerName || "General Walk-In",
        customerPhone: customerPhone || "",
        items: orderItems,
        subtotal: cartSubtotal,
        discount: computedDiscount,
        tax: cartTax,
        grandTotal: cartTotal,
        paymentMethod,
        createdAt: new Date().toISOString()
      });

      // 2. Reduce product stock in Firestore
      for (const item of cart) {
        const productRef = doc(db, "businesses", user.uid, "products", item.id);
        const nextStock = Math.max(0, item.stock - item.qty);
        await updateDoc(productRef, { stock: nextStock });
      }

      // 3. Save new customer if phone is provided and doesn't exist
      if (customerPhone && !customers.some((c) => c.phone === customerPhone)) {
        const customersRef = collection(db, "businesses", user.uid, "customers");
        await addDoc(customersRef, {
          name: customerName || "Unnamed Customer",
          phone: customerPhone,
          createdAt: new Date().toISOString()
        });
      }

      // 4. Generate Receipt
      setReceipt({
        orderId,
        customerName: customerName || "General Customer",
        customerPhone: customerPhone || "—",
        items: orderItems,
        subtotal: cartSubtotal,
        discount: computedDiscount,
        tax: cartTax,
        grandTotal: cartTotal,
        paymentMethod,
        timestamp: new Date().toISOString()
      });

      // 5. Reset POS cart and customer
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDiscountValue("");
    } catch (err: any) {
      console.error(err);
      alert(`Checkout failed: ${err.message || err}`);
    } finally {
      setSaleLoading(false);
    }
  };

  // Filter products by search and category
  const filteredProducts = products.filter((p) => {
    const matchesCategory = p.categoryId === selectedCategoryId;
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <SidebarLayout>
      {error && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-auto text-xs font-bold text-red-500 hover:text-red-700 border-0 bg-transparent cursor-pointer">
            Dismiss
          </button>
        </div>
      )}
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-140px)]">
        {/* Left panel: Product Catalog */}
        <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-slate-200 shadow-sm p-4 overflow-hidden h-full">
          {/* Catalog Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pb-4 border-b border-slate-100 shrink-0 gap-3">
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg">Product Catalog</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Click items to add to the checkout receipt.</p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute inset-y-0 left-0 pl-3 h-5 w-5 text-slate-400 my-auto pointer-events-none" />
              <input
                type="text"
                placeholder="Search name or barcode..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-saffron/20 text-slate-900 bg-slate-50/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Categories Tab List */}
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

          {/* Product Items scroll grid */}
          <div className="flex-1 overflow-y-auto pt-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 pr-1">
            {loading ? (
              <div className="col-span-full py-16 text-center text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-saffron mb-2" />
                <p className="text-xs">Loading products catalog...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs">No active products in this category.</p>
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isOutOfStock = p.stock === 0;
                return (
                  <button
                    key={p.id}
                    disabled={isOutOfStock}
                    onClick={() => addToCart(p)}
                    className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between h-[160px] relative group ${
                      isOutOfStock
                        ? "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"
                        : "bg-white border-slate-200 hover:border-saffron hover:shadow-md cursor-pointer"
                    }`}
                  >
                    <div>
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="h-12 w-12 object-cover rounded-lg border border-slate-100 mb-2"
                        />
                      ) : (
                        <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 mb-2">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}

                      <h4 className="font-bold text-slate-900 text-xs truncate w-full mt-1">{p.name}</h4>
                      
                      {/* Stock Level text */}
                      <span className={`text-[10px] block mt-0.5 font-semibold ${isOutOfStock ? "text-red-500 font-bold" : "text-slate-400"}`}>
                        {isOutOfStock ? "SOLD OUT" : `Stock: ${p.stock} ${p.unit}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 w-full shrink-0">
                      <span className="font-extrabold text-slate-950 text-xs">₹{p.price.toFixed(2)}</span>
                      {!isOutOfStock && (
                        <span className="text-[9px] font-bold text-saffron bg-saffron/15 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                          + Add
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel: POS Bill Checkout Summary */}
        <div className="w-full lg:w-96 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden h-full">
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
            <h4 className="font-bold text-slate-800 text-sm">Receipt Cart</h4>
            <span className="text-xs font-bold text-slate-500 bg-white border px-2 py-0.5 rounded-md">
              {cart.reduce((sum, i) => sum + i.qty, 0)} Items
            </span>
          </div>

          {/* Cart Scroll list */}
          <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-16">
                <Layers className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-xs">Billing cart is empty.</p>
                <p className="text-[10px] text-slate-400 mt-1">Tap catalog products to compile a transaction receipt.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.id} className="py-3.5 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-slate-900 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      ₹{item.price.toFixed(2)} per {item.unit}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Quantity selectors */}
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

                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 border-0 bg-transparent cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Customer / Totals Checkout panel */}
          <div className="border-t border-slate-100 bg-slate-50 shrink-0 p-4 space-y-4">
            
            {/* Customer Inputs */}
            <div className="relative space-y-2 border-b border-slate-200 pb-3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase">Customer Information</label>
              
              {customerPhone ? (
                /* Customer selected display badge */
                <div className="flex items-center justify-between bg-white border border-slate-200 p-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-slate-100 rounded-md text-slate-500">
                      <User className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-900">{customerName}</p>
                      <p className="text-[10px] text-slate-400">{customerPhone}</p>
                    </div>
                  </div>
                  <button
                    onClick={clearCustomer}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 border-0 bg-transparent cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                /* Search autocomplete or manual inputs */
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute inset-y-0 left-0 pl-3 h-4 w-4 text-slate-400 my-auto" />
                    <input
                      type="text"
                      placeholder="Search name or phone..."
                      className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-saffron/20 text-slate-900 bg-white"
                      value={customerSearchQuery}
                      onChange={(e) => {
                        setCustomerSearchQuery(e.target.value);
                        setShowCustomerDropdown(true);
                      }}
                      onFocus={() => setShowCustomerDropdown(true)}
                    />
                  </div>

                  {/* Customer listing dropdown */}
                  {showCustomerDropdown && customerSearchQuery && (
                    <div className="absolute bottom-full mb-1 left-0 right-0 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-20 divide-y divide-slate-100">
                      {filteredCustomers.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          No customer found. Complete sale to log a new user.
                        </div>
                      ) : (
                        filteredCustomers.map((cust) => (
                          <button
                            key={cust.id}
                            type="button"
                            onClick={() => handleSelectCustomer(cust)}
                            className="w-full text-left p-2.5 hover:bg-slate-50 transition-colors text-xs flex justify-between items-center border-0 bg-white cursor-pointer"
                          >
                            <span className="font-semibold text-slate-800">{cust.name}</span>
                            <span className="text-slate-400">{cust.phone}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* Manual Type Fields inputs toggle */}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Manual Name"
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-saffron/20 text-slate-900 bg-white"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                    />
                    <input
                      type="tel"
                      placeholder="Manual Phone"
                      className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-saffron/20 text-slate-900 bg-white"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Discount Inputs */}
            <div className="relative space-y-2 border-b border-slate-200 pb-3">
              <label className="block text-[10px] font-bold text-slate-400 uppercase">Apply Discount</label>
              <div className="flex gap-2">
                <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setDiscountType("percent")}
                    className={`px-2.5 py-1.5 text-xs font-bold transition-colors border-0 cursor-pointer ${
                      discountType === "percent" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    <Percent className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("flat")}
                    className={`px-2.5 py-1.5 text-xs font-bold transition-colors border-0 cursor-pointer ${
                      discountType === "flat" ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    ₹
                  </button>
                </div>
                <input
                  type="number"
                  placeholder="0.00"
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-saffron/20 text-slate-900 bg-white"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                />
              </div>
            </div>

            {/* Price Calculations totals */}
            <div className="space-y-1.5 text-xs text-slate-500">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-800">₹{cartSubtotal.toFixed(2)}</span>
              </div>
              {computedDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount</span>
                  <span>-₹{computedDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST Tax (18%)</span>
                <span className="font-semibold text-slate-800">₹{cartTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold border-t border-dashed border-slate-200 pt-2 text-sm">
                <span>Grand Total</span>
                <span className="text-saffron">₹{cartTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method selector buttons */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {(["Cash", "UPI", "Card"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    paymentMethod === method
                      ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                      : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {/* Checkout Action Button */}
            <button
              type="button"
              onClick={handleCompleteSale}
              disabled={cart.length === 0 || saleLoading}
              className="w-full py-3 bg-saffron hover:bg-saffron-hover text-white font-bold text-sm rounded-lg shadow-lg shadow-saffron/15 flex items-center justify-center gap-2 cursor-pointer transition-all border-0 disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
            >
              {saleLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing Checkout...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  Complete Sale (Pay)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. RECEIPT PREVIEW DIALOG MODAL */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setReceipt(null)}></div>

          {/* Dialog Container */}
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm relative z-10 border border-slate-100 overflow-hidden mx-4">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between shrink-0">
              <span className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">Transaction Receipt</span>
              <button
                onClick={() => setReceipt(null)}
                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 border-0 bg-transparent cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Receipt Styling */}
            <div className="p-6 font-mono text-[11px] text-slate-700 space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto">
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h3 className="font-extrabold text-slate-900 text-sm">{business?.name || "BHARATPOS"}</h3>
                <p className="text-[9px] text-slate-400 mt-1">{business?.city || "Retail Branch"}</p>
                <p className="text-[9px] text-slate-400">Phone: {business?.phone || "—"}</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Receipt ID:</span>
                  <span className="font-bold text-slate-900">{receipt.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Date:</span>
                  <span className="font-bold text-slate-900">
                    {new Date(receipt.timestamp).toLocaleDateString()} &middot; {new Date(receipt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="font-bold text-slate-900">{receipt.customerName}</span>
                </div>
                {receipt.customerPhone && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Phone:</span>
                    <span className="font-bold text-slate-900">{receipt.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* Items Breakdown list */}
              <div className="border-t border-b border-dashed border-slate-300 py-3 space-y-2">
                <div className="flex justify-between font-bold text-slate-800 text-[10px]">
                  <span>ITEM LIST</span>
                  <span>TOTAL</span>
                </div>
                {receipt.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between font-semibold text-slate-900">
                    <span>
                      {i.name} ({i.qty} {i.unit})
                    </span>
                    <span>₹{(i.price * i.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {/* Receipt calculations */}
              <div className="space-y-1 text-right">
                <div className="flex justify-between">
                  <span className="text-slate-400">Subtotal:</span>
                  <span className="font-semibold text-slate-900">₹{receipt.subtotal.toFixed(2)}</span>
                </div>
                {receipt.discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>-₹{receipt.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">GST (18%):</span>
                  <span className="font-semibold text-slate-900">₹{receipt.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-dashed border-slate-300 pt-2 font-black text-slate-950 text-sm">
                  <span>Grand Total:</span>
                  <span>₹{receipt.grandTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-500 font-bold">
                <span>Payment Mode:</span>
                <span className="uppercase text-slate-800">{receipt.paymentMethod}</span>
              </div>

              <div className="text-center text-[9px] text-slate-400 pt-2 border-t border-dashed border-slate-200">
                Thank You For Shopping With Us!
              </div>
            </div>

            {/* Action Bar */}
            <div className="p-4 border-t border-slate-100 flex gap-3 shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="w-1/3 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-semibold text-sm hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                  setReceipt(null);
                }}
                className="w-2/3 py-2.5 bg-saffron hover:bg-saffron-hover text-white font-bold text-sm rounded-lg shadow-md shadow-saffron/10 flex items-center justify-center gap-2 cursor-pointer border-0"
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
};
