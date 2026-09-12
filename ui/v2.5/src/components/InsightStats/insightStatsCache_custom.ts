import type { InsightStatsResult } from "./insightStatsData_custom";
import type { StatsScene } from "../Shared/statsSceneData_custom";
import {
  createInsightStatsRequest,
  loadInsightStatsScenes,
} from "./insightStatsQuery_custom";

export const insightCacheLifetime = 12 * 60 * 60 * 1000;
export type InsightSnapshot = {
  sceneDataVersion: 2;
  scenes: StatsScene[];
  scannedAt: string;
  configKey?: string;
  baseline?: InsightStatsResult;
};
export function isFreshInsightSnapshot(
  value: unknown,
  now = Date.now()
): value is InsightSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<InsightSnapshot>;
  const age = now - Date.parse(snapshot.scannedAt ?? "");
  return (
    snapshot.sceneDataVersion === 2 &&
    Array.isArray(snapshot.scenes) &&
    age >= 0 &&
    age < insightCacheLifetime
  );
}

let legacyCacheRetired = false;

// IndexedDB holds the large scan without blocking the UI or using localStorage quota.
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!legacyCacheRetired) {
      legacyCacheRetired = true;
      // Retire only the superseded, regenerable Playground cache.
      indexedDB.deleteDatabase?.("stash-playground-v1");
    }
    // Keep the existing shared stats store; version the scene payload instead.
    const request = indexedDB.open("stash-insight-stats-v6", 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore("scans");
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Stats cache is unavailable"));
    };
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

export async function removeInsightSnapshot(key: string) {
  try {
    const db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction("scans", "readwrite");
        transaction.objectStore("scans").delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  } catch {
    // Explicit reload still works when browser storage is unavailable.
  }
}

// An older calculation must not overwrite a newer scan loaded by another tab.
export async function writeInsightBaseline(
  key: string,
  snapshot: InsightSnapshot,
  configKey: string,
  baseline: InsightStatsResult
) {
  try {
    const db = await database();
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const transaction = db.transaction("scans", "readwrite");
        const store = transaction.objectStore("scans");
        const request = store.get(key);
        let written = false;
        request.onsuccess = () => {
          const current = request.result as InsightSnapshot | undefined;
          if (
            current?.sceneDataVersion !== snapshot.sceneDataVersion ||
            current.scannedAt !== snapshot.scannedAt
          )
            return;
          store.put({ ...current, configKey, baseline }, key);
          written = true;
        };
        transaction.oncomplete = () => resolve(written);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      });
    } finally {
      db.close();
    }
  } catch {
    return false;
  }
}

export interface IInsightCache {
  read: (key: string) => Promise<unknown>;
  write: (key: string, snapshot: InsightSnapshot) => Promise<boolean>;
  remove: (key: string) => Promise<unknown>;
}

const insightCache: IInsightCache = {
  read: readInsightSnapshot,
  write: writeInsightSnapshot,
  remove: removeInsightSnapshot,
};

export async function loadInsightSnapshot(
  url: string,
  signal: AbortSignal,
  progress: (loaded: number, total: number) => void,
  options: {
    force?: boolean;
    cache?: IInsightCache;
    load?: (
      url: string,
      signal: AbortSignal,
      progress: (loaded: number, total: number) => void
    ) => Promise<StatsScene[]>;
    now?: () => number;
  } = {}
) {
  const {
    force = false,
    cache = insightCache,
    load = (endpoint, abortSignal, report) =>
      loadInsightStatsScenes(
        createInsightStatsRequest(endpoint, abortSignal),
        report,
        abortSignal
      ),
    now = Date.now,
  } = options;
  const checkCancelled = () => {
    if (signal.aborted) throw new Error("Loading cancelled.");
  };
  checkCancelled();
  // All scene-backed Playground tabs use this URL key and lifetime.
  if (force) await cache.remove(url).catch(() => undefined);
  else {
    const cached = await cache.read(url).catch(() => undefined);
    checkCancelled();
    if (isFreshInsightSnapshot(cached, now()))
      return { snapshot: cached, fromCache: true, cacheAvailable: true };
  }
  checkCancelled();
  const scenes = await load(url, signal, progress);
  checkCancelled();
  const snapshot: InsightSnapshot = {
    sceneDataVersion: 2,
    scenes,
    scannedAt: new Date(now()).toISOString(),
  };
  const cacheAvailable = await cache.write(url, snapshot).catch(() => false);
  checkCancelled();
  return { snapshot, fromCache: false, cacheAvailable };
}
