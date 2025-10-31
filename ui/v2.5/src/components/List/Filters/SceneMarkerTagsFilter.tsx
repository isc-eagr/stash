import React, { useCallback } from "react";
import { Button } from "react-bootstrap";
import { defineMessages, useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import { SceneMarkerTagsCriterion } from "src/models/list-filter/criteria/tags";
import { Tag, TagIDSelect } from "src/components/Tags/TagSelect";

const messages = defineMessages({
  add_group: { id: "actions.add_marker", defaultMessage: "Add marker" },
  marker_label: { id: "filters.marker", defaultMessage: "Marker" },
});

export const SceneMarkerTagsFilter: React.FC<{
  criterion: SceneMarkerTagsCriterion;
  setCriterion: (c: SceneMarkerTagsCriterion) => void;
}> = ({ criterion, setCriterion }) => {
  const intl = useIntl();

  const addGroup = () => {
    const c = criterion.clone() as SceneMarkerTagsCriterion;
    c.groups = [...c.groups, []];
    setCriterion(c);
  };
  const removeGroup = (idx: number) => {
    const c = criterion.clone() as SceneMarkerTagsCriterion;
    c.groups = c.groups.filter((_, i) => i !== idx);
    setCriterion(c);
  };

  const onGroupChange = useCallback(
    (idx: number, tags: Tag[]) => {
      const c = criterion.clone() as SceneMarkerTagsCriterion;
      c.groups[idx] = tags.map((t) => ({ id: t.id, label: t.name ?? t.id }));
      setCriterion(c);
    },
    [criterion, setCriterion]
  );

  const onFlatChange = useCallback(
    (tags: Tag[]) => {
      const c = criterion.clone() as SceneMarkerTagsCriterion;
      c.items = tags.map((t) => ({ id: t.id, label: t.name ?? t.id }));
      setCriterion(c);
    },
    [criterion, setCriterion]
  );

  if (
    criterion.modifier === CriterionModifier.IsNull ||
    criterion.modifier === CriterionModifier.NotNull
  ) {
    return null;
  }

  const isGrouped =
    criterion.modifier === CriterionModifier.Equals ||
    criterion.modifier === CriterionModifier.NotEquals;

  return (
    <div className="scene-marker-tags-filter">
      {isGrouped ? (
        <div className="grouped-tags">
          {criterion.groups.map((group, idx) => (
            <div key={idx} className="mb-3">
              <div className="d-flex align-items-center mb-2">
                <strong className="me-2">
                  {intl.formatMessage(messages.marker_label)} {idx + 1}
                </strong>
                <Button
                  className="minimal"
                  size="sm"
                  variant="danger"
                  onClick={() => removeGroup(idx)}
                >
                  ×
                </Button>
              </div>
              <TagIDSelect
                isMulti
                ids={(criterion.groups[idx] ?? []).map((t) => t.id)}
                onSelect={(tags) => onGroupChange(idx, tags)}
                menuPortalTarget={document.body}
              />
            </div>
          ))}
          <Button className="minimal" onClick={addGroup}>
            {intl.formatMessage(messages.add_group)}
          </Button>
        </div>
      ) : (
        <div className="flat-tags">
          <TagIDSelect
            isMulti
            ids={criterion.items.map((t) => t.id)}
            onSelect={(tags) => onFlatChange(tags)}
            menuPortalTarget={document.body}
          />
        </div>
      )}
    </div>
  );
};

export default SceneMarkerTagsFilter;
