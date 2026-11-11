import React from "react";
import { FormattedMessage } from "react-intl";
import type {
  PerformerMarkersCriterionBase,
  IPerformerMarkersGroup,
} from "src/models/list-filter/criteria/performer-markers";
import { PerformerMarkerGroupEditor } from "./PerformerMarkerGroupEditor_custom";

interface IPerformerMarkersFilterProps {
  criterion: PerformerMarkersCriterionBase;
  setCriterion: (c: PerformerMarkersCriterionBase) => void;
  // Editing the exclude criterion instead of the include one.
  exclude?: boolean;
}

export const PerformerMarkersFilter: React.FC<IPerformerMarkersFilterProps> = ({
  criterion,
  setCriterion,
  exclude,
}) => {
  const onUpdateGroup = (updates: Partial<IPerformerMarkersGroup>) => {
    const c = criterion.clone() as PerformerMarkersCriterionBase;
    c.updateGroup(updates);
    setCriterion(c);
  };

  return (
    <div
      className={
        exclude
          ? "performer-markers-exclude-filter"
          : "performer-markers-filter"
      }
    >
      <div className="mb-3 text-muted small">
        {exclude ? (
          <FormattedMessage
            id="performer_markers_exclude_filter_help"
            defaultMessage="Exclude vatos with markers matching these criteria. Use 'Includes All' for AND mode (both vato AND partner must match), 'Includes' for OR mode (either can match)."
          />
        ) : (
          <FormattedMessage
            id="performer_markers_filter_help"
            defaultMessage="Find vatos with markers matching these criteria. Use 'Includes All' for AND mode (both vato AND partner must match), 'Includes' for OR mode (either can match)."
          />
        )}
      </div>

      <PerformerMarkerGroupEditor
        group={criterion.value.group}
        onUpdate={onUpdateGroup}
      />
    </div>
  );
};
