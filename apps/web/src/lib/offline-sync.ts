import type { SyncMutationInput } from "@finflow/shared";
import { api } from "./api";

const OUTBOX_KEY = "finflow:offline_outbox";

export function getOfflineOutbox(): SyncMutationInput[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as SyncMutationInput[]) : [];
  } catch {
    return [];
  }
}

export function enqueueOfflineMutation(mutation: SyncMutationInput): void {
  const list = getOfflineOutbox();
  list.push(mutation);
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
}

export async function flushOfflineOutbox(): Promise<{ applied: number; duplicates: number }> {
  const list = getOfflineOutbox();
  if (list.length === 0) return { applied: 0, duplicates: 0 };
  const res = await api.sync.batch(list);
  localStorage.removeItem(OUTBOX_KEY);
  return res;
}
