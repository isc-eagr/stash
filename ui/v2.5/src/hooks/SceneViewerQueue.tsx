import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import * as GQL from "src/core/generated-graphql";

interface ISceneViewerQueueContext {
  queue: GQL.SlimSceneDataFragment[];
  count: number;
  addToQueue: (scenes: GQL.SlimSceneDataFragment[]) => void;
  clearQueue: () => void;
  isInQueue: (id: string) => boolean;
}

const SceneViewerQueueContext = createContext<ISceneViewerQueueContext | null>(
  null
);

export const SceneViewerQueueProvider: React.FC = ({ children }) => {
  const [queue, setQueue] = useState<GQL.SlimSceneDataFragment[]>([]);

  const addToQueue = useCallback((scenes: GQL.SlimSceneDataFragment[]) => {
    setQueue((prev) => {
      const existingIds = new Set(prev.map((scene) => scene.id));
      const newScenes = scenes.filter((scene) => !existingIds.has(scene.id));
      return [...prev, ...newScenes];
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const isInQueue = useCallback(
    (id: string) => {
      return queue.some((scene) => scene.id === id);
    },
    [queue]
  );

  const count = queue.length;

  const value = useMemo(
    () => ({
      queue,
      count,
      addToQueue,
      clearQueue,
      isInQueue,
    }),
    [queue, count, addToQueue, clearQueue, isInQueue]
  );

  return (
    <SceneViewerQueueContext.Provider value={value}>
      {children}
    </SceneViewerQueueContext.Provider>
  );
};

export const useSceneViewerQueue = (): ISceneViewerQueueContext => {
  const context = useContext(SceneViewerQueueContext);
  if (!context) {
    throw new Error(
      "useSceneViewerQueue must be used within a SceneViewerQueueProvider"
    );
  }
  return context;
};
