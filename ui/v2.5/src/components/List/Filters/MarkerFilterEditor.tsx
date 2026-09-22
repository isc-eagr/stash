import { useState } from "react";
import { Button, ButtonGroup, Form, Modal } from "react-bootstrap";
import { useIntl } from "react-intl";
import { faArrowDown, faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { PerformerIDSelect } from "src/components/Performers/PerformerSelect";
import { TagIDSelect } from "src/components/Tags/TagSelect";
import { Icon } from "src/components/Shared/Icon";
import {
  cloneUnnamedPerformer,
  createUnnamedPerformer,
  formatUnnamedPerformerSummary,
} from "src/models/list-filter/criteria/unnamed-performer";
import type { IUnnamedPerformer } from "src/models/list-filter/criteria/unnamed-performer";
import { ROLE_COLORS_CUSTOM } from "src/utils/roleColors_custom";
import { UnnamedPerformerEditor } from "./UnnamedPerformerManager";
import {
  markerEditorDraftCustom,
  markerEditorGroupsCustom,
  markerUnnamedSelectOptionsCustom,
  markerUnnamedUsesCustom,
  markerSelectedVatosCustom,
  removeMarkerUnnamedCustom,
  saveMarkerUnnamedCustom,
} from "./markerFilterEditor_custom";
import type {
  IMarkerEditorGroup,
  MarkerEditorCriterion,
  MarkerEditorRole,
} from "./markerFilterEditor_custom";
import "./markerFilterEditor_custom.scss";

type MarkerSection = "tags" | MarkerEditorRole;
type MarkerScope = "markers" | "scenes" | "exclude";

interface IMarkerFilterEditorProps<T extends MarkerEditorCriterion> {
  criterion: T;
  setCriterion: (criterion: T) => void;
  scope: MarkerScope;
}

interface IEditingVato {
  performer: IUnnamedPerformer;
  isNew: boolean;
  role: MarkerEditorRole;
}

export function MarkerFilterEditor<T extends MarkerEditorCriterion>({
  criterion,
  setCriterion,
  scope,
}: IMarkerFilterEditorProps<T>) {
  const intl = useIntl();
  const msg = (id: string, defaultMessage: string) =>
    intl.formatMessage({ id, defaultMessage });
  const [draft, setDraft] = useState<T | null>(null);
  const [groupId, setGroupId] = useState("");
  const [section, setSection] = useState<MarkerSection>("tags");
  const [editing, setEditing] = useState<IEditingVato | null>(null);
  const source = draft ?? criterion;
  const groups = markerEditorGroupsCustom(source);
  const group = groups.find((g) => g.groupId === groupId) ?? groups[0];
  const people = source.value.unnamed_performers ?? [];
  const labels = {
    tags: msg("tags", "Tags"),
    top_performer_ids: msg("top_performers", "Top Vatos"),
    bottom_performer_ids: msg("bottom_performers", "Bottom Vatos"),
  };
  const title =
    scope === "markers"
      ? msg("marker_performers", "Markers")
      : scope === "exclude"
      ? msg("scene_markers_exclude", "Scene Markers: Exclude")
      : msg("scene_markers", "Scene Markers");
  const unrestricted = msg("marker_editor.unrestricted", "Unrestricted");
  const role =
    section === "bottom_performer_ids"
      ? "bottom_performer_ids"
      : "top_performer_ids";
  const selected = group?.[role] ?? [];
  const unnamedOptions = markerUnnamedSelectOptionsCustom(people);
  const editingUses = editing
    ? markerUnnamedUsesCustom(groups, editing.performer.id)
    : [];

  function edit(change: (next: T) => void) {
    setDraft((current) => {
      if (!current) return current;
      const next = markerEditorDraftCustom(current);
      change(next);
      return next;
    });
  }

  function updateGroup(updates: Partial<IMarkerEditorGroup>) {
    if (!group) return;
    edit((next) => {
      const target = markerEditorGroupsCustom(next).find(
        (g) => g.groupId === group.groupId
      );
      if (target) Object.assign(target, updates);
    });
  }

  function open(targetId?: string, targetSection: MarkerSection = "tags") {
    const next = markerEditorDraftCustom(criterion);
    setDraft(next);
    setGroupId(targetId ?? markerEditorGroupsCustom(next)[0].groupId);
    setSection(targetSection);
    setEditing(null);
  }

  function close() {
    setDraft(null);
    setEditing(null);
  }

  function chooseSection(next: MarkerSection) {
    setSection(next);
  }

  function addGroup() {
    if (!draft) return;
    const next = markerEditorDraftCustom(draft);
    const id = next.addGroup();
    setDraft(next);
    setGroupId(id);
    setSection("tags");
  }

  function performerLabel(id: string, fallback: string) {
    return people.find((p) => p.id === id)?.label ?? fallback;
  }

  function sectionSummary(g: IMarkerEditorGroup, s: MarkerSection) {
    const values = s === "tags" ? g.tag_ids : g[s];
    return (
      values.map((p) => performerLabel(p.id, p.label)).join(", ") ||
      unrestricted
    );
  }

  function usesLabel(id: string) {
    return markerUnnamedUsesCustom(groups, id)
      .map((use) => `${use.groupId} · ${labels[use.role]}`)
      .join(" / ");
  }

  function renderSummary(g: IMarkerEditorGroup) {
    return (
      <div className="marker-editor-summary-group" key={g.groupId}>
        <Button
          variant="link"
          className="marker-editor-summary-title"
          onClick={() => open(g.groupId)}
        >
          {msg("marker", "Marker")} {g.groupId}
        </Button>
        {(["tags", "top_performer_ids", "bottom_performer_ids"] as const).map(
          (s) => {
            const entries = s === "tags" ? g.tag_ids : g[s];
            if (!entries.length) return null;
            return (
              <Button
                key={s}
                variant="link"
                className="marker-editor-summary-row"
                onClick={() => open(g.groupId, s)}
              >
                <span>{labels[s]}</span>
                <span>
                  {entries.map((p) => {
                    const up =
                      s !== "tags"
                        ? people.find((v) => v.id === p.id)
                        : undefined;
                    return (
                      <span className="marker-editor-summary-value" key={p.id}>
                        {up
                          ? `${up.label}: ${formatUnnamedPerformerSummary(up)}`
                          : p.label}
                      </span>
                    );
                  })}
                  {s === "tags" && (!!g.depth || g.include_subtags) && (
                    <small className="text-muted">
                      {msg("include_sub_tags", "Include sub-tags")}
                    </small>
                  )}
                </span>
              </Button>
            );
          }
        )}
        {!!g.top_performer_ids.length && !!g.bottom_performer_ids.length && (
          <small className="text-muted">
            {g.performer_mode === "AND"
              ? msg("performer_mode_and", "Top AND Bottom")
              : msg("performer_mode_or", "Top OR Bottom")}
          </small>
        )}
      </div>
    );
  }

  return (
    <div className="marker-filter-editor">
      <div className="marker-editor-summary">
        {markerEditorGroupsCustom(criterion).map(renderSummary)}
        {markerEditorGroupsCustom(criterion).length > 1 && (
          <small className="text-muted">
            {scope === "markers"
              ? msg("marker_editor.overlapping", "Overlapping markers")
              : scope === "scenes" &&
                "require_overlap" in criterion.value &&
                criterion.value.require_overlap
              ? msg("marker_editor.overlapping", "Overlapping markers")
              : scope === "scenes"
              ? msg(
                  "marker_editor.every_config",
                  "Every configuration required"
                )
              : msg("marker_editor.excluded", "Excluded configurations")}
          </small>
        )}
        <Button
          variant="outline-primary"
          size="sm"
          className="marker-editor-open"
          onClick={() => open()}
        >
          {msg("marker_editor.edit", "Edit markers")}
        </Button>
      </div>
      <Modal
        show={draft !== null}
        onHide={close}
        size="xl"
        backdrop="static"
        enforceFocus={false}
        className="marker-editor-modal"
        aria-labelledby="marker-editor-title"
      >
        <Modal.Header closeButton>
          <Modal.Title id="marker-editor-title">{title}</Modal.Title>
        </Modal.Header>
        {draft && group && (
          <>
            <Modal.Body
              className="marker-editor-groups"
              aria-label={msg(
                "marker_editor.configurations",
                "Marker configurations"
              )}
            >
              {groups.map((g) => (
                <Button
                  key={g.groupId}
                  variant={
                    g.groupId === group.groupId
                      ? "primary"
                      : "outline-secondary"
                  }
                  size="sm"
                  aria-pressed={g.groupId === group.groupId}
                  disabled={!!editing}
                  onClick={() => {
                    setGroupId(g.groupId);
                  }}
                >
                  {msg("marker", "Marker")} {g.groupId}
                </Button>
              ))}
              <Button
                variant="link"
                size="sm"
                disabled={!!editing}
                onClick={addGroup}
              >
                +{" "}
                {scope === "markers"
                  ? msg("marker_editor.add_overlap", "Overlapping marker")
                  : msg("marker_editor.add_marker", "Marker")}
              </Button>
            </Modal.Body>
            <Modal.Body>
              {groups.length > 1 && (
                <div className="marker-editor-group-options">
                  {scope === "scenes" && "require_overlap" in draft.value ? (
                    <Form.Check
                      id="marker-editor-overlap"
                      checked={draft.value.require_overlap}
                      disabled={!!editing}
                      label={msg(
                        "marker_editor.require_overlap",
                        "Require overlap"
                      )}
                      onChange={(event) => {
                        const { checked } = event.currentTarget;
                        edit((next) => {
                          if ("require_overlap" in next.value)
                            next.value.require_overlap = checked;
                        });
                      }}
                    />
                  ) : (
                    <small className="text-muted">
                      {scope === "markers"
                        ? msg(
                            "marker_editor.overlapping",
                            "Overlapping markers"
                          )
                        : msg(
                            "marker_editor.excluded",
                            "Excluded configurations"
                          )}
                    </small>
                  )}
                  <Button
                    variant="link"
                    size="sm"
                    disabled={!!editing}
                    onClick={() => {
                      edit((next) => next.removeGroup(group.groupId));
                      setGroupId(
                        groups.find((g) => g.groupId !== group.groupId)
                          ?.groupId ?? ""
                      );
                    }}
                  >
                    {msg("actions.remove", "Remove")} {group.groupId}
                  </Button>
                </div>
              )}
              <div className="marker-editor-layout">
                <nav
                  className="marker-editor-outline"
                  aria-label={msg("marker_editor.sections", "Marker sections")}
                >
                  {(
                    [
                      "tags",
                      "top_performer_ids",
                      "bottom_performer_ids",
                    ] as const
                  ).map((s) => (
                    <Button
                      key={s}
                      variant="link"
                      className="marker-editor-section"
                      aria-pressed={section === s}
                      aria-controls="marker-editor-detail"
                      disabled={!!editing}
                      onClick={() => chooseSection(s)}
                    >
                      <span>
                        {s !== "tags" && (
                          <Icon
                            icon={
                              s === "top_performer_ids"
                                ? faArrowUp
                                : faArrowDown
                            }
                            className={`text-${
                              s === "top_performer_ids"
                                ? ROLE_COLORS_CUSTOM.top.variant
                                : ROLE_COLORS_CUSTOM.bottom.variant
                            }`}
                          />
                        )}{" "}
                        {labels[s]}
                      </span>
                      <small>{sectionSummary(group, s)}</small>
                    </Button>
                  ))}
                  {!!group.top_performer_ids.length &&
                    !!group.bottom_performer_ids.length && (
                      <div className="marker-editor-mode">
                        <small className="text-muted">
                          {msg("marker_editor.roles", "Role requirements")}
                        </small>
                        <ButtonGroup vertical size="sm">
                          {(["AND", "OR"] as const).map((mode) => (
                            <Button
                              key={mode}
                              variant={
                                group.performer_mode === mode
                                  ? "primary"
                                  : "outline-primary"
                              }
                              aria-pressed={group.performer_mode === mode}
                              disabled={!!editing}
                              onClick={() =>
                                updateGroup({ performer_mode: mode })
                              }
                            >
                              {mode === "AND"
                                ? msg("marker_editor.both", "Both · AND")
                                : msg("marker_editor.either", "Either · OR")}
                            </Button>
                          ))}
                        </ButtonGroup>
                      </div>
                    )}
                </nav>
                <div className="marker-editor-detail" id="marker-editor-detail">
                  {editing ? (
                    <>
                      {!editing.isNew && (
                        <div className="marker-editor-group-options">
                          <Button
                            variant="link"
                            size="sm"
                            className="text-danger"
                            onClick={() => {
                              edit((next) =>
                                removeMarkerUnnamedCustom(
                                  next,
                                  editing.performer.id
                                )
                              );
                              setEditing(null);
                            }}
                          >
                            {msg(
                              "marker_editor.delete_vato",
                              "Delete vato from all markers"
                            )}
                          </Button>
                        </div>
                      )}
                      {editingUses.length > 1 && (
                        <div className="marker-editor-shared text-muted">
                          {msg("marker_editor.same_person", "Same vato")}:{" "}
                          {usesLabel(editing.performer.id)}
                        </div>
                      )}
                      <UnnamedPerformerEditor
                        key={editing.performer.id}
                        performer={editing.performer}
                        isNew={editing.isNew}
                        inModal
                        onCancel={() => setEditing(null)}
                        onSave={(performer) => {
                          edit((next) =>
                            saveMarkerUnnamedCustom(next, performer)
                          );
                          setEditing(null);
                        }}
                      />
                    </>
                  ) : section === "tags" ? (
                    <Form.Group>
                      <Form.Label>
                        {labels.tags}{" "}
                        <small className="text-muted">
                          · {msg("marker_editor.all", "Match all")}
                        </small>
                      </Form.Label>
                      <TagIDSelect
                        isMulti
                        ids={group.tag_ids.map((tag) => tag.id)}
                        onSelect={(tags) =>
                          updateGroup({
                            tag_ids: tags.map((tag) => ({
                              id: tag.id,
                              label: tag.name ?? tag.id,
                            })),
                          })
                        }
                        menuPortalTarget={document.body}
                      />
                      <Form.Check
                        id="marker-editor-subtags"
                        className="mt-3"
                        label={msg("include_sub_tags", "Include sub-tags")}
                        checked={!!group.depth || !!group.include_subtags}
                        onChange={(event) =>
                          updateGroup(
                            "include_subtags" in group
                              ? { include_subtags: event.currentTarget.checked }
                              : { depth: event.currentTarget.checked ? -1 : 0 }
                          )
                        }
                      />
                    </Form.Group>
                  ) : (
                    <>
                      <Form.Group>
                        <Form.Label>{labels[role]}</Form.Label>
                        <PerformerIDSelect
                          isMulti
                          ids={selected.map((p) => p.id)}
                          additionalOptions={unnamedOptions}
                          onSelect={(performers) =>
                            updateGroup({
                              [role]: markerSelectedVatosCustom(performers),
                            })
                          }
                          menuPortalTarget={document.body}
                        />
                      </Form.Group>
                      <div className="marker-editor-vato-actions">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => {
                            setEditing({
                              performer: createUnnamedPerformer(people),
                              isNew: true,
                              role,
                            });
                          }}
                        >
                          + {msg("marker_editor.new_vato", "Unnamed vato")}
                        </Button>
                        {!!people.length && (
                          <Form.Control
                            as="select"
                            size="sm"
                            className="marker-editor-edit-vato"
                            value=""
                            aria-label={msg(
                              "marker_editor.edit_vato",
                              "Edit unnamed vato"
                            )}
                            onChange={(event) => {
                              const performer = people.find(
                                (person) =>
                                  person.id === event.currentTarget.value
                              );
                              if (performer)
                                setEditing({
                                  performer: cloneUnnamedPerformer(performer),
                                  isNew: false,
                                  role,
                                });
                            }}
                          >
                            <option value="">
                              {msg(
                                "marker_editor.edit_vato",
                                "Edit unnamed vato"
                              )}
                            </option>
                            {people.map((performer) => (
                              <option key={performer.id} value={performer.id}>
                                {performer.label}
                              </option>
                            ))}
                          </Form.Control>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={close}>
                {msg("actions.cancel", "Cancel")}
              </Button>
              <Button
                variant="primary"
                disabled={!!editing || !draft.isValid()}
                onClick={() => {
                  setCriterion(draft);
                  close();
                }}
              >
                {msg("actions.apply", "Apply")}
              </Button>
            </Modal.Footer>
          </>
        )}
      </Modal>
    </div>
  );
}
