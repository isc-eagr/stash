import type {
  InsightStatsScene,
  InsightStatsResult,
} from "./insightStatsData_custom";

export const insightCacheLifetime = 12 * 60 * 60 * 1000;
export type InsightSnapshot = {
  scenes: InsightStatsScene[];
  scannedAt: string;
  configKey?: string;
  baseline?: InsightStatsResult;
};
export function isFreshInsightSnapshot(
  snapshot: InsightSnapshot,
  now = Date.now()
) {
  const age = now - Date.parse(snapshot.scannedAt);
  return age >= 0 && age < insightCacheLifetime;
}

// IndexedDB holds the large scan without blocking the UI or using localStorage quota.
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("stash-insight-stats-v2", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("scans");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readInsightSnapshot(key: string) {
  try {
    const db = await database();
    try {
      return await new Promise<InsightSnapshot | undefined>(
        (resolve, reject) => {
          const request = db.transaction("scans").objectStore("scans").get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }
      );
    } finally {
      db.close();
    }
  } catch {
    return undefined;
  }
}
export async function writeInsightSnapshot(
  key: string,
  snapshot: InsightSnapshot
) {
  try {
    const db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("scans", "readwrite");
        transaction.objectStore("scans").put(snapshot, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
      return true;
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}
