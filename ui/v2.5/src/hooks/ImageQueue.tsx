import React, { createContext, useContext, useState, useCallback } from "react";
import * as GQL from "src/core/generated-graphql";

interface IImageQueueContext {
  queue: GQL.SlimImageDataFragment[];
  addToQueue: (images: GQL.SlimImageDataFragment[]) => void;
  removeFromQueue: (imageId: string) => void;
  clearQueue: () => void;
  isInQueue: (imageId: string) => boolean;
}

const ImageQueueContext = createContext<IImageQueueContext | undefined>(
  undefined
);

export const ImageQueueProvider: React.FC<React.PropsWithChildren<object>> = ({
  children,
}) => {
  const [queue, setQueue] = useState<GQL.SlimImageDataFragment[]>([]);

  const addToQueue = useCallback((images: GQL.SlimImageDataFragment[]) => {
    setQueue((prev) => {
      const existingIds = new Set(prev.map((img) => img.id));
      const newImages = images.filter((img) => !existingIds.has(img.id));
      return [...prev, ...newImages];
    });
  }, []);

  const removeFromQueue = useCallback((imageId: string) => {
    setQueue((prev) => prev.filter((img) => img.id !== imageId));
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const isInQueue = useCallback(
    (imageId: string) => {
      return queue.some((img) => img.id === imageId);
    },
    [queue]
  );

  return (
    <ImageQueueContext.Provider
      value={{
        queue,
        addToQueue,
        removeFromQueue,
        clearQueue,
        isInQueue,
      }}
    >
      {children}
    </ImageQueueContext.Provider>
  );
};

export const useImageQueue = (): IImageQueueContext => {
  const context = useContext(ImageQueueContext);
  if (!context) {
    throw new Error("useImageQueue must be used within an ImageQueueProvider");
  }
  return context;
};
