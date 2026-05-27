import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { logoutUser } from "../lib/auth";

export interface BusinessDetails {
  name: string;
  ownerName: string;
  phone: string;
  city: string;
  type: "restaurant" | "retail";
  plan: string;
  createdAt: any;
}

interface AuthContextType {
  user: User | null;
  business: BusinessDetails | null;
  loading: boolean;
  refreshBusiness: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<BusinessDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchBusiness = async (uid: string) => {
    try {
      const docRef = doc(db, "businesses", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setBusiness(docSnap.data() as BusinessDetails);
      } else {
        setBusiness(null);
      }
    } catch (error) {
      console.error("Error fetching business:", error);
      setBusiness(null);
    }
  };

  const refreshBusiness = async () => {
    if (user) {
      await fetchBusiness(user.uid);
    }
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
    setBusiness(null);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchBusiness(currentUser.uid);
      } else {
        setBusiness(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, business, loading, refreshBusiness, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
