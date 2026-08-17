import React, { useMemo } from "react";
import { useFindScenes } from "src/core/StashService";
import { SceneCard } from "./SceneCard";
import { SceneQueue } from "src/models/sceneQueue";
import { ListFilterModel } from "src/models/list-filter/filter";
import { PatchComponent } from "src/patch";
import { FilteredRecommendationRow } from "../FrontPage/FilteredRecommendationRow";
import { usePerformerCardRoleStats } from "../Performers/performerRoleStats_custom"; // CUSTOM

interface IProps {
  isTouch: boolean;
  filter: ListFilterModel;
  header: string;
}

export const SceneRecommendationRow: React.FC<IProps> = PatchComponent(
  "SceneRecommendationRow",
  (props) => {
    const result = useFindScenes(props.filter);
    const count = result.data?.findScenes.count ?? 0;
    const scenes = useMemo(
      () => result.data?.findScenes.scenes ?? [],
      [result.data?.findScenes.scenes]
    );
    const insightPerformers = useMemo(
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
    const roleStatsByPerformer = usePerformerCardRoleStats(
      insightPerformers,
      result.loading
    ); // CUSTOM

    const queue = useMemo(() => {
      return SceneQueue.fromListFilterModel(props.filter);
    }, [props.filter]);

    return (
      <FilteredRecommendationRow
        className="scene-recommendations"
        heading={props.header}
        url={`/scenes?${props.filter.makeQueryParameters()}`}
        count={count}
        loading={result.loading}
        isTouch={props.isTouch}
        filter={props.filter}
      >
        {result.loading
          ? [...Array(props.filter.itemsPerPage)].map((i) => (
              <div key={`_${i}`} className="scene-skeleton skeleton-card"></div>
            ))
          : scenes.map((scene, index) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                queue={queue}
                index={index}
                zoomIndex={1}
                roleStatsByPerformer={roleStatsByPerformer} // CUSTOM
              />
            ))}
      </FilteredRecommendationRow>
    );
  }
);
