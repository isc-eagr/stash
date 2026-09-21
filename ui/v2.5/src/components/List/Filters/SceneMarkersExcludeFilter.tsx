import React from "react";
import type { SceneMarkersExcludeCriterion } from "src/models/list-filter/criteria/scene-markers-exclude";
import { MarkerFilterEditor } from "./MarkerFilterEditor";

interface ISceneMarkersExcludeFilterProps {
  criterion: SceneMarkersExcludeCriterion;
  setCriterion: (criterion: SceneMarkersExcludeCriterion) => void;
}

export const SceneMarkersExcludeFilter: React.FC<
  ISceneMarkersExcludeFilterProps
> = (props) => <MarkerFilterEditor {...props} scope="exclude" />;

export default SceneMarkersExcludeFilter;
