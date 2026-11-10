import React from "react";
import type { Criterion } from "src/models/list-filter/criteria/criterion";
import type { ActivityTypeCriterion } from "src/models/list-filter/criteria/activity-type_custom";
import { PercentageMetricEditor } from "./PercentageMetricEditor_custom";

export const ActivityTypeFilter: React.FC<{
  criterion: ActivityTypeCriterion;
  setCriterion: (criterion: Criterion) => void;
}> = (props) => (
  <PercentageMetricEditor
    {...props}
    prefix="activity_type"
    hint="activity_type_filter_hint"
  />
);
