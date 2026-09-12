import React from "react";
import { FormattedMessage } from "react-intl";
import type {
  PerformerMarkersCriterion,
  IPerformerMarkersGroup,
} from "src/models/list-filter/criteria/performer-markers";
import { PerformerMarkerGroupEditor } from "./PerformerMarkerGroupEditor_custom";

interface IPerformerMarkersFilterProps {
  criterion: PerformerMarkersCriterion;
  setCriterion: (c: PerformerMarkersCriterion) => void;
}

export const PerformerMarkersFilter: React.FC<IPerformerMarkersFilterProps> = ({
  criterion,
  setCriterion,
}) => {
  const onUpdateGroup = (updates: Partial<IPerformerMarkersGroup>) => {
    const c = criterion.clone() as PerformerMarkersCriterion;
    c.updateGroup(updates);
    setCriterion(c);
  };

  return (
    <div className="performer-markers-filter">
      <div className="mb-3 text-muted small">
        <FormattedMessage
          id="performer_markers_filter_help"
          defaultMessage="Find vatos with markers matching these criteria. Use 'Includes All' for AND mode (both vato AND partner must match), 'Includes' for OR mode (either can match)."
        />
      </div>

      <PerformerMarkerGroupEditor
        group={criterion.value.group}
        onUpdate={onUpdateGroup}
      />
    </div>
  );
};

export default PerformerMarkersFilter;
