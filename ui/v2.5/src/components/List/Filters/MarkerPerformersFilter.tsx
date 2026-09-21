import React from "react";
import type { MarkerPerformersCriterion } from "src/models/list-filter/criteria/marker-performers";
import { MarkerFilterEditor } from "./MarkerFilterEditor";

interface IMarkerPerformersFilterProps {
  criterion: MarkerPerformersCriterion;
  setCriterion: (criterion: MarkerPerformersCriterion) => void;
}

export const MarkerPerformersFilter: React.FC<IMarkerPerformersFilterProps> = (
  props
) => <MarkerFilterEditor {...props} scope="markers" />;

export default MarkerPerformersFilter;
