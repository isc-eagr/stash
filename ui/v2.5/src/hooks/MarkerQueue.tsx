import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import * as GQL from "src/core/generated-graphql";

const STORAGE_KEY = "markerPlaybackQueue";

interface IMarkerQueueContext {
  /** The list of markers in the queue */
  queue: GQL.SceneMarkerDataFragment[];
  /** Number of markers in the queue */
  count: number;
  /** Add markers to the queue (deduplicates by ID) */
  addToQueue: (markers: GQL.SceneMarkerDataFragment[]) => void;
  /** Remove specific markers from the queue by ID */
  removeFromQueue: (ids: string[]) => void;
  /** Clear all markers from the queue */
  clearQueue: () => void;
  /** Check if a marker is in the queue */
  isInQueue: (id: string) => boolean;
}

const MarkerQueueContext = createContext<IMarkerQueueContext | null>(null);

export const MarkerQueueProvider: React.FC = ({ children }) => {
  const [queue, setQueue] = useState<GQL.SceneMarkerDataFragment[]>([]);

  // Load queue from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as GQL.SceneMarkerDataFragment[];
        setQueue(parsed);
      }
    } catch (e) {
      console.error("Failed to load marker queue from storage:", e);
    }
  }, []);

  // Persist queue to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error("Failed to save marker queue to storage:", e);
    }
  }, [queue]);

  const addToQueue = useCallback((markers: GQL.SceneMarkerDataFragment[]) => {
    setQueue((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newMarkers = markers.filter((m) => !existingIds.has(m.id));
      return [...prev, ...newMarkers];
    });
  }, []);

  const removeFromQueue = useCallback((ids: string[]) => {
    const idsSet = new Set(ids);
    setQueue((prev) => prev.filter((m) => !idsSet.has(m.id)));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const isInQueue = useCallback(
    (id: string) => {
      return queue.some((m) => m.id === id);
    },
    [queue]
  );

  const count = queue.length;

  const value = useMemo(
    () => ({
      queue,
      count,
      addToQueue,
      removeFromQueue,
      clearQueue,
      isInQueue,
    }),
    [queue, count, addToQueue, removeFromQueue, clearQueue, isInQueue]
  );

  return (
    <MarkerQueueContext.Provider value={value}>
      {children}
    </MarkerQueueContext.Provider>
  );
};

export const useMarkerQueue = (): IMarkerQueueContext => {
  const context = useContext(MarkerQueueContext);
  if (!context) {
    throw new Error("useMarkerQueue must be used within a MarkerQueueProvider");
  }
  return context;
};
