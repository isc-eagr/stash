import React from "react";
import { FormattedMessage } from "react-intl";
import type {
  PerformerMarkersExcludeCriterion,
  IPerformerMarkersExcludeGroup,
} from "src/models/list-filter/criteria/performer-markers-exclude";
import { PerformerMarkerGroupEditor } from "./PerformerMarkerGroupEditor_custom";

interface IPerformerMarkersExcludeFilterProps {
  criterion: PerformerMarkersExcludeCriterion;
  setCriterion: (c: PerformerMarkersExcludeCriterion) => void;
}

export const PerformerMarkersExcludeFilter: React.FC<
  IPerformerMarkersExcludeFilterProps
> = ({ criterion, setCriterion }) => {
  const onUpdateGroup = (updates: Partial<IPerformerMarkersExcludeGroup>) => {
    const c = criterion.clone() as PerformerMarkersExcludeCriterion;
    c.updateGroup(updates);
    setCriterion(c);
  };

  return (
    <div className="performer-markers-exclude-filter">
      <div className="mb-3 text-muted small">
        <FormattedMessage
          id="performer_markers_exclude_filter_help"
          defaultMessage="Exclude vatos with markers matching these criteria. Use 'Includes All' for AND mode (both vato AND partner must match), 'Includes' for OR mode (either can match)."
        />
      </div>

      <PerformerMarkerGroupEditor
        group={criterion.value.group}
        onUpdate={onUpdateGroup}
      />
    </div>
  );
};

export default PerformerMarkersExcludeFilter;
