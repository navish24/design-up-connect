import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { Analytics } from '../lib/analytics';
import type { User, CardContact, ConnectionType, ConnectionScope } from '../types';

const SAVED_BRANDS_KEY = 'saved_brands_v1';
const CARD_CONTACTS_KEY = 'card_contacts_v1';
const CONNECTIONS_KEY = 'connections_v1';

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
  completeProfile: (input: ProfileInput) => Promise<void>;
  setProfileComplete: () => void;
  showProfileNudge: boolean;
  dismissProfileNudge: () => void;
  // User update
  updateUser: (fields: Partial<User>) => void;
  // Card contacts (physical visiting card scans)
  cardContacts: CardContact[];
  addCardContact: (contact: CardContact) => Promise<void>;
  updateCardContact: (contact: CardContact) => Promise<void>;
  deleteCardContact: (id: string) => Promise<void>;
  clearCardContacts: () => void;
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
  completeProfile: async () => {},
  setProfileComplete: () => {},
  showProfileNudge: false,
  dismissProfileNudge: () => {},
  updateUser: () => {},
  cardContacts: [],
  addCardContact: async () => {},
  updateCardContact: async () => {},
  deleteCardContact: async () => {},
  clearCardContacts: () => {},
});

const DEMO_EXHIBITION = { id: 'exh-001', name: 'Index Mumbai 2025' };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeExhibitionId, setActiveExhibitionId] = useState<string | null>(null);
  const [activeExhibitionName, setActiveExhibitionName] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoSavedReset, setDemoSavedReset] = useState(false);
  const [demoConnectionsReset, setDemoConnectionsReset] = useState(false);
  const [demoSavedBrands, setDemoSavedBrands] = useState<any[]>([]);
  const [savedBrandsLoaded, setSavedBrandsLoaded] = useState(false);
  const [demoAddedConnections, setDemoAddedConnections] = useState<any[]>([]);
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [demoRegisteredExhibitions, setDemoRegisteredExhibitions] = useState<string[]>([]);
  const [demoWishlist, setDemoWishlist] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [showProfileNudge, setShowProfileNudge] = useState(false);
  const [cardContacts, setCardContacts] = useState<CardContact[]>([]);
  const [cardContactsLoaded, setCardContactsLoaded] = useState(false);
  const cardContactsRef = useRef<CardContact[]>([]);
  useEffect(() => { cardContactsRef.current = cardContacts; }, [cardContacts]);

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

  // Load card contacts from AsyncStorage on mount (fallback / offline cache)
  useEffect(() => {
    AsyncStorage.getItem(CARD_CONTACTS_KEY).then((raw) => {
      if (raw) {
        try { setCardContacts(JSON.parse(raw)); } catch (_) {}
      }
      setCardContactsLoaded(true);
    });
  }, []);

  // Keep AsyncStorage in sync as local cache
  useEffect(() => {
    if (!cardContactsLoaded) return;
    AsyncStorage.setItem(CARD_CONTACTS_KEY, JSON.stringify(cardContacts));
  }, [cardContacts, cardContactsLoaded]);


  // Load persisted connections on mount
  useEffect(() => {
    AsyncStorage.getItem(CONNECTIONS_KEY).then((raw) => {
      if (raw) {
        try { setDemoAddedConnections(JSON.parse(raw)); } catch (_) {}
      }
      setConnectionsLoaded(true);
    });
  }, []);

  // Persist connections whenever they change (after initial load)
  useEffect(() => {
    if (!connectionsLoaded) return;
    AsyncStorage.setItem(CONNECTIONS_KEY, JSON.stringify(demoAddedConnections));
  }, [demoAddedConnections, connectionsLoaded]);

  // ── Real Supabase auth ───────────────────────────────────────────────────────

  const loadCardContacts = useCallback(async (userId: string) => {
    // Read current local cards from ref — always up to date regardless of render timing
    let local = cardContactsRef.current;

    // Fix non-UUID ids (cards saved before UUID enforcement)
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const needsFix = local.some((c) => !uuidRe.test(c.id));
    if (needsFix) {
      local = local.map((c) => uuidRe.test(c.id) ? c : { ...c, id: crypto.randomUUID() });
      setCardContacts(local);
    }

    const { data: rows, error: ccError } = await supabase
      .from('card_contacts')
      .select('id, scanned_at, fields, notes, tags, connect_user_id, card_image_uri, card_image_uri_back')
      .eq('user_id', userId)
      .order('scanned_at', { ascending: false });
    if (ccError) console.error('[loadCardContacts] query failed:', ccError.message);

    const remoteIds = new Set((rows ?? []).map((r: any) => r.id));
    const localOnly = local.filter((c) => !remoteIds.has(c.id));

    // Upload local-only cards to Supabase (await so PWA sees them on next load)
    let finalRows = rows ?? [];
    if (localOnly.length > 0) {
      console.log('[loadCardContacts] uploading', localOnly.length, 'local-only cards to Supabase');
      const { error: syncErr } = await supabase.from('card_contacts').upsert(
        localOnly.map((c) => ({
          id: c.id,
          user_id: userId,
          scanned_at: c.scanned_at,
          fields: c.fields,
          notes: c.notes,
          tags: c.tags,
          connect_user_id: c.connect_user_id ?? null,
        })),
        { onConflict: 'id' },
      );
      if (syncErr) {
        console.error('[loadCardContacts] sync failed:', syncErr.message);
      } else {
        console.log('[loadCardContacts] sync complete — re-querying');
        const { data: fresh } = await supabase
          .from('card_contacts')
          .select('id, scanned_at, fields, notes, tags, connect_user_id, card_image_uri, card_image_uri_back')
          .eq('user_id', userId)
          .order('scanned_at', { ascending: false });
        finalRows = fresh ?? finalRows;
      }
    }

    if (finalRows.length === 0) return; // nothing in Supabase and nothing local to sync

    // Merge: prefer Supabase cloud URLs, fall back to local AsyncStorage URIs for
    // cards scanned in this session before Cloudinary upload completed.
    const localById: Record<string, CardContact> = {};
    for (const c of local) localById[c.id] = c;

    const merged = finalRows.map((r: any) => ({
      id: r.id,
      source: 'card_scan' as const,
      scanned_at: r.scanned_at,
      card_image_uri: r.card_image_uri ?? localById[r.id]?.card_image_uri ?? null,
      card_image_uri_back: r.card_image_uri_back ?? localById[r.id]?.card_image_uri_back ?? null,
      fields: r.fields ?? [],
      notes: r.notes ?? '',
      tags: r.tags ?? [],
      connect_user_id: r.connect_user_id ?? null,
    })).sort((a: any, b: any) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime());

    setCardContacts(merged);
  }, []);

  // Fire only after BOTH auth AND AsyncStorage are ready — defined after
  // loadCardContacts so the dependency array captures the real function reference.
  useEffect(() => {
    if (!user?.id || !cardContactsLoaded) return;
    void loadCardContacts(user.id);
  }, [user?.id, cardContactsLoaded, loadCardContacts]);

  const loadConnections = useCallback(async (userId: string) => {
    const { data: rows } = await supabase
      .from('connections')
      .select('connected_user_id, is_mutual, connected_at')
      .eq('user_id', userId);

    if (!rows || rows.length === 0) return;

    const ids = rows.map((r: any) => r.connected_user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, designation, company_name, email, phone, city, designup_user_id')
      .in('id', ids);

    const profileMap: Record<string, any> = {};
    for (const p of (profiles ?? [])) profileMap[p.id] = p;

    const connections = rows.map((c: any) => {
      const p = profileMap[c.connected_user_id] ?? {};
      return {
        id: `demo-${c.connected_user_id}`,
        user: {
          id: c.connected_user_id,
          full_name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
          designup_user_id: p.designup_user_id ?? '',
          designation: p.designation ?? undefined,
          company_name: p.company_name ?? undefined,
          city: p.city ?? undefined,
          phone: p.phone ?? undefined,
          email: p.email ?? undefined,
        },
        connection_type: 'networking' as ConnectionType,
        scope: 'personal' as ConnectionScope,
        is_mutual: c.is_mutual ?? false,
        to_contact_shared: true,
        from_contact_shared: true,
        created_at: c.connected_at ?? new Date().toISOString(),
      };
    });

    setDemoAddedConnections(connections);
  }, []);

  const loadProfile = useCallback(async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, phone, designation, company_name, city, country, designup_user_id, instagram_handle, website_url, linkedin_url, address')
      .eq('id', userId)
      .single();

    if (profile) {
      if (profile.email) {
        AsyncStorage.setItem('connect_last_email', profile.email).catch(() => {});
      }
      setUser({
        id: profile.id,
        designup_user_id: profile.designup_user_id ?? '',
        first_name: profile.first_name ?? '',
        last_name: profile.last_name ?? '',
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        profession: profile.designation ?? '',
        company_name: profile.company_name ?? '',
        designation: profile.designation ?? '',
        city: profile.city ?? '',
        country: profile.country ?? 'India',
        instagram_handle: profile.instagram_handle ?? '',
        website_url: profile.website_url ?? '',
        linkedin_url: profile.linkedin_url ?? '',
        address: profile.address ?? '',
        profile_complete: !!(profile.first_name && profile.designation),
      });
      Analytics.identify(profile.id, {
        name: `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim(),
        email: profile.email ?? '',
        phone: profile.phone ?? '',
        profession: profile.designation ?? '',
        company: profile.company_name ?? '',
      });
      void loadConnections(userId);
    }

    setIsLoading(false);
  }, [loadConnections, loadCardContacts]);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          void loadProfile(session.user.id);
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => setIsLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setDemoAddedConnections([]);
        setIsLoading(false);
      } else if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
        setIsLoading(true); // hold the auth guard while profile loads
        void loadProfile(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // ────────────────────────────────────────────────────────────────────────────

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
    } catch (_) {}
    setUser(null);
    // Do NOT clear demoAddedConnections here — clearing state triggers the
    // persistence effect which would overwrite AsyncStorage with [].
    // Local device connections survive logout by design.
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
    AsyncStorage.removeItem(CONNECTIONS_KEY);
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
    Analytics.noteAdded();
    setNotes((prev) => ({ ...prev, [entityId]: [note, ...(prev[entityId] ?? [])] }));
  };

  const updateUser = (fields: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...fields } : prev);
    // Persist to Supabase so changes survive refresh
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return;
      const dbFields: Record<string, any> = { id: authUser.id };
      if (fields.first_name !== undefined) dbFields.first_name = fields.first_name;
      if (fields.last_name !== undefined) dbFields.last_name = fields.last_name;
      if (fields.designation !== undefined) dbFields.designation = fields.designation;
      if (fields.profession !== undefined) dbFields.designation = fields.profession;
      if (fields.company_name !== undefined) dbFields.company_name = fields.company_name;
      if (fields.city !== undefined) dbFields.city = fields.city;
      if (fields.country !== undefined) dbFields.country = fields.country;
      if (fields.phone !== undefined) dbFields.phone = fields.phone;
      if (fields.email !== undefined) dbFields.email = fields.email;
      if (fields.instagram_handle !== undefined) dbFields.instagram_handle = fields.instagram_handle;
      if (fields.website_url !== undefined) dbFields.website_url = fields.website_url;
      if (fields.linkedin_url !== undefined) dbFields.linkedin_url = fields.linkedin_url;
      if (fields.address !== undefined) dbFields.address = fields.address;
      if (Object.keys(dbFields).length > 1) {
        supabase.from('profiles').upsert(dbFields, { onConflict: 'id' }).then(({ error }) => {
          if (error) console.error('[updateUser] upsert failed:', error.message, dbFields);
        });
      }
    });
  };

  const completeProfile = async (input: ProfileInput): Promise<void> => {
    const [first, ...rest] = input.full_name.trim().split(' ');
    const lastName = rest.join(' ');
    setUser((prev) => ({
      id: prev?.id ?? 'pending',
      designup_user_id: prev?.designup_user_id ?? '',
      first_name: first,
      last_name: lastName,
      phone: input.phone,
      email: input.email,
      profession: input.profession,
      designation: input.profession,
      company_name: input.company_name,
      city: prev?.city ?? '',
      country: prev?.country ?? 'India',
      profile_complete: true,
    }));
    setShowProfileNudge(true);

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase.from('profiles').upsert({
        id: authUser.id,
        first_name: first,
        last_name: lastName || null,
        designation: input.profession,
        company_name: input.company_name || null,
        email: input.email,
        phone: input.phone,
      }, { onConflict: 'id' });
    }
  };

  const setProfileComplete = () => {
    setShowProfileNudge(false);
  };

  const dismissProfileNudge = () => {
    setShowProfileNudge(false);
  };

  const addCardContact = async (contact: CardContact) => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(contact.id)) contact = { ...contact, id: crypto.randomUUID() };
    setCardContacts((prev) => [contact, ...prev]);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { error: insertErr } = await supabase.from('card_contacts').upsert({
        id: contact.id,
        user_id: authUser.id,
        scanned_at: contact.scanned_at,
        fields: contact.fields,
        notes: contact.notes,
        tags: contact.tags,
        connect_user_id: contact.connect_user_id ?? null,
      }, { onConflict: 'id' });
      if (insertErr) console.error('[addCardContact] upsert failed:', insertErr.message);
    } else {
      console.warn('[addCardContact] no auth session — card saved locally only');
    }
  };

  const updateCardContact = async (contact: CardContact) => {
    setCardContacts((prev) => prev.map((c) => (c.id === contact.id ? contact : c)));
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase.from('card_contacts').update({
        fields: contact.fields,
        notes: contact.notes,
        tags: contact.tags,
        // Only persist cloud URLs — local device URIs are not portable across sessions
        ...(contact.card_image_uri?.startsWith('https://') ? { card_image_uri: contact.card_image_uri } : {}),
        ...(contact.card_image_uri_back?.startsWith('https://') ? { card_image_uri_back: contact.card_image_uri_back } : {}),
      }).eq('id', contact.id).eq('user_id', authUser.id);
    }
  };

  const deleteCardContact = async (id: string) => {
    setCardContacts((prev) => prev.filter((c) => c.id !== id));
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await supabase.from('card_contacts').delete().eq('id', id).eq('user_id', authUser.id);
    }
  };

  const clearCardContacts = () => {
    setCardContacts([]);
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
      isLoading,
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
      cardContacts,
      addCardContact,
      updateCardContact,
      deleteCardContact,
      clearCardContacts,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
