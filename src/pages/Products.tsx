import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { SidebarLayout } from "../components/Sidebar";
import {
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Upload,
  X,
  Search,
  Package,
  CheckCircle2,
  XCircle
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
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
}

export const Products: React.FC = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Product Modal States
  const [showProductSheet, setShowProductSheet] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productName, setProductName] = useState<string>("");
  const [productCategoryId, setProductCategoryId] = useState<string>("");
  const [productPrice, setProductPrice] = useState<string>("");
  const [productStock, setProductStock] = useState<string>("");
  const [productUnit, setProductUnit] = useState<"pcs" | "kg" | "ltr">("pcs");
  const [productBarcode, setProductBarcode] = useState<string>("");
  const [productImageUrl, setProductImageUrl] = useState<string>("");
  const [productStatus, setProductStatus] = useState<"Active" | "Inactive">("Active");

  // Image Upload States
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<boolean>(false);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deletions
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // ─── Stock Update States ───
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockMode, setStockMode] = useState<"add" | "set">("add");
  const [stockInput, setStockInput] = useState("");

  // ─── Bulk Stock Update States ───
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkChanges, setBulkChanges] = useState<Record<string, { mode: "add" | "set"; value: string }>>({});
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  // ─── Toast Notification ───
  const [toastNotif, setToastNotif] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (toastNotif) {
      const timer = setTimeout(() => setToastNotif(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastNotif]);

  // 1. Fetch Categories & Products from Firestore
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    // Fetch Products
    const productsQuery = query(
      collection(db, "businesses", user.uid, "products"),
      orderBy("createdAt", "desc")
    );
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const prodList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(prodList);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to fetch products list.");
      setLoading(false);
    });

    // Fetch Categories (re-use menuCategories as generic product categories)
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
    });

    return () => {
      unsubscribeProducts();
      unsubscribeCategories();
    };
  }, [user]);

  // Set default category in Sheet
  useEffect(() => {
    if (categories.length > 0 && !productCategoryId) {
      setProductCategoryId(categories[0].id);
    }
  }, [categories, productCategoryId]);

  // Helper: Upload Image to Cloudinary
  const uploadImage = async (file: File): Promise<string> => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary credentials are not configured in your environment.");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const errRes = await response.text();
      console.error("Cloudinary error:", errRes);
      throw new Error("Failed to upload image.");
    }

    const data = await response.json();
    return data.secure_url;
  };

  // 2. Add / Edit Product Submit
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName || !productCategoryId || !productPrice || !productStock || !user) return;

    setSubmitLoading(true);
    let finalImageUrl = productImageUrl;

    try {
      if (imageFile) {
        setUploadProgress(true);
        finalImageUrl = await uploadImage(imageFile);
        setUploadProgress(false);
      }

      const productData = {
        name: productName,
        categoryId: productCategoryId,
        price: Number(productPrice),
        stock: Number(productStock),
        unit: productUnit,
        barcode: productBarcode,
        imageUrl: finalImageUrl,
        status: productStatus,
        createdAt: editingProduct ? editingProduct.createdAt : new Date().toISOString()
      };

      if (editingProduct) {
        const productRef = doc(db, "businesses", user.uid, "products", editingProduct.id);
        await updateDoc(productRef, productData);
      } else {
        const productsRef = collection(db, "businesses", user.uid, "products");
        await addDoc(productsRef, productData);
      }

      // Reset Form and close sheet
      setShowProductSheet(false);
      setEditingProduct(null);
      setProductName("");
      setProductPrice("");
      setProductStock("");
      setProductUnit("pcs");
      setProductBarcode("");
      setProductImageUrl("");
      setImageFile(null);
      setImagePreview("");
      setProductStatus("Active");
    } catch (err: any) {
      console.error(err);
      setError(`Failed to save product: ${err.message || err}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  // 3. Delete Product Submit
  const handleProductDelete = async () => {
    if (!deletingProductId || !user) return;
    try {
      const productRef = doc(db, "businesses", user.uid, "products", deletingProductId);
      await deleteDoc(productRef);
    } catch (err) {
      console.error(err);
      alert("Failed to delete product.");
    } finally {
      setDeletingProductId(null);
    }
  };

  // 4. File selection & preview
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 5. Quick Toggle Product Status
  const toggleProductStatus = async (product: Product) => {
    if (!user) return;
    const nextStatus = product.status === "Active" ? "Inactive" : "Active";
    try {
      const productRef = doc(db, "businesses", user.uid, "products", product.id);
      await updateDoc(productRef, { status: nextStatus });
    } catch (err) {
      console.error(err);
      alert("Failed to update status.");
    }
  };

  // ─── 6. Individual Stock Update ───
  const openStockDialog = (product: Product) => {
    setSelectedProduct(product);
    setStockMode("add");
    setStockInput("");
    setStockDialogOpen(true);
  };

  const handleStockConfirm = async () => {
    if (!selectedProduct || !user || !stockInput) return;
    const inputVal = Number(stockInput);
    if (isNaN(inputVal) || inputVal < 0) return;

    const oldStock = selectedProduct.stock;
    const newStock = stockMode === "add" ? oldStock + inputVal : inputVal;

    try {
      const productRef = doc(db, "businesses", user.uid, "products", selectedProduct.id);
      await updateDoc(productRef, { stock: newStock });
      setToastNotif({
        message: `Stock updated — ${selectedProduct.name}: ${oldStock} → ${newStock} ${selectedProduct.unit}`,
        type: "success"
      });
      setStockDialogOpen(false);
    } catch (err) {
      console.error(err);
      setToastNotif({ message: "Failed to update stock.", type: "error" });
    }
  };

  // ─── 7. Bulk Stock Update ───
  const openBulkDialog = () => {
    // Initialize bulkChanges with empty values for each product
    const initial: Record<string, { mode: "add" | "set"; value: string }> = {};
    products.forEach((p) => {
      initial[p.id] = { mode: "add", value: "" };
    });
    setBulkChanges(initial);
    setBulkDialogOpen(true);
  };

  const handleBulkUpdate = async () => {
    if (!user) return;
    setBulkSaving(true);

    try {
      const batch = writeBatch(db);
      let updateCount = 0;

      Object.entries(bulkChanges).forEach(([id, { mode, value }]) => {
        const numVal = Number(value);
        if (!value || isNaN(numVal) || numVal < 0) return; // skip empty/invalid

        const product = products.find((p) => p.id === id);
        if (!product) return;

        const newStock = mode === "add" ? product.stock + numVal : numVal;
        const prodRef = doc(db, "businesses", user.uid, "products", id);
        batch.update(prodRef, { stock: newStock });
        updateCount++;
      });

      if (updateCount === 0) {
        setToastNotif({ message: "No changes to apply. Enter quantities first.", type: "error" });
        setBulkSaving(false);
        setBulkConfirmOpen(false);
        return;
      }

      await batch.commit();
      setToastNotif({
        message: `Bulk stock updated for ${updateCount} product${updateCount > 1 ? "s" : ""} ✅`,
        type: "success"
      });
      setBulkDialogOpen(false);
      setBulkConfirmOpen(false);
      setBulkChanges({});
    } catch (err) {
      console.error(err);
      setToastNotif({ message: "Failed to apply bulk stock update.", type: "error" });
    } finally {
      setBulkSaving(false);
    }
  };

  // Trig helpers
  const openAddProduct = () => {
    setEditingProduct(null);
    setProductName("");
    setProductCategoryId(categories.length > 0 ? categories[0].id : "");
    setProductPrice("");
    setProductStock("");
    setProductUnit("pcs");
    setProductBarcode("");
    setProductImageUrl("");
    setImageFile(null);
    setImagePreview("");
    setProductStatus("Active");
    setShowProductSheet(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductName(product.name);
    setProductCategoryId(product.categoryId);
    setProductPrice(product.price.toString());
    setProductStock(product.stock.toString());
    setProductUnit(product.unit);
    setProductBarcode(product.barcode || "");
    setProductImageUrl(product.imageUrl || "");
    setImageFile(null);
    setImagePreview(product.imageUrl || "");
    setProductStatus(product.status);
    setShowProductSheet(true);
  };

  // Calculations: Find products with low stock (below 10)
  const lowStockProducts = products.filter((p) => p.stock < 10);

  // Filter products by search query
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Error Warning Banner */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto text-xs font-bold text-red-500 hover:text-red-700 border-0 bg-transparent cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* Low Stock Alert Banner */}
        {lowStockProducts.length > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl shadow-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-xs">
              <span className="font-extrabold">Inventory Stock Alert</span>: There are{" "}
              <span className="font-extrabold text-amber-950">{lowStockProducts.length} items</span> currently running low
              on stock (under 10 units). Please review your inventory.
            </div>
          </div>
        )}

        {/* Header Toolbar row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Product Management</h2>
            <p className="text-xs text-slate-400 mt-1">Manage catalog listings, SKU barcodes, pricing, and stock count levels.</p>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute inset-y-0 left-0 pl-3 h-5 w-5 text-slate-400 my-auto pointer-events-none" />
              <input
                type="text"
                placeholder="Search name or barcode..."
                className="w-full sm:w-64 pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Bulk Stock Update Button */}
            {products.length > 0 && (
              <button
                onClick={openBulkDialog}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all cursor-pointer"
              >
                <Package className="h-4 w-4 text-saffron" />
                <span className="hidden sm:inline">Bulk Stock</span>
              </button>
            )}

            <button
              onClick={openAddProduct}
              className="flex items-center justify-center gap-1.5 px-4 py-2 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-saffron-hover shadow-md shadow-saffron/15 transition-all border-0 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </button>
          </div>
        </div>

        {/* Data list view */}
        {loading ? (
          <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-saffron" />
              <p className="text-slate-400 text-sm font-medium">Loading products catalog...</p>
            </div>
          </div>
        ) : products.length === 0 ? (
          /* Empty catalog state */
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="h-16 w-16 bg-saffron/10 text-saffron rounded-full flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No products listed yet</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
              Create product listings with price values, barcodes, and inventory levels to enable quick billing transactions.
            </p>
            <button
              onClick={openAddProduct}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-saffron-hover shadow-lg shadow-saffron/20 border-0 cursor-pointer transition-all"
            >
              Log Your First Product
            </button>
          </div>
        ) : (
          /* Products Table */
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-4">Image</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4">Price</th>
                    <th className="px-6 py-4">Stock</th>
                    <th className="px-6 py-4">SKU / Barcode</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {filteredProducts.map((product) => {
                    const isLowStock = product.stock < 10;
                    const catName = categories.find((c) => c.id === product.categoryId)?.name || "Uncategorized";

                    return (
                      <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Image */}
                        <td className="px-6 py-3.5">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-10 w-10 object-cover rounded-lg border border-slate-100 shadow-sm"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                        </td>

                        {/* Name */}
                        <td className="px-6 py-3.5 font-bold text-slate-900 truncate max-w-xs">
                          {product.name}
                        </td>

                        {/* Category */}
                        <td className="px-6 py-3.5">
                          <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full">
                            {catName}
                          </span>
                        </td>

                        {/* Price */}
                        <td className="px-6 py-3.5 font-extrabold text-slate-950">
                          ₹{product.price.toFixed(2)}
                        </td>

                        {/* Stock level */}
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold ${
                                product.stock === 0
                                  ? "text-red-600"
                                  : isLowStock
                                  ? "text-amber-600"
                                  : "text-slate-900"
                              }`}
                            >
                              {product.stock} {product.unit}
                            </span>
                            {isLowStock && (
                              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                product.stock === 0 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"
                              }`}>
                                {product.stock === 0 ? "Out of Stock" : "Low Stock"}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* SKU/Barcode */}
                        <td className="px-6 py-3.5 font-mono text-xs text-slate-500">
                          {product.barcode || "—"}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-3.5">
                          <button
                            onClick={() => toggleProductStatus(product)}
                            className="text-slate-400 hover:text-slate-600 focus:outline-none border-0 bg-transparent p-0 cursor-pointer flex items-center"
                          >
                            {product.status === "Active" ? (
                              <ToggleRight className="h-8 w-8 text-saffron" />
                            ) : (
                              <ToggleLeft className="h-8 w-8 text-slate-300" />
                            )}
                            <span className="text-xs ml-2 text-slate-500 font-medium">{product.status}</span>
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-3.5 text-right space-x-2">
                          <button
                            onClick={() => openStockDialog(product)}
                            title="Update Stock"
                            className="p-1.5 text-saffron hover:text-saffron-hover hover:bg-saffron/10 rounded-md border-0 bg-transparent cursor-pointer transition-colors"
                          >
                            <Package className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditProduct(product)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md border-0 bg-transparent cursor-pointer transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeletingProductId(product.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md border-0 bg-transparent cursor-pointer transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. PRODUCT ADD / EDIT DRAWER SHEET */}
      {showProductSheet && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowProductSheet(false)}></div>

          {/* Drawer Panel */}
          <div className="bg-white h-full w-full max-w-md shadow-2xl relative z-10 flex flex-col justify-between border-l border-slate-200 animate-slide-in">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingProduct ? "Edit Product" : "Add Product"}
                </h3>
                <p className="text-xs text-slate-400">Fill in the product profile for catalog listing.</p>
              </div>
              <button
                onClick={() => setShowProductSheet(false)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 border-0 bg-transparent cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleProductSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Basmati Rice 5kg"
                  className="block w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Category</label>
                {categories.length === 0 ? (
                  <p className="text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    No categories available. Please create a category first under Menu Management page or add categories.
                  </p>
                ) : (
                  <select
                    required
                    className="block w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                    value={productCategoryId}
                    onChange={(e) => setProductCategoryId(e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Price & Unit Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    className="block w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                  />
                </div>

                {/* Unit selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Quantity Unit</label>
                  <select
                    required
                    className="block w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                    value={productUnit}
                    onChange={(e) => setProductUnit(e.target.value as any)}
                  >
                    <option value="pcs">Pcs (pieces)</option>
                    <option value="kg">Kg (kilogram)</option>
                    <option value="ltr">Ltr (liter)</option>
                  </select>
                </div>
              </div>

              {/* Stock count & Barcode */}
              <div className="grid grid-cols-2 gap-4">
                {/* Stock */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Initial Stock</label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    className="block w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                    value={productStock}
                    onChange={(e) => setProductStock(e.target.value)}
                  />
                </div>

                {/* Barcode SKU */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Barcode / SKU (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. 8901058002315"
                    className="block w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                    value={productBarcode}
                    onChange={(e) => setProductBarcode(e.target.value)}
                  />
                </div>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Product Image</label>
                <div className="flex gap-4 items-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageChange}
                  />

                  {imagePreview ? (
                    <div className="relative h-20 w-20 rounded-xl border border-slate-200 overflow-hidden shadow-sm shrink-0">
                      <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview("");
                          setProductImageUrl("");
                        }}
                        className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white hover:bg-black border-0 cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-20 w-20 rounded-xl border border-dashed border-slate-300 hover:border-saffron text-slate-400 hover:text-saffron bg-slate-50/50 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
                    >
                      <Upload className="h-5 w-5" />
                      <span className="text-[9px] font-bold uppercase">Upload</span>
                    </button>
                  )}

                  <div className="text-xs text-slate-400 leading-relaxed">
                    <p className="font-semibold text-slate-500">Cloudinary Upload</p>
                    <p>Formats: JPG, PNG, WEBP. Max size 5MB.</p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Catalog Status</label>
                <button
                  type="button"
                  onClick={() => setProductStatus(productStatus === "Active" ? "Inactive" : "Active")}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none border-0 bg-transparent p-0 cursor-pointer flex items-center"
                >
                  {productStatus === "Active" ? (
                    <ToggleRight className="h-8 w-8 text-saffron" />
                  ) : (
                    <ToggleLeft className="h-8 w-8 text-slate-300" />
                  )}
                  <span className="text-xs ml-2 text-slate-600 font-semibold uppercase tracking-wide">
                    {productStatus}
                  </span>
                </button>
              </div>
            </form>

            {/* Footer Buttons */}
            <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowProductSheet(false)}
                disabled={submitLoading}
                className="w-1/3 py-3 border border-slate-200 rounded-lg text-slate-600 font-semibold text-sm hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProductSubmit}
                disabled={submitLoading || categories.length === 0 || !productName || !productPrice || !productStock}
                className="w-2/3 py-3 bg-saffron text-white rounded-lg font-semibold text-sm hover:bg-saffron-hover shadow-lg shadow-saffron/20 border-0 cursor-pointer flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadProgress ? "Uploading image..." : "Saving..."}
                  </>
                ) : (
                  "Save Product"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. DELETE CONFIRMATION DIALOG */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeletingProductId(null)}></div>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative z-10 border border-slate-100 mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Product Listing?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to delete this product listing from the retail inventory? This action is permanent.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeletingProductId(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProductDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 shadow-md shadow-red-600/10 border-0 cursor-pointer"
              >
                Delete Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. INDIVIDUAL STOCK UPDATE DIALOG */}
      {stockDialogOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setStockDialogOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm relative z-10 border border-slate-100 mx-4 overflow-hidden animate-slide-in">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-saffron/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-saffron/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-saffron" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Update Stock</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{selectedProduct.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setStockDialogOpen(false)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 border-0 bg-transparent cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Current Stock Display */}
              <div className="bg-slate-50 rounded-xl p-3.5 flex items-center justify-between border border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Current Stock</span>
                <span className={`text-lg font-extrabold ${selectedProduct.stock < 10 ? "text-amber-600" : "text-slate-900"}`}>
                  {selectedProduct.stock} {selectedProduct.unit}
                </span>
              </div>

              {/* Mode Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStockMode("add")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold border-0 cursor-pointer transition-all duration-200 ${
                    stockMode === "add"
                      ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  + Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => setStockMode("set")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold border-0 cursor-pointer transition-all duration-200 ${
                    stockMode === "set"
                      ? "bg-sky-500 text-white shadow-md shadow-sky-500/20"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  = Set Stock
                </button>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">
                  {stockMode === "add" ? "Add quantity" : "Set exact quantity"}
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  autoFocus
                  className="block w-full border border-slate-200 rounded-lg px-3.5 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                  value={stockInput}
                  onChange={(e) => setStockInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleStockConfirm(); }}
                />
              </div>

              {/* Preview */}
              {stockInput && Number(stockInput) >= 0 && (
                <div className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-100">
                  <span className="text-xs text-slate-400">New stock will be: </span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {stockMode === "add" ? selectedProduct.stock + Number(stockInput) : Number(stockInput)} {selectedProduct.unit}
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 flex gap-3 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setStockDialogOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStockConfirm}
                disabled={!stockInput || Number(stockInput) < 0}
                className="flex-1 py-2.5 bg-saffron text-white rounded-lg text-sm font-bold hover:bg-saffron-hover shadow-md shadow-saffron/20 border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Confirm Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. BULK STOCK UPDATE DIALOG */}
      {bulkDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBulkDialogOpen(false)}></div>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl relative z-10 border border-slate-100 mx-4 overflow-hidden animate-slide-in flex flex-col" style={{ maxHeight: "85vh" }}>
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-saffron/5 to-transparent shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-saffron/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-saffron" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Bulk Stock Update</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Update stock levels for multiple products at once</p>
                  </div>
                </div>
                <button
                  onClick={() => setBulkDialogOpen(false)}
                  className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 border-0 bg-transparent cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Product List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {products.map((product) => {
                const change = bulkChanges[product.id] || { mode: "add", value: "" };
                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-white transition-colors"
                  >
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                      <p className={`text-xs font-semibold mt-0.5 ${product.stock < 10 ? "text-amber-600" : "text-slate-400"}`}>
                        Current: {product.stock} {product.unit}
                        {product.stock < 10 && " ⚠️"}
                      </p>
                    </div>

                    {/* Mode Toggle */}
                    <button
                      type="button"
                      onClick={() => {
                        setBulkChanges((prev) => ({
                          ...prev,
                          [product.id]: {
                            ...prev[product.id],
                            mode: prev[product.id]?.mode === "add" ? "set" : "add"
                          }
                        }));
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider border-0 cursor-pointer transition-all duration-200 shrink-0 ${
                        change.mode === "add"
                          ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                      }`}
                    >
                      {change.mode === "add" ? "+ Add" : "= Set"}
                    </button>

                    {/* Quantity Input */}
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="w-20 border border-slate-200 rounded-lg px-2.5 py-2 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                      value={change.value}
                      onChange={(e) => {
                        setBulkChanges((prev) => ({
                          ...prev,
                          [product.id]: {
                            ...prev[product.id],
                            value: e.target.value
                          }
                        }));
                      }}
                    />

                    {/* Preview */}
                    {change.value && Number(change.value) >= 0 && (
                      <span className="text-xs font-bold text-slate-500 shrink-0 w-16 text-right">
                        → {change.mode === "add" ? product.stock + Number(change.value) : Number(change.value)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 flex gap-3 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => setBulkDialogOpen(false)}
                className="flex-1 py-2.5 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setBulkConfirmOpen(true)}
                disabled={!Object.values(bulkChanges).some((c) => c.value && Number(c.value) >= 0)}
                className="flex-1 py-2.5 bg-saffron text-white rounded-lg text-sm font-bold hover:bg-saffron-hover shadow-md shadow-saffron/20 border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Update All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. BULK CONFIRM DIALOG */}
      {bulkConfirmOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setBulkConfirmOpen(false)}></div>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative z-10 border border-slate-100 mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Confirm Bulk Update?</h3>
            <p className="text-sm text-slate-500 mb-6">
              This will update stock levels for {Object.values(bulkChanges).filter((c) => c.value && Number(c.value) >= 0).length} product(s). This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setBulkConfirmOpen(false)}
                disabled={bulkSaving}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkUpdate}
                disabled={bulkSaving}
                className="px-4 py-2 bg-saffron text-white rounded-lg text-sm font-bold hover:bg-saffron-hover shadow-md shadow-saffron/20 border-0 cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bulkSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Confirm Update"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. FLOATING TOAST NOTIFICATION */}
      {toastNotif && (
        <div
          className={`fixed bottom-6 right-6 z-[70] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-white animate-slide-in transition-all duration-300 ${
            toastNotif.type === "success"
              ? "bg-slate-900/95 border-emerald-500/30 shadow-emerald-500/5"
              : "bg-red-950/95 border-red-500/30 shadow-red-500/5"
          }`}
        >
          {toastNotif.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-red-400 shrink-0" />
          )}
          <span className="text-xs font-bold tracking-wide">{toastNotif.message}</span>
        </div>
      )}
    </SidebarLayout>
  );
};
