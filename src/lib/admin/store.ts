import { useEffect, useState } from "react";

export type AdminCategory = "themes" | "plugins" | "blocks" | "scripts";
export type AdPlacement = "feed" | "marketplace" | "academy";
export type AdTier = "text" | "banner" | "video";
export type AdminCurrency = "USD" | "NGN" | "GHS";

export interface AdminProduct {
  id: string;
  name: string;
  category: AdminCategory;
  version: string;
  vendor: string;
  description: string;
  priceUSD: number;
  priceNGN: number;
  priceGHS: number;
  createdAt: number;
}

export interface AdminAd {
  id: string;
  advertiser: string;
  placement: AdPlacement;
  tier: AdTier;
  mediaUrl: string;
  cta: string;
  clickUrl: string;
  createdAt: number;
  /** Unix ms. If null, campaign starts immediately. */
  startAt: number | null;
  /** Unix ms. If null, campaign runs indefinitely. */
  endAt: number | null;
}

/** True when the ad's scheduled window includes `now`. */
export function isAdActive(ad: AdminAd, now: number = Date.now()): boolean {
  if (ad.startAt != null && now < ad.startAt) return false;
  if (ad.endAt != null && now > ad.endAt) return false;
  return true;
}

export interface AdminBounty {
  id: string;
  title: string;
  scope: string;
  timeframe: string;
  applicantLimit: number;
  escrowAmount: number;
  escrowCurrency: AdminCurrency;
  createdAt: number;
}

interface AdminState {
  products: AdminProduct[];
  ads: AdminAd[];
  bounties: AdminBounty[];
}

const state: AdminState = { products: [], ads: [], bounties: [] };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const adminStore = {
  get: (): AdminState => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  addProduct(p: Omit<AdminProduct, "id" | "createdAt">) {
    state.products = [{ ...p, id: `ap_${Date.now()}`, createdAt: Date.now() }, ...state.products];
    emit();
  },
  addAd(a: Omit<AdminAd, "id" | "createdAt">) {
    state.ads = [{ ...a, id: `ad_${Date.now()}`, createdAt: Date.now() }, ...state.ads];
    emit();
  },
  addBounty(b: Omit<AdminBounty, "id" | "createdAt">) {
    state.bounties = [{ ...b, id: `ab_${Date.now()}`, createdAt: Date.now() }, ...state.bounties];
    emit();
  },
};

export function useAdminStore() {
  const [snap, setSnap] = useState<AdminState>({ ...state });
  useEffect(() => {
    const unsub = adminStore.subscribe(() => setSnap({ ...state }));
    return () => {
      unsub();
    };
  }, []);
  return snap;
}
