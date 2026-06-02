import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

const SAVED_BRANDS_KEY = 'saved_brands_v1';

export interface Note {
  id: string;
  text: string;
  created_at: string;
}

export interface ProfileInput {
  full_name: string;
  profession: string;
  company_name: string;
  email: string;
  phone: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  activeExhibitionId: string | null;
  activeExhibitionName: string | null;
  setActiveExhibition: (id: string, name: string) => void;
  clearActiveExhibition: () => void;
  signOut: () => Promise<void>;
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  activateDemoExhibition: () => void;
  // Demo reset controls
  demoSavedReset: boolean;
  demoConnectionsReset: boolean;
  resetDemoSaved: () => void;
  resetDemoConnections: () => void;
  // Demo accumulated data
  demoSavedBrands: any[];
  addDemoSavedBrand: (brand: any) => void;
  demoAddedConnections: any[];
  addDemoConnection: (person: any) => void;
  demoRegisteredExhibitions: string[];
  addDemoRegistration: (exhibitionId: string) => void;
  // Wishlist
  demoWishlist: any[];
  demoWishlistedIds: string[];
  toggleWishlistItem: (item: { id: string; product_name: string; brand_name: string; brand_id: string; image_url: string; material?: string }) => void;
  // Notes (keyed by brand_id or connection_id)
  notes: Record<string, Note[]>;
  addNote: (entityId: string, text: string) => void;
  // Profile setup
  completeProfile: (input: ProfileInput) => void;
  setProfileComplete: () => void;
  showProfileNudge: boolean;
  dismissProfileNudge: () => void;
  // User update
  updateUser: (fields: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  activeExhibitionId: null,
  activeExhibitionName: null,
  setActiveExhibition: () => {},
  clearActiveExhibition: () => {},
  signOut: async () => {},
  isDemoMode: false,
  toggleDemoMode: () => {},
  activateDemoExhibition: () => {},
  demoSavedReset: false,
  demoConnectionsReset: false,
  resetDemoSaved: () => {},
  resetDemoConnections: () => {},
  demoSavedBrands: [],
  addDemoSavedBrand: () => {},
  demoAddedConnections: [],
  addDemoConnection: () => {},
  demoRegisteredExhibitions: [],
  addDemoRegistration: () => {},
  demoWishlist: [],
  demoWishlistedIds: [],
  toggleWishlistItem: () => {},
  notes: {},
  addNote: () => {},
  completeProfile: () => {},
  setProfileComplete: () => {},
  showProfileNudge: false,
  dismissProfileNudge: () => {},
  updateUser: () => {},
});

const MOCK_USER: User = {
  id: 'user-001',
  designup_user_id: 'demo_user',
  first_name: 'Demo',
  last_name: 'User',
  phone: '+919876543210',
  email: 'demo@designup.in',
  profession: 'Interior Designer',
  company_name: 'Studio Demo',
  designation: 'Principal Designer',
  city: 'Mumbai',
  country: 'India',
  profile_complete: false,
};

const DEMO_EXHIBITION = { id: 'exh-001', name: 'Index Mumbai 2025' };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(MOCK_USER);
  const [activeExhibitionId, setActiveExhibitionId] = useState<string | null>(null);
  const [activeExhibitionName, setActiveExhibitionName] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoSavedReset, setDemoSavedReset] = useState(false);
  const [demoConnectionsReset, setDemoConnectionsReset] = useState(false);
  const [demoSavedBrands, setDemoSavedBrands] = useState<any[]>([]);
  const [savedBrandsLoaded, setSavedBrandsLoaded] = useState(false);
  const [demoAddedConnections, setDemoAddedConnections] = useState<any[]>([]);
  const [demoRegisteredExhibitions, setDemoRegisteredExhibitions] = useState<string[]>([]);
  const [demoWishlist, setDemoWishlist] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [showProfileNudge, setShowProfileNudge] = useState(false);

  // Load persisted saved brands on mount
  useEffect(() => {
    AsyncStorage.getItem(SAVED_BRANDS_KEY).then((raw) => {
      if (raw) {
        try { setDemoSavedBrands(JSON.parse(raw)); } catch (_) {}
      }
      setSavedBrandsLoaded(true);
    });
  }, []);

  // Persist saved brands whenever they change (after initial load)
  useEffect(() => {
    if (!savedBrandsLoaded) return;
    AsyncStorage.setItem(SAVED_BRANDS_KEY, JSON.stringify(demoSavedBrands));
  }, [demoSavedBrands, savedBrandsLoaded]);

  const setActiveExhibition = (id: string, name: string) => {
    setActiveExhibitionId(id);
    setActiveExhibitionName(name);
  };

  const clearActiveExhibition = () => {
    setActiveExhibitionId(null);
    setActiveExhibitionName(null);
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (_) {
      // No active session in demo mode — ignore
    }
    const { router } = await import('expo-router');
    router.replace('/(auth)/welcome');
  };

  const toggleDemoMode = () => {
    // Do NOT clear scan data when toggling modes — user may have real QR scan data
    // that should persist. They can reset explicitly via the Reset buttons.
    setIsDemoMode((v) => !v);
  };

  // Simulates scanning entry QR — activates the demo exhibition
  const activateDemoExhibition = () => {
    setActiveExhibition(DEMO_EXHIBITION.id, DEMO_EXHIBITION.name);
  };

  const resetDemoSaved = () => {
    setDemoSavedReset(true);
    setDemoSavedBrands([]);
    AsyncStorage.removeItem(SAVED_BRANDS_KEY);
  };
  const resetDemoConnections = () => {
    setDemoConnectionsReset(true);
    setDemoAddedConnections([]);
  };

  const addDemoSavedBrand = (brand: any) => {
    setDemoSavedBrands((prev) => {
      if (prev.find((b) => b.brand_id === brand.brand_id)) return prev;
      return [...prev, brand];
    });
    setDemoSavedReset(false);
  };

  const addDemoConnection = (person: any) => {
    setDemoAddedConnections((prev) => {
      if (prev.find((p) => p.id === person.id)) return prev;
      return [...prev, person];
    });
    setDemoConnectionsReset(false);
  };

  const addDemoRegistration = (exhibitionId: string) => {
    setDemoRegisteredExhibitions((prev) =>
      prev.includes(exhibitionId) ? prev : [...prev, exhibitionId]
    );
  };

  const addNote = (entityId: string, text: string) => {
    const note: Note = { id: Date.now().toString(), text, created_at: new Date().toISOString() };
    setNotes((prev) => ({ ...prev, [entityId]: [note, ...(prev[entityId] ?? [])] }));
  };

  const updateUser = (fields: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...fields } : prev);
  };

  const completeProfile = (input: ProfileInput) => {
    const [first, ...rest] = input.full_name.trim().split(' ');
    setUser((prev) => prev ? {
      ...prev,
      first_name: first,
      last_name: rest.join(' '),
      profession: input.profession,
      company_name: input.company_name,
      email: input.email,
      phone: input.phone,
      profile_complete: true,
    } : prev);
    setShowProfileNudge(true);
  };

  const setProfileComplete = () => {
    setShowProfileNudge(false);
  };

  const dismissProfileNudge = () => {
    setShowProfileNudge(false);
  };

  const demoWishlistedIds = demoWishlist.map((w: any) => w.id);

  const toggleWishlistItem = (item: any) => {
    setDemoWishlist((prev) => {
      const exists = prev.find((w) => w.id === item.id);
      return exists ? prev.filter((w) => w.id !== item.id) : [...prev, item];
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading: false,
      activeExhibitionId,
      activeExhibitionName,
      setActiveExhibition,
      clearActiveExhibition,
      signOut,
      isDemoMode,
      toggleDemoMode,
      activateDemoExhibition,
      demoSavedReset,
      demoConnectionsReset,
      resetDemoSaved,
      resetDemoConnections,
      demoSavedBrands,
      addDemoSavedBrand,
      demoAddedConnections,
      addDemoConnection,
      demoRegisteredExhibitions,
      addDemoRegistration,
      demoWishlist,
      demoWishlistedIds,
      toggleWishlistItem,
      notes,
      addNote,
      completeProfile,
      setProfileComplete,
      showProfileNudge,
      dismissProfileNudge,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
