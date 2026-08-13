import React from "react";
import { Badge, Button, Card, Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { Tag, TagIDSelect } from "src/components/Tags/TagSelect";
import {
  MarkerTagsCriterion,
  IMarkerTagGroup,
} from "src/models/list-filter/criteria/marker-tags";
import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";

interface IMarkerTagsFilterProps {
  criterion: MarkerTagsCriterion;
  setCriterion: (c: MarkerTagsCriterion) => void;
}

interface IGroupEditorProps {
  group: IMarkerTagGroup;
  onUpdate: (updates: Partial<Omit<IMarkerTagGroup, "groupId">>) => void;
  onDelete: () => void;
  canDelete: boolean;
}

const GroupEditor: React.FC<IGroupEditorProps> = ({
  group,
  onUpdate,
  onDelete,
  canDelete,
}) => {
  const intl = useIntl();

  const onTagsChange = (tags: Tag[]) => {
    onUpdate({
      tags: tags.map((t) => ({
        id: t.id,
        label: t.name ?? t.id,
      })),
    });
  };

  const onDepthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ depth: e.target.checked ? -1 : 0 });
  };

  const onPerformerModeChange = (mode: "AND" | "OR") => {
    onUpdate({ performerMode: mode });
  };

  return (
    <Card className="mb-3">
      <Card.Header className="d-flex justify-content-between align-items-center py-2">
        <Badge variant="secondary">
          <FormattedMessage id="group" defaultMessage="Group" /> {group.groupId}
        </Badge>
        {canDelete && (
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            title={intl.formatMessage({ id: "actions.delete" })}
          >
            <Icon icon={faTrash} />
          </Button>
        )}
      </Card.Header>
      <Card.Body>
        <Form.Group className="mb-3">
          <Form.Label>
            <FormattedMessage id="tags" defaultMessage="Tags" />
          </Form.Label>
          <TagIDSelect
            isMulti
            ids={group.tags.map((t) => t.id)}
            onSelect={onTagsChange}
            menuPortalTarget={document.body}
          />
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Check
            type="checkbox"
            id={`include-sub-tags-${group.groupId}`}
            label={intl.formatMessage({
              id: "include_sub_tags",
              defaultMessage: "Include Sub Tags",
            })}
            checked={group.depth !== 0}
            onChange={onDepthChange}
          />
        </Form.Group>

        <Form.Group className="mb-0">
          <Form.Label>
            <FormattedMessage
              id="performer_role_mode"
              defaultMessage="Top/Bottom Mode"
            />
          </Form.Label>
          <Form.Text className="text-muted d-block mb-2">
            <FormattedMessage
              id="performer_role_mode_help"
              defaultMessage="AND = both top AND bottom must match. OR = either can match."
            />
          </Form.Text>
          <div className="d-flex gap-3">
            <Form.Check
              type="radio"
              id={`mode-or-${group.groupId}`}
              name={`performer-mode-${group.groupId}`}
              label="OR"
              checked={group.performerMode === "OR"}
              onChange={() => onPerformerModeChange("OR")}
            />
            <Form.Check
              type="radio"
              id={`mode-and-${group.groupId}`}
              name={`performer-mode-${group.groupId}`}
              label="AND"
              checked={group.performerMode === "AND"}
              onChange={() => onPerformerModeChange("AND")}
            />
          </div>
        </Form.Group>
      </Card.Body>
    </Card>
  );
};

export const MarkerTagsFilter: React.FC<IMarkerTagsFilterProps> = ({
  criterion,
  setCriterion,
}) => {
  const onAddGroup = () => {
    const c = criterion.clone() as MarkerTagsCriterion;
    c.addGroup();
    setCriterion(c);
  };

  const onUpdateGroup = (
    groupId: string,
    updates: Partial<Omit<IMarkerTagGroup, "groupId">>
  ) => {
    const c = criterion.clone() as MarkerTagsCriterion;
    c.updateGroup(groupId, updates);
    setCriterion(c);
  };

  const onDeleteGroup = (groupId: string) => {
    const c = criterion.clone() as MarkerTagsCriterion;
    c.removeGroup(groupId);
    setCriterion(c);
  };

  // Auto-add first group if empty
  React.useEffect(() => {
    if (criterion.value.groups.length === 0) {
      onAddGroup();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="marker-tags-filter">
      <div className="mb-3 text-muted">
        <FormattedMessage
          id="marker_tags_groups_help"
          defaultMessage="Create tag groups to filter markers. Top and Bottom filters can target specific groups."
        />
      </div>

      {criterion.value.groups.map((group) => (
        <GroupEditor
          key={group.groupId}
          group={group}
          onUpdate={(updates) => onUpdateGroup(group.groupId, updates)}
          onDelete={() => onDeleteGroup(group.groupId)}
          canDelete={criterion.value.groups.length > 1}
        />
      ))}

      <Button
        variant="secondary"
        size="sm"
        onClick={onAddGroup}
        className="w-100"
      >
        <Icon icon={faPlus} className="me-2" />
        <FormattedMessage id="add_group" defaultMessage="Add Group" />
      </Button>
    </div>
  );
};

export default MarkerTagsFilter;
