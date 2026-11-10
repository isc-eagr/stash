import type { StatsScene } from "../Shared/statsSceneData_custom";
import {
  createPlaygroundRequest,
  loadPlaygroundScenePages,
} from "./playgroundSceneQuery_custom";

export const playgroundCacheLifetime = 12 * 60 * 60 * 1000;

export type PlaygroundSnapshot = {
  sceneDataVersion: 2;
  scenes: StatsScene[];
  scannedAt: string;
};
export function isFreshPlaygroundSnapshot(
  value: unknown,
  now = Date.now()
): value is PlaygroundSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<PlaygroundSnapshot>;
  const age = now - Date.parse(snapshot.scannedAt ?? "");
  return (
    snapshot.sceneDataVersion === 2 &&
    Array.isArray(snapshot.scenes) &&
    age >= 0 &&
    age < playgroundCacheLifetime
  );
}

let legacyCacheRetired = false;

// IndexedDB holds the large scan without blocking the UI or using localStorage quota.
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!legacyCacheRetired) {
      legacyCacheRetired = true;
      // Retire the superseded, regenerable caches.
      indexedDB.deleteDatabase?.("stash-playground-v1");
      indexedDB.deleteDatabase?.("stash-insight-stats-v6");
    }
    // Version the scene payload, not the store.
    const request = indexedDB.open("stash-playground-v2", 1);
    let blocked = false;
    request.onupgradeneeded = () => request.result.createObjectStore("scans");
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Playground cache is unavailable"));
    };
  });
}
export async function readPlaygroundSnapshot(key: string) {
  try {
    const db = await database();
    try {
      return await new Promise<PlaygroundSnapshot | undefined>(
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
export async function writePlaygroundSnapshot(
  key: string,
  snapshot: PlaygroundSnapshot
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

export async function removePlaygroundSnapshot(key: string) {
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

export interface IPlaygroundCache {
  read: (key: string) => Promise<unknown>;
  write: (key: string, snapshot: PlaygroundSnapshot) => Promise<boolean>;
  remove: (key: string) => Promise<unknown>;
}

const playgroundCache: IPlaygroundCache = {
  read: readPlaygroundSnapshot,
  write: writePlaygroundSnapshot,
  remove: removePlaygroundSnapshot,
};

export async function loadPlaygroundSnapshot(
  url: string,
  signal: AbortSignal,
  progress: (loaded: number, total: number) => void,
  options: {
    force?: boolean;
    cache?: IPlaygroundCache;
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
    cache = playgroundCache,
    load = (endpoint, abortSignal, report) =>
      loadPlaygroundScenePages(
        createPlaygroundRequest(endpoint, abortSignal),
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
    if (isFreshPlaygroundSnapshot(cached, now()))
      return { snapshot: cached, fromCache: true, cacheAvailable: true };
  }
  checkCancelled();
  const scenes = await load(url, signal, progress);
  checkCancelled();
  const snapshot: PlaygroundSnapshot = {
    sceneDataVersion: 2,
    scenes,
    scannedAt: new Date(now()).toISOString(),
  };
  const cacheAvailable = await cache.write(url, snapshot).catch(() => false);
  checkCancelled();
  return { snapshot, fromCache: false, cacheAvailable };
}
