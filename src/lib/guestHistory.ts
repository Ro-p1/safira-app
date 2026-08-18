import { GuestScanRecord } from "../types";

const STORAGE_KEY = "safira_guest_scan_history";

export function getGuestHistory(): GuestScanRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addGuestHistoryRecord(record: GuestScanRecord) {
  const history = getGuestHistory();
  history.unshift(record);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 200)));
}

export function clearGuestHistory() {
  localStorage.removeItem(STORAGE_KEY);
}

// Onboarding SENGAJA tidak disimpan status "sudah dilihat" di localStorage —
// sesuai spesifikasi, onboarding harus muncul setiap kali app dibuka ulang.
