import React from "react";
import { Badge, Button, ButtonGroup, Col, Form, Row } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import {
  SceneMarkersExcludeCriterion,
  ISceneMarkersExcludeGroup,
} from "src/models/list-filter/criteria/scene-markers-exclude";
import {
  IUnnamedPerformer,
  isUnnamedPerformerId,
} from "src/models/list-filter/criteria/unnamed-performer";
import {
  PerformerIDSelect,
  Performer,
} from "src/components/Performers/PerformerSelect";
import { Tag, TagIDSelect } from "src/components/Tags/TagSelect";
import {
  faArrowUp,
  faArrowDown,
  faPlus,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { UnnamedPerformersManager } from "./UnnamedPerformerManager";
import { ROLE_COLORS_CUSTOM } from "src/utils/roleColors_custom"; // CUSTOM

interface ISceneMarkersExcludeFilterProps {
  criterion: SceneMarkersExcludeCriterion;
  setCriterion: (c: SceneMarkersExcludeCriterion) => void;
}

interface IGroupEditorProps {
  group: ISceneMarkersExcludeGroup;
  availableUnnamedPerformers: IUnnamedPerformer[];
  onUpdate: (
    updates: Partial<Omit<ISceneMarkersExcludeGroup, "groupId">>
  ) => void;
  onDelete: () => void;
  canDelete: boolean;
}

const GroupEditor: React.FC<IGroupEditorProps> = ({
  group,
  availableUnnamedPerformers,
  onUpdate,
  onDelete,
  canDelete,
}) => {
  const intl = useIntl();

  // Tags handler
  const onTagsChange = (tags: Tag[]) => {
    onUpdate({
      tag_ids: tags.map((t) => ({
        id: t.id,
        label: t.name ?? t.id,
      })),
    });
  };

  const onDepthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ depth: e.target.checked ? -1 : 0 });
  };

  // Top handlers
  const onTopPerformersChange = (performers: Performer[]) => {
    const unnamed = group.top_performer_ids.filter((p) =>
      isUnnamedPerformerId(p.id)
    );
    onUpdate({
      top_performer_ids: [
        ...unnamed,
        ...performers.map((p) => ({
          id: p.id,
          label: p.name ?? p.id,
        })),
      ],
    });
  };

  // Bottom handlers
  const onBottomPerformersChange = (performers: Performer[]) => {
    const unnamed = group.bottom_performer_ids.filter((p) =>
      isUnnamedPerformerId(p.id)
    );
    onUpdate({
      bottom_performer_ids: [
        ...unnamed,
        ...performers.map((p) => ({
          id: p.id,
          label: p.name ?? p.id,
        })),
      ],
    });
  };

  // Helper to toggle unnamed performer in top performer list
  const toggleUnnamedInTop = (up: IUnnamedPerformer) => {
    const isSelected = group.top_performer_ids.some((p) => p.id === up.id);
    if (isSelected) {
      onUpdate({
        top_performer_ids: group.top_performer_ids.filter(
          (p) => p.id !== up.id
        ),
      });
    } else {
      onUpdate({
        top_performer_ids: [
          ...group.top_performer_ids,
          { id: up.id, label: up.label },
        ],
      });
    }
  };

  // Helper to toggle unnamed performer in bottom performer list
  const toggleUnnamedInBottom = (up: IUnnamedPerformer) => {
    const isSelected = group.bottom_performer_ids.some((p) => p.id === up.id);
    if (isSelected) {
      onUpdate({
        bottom_performer_ids: group.bottom_performer_ids.filter(
          (p) => p.id !== up.id
        ),
      });
    } else {
      onUpdate({
        bottom_performer_ids: [
          ...group.bottom_performer_ids,
          { id: up.id, label: up.label },
        ],
      });
    }
  };

  return (
    <div className="scene-marker-config border rounded mb-3">
      <div className="d-flex justify-content-between align-items-center border-bottom px-2 py-2">
        <Badge variant="danger">
          <FormattedMessage id="marker" defaultMessage="Marker" />{" "}
          {group.groupId}
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
      </div>
      <div className="p-3">
        {/* Tags section at the top */}
        <Form.Group className="mb-3">
          <Form.Label>
            <FormattedMessage id="tags" defaultMessage="Tags" />
          </Form.Label>
          <TagIDSelect
            isMulti
            ids={group.tag_ids.map((t) => t.id)}
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

        {/* Performer mode toggle - AND vs OR mode */}
        <Form.Group className="mb-3">
          <Form.Label>
            <FormattedMessage id="mode" defaultMessage="Mode" />
          </Form.Label>
          <ButtonGroup size="sm" className="d-flex">
            <Button
              variant={
                group.performer_mode === "OR" ? "danger" : "outline-danger"
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
                group.performer_mode === "AND" ? "danger" : "outline-danger"
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
          {/* Top Column */}
          <Col md={6}>
            <h6 className="d-flex align-items-center mb-3">
              <Badge
                pill
                variant={ROLE_COLORS_CUSTOM.top.variant}
                className="me-2"
                style={{ fontSize: 10, padding: "3px 6px" }}
              >
                <Icon icon={faArrowUp} />
              </Badge>
              <FormattedMessage id="top_performers" defaultMessage="Top" />
            </h6>

            {/* Top Performers */}
            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="performers" defaultMessage="Vatos" />
              </Form.Label>
              <PerformerIDSelect
                isMulti
                ids={group.top_performer_ids
                  .filter((p) => !isUnnamedPerformerId(p.id))
                  .map((p) => p.id)}
                onSelect={onTopPerformersChange}
                menuPortalTarget={document.body}
              />
              {/* Unnamed performer quick-select buttons */}
              {availableUnnamedPerformers.length > 0 && (
                <div className="unnamed-performer-quick-select mt-2">
                  <small className="text-muted me-2">
                    <FormattedMessage
                      id="unnamed_performers"
                      defaultMessage="Unnamed:"
                    />
                  </small>
                  {availableUnnamedPerformers.map((up) => {
                    const isSelected = group.top_performer_ids.some(
                      (p) => p.id === up.id
                    );
                    return (
                      <Button
                        key={up.id}
                        size="sm"
                        variant={
                          isSelected
                            ? ROLE_COLORS_CUSTOM.top.variant
                            : ROLE_COLORS_CUSTOM.top.outlineVariant
                        }
                        className="me-1 mb-1"
                        onClick={() => toggleUnnamedInTop(up)}
                      >
                        {up.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </Form.Group>
          </Col>

          {/* Bottom Column */}
          <Col md={6}>
            <h6 className="d-flex align-items-center mb-3">
              <Badge
                pill
                variant={ROLE_COLORS_CUSTOM.bottom.variant}
                className="me-2"
                style={{ fontSize: 10, padding: "3px 6px" }}
              >
                <Icon icon={faArrowDown} />
              </Badge>
              <FormattedMessage
                id="bottom_performers"
                defaultMessage="Bottom"
              />
            </h6>

            {/* Bottom Performers */}
            <Form.Group className="mb-3">
              <Form.Label>
                <FormattedMessage id="performers" defaultMessage="Vatos" />
              </Form.Label>
              <PerformerIDSelect
                isMulti
                ids={group.bottom_performer_ids
                  .filter((p) => !isUnnamedPerformerId(p.id))
                  .map((p) => p.id)}
                onSelect={onBottomPerformersChange}
                menuPortalTarget={document.body}
              />
              {/* Unnamed performer quick-select buttons */}
              {availableUnnamedPerformers.length > 0 && (
                <div className="unnamed-performer-quick-select mt-2">
                  <small className="text-muted me-2">
                    <FormattedMessage
                      id="unnamed_performers"
                      defaultMessage="Unnamed:"
                    />
                  </small>
                  {availableUnnamedPerformers.map((up) => {
                    const isSelected = group.bottom_performer_ids.some(
                      (p) => p.id === up.id
                    );
                    return (
                      <Button
                        key={up.id}
                        size="sm"
                        variant={
                          isSelected
                            ? ROLE_COLORS_CUSTOM.bottom.variant
                            : ROLE_COLORS_CUSTOM.bottom.outlineVariant
                        }
                        className="me-1 mb-1"
                        onClick={() => toggleUnnamedInBottom(up)}
                      >
                        {up.label}
                      </Button>
                    );
                  })}
                </div>
              )}
            </Form.Group>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export const SceneMarkersExcludeFilter: React.FC<
  ISceneMarkersExcludeFilterProps
> = ({ criterion, setCriterion }) => {
  const onAddGroup = () => {
    const c = criterion.clone() as SceneMarkersExcludeCriterion;
    c.addGroup();
    setCriterion(c);
  };

  const onUpdateGroup = (
    groupId: string,
    updates: Partial<Omit<ISceneMarkersExcludeGroup, "groupId">>
  ) => {
    const c = criterion.clone() as SceneMarkersExcludeCriterion;
    c.updateGroup(groupId, updates);
    setCriterion(c);
  };

  const onDeleteGroup = (groupId: string) => {
    const c = criterion.clone() as SceneMarkersExcludeCriterion;
    c.removeGroup(groupId);
    setCriterion(c);
  };

  // Handler for unnamed performers at criterion level
  const onUnnamedPerformersChange = (performers: IUnnamedPerformer[]) => {
    const c = criterion.clone() as SceneMarkersExcludeCriterion;
    const validIds = new Set(performers.map((p) => p.id));
    c.value.unnamed_performers = performers;
    c.value.groups = c.value.groups.map((group) => ({
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

  const usedUnnamedPerformerIds = React.useMemo(() => {
    const usedIds = new Set<string>();
    criterion.value.groups.forEach((group) => {
      [...group.top_performer_ids, ...group.bottom_performer_ids].forEach(
        (performer) => {
          if (isUnnamedPerformerId(performer.id)) {
            usedIds.add(performer.id);
          }
        }
      );
    });
    return Array.from(usedIds);
  }, [criterion.value.groups]);

  // Auto-add first group if empty
  React.useEffect(() => {
    if (criterion.value.groups.length === 0) {
      onAddGroup();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="scene-markers-exclude-filter">
      {/* Unnamed Performers Manager at criterion level - shared across all groups */}
      <UnnamedPerformersManager
        performers={criterion.value.unnamed_performers ?? []}
        usedPerformerIds={usedUnnamedPerformerIds}
        onPerformersChange={onUnnamedPerformersChange}
      />

      {criterion.value.groups.map((group) => (
        <GroupEditor
          key={group.groupId}
          group={group}
          availableUnnamedPerformers={criterion.value.unnamed_performers ?? []}
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
        <FormattedMessage
          id="add_marker_config"
          defaultMessage="Add Marker Configuration"
        />
      </Button>
    </div>
  );
};

export default SceneMarkersExcludeFilter;
