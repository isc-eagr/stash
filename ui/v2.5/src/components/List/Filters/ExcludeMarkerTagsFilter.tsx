import React from "react";
import { Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { Tag, TagIDSelect } from "src/components/Tags/TagSelect";
import { ExcludeMarkerTagsCriterion } from "src/models/list-filter/criteria/exclude-marker-tags";
import { useMarkerFilterGroups } from "./MarkerFilterGroupContext";

interface IExcludeMarkerTagsFilterProps {
  criterion: ExcludeMarkerTagsCriterion;
  setCriterion: (c: ExcludeMarkerTagsCriterion) => void;
}

export const ExcludeMarkerTagsFilter: React.FC<
  IExcludeMarkerTagsFilterProps
> = ({ criterion, setCriterion }) => {
  const intl = useIntl();
  const { groups } = useMarkerFilterGroups();

  const onTagsChange = (tags: Tag[]) => {
    const c = criterion.clone() as ExcludeMarkerTagsCriterion;
    c.value.tags = tags.map((t) => ({
      id: t.id,
      label: t.name ?? t.id,
    }));
    setCriterion(c);
  };

  const onTargetGroupChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>
  ) => {
    const c = criterion.clone() as ExcludeMarkerTagsCriterion;
    c.value.targetGroupId = e.target.value || undefined;
    setCriterion(c);
  };

  return (
    <div className="exclude-marker-tags-filter">
      <Form.Group className="mb-3">
        <Form.Label className="d-flex align-items-center">
          <span className="text-danger me-2">❌</span>
          <FormattedMessage id="exclude_tags" defaultMessage="Exclude Tags" />
        </Form.Label>
        <TagIDSelect
          isMulti
          ids={criterion.value.tags.map((t) => t.id)}
          onSelect={onTagsChange}
          menuPortalTarget={document.body}
        />
        <Form.Text className="text-muted">
          <FormattedMessage
            id="exclude_tags_help"
            defaultMessage="Scenes with markers having ANY of these tags will be excluded"
          />
        </Form.Text>
      </Form.Group>

      {groups.length > 0 && (
        <Form.Group className="mb-2">
          <Form.Label>
            <FormattedMessage
              id="exclude_from_group"
              defaultMessage="Exclude from Group (optional)"
            />
          </Form.Label>
          <Form.Control
            as="select"
            value={criterion.value.targetGroupId ?? ""}
            onChange={onTargetGroupChange}
          >
            <option value="">
              {intl.formatMessage({
                id: "all_groups",
                defaultMessage: "All Groups (Global)",
              })}
            </option>
            {groups.map((g) => (
              <option key={g.groupId} value={g.groupId}>
                {intl.formatMessage({ id: "group", defaultMessage: "Group" })}{" "}
                {g.groupId}
                {g.tagLabels.length > 0 ? ` (${g.tagLabels.join(", ")})` : ""}
              </option>
            ))}
          </Form.Control>
        </Form.Group>
      )}
    </div>
  );
};

export default ExcludeMarkerTagsFilter;
