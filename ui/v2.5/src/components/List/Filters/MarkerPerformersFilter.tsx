import React from "react";
import { Badge, Button, ButtonGroup, Col, Form, Row } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import {
  IMarkerPerformersGroup,
  MarkerPerformersCriterion,
} from "src/models/list-filter/criteria/marker-performers";
import { PerformerIDSelect } from "src/components/Performers/PerformerSelect";
import { Tag, TagIDSelect } from "src/components/Tags/TagSelect";
import {
  faArrowDown,
  faArrowUp,
  faPlus,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { UnnamedPerformersManager } from "./UnnamedPerformerManager";
import {
  IUnnamedPerformer,
  isUnnamedPerformerId,
} from "src/models/list-filter/criteria/unnamed-performer";

interface IMarkerPerformersFilterProps {
  criterion: MarkerPerformersCriterion;
  setCriterion: (c: MarkerPerformersCriterion) => void;
}

interface IMarkerGroupEditorProps {
  group: IMarkerPerformersGroup;
  availableUnnamedPerformers: IUnnamedPerformer[];
  canDelete: boolean;
  onUpdate: (updates: Partial<Omit<IMarkerPerformersGroup, "groupId">>) => void;
  onDelete: () => void;
}

const MarkerGroupEditor: React.FC<IMarkerGroupEditorProps> = ({
  group,
  availableUnnamedPerformers,
  canDelete,
  onUpdate,
  onDelete,
}) => {
  const intl = useIntl();

  const mergeNamedPerformers = (
    current: IMarkerPerformersGroup["top_performer_ids"],
    performers: Array<{ id: string; name?: string | null }>
  ) => [
    ...current.filter((p) => isUnnamedPerformerId(p.id)),
    ...performers.map((p) => ({ id: p.id, label: p.name ?? p.id })),
  ];

  const toggleUnnamed = (
    field: "top_performer_ids" | "bottom_performer_ids",
    performer: IUnnamedPerformer
  ) => {
    const current = group[field];
    const isSelected = current.some((p) => p.id === performer.id);
    onUpdate({
      [field]: isSelected
        ? current.filter((p) => p.id !== performer.id)
        : [...current, { id: performer.id, label: performer.label }],
    });
  };

  const renderUnnamedButtons = (
    field: "top_performer_ids" | "bottom_performer_ids"
  ) => {
    if (availableUnnamedPerformers.length === 0) return null;

    return (
      <div className="unnamed-performer-quick-select mt-2">
        <small className="text-muted me-2">
          <FormattedMessage id="unnamed_performers" defaultMessage="Unnamed:" />
        </small>
        {availableUnnamedPerformers.map((up) => {
          const isSelected = group[field].some((p) => p.id === up.id);
          return (
            <Button
              key={up.id}
              size="sm"
              variant={isSelected ? "info" : "outline-info"}
              className="me-1 mb-1"
              onClick={() => toggleUnnamed(field, up)}
            >
              {up.label}
            </Button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="border rounded p-3 mb-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <strong>
          <FormattedMessage id="marker" defaultMessage="Marker" />{" "}
          {group.groupId}
        </strong>
        <Button
          className="minimal"
          size="sm"
          variant="danger"
          onClick={onDelete}
          disabled={!canDelete}
        >
          <Icon icon={faTrash} />
        </Button>
      </div>

      <Form.Group className="mb-3">
        <Form.Label>
          <FormattedMessage id="tags" defaultMessage="Tags" />
        </Form.Label>
        <TagIDSelect
          isMulti
          ids={group.tag_ids.map((t) => t.id)}
          onSelect={(tags: Tag[]) =>
            onUpdate({
              tag_ids: tags.map((t) => ({
                id: t.id,
                label: t.name ?? t.id,
              })),
            })
          }
          menuPortalTarget={document.body}
        />
        <Form.Check
          type="checkbox"
          className="mt-1"
          label={intl.formatMessage({
            id: "include_sub_tags",
            defaultMessage: "Include sub-tags",
          })}
          checked={group.include_subtags}
          onChange={(e) =>
            onUpdate({ include_subtags: e.currentTarget.checked })
          }
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>
          <FormattedMessage id="mode" defaultMessage="Mode" />
        </Form.Label>
        <ButtonGroup size="sm" className="d-flex">
          <Button
            variant={
              group.performer_mode === "OR" ? "primary" : "outline-primary"
            }
            onClick={() => onUpdate({ performer_mode: "OR" })}
          >
            <FormattedMessage
              id="performer_mode_or"
              defaultMessage="Top OR Bottom"
            />
          </Button>
          <Button
            variant={
              group.performer_mode === "AND" ? "primary" : "outline-primary"
            }
            onClick={() => onUpdate({ performer_mode: "AND" })}
          >
            <FormattedMessage
              id="performer_mode_and"
              defaultMessage="Top AND Bottom"
            />
          </Button>
        </ButtonGroup>
      </Form.Group>

      <Row>
        <Col md={6}>
          <h6 className="d-flex align-items-center mb-3">
            <Badge
              pill
              variant="success"
              className="me-2"
              style={{ fontSize: 10, padding: "3px 6px" }}
            >
              <Icon icon={faArrowUp} />
            </Badge>
            <FormattedMessage id="top_performers" defaultMessage="Top" />
          </h6>
          <PerformerIDSelect
            isMulti
            ids={group.top_performer_ids
              .filter((p) => !isUnnamedPerformerId(p.id))
              .map((p) => p.id)}
            onSelect={(performers) =>
              onUpdate({
                top_performer_ids: mergeNamedPerformers(
                  group.top_performer_ids,
                  performers
                ),
              })
            }
            menuPortalTarget={document.body}
          />
          {renderUnnamedButtons("top_performer_ids")}
        </Col>

        <Col md={6}>
          <h6 className="d-flex align-items-center mb-3">
            <Badge
              pill
              variant="info"
              className="me-2"
              style={{ fontSize: 10, padding: "3px 6px" }}
            >
              <Icon icon={faArrowDown} />
            </Badge>
            <FormattedMessage id="bottom_performers" defaultMessage="Bottom" />
          </h6>
          <PerformerIDSelect
            isMulti
            ids={group.bottom_performer_ids
              .filter((p) => !isUnnamedPerformerId(p.id))
              .map((p) => p.id)}
            onSelect={(performers) =>
              onUpdate({
                bottom_performer_ids: mergeNamedPerformers(
                  group.bottom_performer_ids,
                  performers
                ),
              })
            }
            menuPortalTarget={document.body}
          />
          {renderUnnamedButtons("bottom_performer_ids")}
        </Col>
      </Row>
    </div>
  );
};

export const MarkerPerformersFilter: React.FC<IMarkerPerformersFilterProps> = ({
  criterion,
  setCriterion,
}) => {
  const groups = criterion.getGroups();

  const onAddGroup = () => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.addGroup();
    setCriterion(c);
  };

  const onUpdateGroup = (
    groupId: string,
    updates: Partial<Omit<IMarkerPerformersGroup, "groupId">>
  ) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.updateGroup(groupId, updates);
    setCriterion(c);
  };

  const onDeleteGroup = (groupId: string) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.removeGroup(groupId);
    setCriterion(c);
  };

  const onUnnamedPerformersChange = (performers: IUnnamedPerformer[]) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    const validIds = new Set(performers.map((p) => p.id));
    c.ensureGroups();
    c.value.unnamed_performers = performers;
    c.value.groups = (c.value.groups ?? []).map((group) => ({
      ...group,
      top_performer_ids: group.top_performer_ids.filter(
        (p) => !isUnnamedPerformerId(p.id) || validIds.has(p.id)
      ),
      bottom_performer_ids: group.bottom_performer_ids.filter(
        (p) => !isUnnamedPerformerId(p.id) || validIds.has(p.id)
      ),
    }));
    setCriterion(c);
  };

  return (
    <div className="marker-performers-filter">
      <UnnamedPerformersManager
        performers={criterion.value.unnamed_performers ?? []}
        onPerformersChange={onUnnamedPerformersChange}
      />

      {groups.map((group) => (
        <MarkerGroupEditor
          key={group.groupId}
          group={group}
          availableUnnamedPerformers={criterion.value.unnamed_performers ?? []}
          canDelete={groups.length > 1}
          onUpdate={(updates) => onUpdateGroup(group.groupId, updates)}
          onDelete={() => onDeleteGroup(group.groupId)}
        />
      ))}

      <Button
        variant="secondary"
        size="sm"
        onClick={onAddGroup}
        className="w-100"
      >
        <Icon icon={faPlus} className="me-2" />
        <FormattedMessage
          id="add_marker_config"
          defaultMessage="Add Marker Configuration"
        />
      </Button>
    </div>
  );
};

export default MarkerPerformersFilter;
