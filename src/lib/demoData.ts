import { collection, addDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface DemoCategory {
  name: string;
  sortOrder: number;
}

export interface DemoMenuItem {
  name: string;
  categoryName: string;
  price: number;
  type: "Veg" | "Non-Veg";
  status: "Available" | "Unavailable";
  description: string;
}

export interface DemoTable {
  tableNumber: string;
  capacity: number;
  section: "Main Hall" | "Outdoor" | "VIP";
  status: "Available" | "Occupied" | "Reserved";
}

export interface DemoProduct {
  name: string;
  categoryName: string;
  price: number;
  stock: number;
  unit: "pcs" | "kg" | "ltr";
  barcode: string;
  status: "Active" | "Inactive";
}

export interface DemoCustomer {
  name: string;
  phone: string;
  city: string;
}

// 1. Seed Restaurant Mode
export const seedRestaurantData = async (userId: string) => {
  // A. Categories
  const categories: DemoCategory[] = [
    { name: "Starters", sortOrder: 1 },
    { name: "Main Course", sortOrder: 2 },
    { name: "Beverages", sortOrder: 3 },
    { name: "Desserts", sortOrder: 4 }
  ];

  const categoryIds: { [key: string]: string } = {};
  const categoriesRef = collection(db, "businesses", userId, "menuCategories");

  for (const cat of categories) {
    const docRef = await addDoc(categoriesRef, cat);
    categoryIds[cat.name] = docRef.id;
  }

  // B. Menu Items
  const menuItems: DemoMenuItem[] = [
    { name: "Paneer Tikka", categoryName: "Starters", price: 280, type: "Veg", status: "Available", description: "Succulent paneer chunks marinated in spices and cooked in tandoor." },
    { name: "Chicken Wings", categoryName: "Starters", price: 320, type: "Non-Veg", status: "Available", description: "Crispy grilled chicken wings coated in spicy glaze." },
    { name: "Dal Makhani", categoryName: "Main Course", price: 220, type: "Veg", status: "Available", description: "Rich, creamy black lentils slow-cooked overnight with butter." },
    { name: "Butter Chicken", categoryName: "Main Course", price: 350, type: "Non-Veg", status: "Available", description: "Tender tandoori chicken simmered in spiced tomato and butter gravy." },
    { name: "Garlic Naan", categoryName: "Main Course", price: 60, type: "Veg", status: "Available", description: "Soft clay-oven flatbread flavored with minced garlic." },
    { name: "Mango Lassi", categoryName: "Beverages", price: 120, type: "Veg", status: "Available", description: "Creamy yogurt drink blended with fresh sweet mangoes." },
    { name: "Cold Coffee", categoryName: "Beverages", price: 150, type: "Veg", status: "Available", description: "Classic chilled coffee shake with cream and milk." },
    { name: "Gulab Jamun", categoryName: "Desserts", price: 90, type: "Veg", status: "Available", description: "Deep-fried milk dumplings soaked in warm sugar syrup." },
    { name: "Brownie", categoryName: "Desserts", price: 160, type: "Veg", status: "Available", description: "Fudgy chocolate brownie loaded with walnuts." }
  ];

  const itemRefs: any[] = [];
  const itemsRef = collection(db, "businesses", userId, "menuItems");

  for (const item of menuItems) {
    const { categoryName, ...rest } = item;
    const docData = {
      ...rest,
      categoryId: categoryIds[categoryName],
      createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(itemsRef, docData);
    itemRefs.push({ id: docRef.id, ...docData });
  }

  // C. Tables
  const tables: DemoTable[] = [
    { tableNumber: "1", capacity: 4, section: "Main Hall", status: "Available" },
    { tableNumber: "2", capacity: 4, section: "Main Hall", status: "Available" },
    { tableNumber: "3", capacity: 6, section: "Main Hall", status: "Available" },
    { tableNumber: "4", capacity: 2, section: "Outdoor", status: "Available" },
    { tableNumber: "5", capacity: 2, section: "Outdoor", status: "Available" },
    { tableNumber: "VIP 1", capacity: 8, section: "VIP", status: "Available" }
  ];

  const tablesRef = collection(db, "businesses", userId, "tables");
  for (const t of tables) {
    await addDoc(tablesRef, {
      ...t,
      currentOrderAmount: 0,
      activeOrderItems: []
    });
  }

  // D. Sample completed orders (last 7 days)
  const ordersRef = collection(db, "businesses", userId, "orders");
  const paymentMethods = ["Cash", "UPI", "Card"];

  for (let i = 0; i < 5; i++) {
    let orderItems: any[] = [];
    let subtotal = 0;
    
    // Choose random items until subtotal is between ₹280 and ₹1400 (so grand total is ₹300 - ₹1500)
    // We shuffle the menu items and pick items
    const shuffledItems = [...itemRefs].sort(() => 0.5 - Math.random());
    const itemCount = Math.floor(Math.random() * 2) + 2; // 2 to 3 distinct items

    for (let j = 0; j < Math.min(itemCount, shuffledItems.length); j++) {
      const item = shuffledItems[j];
      const qty = Math.floor(Math.random() * 2) + 1; // 1 or 2
      orderItems.push({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: qty
      });
      subtotal += item.price * qty;
    }

    // Force total within range if needed
    if (subtotal < 285) {
      // Add one more starter or main course
      const extraItem = itemRefs.find(x => x.price >= 150) || itemRefs[0];
      orderItems.push({
        id: extraItem.id,
        name: extraItem.name,
        price: extraItem.price,
        qty: 1
      });
      subtotal += extraItem.price;
    } else if (subtotal > 1425) {
      // Scale down quantities to bring in range
      orderItems = orderItems.map(item => ({ ...item, qty: 1 }));
      subtotal = orderItems.reduce((acc, item) => acc + item.price, 0);
    }

    const tax = subtotal * 0.05; // 5% Food Tax
    const grandTotal = subtotal + tax;
    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const randomTable = tables[Math.floor(Math.random() * tables.length)].tableNumber;

    const orderDate = new Date();
    // Random days offset (0 to 6 days ago)
    orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 7));
    orderDate.setHours(Math.floor(Math.random() * 12) + 10, Math.floor(Math.random() * 60)); // Between 10 AM and 10 PM

    await addDoc(ordersRef, {
      tableNumber: randomTable,
      items: orderItems,
      subtotal,
      tax,
      grandTotal,
      paymentMethod,
      createdAt: orderDate.toISOString()
    });
  }
};

// 2. Seed Retail Mode
export const seedRetailData = async (userId: string) => {
  // A. Categories
  const categories: DemoCategory[] = [
    { name: "Grocery", sortOrder: 1 },
    { name: "Medical", sortOrder: 2 },
    { name: "Other", sortOrder: 3 }
  ];

  const categoryIds: { [key: string]: string } = {};
  const categoriesRef = collection(db, "businesses", userId, "menuCategories");

  for (const cat of categories) {
    const docRef = await addDoc(categoriesRef, cat);
    categoryIds[cat.name] = docRef.id;
  }

  // B. Products
  const products: DemoProduct[] = [
    { name: "Basmati Rice 5kg", categoryName: "Grocery", price: 450, stock: 50, unit: "pcs", barcode: "8901725181224", status: "Active" },
    { name: "Tata Salt 1kg", categoryName: "Grocery", price: 28, stock: 8, unit: "pcs", barcode: "8901058002315", status: "Active" },
    { name: "Amul Butter 500g", categoryName: "Grocery", price: 280, stock: 5, unit: "pcs", barcode: "8901262010049", status: "Active" },
    { name: "Surf Excel 1kg", categoryName: "Grocery", price: 220, stock: 30, unit: "pcs", barcode: "8901030753082", status: "Active" },
    { name: "Colgate Toothpaste", categoryName: "Medical", price: 95, stock: 15, unit: "pcs", barcode: "8901123004564", status: "Active" },
    { name: "Dettol Soap", categoryName: "Medical", price: 65, stock: 3, unit: "pcs", barcode: "8901396324208", status: "Active" },
    { name: "Notebook A4", categoryName: "Other", price: 120, stock: 25, unit: "pcs", barcode: "8904039702206", status: "Active" },
    { name: "Ball Pen Pack", categoryName: "Other", price: 45, stock: 7, unit: "pcs", barcode: "8902517009988", status: "Active" }
  ];

  const productRefs: any[] = [];
  const productsRef = collection(db, "businesses", userId, "products");

  for (const p of products) {
    const { categoryName, ...rest } = p;
    const docData = {
      ...rest,
      categoryId: categoryIds[categoryName],
      createdAt: new Date().toISOString()
    };
    const docRef = await addDoc(productsRef, docData);
    productRefs.push({ id: docRef.id, ...docData });
  }

  // C. Customers
  const customers: DemoCustomer[] = [
    { name: "Rajesh Patel", phone: "9876543210", city: "Ahmedabad" },
    { name: "Priya Shah", phone: "9765432109", city: "Surat" },
    { name: "Amit Mehta", phone: "9654321098", city: "Vadodara" },
    { name: "Neha Joshi", phone: "9543210987", city: "Rajkot" },
    { name: "Vikram Desai", phone: "9432109876", city: "Gandhinagar" }
  ];

  const customersRef = collection(db, "businesses", userId, "customers");
  for (const cust of customers) {
    await addDoc(customersRef, {
      ...cust,
      createdAt: new Date().toISOString()
    });
  }

  // D. Sample completed orders (last 7 days)
  const ordersRef = collection(db, "businesses", userId, "orders");
  const paymentMethods = ["Cash", "UPI", "Card"];

  for (let i = 0; i < 8; i++) {
    let orderItems: any[] = [];
    let subtotal = 0;

    const shuffledProds = [...productRefs].sort(() => 0.5 - Math.random());
    const itemCount = Math.floor(Math.random() * 2) + 2; // 2 to 3 distinct items

    for (let j = 0; j < Math.min(itemCount, shuffledProds.length); j++) {
      const prod = shuffledProds[j];
      const qty = Math.floor(Math.random() * 2) + 1; // 1 or 2
      orderItems.push({
        id: prod.id,
        name: prod.name,
        price: prod.price,
        qty: qty,
        unit: prod.unit
      });
      subtotal += prod.price * qty;
    }

    const discount = Math.random() > 0.5 ? Math.floor(Math.random() * 3) * 10 : 0; // Flat discount
    const discountedSubtotal = Math.max(0, subtotal - discount);
    const tax = discountedSubtotal * 0.18; // 18% Retail GST
    const grandTotal = discountedSubtotal + tax;

    const paymentMethod = paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
    const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
    
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - Math.floor(Math.random() * 7));
    orderDate.setHours(Math.floor(Math.random() * 12) + 10, Math.floor(Math.random() * 60));

    await addDoc(ordersRef, {
      orderId: `SALE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerName: randomCustomer.name,
      customerPhone: randomCustomer.phone,
      items: orderItems,
      subtotal,
      discount,
      tax,
      grandTotal,
      paymentMethod,
      createdAt: orderDate.toISOString()
    });
  }
};
