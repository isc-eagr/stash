import React from "react";
import type { SceneMarkersCriterion } from "src/models/list-filter/criteria/scene-markers";
import { MarkerFilterEditor } from "./MarkerFilterEditor";

interface ISceneMarkersFilterProps {
  criterion: SceneMarkersCriterion;
  setCriterion: (criterion: SceneMarkersCriterion) => void;
}

export const SceneMarkersFilter: React.FC<ISceneMarkersFilterProps> = (
  props
) => <MarkerFilterEditor {...props} scope="scenes" />;

export default SceneMarkersFilter;
