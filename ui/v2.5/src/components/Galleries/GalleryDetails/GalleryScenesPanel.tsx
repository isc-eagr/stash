import React from "react";
import * as GQL from "src/core/generated-graphql";
import { SceneCard } from "src/components/Scenes/SceneCard";
import { usePerformerCardRoleStats } from "src/components/Performers/performerRoleStats_custom"; // CUSTOM

interface IGalleryScenesPanelProps {
  scenes: GQL.SlimSceneDataFragment[];
}

export const GalleryScenesPanel: React.FC<IGalleryScenesPanelProps> = ({
  scenes,
}) => {
  const performers = React.useMemo(
    () =>
      Array.from(
        new Map(
          scenes
            .flatMap((scene) => scene.performers)
            .map((performer) => [performer.id, performer])
        ).values()
      ),
    [scenes]
  ); // CUSTOM
  const roleStatsByPerformer = usePerformerCardRoleStats(performers); // CUSTOM

  return (
    <div className="container gallery-scenes">
      {scenes.map((scene) => (
        <SceneCard
          scene={scene}
          key={scene.id}
          roleStatsByPerformer={roleStatsByPerformer} // CUSTOM
        />
      ))}
    </div>
  );
};
