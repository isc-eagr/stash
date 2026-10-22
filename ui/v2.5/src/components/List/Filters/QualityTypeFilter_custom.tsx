import React from "react";
import type { Criterion } from "src/models/list-filter/criteria/criterion";
import type { QualityTypeCriterion } from "src/models/list-filter/criteria/quality-type_custom";
import { PercentageMetricEditor } from "./PercentageMetricEditor_custom";

export const QualityTypeFilter: React.FC<{
  criterion: QualityTypeCriterion;
  setCriterion: (criterion: Criterion) => void;
}> = (props) => (
  <PercentageMetricEditor
    {...props}
    prefix="quality_type"
    hint="quality_type_filter_hint"
  />
);
