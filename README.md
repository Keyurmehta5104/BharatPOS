# BhaaratPOS 🧾

A modern dual-mode Point of Sale (POS) system for 
Indian restaurants and retail shops. Built with 
React, TypeScript, Firebase, and Tailwind CSS.

![BharatPOS](https://img.shields.io/badge/BharatPOS-v1.0-orange)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange)
![License](https://img.shields.io/badge/License-MIT-green)

## 🌐 Live Demo
👉 [https://bhaaratpos.netlify.app](https://bhaaratpos.netlify.app)

> Use "Load Demo Data" button on dashboard to 
> populate sample data for testing.

---

## 🍽️ Restaurant Mode
- Menu management (categories + items with 
  Veg/Non-Veg indicators)
- Table management (Main Hall / Outdoor / VIP)
- Live order taking with cart
- Kitchen Order Ticket (KOT) system
- **Kitchen Display System (KDS)** — separate 
  screen for kitchen staff with PIN login
- Item-by-item cooking status tracking
- Real-time waiter notifications
- Bill generation with Cash/UPI/Card payment
- Orders history with expandable details

## 🛒 Retail Mode
- Product catalog with image upload (Cloudinary)
- Low stock alerts
- Quick billing POS screen (two-panel cashier)
- Customer management (loyalty tracking)
- Stock update + bulk stock update
- Sales history with date filters
- Receipt printing

## 📊 Both Modes
- Real-time dashboard metrics
- Reports with charts (Recharts)
- Sales trends, top items, payment breakdown
- Export data as CSV
- Demo data controls (Load / Clear / Export)
- Settings page with business profile

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | Firebase Authentication |
| Database | Firebase Firestore |
| Image Upload | Cloudinary |
| Charts | Recharts |
| Routing | React Router v6 |
| Deployment | Netlify |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Firebase account
- Cloudinary account

### Installation

```bash
# Clone the repo
git clone https://github.com/Keyurmehta5104/BharatPOS.git

# Install dependencies
cd BharatPOS
npm install

# Create .env file
cp .env.example .env
# Fill in your Firebase and Cloudinary keys

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with:

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
```

---

## 📱 Kitchen Display System

Kitchen staff can access a separate display at:
```
https://your-domain/kitchen/login
```
- Enter Business UID (from Settings page)
- Enter 4-digit PIN (default: 1234)
- Real-time order updates
- Item-by-item status tracking
- Works on tablets

---

## 📸 Screenshots

> Restaurant Dashboard — Table Management — 
> Kitchen Display — Retail POS Billing

---

## 🗂️ Project Structure

```
src/
  components/     → Sidebar, ProtectedRoute
  context/        → AuthContext
  lib/            → Firebase, Auth, Utils, DemoData
  pages/          → All page components
    Dashboard.tsx
    Tables.tsx
    Menu.tsx
    Orders.tsx
    KitchenDisplay.tsx
    KitchenLogin.tsx
    Billing.tsx
    Products.tsx
    Customers.tsx
    Reports.tsx
    Settings.tsx
```

---

## 👨‍💻 Developer

**Keyur Mehta**
- GitHub: [@Keyurmehta5104](https://github.com/Keyurmehta5104)
- Location: Rajkot, Gujarat, India

---

## 📄 License
MIT License — free to use and modify.
