import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { SidebarLayout } from "../components/Sidebar";
import {
  Plus,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Upload,
  X,
  PlusCircle
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  type: "Veg" | "Non-Veg";
  description?: string;
  imageUrl?: string;
  status: "Available" | "Unavailable";
  createdAt: any;
}

export const Menu: React.FC = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  // Category Modal States
  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState<string>("");
  const [categorySortOrder, setCategorySortOrder] = useState<number>(0);
  const [categorySubmitLoading, setCategorySubmitLoading] = useState<boolean>(false);

  // Item Sheet States
  const [showItemSheet, setShowItemSheet] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemName, setItemName] = useState<string>("");
  const [itemCategoryId, setItemCategoryId] = useState<string>("");
  const [itemPrice, setItemPrice] = useState<string>("");
  const [itemType, setItemType] = useState<"Veg" | "Non-Veg">("Veg");
  const [itemDescription, setItemDescription] = useState<string>("");
  const [itemImageUrl, setItemImageUrl] = useState<string>("");
  const [itemStatus, setItemStatus] = useState<"Available" | "Unavailable">("Available");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<boolean>(false);
  const [itemSubmitLoading, setItemSubmitLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmations
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  // 1. Fetch Categories & Items
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const categoriesQuery = query(
      collection(db, "businesses", user.uid, "menuCategories"),
      orderBy("sortOrder", "asc")
    );

    const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
      const catsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Category[];
      setCategories(catsList);

      if (catsList.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(catsList[0].id);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError(`Failed to fetch menu categories: ${err.message || err}`);
      setLoading(false);
    });

    const itemsQuery = query(
      collection(db, "businesses", user.uid, "menuItems")
    );

    const unsubscribeItems = onSnapshot(itemsQuery, (snapshot) => {
      const itemsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as MenuItem[];
      setItems(itemsList);
    }, (err) => {
      console.error(err);
      setError(`Failed to fetch menu items: ${err.message || err}`);
    });

    return () => {
      unsubscribeCategories();
      unsubscribeItems();
    };
  }, [user]);

  // Set default category in Sheet
  useEffect(() => {
    if (selectedCategoryId) {
      setItemCategoryId(selectedCategoryId);
    }
  }, [selectedCategoryId]);

  // Helper: Upload Image to Cloudinary
  const uploadImage = async (file: File): Promise<string> => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("Cloudinary environment keys are not configured.");
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
      console.error("Cloudinary error response:", errRes);
      throw new Error("Failed to upload image. Please try again.");
    }

    const data = await response.json();
    return data.secure_url;
  };

  // 2. Add / Edit Category Submit
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName) return;
    if (!user) return;

    setCategorySubmitLoading(true);
    try {
      if (editingCategory) {
        const catRef = doc(db, "businesses", user.uid, "menuCategories", editingCategory.id);
        await updateDoc(catRef, {
          name: categoryName,
          sortOrder: Number(categorySortOrder)
        });
      } else {
        const catsRef = collection(db, "businesses", user.uid, "menuCategories");
        await addDoc(catsRef, {
          name: categoryName,
          sortOrder: Number(categorySortOrder)
        });
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      setCategoryName("");
      setCategorySortOrder(0);
    } catch (err: any) {
      console.error(err);
      setError("Failed to save category. Please check your rules.");
    } finally {
      setCategorySubmitLoading(false);
    }
  };

  // 3. Delete Category Submit
  const handleCategoryDelete = async () => {
    if (!deletingCategoryId || !user) return;

    // Check if category contains items
    const hasItems = items.some((item) => item.categoryId === deletingCategoryId);
    if (hasItems) {
      alert("Cannot delete category containing menu items. Please remove or reassign the items first.");
      setDeletingCategoryId(null);
      return;
    }

    try {
      const catRef = doc(db, "businesses", user.uid, "menuCategories", deletingCategoryId);
      await deleteDoc(catRef);

      // If active category was deleted, select another one
      if (selectedCategoryId === deletingCategoryId) {
        const remaining = categories.filter((c) => c.id !== deletingCategoryId);
        setSelectedCategoryId(remaining.length > 0 ? remaining[0].id : "");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete category.");
    } finally {
      setDeletingCategoryId(null);
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

  // 5. Add / Edit Item Submit
  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !itemCategoryId || !itemPrice) return;
    if (!user) return;

    setItemSubmitLoading(true);
    let finalImageUrl = itemImageUrl;

    try {
      // 1. Upload image to Cloudinary if new file selected
      if (imageFile) {
        setUploadProgress(true);
        finalImageUrl = await uploadImage(imageFile);
        setUploadProgress(false);
      }

      // 2. Submit data to Firestore
      const itemData = {
        categoryId: itemCategoryId,
        name: itemName,
        price: Number(itemPrice),
        type: itemType,
        description: itemDescription,
        imageUrl: finalImageUrl,
        status: itemStatus,
        createdAt: new Date().toISOString()
      };

      if (editingItem) {
        const itemRef = doc(db, "businesses", user.uid, "menuItems", editingItem.id);
        await updateDoc(itemRef, itemData);
      } else {
        const itemsRef = collection(db, "businesses", user.uid, "menuItems");
        await addDoc(itemsRef, itemData);
      }

      // Reset states and close sheet
      setShowItemSheet(false);
      setEditingItem(null);
      setItemName("");
      setItemPrice("");
      setItemType("Veg");
      setItemDescription("");
      setItemImageUrl("");
      setImageFile(null);
      setImagePreview("");
      setItemStatus("Available");
    } catch (err: any) {
      console.error(err);
      setError(`Failed to save item: ${err.message || err}`);
    } finally {
      setItemSubmitLoading(false);
    }
  };

  // 6. Delete Item Submit
  const handleItemDelete = async () => {
    if (!deletingItemId || !user) return;
    try {
      const itemRef = doc(db, "businesses", user.uid, "menuItems", deletingItemId);
      await deleteDoc(itemRef);
    } catch (err) {
      console.error(err);
      alert("Failed to delete menu item.");
    } finally {
      setDeletingItemId(null);
    }
  };

  // 7. Quick toggle Available status directly from table row
  const toggleItemStatus = async (item: MenuItem) => {
    if (!user) return;
    const newStatus = item.status === "Available" ? "Unavailable" : "Available";
    try {
      const itemRef = doc(db, "businesses", user.uid, "menuItems", item.id);
      await updateDoc(itemRef, { status: newStatus });
    } catch (err) {
      console.error(err);
      alert("Failed to update status.");
    }
  };

  // Helpers to trigger Add/Edit states
  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategorySortOrder(categories.length + 1);
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategorySortOrder(cat.sortOrder);
    setShowCategoryModal(true);
  };

  const openAddItem = () => {
    setEditingItem(null);
    setItemName("");
    setItemCategoryId(selectedCategoryId || (categories.length > 0 ? categories[0].id : ""));
    setItemPrice("");
    setItemType("Veg");
    setItemDescription("");
    setItemImageUrl("");
    setImageFile(null);
    setImagePreview("");
    setItemStatus("Available");
    setShowItemSheet(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCategoryId(item.categoryId);
    setItemPrice(item.price.toString());
    setItemType(item.type);
    setItemDescription(item.description || "");
    setItemImageUrl(item.imageUrl || "");
    setImageFile(null);
    setImagePreview(item.imageUrl || "");
    setItemStatus(item.status);
    setShowItemSheet(true);
  };

  // Filter items based on active tab category
  const filteredItems = items.filter((item) => item.categoryId === selectedCategoryId);

  return (
    <SidebarLayout>
      <div className="space-y-6">
        {/* Error Warning Banner */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError("")} className="ml-auto text-xs font-bold text-red-500 hover:text-red-700 border-0 cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* 1. Header Row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Menu Management</h2>
            <p className="text-xs text-slate-400 mt-1">Add categories and list dishes on your digital menu card.</p>
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={openAddCategory}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              Add Category
            </button>

            <button
              onClick={openAddItem}
              disabled={categories.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-saffron-hover shadow-md shadow-saffron/15 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-0"
            >
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>
        </div>

        {/* 2. Loading State */}
        {loading ? (
          <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-saffron" />
              <p className="text-slate-400 text-sm font-medium">Loading menu catalog...</p>
            </div>
          </div>
        ) : categories.length === 0 ? (
          /* Empty Categories State */
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
            <div className="h-16 w-16 bg-saffron/10 text-saffron rounded-full flex items-center justify-center mx-auto mb-4">
              <PlusCircle className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No categories created yet</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
              Categories help organize your menu items (e.g. Starters, Main Course, Drinks) for fast checkout and billing.
            </p>
            <button
              onClick={openAddCategory}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-saffron-hover shadow-lg shadow-saffron/20 border-0 cursor-pointer transition-all"
            >
              Add Your First Category
            </button>
          </div>
        ) : (
          /* Main Menu Panel Grid */
          <div className="space-y-4">
            {/* Category horizontal tabs bar */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 max-w-full">
                {categories.map((cat) => {
                  const isActive = selectedCategoryId === cat.id;
                  return (
                    <div
                      key={cat.id}
                      className={`flex items-center gap-1.5 shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all border cursor-pointer ${
                        isActive
                          ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                          : "bg-slate-50 border-slate-100 hover:bg-slate-100 text-slate-600"
                      }`}
                      onClick={() => setSelectedCategoryId(cat.id)}
                    >
                      <span>{cat.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditCategory(cat);
                        }}
                        className={`p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white border-0 cursor-pointer ${
                          isActive ? "text-slate-400" : "text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                        }`}
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingCategoryId(cat.id);
                        }}
                        className={`p-0.5 rounded hover:bg-red-500 hover:text-white border-0 cursor-pointer text-slate-400 ${
                          isActive ? "text-slate-400" : "text-slate-400 hover:bg-red-50"
                        }`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Items Table container */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {filteredItems.length === 0 ? (
                /* Empty Category Items State */
                <div className="p-16 text-center">
                  <div className="h-14 w-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-base">No items in this category</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    Fill this category with your dishes, beverages, and desserts.
                  </p>
                  <button
                    onClick={openAddItem}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-saffron text-white rounded-lg text-xs font-semibold hover:bg-saffron-hover shadow-md shadow-saffron/10 border-0 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </button>
                </div>
              ) : (
                /* Items Data Table */
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="px-6 py-4">Image</th>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Price</th>
                        <th className="px-6 py-4">Type</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {filteredItems.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          {/* Image */}
                          <td className="px-6 py-3.5">
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-10 w-10 object-cover rounded-lg border border-slate-100 shadow-sm"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
                                <ImageIcon className="h-4 w-4" />
                              </div>
                            )}
                          </td>

                          {/* Name / Description */}
                          <td className="px-6 py-3.5 max-w-xs">
                            <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                            {item.description && (
                              <div className="text-xs text-slate-400 truncate mt-0.5">{item.description}</div>
                            )}
                          </td>

                          {/* Price */}
                          <td className="px-6 py-3.5 font-bold text-slate-900">
                            ₹{item.price.toFixed(2)}
                          </td>

                          {/* Type (Veg/Non-Veg indicator) */}
                          <td className="px-6 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                item.type === "Veg"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              <span
                                className={`h-2 w-2 rounded-full ${
                                  item.type === "Veg" ? "bg-emerald-500" : "bg-red-500"
                                }`}
                              ></span>
                              {item.type}
                            </span>
                          </td>

                          {/* Status: Available Toggle Switch */}
                          <td className="px-6 py-3.5">
                            <button
                              onClick={() => toggleItemStatus(item)}
                              className="text-slate-400 hover:text-slate-600 focus:outline-none border-0 bg-transparent p-0 cursor-pointer flex items-center"
                            >
                              {item.status === "Available" ? (
                                <ToggleRight className="h-8 w-8 text-saffron" />
                              ) : (
                                <ToggleLeft className="h-8 w-8 text-slate-300" />
                              )}
                              <span className="text-xs ml-2 text-slate-500 font-medium">{item.status}</span>
                            </button>
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-3.5 text-right space-x-2">
                            <button
                              onClick={() => openEditItem(item)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md border-0 bg-transparent cursor-pointer transition-colors"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingItemId(item.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md border-0 bg-transparent cursor-pointer transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 3. CATEGORY MODAL DIALOG */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCategoryModal(false)}></div>

          {/* Modal Container */}
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative z-10 border border-slate-100 mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {editingCategory ? "Edit Category" : "Add Menu Category"}
            </h3>

            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Starters"
                  className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Sort Order</label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  className="block w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                  value={categorySortOrder}
                  onChange={(e) => setCategorySortOrder(Number(e.target.value))}
                />
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  disabled={categorySubmitLoading}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={categorySubmitLoading || !categoryName}
                  className="px-4 py-2 bg-saffron text-white rounded-lg text-sm font-semibold hover:bg-saffron-hover shadow-md shadow-saffron/10 border-0 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {categorySubmitLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Category"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MENU ITEM DRAWER SHEET (Right side panel overlay) */}
      {showItemSheet && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowItemSheet(false)}></div>

          {/* Drawer Panel */}
          <div className="bg-white h-full w-full max-w-md shadow-2xl relative z-10 flex flex-col justify-between border-l border-slate-200 animate-slide-in">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {editingItem ? "Edit Menu Item" : "Add Menu Item"}
                </h3>
                <p className="text-xs text-slate-400">Fill in the item details to update the restaurant menu.</p>
              </div>
              <button
                onClick={() => setShowItemSheet(false)}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 border-0 bg-transparent cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Body Scroll */}
            <form onSubmit={handleItemSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Item Name */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Garlic Naan"
                  className="block w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                />
              </div>

              {/* Category selector */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Category</label>
                <select
                  required
                  className="block w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50"
                  value={itemCategoryId}
                  onChange={(e) => setItemCategoryId(e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Price & Type Grid */}
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
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value)}
                  />
                </div>

                {/* Type Selection Veg/Non-Veg */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Food Type</label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      className={`py-1.5 rounded-md text-xs font-bold transition-all border-0 cursor-pointer ${
                        itemType === "Veg" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500"
                      }`}
                      onClick={() => setItemType("Veg")}
                    >
                      Veg
                    </button>
                    <button
                      type="button"
                      className={`py-1.5 rounded-md text-xs font-bold transition-all border-0 cursor-pointer ${
                        itemType === "Non-Veg" ? "bg-white text-red-600 shadow-sm" : "text-slate-500"
                      }`}
                      onClick={() => setItemType("Non-Veg")}
                    >
                      Non-Veg
                    </button>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Brief details about ingredients, spice level..."
                  className="block w-full border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-saffron/20 focus:border-saffron text-slate-900 bg-slate-50/50 resize-none"
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                />
              </div>

              {/* Image Upload Input */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Dish Image</label>
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
                          setItemImageUrl("");
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
                    <p>Formats: JPG, PNG, WEBP. Maximum size 5MB.</p>
                  </div>
                </div>
              </div>

              {/* Status Select Toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Availability Status</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setItemStatus(itemStatus === "Available" ? "Unavailable" : "Available")}
                    className="text-slate-400 hover:text-slate-600 focus:outline-none border-0 bg-transparent p-0 cursor-pointer flex items-center"
                  >
                    {itemStatus === "Available" ? (
                      <ToggleRight className="h-8 w-8 text-saffron" />
                    ) : (
                      <ToggleLeft className="h-8 w-8 text-slate-300" />
                    )}
                    <span className="text-xs ml-2 text-slate-600 font-semibold uppercase tracking-wide">
                      {itemStatus}
                    </span>
                  </button>
                </div>
              </div>
            </form>

            {/* Drawer Footer Actions */}
            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => setShowItemSheet(false)}
                disabled={itemSubmitLoading}
                className="w-1/3 py-3 border border-slate-200 rounded-lg text-slate-600 font-semibold text-sm hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleItemSubmit}
                disabled={itemSubmitLoading || !itemName || !itemPrice}
                className="w-2/3 py-3 bg-saffron text-white rounded-lg font-semibold text-sm hover:bg-saffron-hover shadow-lg shadow-saffron/20 border-0 cursor-pointer flex justify-center items-center gap-2 disabled:opacity-50"
              >
                {itemSubmitLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {uploadProgress ? "Uploading image..." : "Saving dish..."}
                  </>
                ) : (
                  "Save Menu Item"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. DELETE CATEGORY CONFIRMATION DIALOG */}
      {deletingCategoryId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeletingCategoryId(null)}></div>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative z-10 border border-slate-100 mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Category?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to delete this category? This action is permanent. You cannot delete categories that contain dishes.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeletingCategoryId(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCategoryDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 shadow-md shadow-red-600/10 border-0 cursor-pointer"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 6. DELETE ITEM CONFIRMATION DIALOG */}
      {deletingItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeletingItemId(null)}></div>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative z-10 border border-slate-100 mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Menu Item?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to delete this dish from the menu? This action is permanent.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setDeletingItemId(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleItemDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 shadow-md shadow-red-600/10 border-0 cursor-pointer"
              >
                Delete Item
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarLayout>
  );
};
