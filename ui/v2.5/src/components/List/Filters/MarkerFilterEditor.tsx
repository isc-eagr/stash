import { useState } from "react";
import { Button, ButtonGroup, Form, Modal } from "react-bootstrap";
import { useIntl } from "react-intl";
import {
  faArrowDown,
  faArrowUp,
  faPencilAlt,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { PerformerIDSelect } from "src/components/Performers/PerformerSelect";
import { TagIDSelect } from "src/components/Tags/TagSelect";
import { Icon } from "src/components/Shared/Icon";
import {
  cloneUnnamedPerformer,
  createUnnamedPerformer,
  formatUnnamedPerformerSummary,
} from "src/models/list-filter/criteria/unnamed-performer";
import type { IUnnamedPerformer } from "src/models/list-filter/criteria/unnamed-performer";
import {
  MARKER_ROLE_PREFIX_CUSTOM,
  MARKER_VATO_ROLES_CUSTOM,
  isMarkerGroupEmptyCustom,
  markerGroupPeopleCustom,
  markerGroupSentenceCustom,
  markerTagsSummaryCustom,
  markerVatoLabelCustom,
  setMarkerPeopleCustom,
  setMarkerPersonRoleCustom,
} from "src/models/list-filter/criteria/marker-group_custom";
import type { MarkerVatoRoleCustom } from "src/models/list-filter/criteria/marker-group_custom";
import { ROLE_COLORS_CUSTOM } from "src/utils/roleColors_custom";
import { UnnamedPerformerEditor } from "./UnnamedPerformerManager";
import {
  markerEditorAppliedCustom,
  markerEditorDraftCustom,
  markerEditorGroupsCustom,
  markerSelectedVatosCustom,
  markerUnnamedSelectOptionsCustom,
  markerUnnamedUsesCustom,
  removeMarkerUnnamedCustom,
  saveMarkerUnnamedCustom,
} from "./markerFilterEditor_custom";
import type {
  IMarkerEditorGroup,
  MarkerEditorCriterion,
} from "./markerFilterEditor_custom";
import "./markerFilterEditor_custom.scss";

type MarkerSection = "tags" | "vatos";
type MarkerScope = "markers" | "scenes" | "exclude";

interface IMarkerFilterEditorProps<T extends MarkerEditorCriterion> {
  criterion: T;
  setCriterion: (criterion: T) => void;
  scope: MarkerScope;
}

interface IEditingVato {
  performer: IUnnamedPerformer;
  isNew: boolean;
}

// Stable badge color per vato letter, so a shared vato is recognisable in
// every marker.
function vatoColorCustom(vato: IUnnamedPerformer) {
  const index = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(vato.letter);
  return `marker-editor-vato-color-${(index < 0 ? 0 : index) % 6}`;
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
  const groupIndex = Math.max(
    0,
    groups.findIndex((g) => g.groupId === groupId)
  );
  const group = groups[groupIndex];
  const people = source.value.unnamed_performers ?? [];
  const unnamedOptions = markerUnnamedSelectOptionsCustom(people);
  const title =
    scope === "markers"
      ? msg("marker_performers", "Marker Match")
      : scope === "exclude"
      ? msg("scene_markers_exclude", "Scene Markers: Exclude")
      : msg("scene_markers", "Scene Markers");
  const unrestricted = msg("marker_editor.unrestricted", "Unrestricted");
  const roleLabels: Record<MarkerVatoRoleCustom, string> = {
    top: msg("marker_editor.role_top", "Top"),
    bottom: msg("marker_editor.role_bottom", "Bottom"),
    both: msg("marker_editor.role_both", "Both"),
    either: msg("marker_editor.role_either", "Any role"),
  };

  function overlapping(value: T) {
    return (
      scope === "markers" ||
      (scope === "scenes" &&
        "require_overlap" in value.value &&
        value.value.require_overlap)
    );
  }

  function connectorLabel(value: T) {
    if (scope === "exclude") return msg("marker_editor.connector_or", "or");
    return overlapping(value)
      ? msg("marker_editor.connector_while", "while")
      : msg("marker_editor.connector_and", "and");
  }

  function markerLabel(index: number) {
    return `${msg("marker", "Marker")} ${index + 1}`;
  }

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

  function addGroup() {
    if (!draft) return;
    const next = markerEditorDraftCustom(draft);
    const id = next.addGroup();
    setDraft(next);
    setGroupId(id);
    setSection("tags");
  }

  function vatoBadge(id: string) {
    const vato = people.find((p) => p.id === id);
    if (!vato) return null;
    return (
      <span
        className={`marker-editor-vato-badge ${vatoColorCustom(vato)}`}
        aria-hidden
      >
        {vato.letter}
      </span>
    );
  }

  function usesLabel(id: string) {
    return markerUnnamedUsesCustom(groups, id)
      .map((use) => `${markerLabel(use.index)} · ${roleLabels[use.role]}`)
      .join(" / ");
  }

  function filledMarkers(value: T) {
    return markerEditorGroupsCustom(value)
      .map((g, index) => ({ g, index }))
      .filter(({ g }) => !isMarkerGroupEmptyCustom(g));
  }

  function renderSummary() {
    const rows = filledMarkers(criterion);
    return (
      <div className="marker-editor-summary">
        {rows.map(({ g, index }, i) => (
          <div key={g.groupId}>
            {i > 0 && (
              <small className="marker-editor-connector text-muted">
                {connectorLabel(criterion)}
              </small>
            )}
            <Button
              variant="link"
              className="marker-editor-summary-row"
              onClick={() => open(g.groupId)}
            >
              <span className="marker-editor-summary-title">
                {markerLabel(index)}
              </span>
              <span>
                {markerGroupSentenceCustom(
                  g,
                  criterion.value.unnamed_performers ?? []
                )}
              </span>
            </Button>
          </div>
        ))}
        <Button
          variant="outline-primary"
          size="sm"
          className="marker-editor-open"
          onClick={() => open()}
        >
          {msg("marker_editor.edit", "Edit markers")}
        </Button>
      </div>
    );
  }

  function renderVatos() {
    if (!group) return null;
    const members = markerGroupPeopleCustom(group);
    return (
      <>
        <Form.Group>
          <Form.Label>{msg("marker_editor.vatos", "Vatos")}</Form.Label>
          <PerformerIDSelect
            isMulti
            ids={members.map((p) => p.id)}
            additionalOptions={unnamedOptions}
            onSelect={(performers) =>
              updateGroup(
                setMarkerPeopleCustom(
                  group,
                  markerSelectedVatosCustom(performers)
                )
              )
            }
            menuPortalTarget={document.body}
          />
        </Form.Group>
        {!!members.length && (
          <ul className="marker-editor-vatos">
            {members.map((person) => {
              const vato = people.find((p) => p.id === person.id);
              return (
                <li className="marker-editor-vato" key={person.id}>
                  <span className="marker-editor-vato-name">
                    {vatoBadge(person.id)}
                    <span>
                      {vato?.label ?? person.label}
                      {vato && (
                        <small className="text-muted">
                          {formatUnnamedPerformerSummary(vato)}
                        </small>
                      )}
                    </span>
                  </span>
                  <ButtonGroup
                    size="sm"
                    className="marker-editor-roles"
                    aria-label={`${msg("marker_editor.role", "Role")}: ${
                      vato?.label ?? person.label
                    }`}
                  >
                    {MARKER_VATO_ROLES_CUSTOM.map((role) => (
                      <Button
                        key={role}
                        variant={
                          person.role === role ? "primary" : "secondary"
                        }
                        aria-pressed={person.role === role}
                        onClick={() =>
                          updateGroup(
                            setMarkerPersonRoleCustom(group, person.id, role)
                          )
                        }
                      >
                        {(role === "top" || role === "both") && (
                          <Icon
                            icon={faArrowUp}
                            className={
                              person.role === role
                                ? undefined
                                : `text-${ROLE_COLORS_CUSTOM.top.variant}`
                            }
                          />
                        )}
                        {(role === "bottom" || role === "both") && (
                          <Icon
                            icon={faArrowDown}
                            className={
                              person.role === role
                                ? undefined
                                : `text-${ROLE_COLORS_CUSTOM.bottom.variant}`
                            }
                          />
                        )}{" "}
                        {roleLabels[role]}
                      </Button>
                    ))}
                  </ButtonGroup>
                  <span className="marker-editor-vato-actions">
                    {vato && (
                      <Button
                        variant="link"
                        size="sm"
                        title={msg("marker_editor.edit_vato", "Edit vato")}
                        aria-label={`${msg(
                          "marker_editor.edit_vato",
                          "Edit vato"
                        )}: ${vato.label}`}
                        onClick={() =>
                          setEditing({
                            performer: cloneUnnamedPerformer(vato),
                            isNew: false,
                          })
                        }
                      >
                        <Icon icon={faPencilAlt} />
                      </Button>
                    )}
                    <Button
                      variant="link"
                      size="sm"
                      title={msg("actions.remove", "Remove")}
                      aria-label={`${msg("actions.remove", "Remove")}: ${
                        vato?.label ?? person.label
                      }`}
                      onClick={() =>
                        updateGroup(
                          setMarkerPeopleCustom(
                            group,
                            members.filter((p) => p.id !== person.id)
                          )
                        )
                      }
                    >
                      <Icon icon={faTimes} />
                    </Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div className="marker-editor-vato-footer">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() =>
              setEditing({
                performer: createUnnamedPerformer(people),
                isNew: true,
              })
            }
          >
            + {msg("marker_editor.new_vato", "Unnamed vato")}
          </Button>
          {!!people.length && (
            <small className="text-muted">
              {msg(
                "marker_editor.vato_letters",
                "Same letter = same vato in every marker. Different letters are different people."
              )}
            </small>
          )}
        </div>
      </>
    );
  }

  function renderEditingVato() {
    if (!editing || !group) return null;
    const uses = markerUnnamedUsesCustom(groups, editing.performer.id);
    return (
      <>
        {!editing.isNew && (
          <div className="marker-editor-group-options">
            <Button
              variant="link"
              size="sm"
              className="text-danger"
              onClick={() => {
                edit((next) =>
                  removeMarkerUnnamedCustom(next, editing.performer.id)
                );
                setEditing(null);
              }}
            >
              {msg("marker_editor.delete_vato", "Delete vato from all markers")}
            </Button>
          </div>
        )}
        {uses.length > 1 && (
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
              saveMarkerUnnamedCustom(
                next,
                performer,
                editing.isNew ? { groupId: group.groupId } : undefined
              )
            );
            setEditing(null);
          }}
        />
      </>
    );
  }

  const applied = draft ? markerEditorAppliedCustom(draft) : null;
  const draftRows = draft ? filledMarkers(draft) : [];

  return (
    <div className="marker-filter-editor">
      {renderSummary()}
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
            <Modal.Body className="marker-editor-sentence" aria-live="polite">
              {draftRows.length ? (
                draftRows.map(({ g, index }, i) => (
                  <span key={g.groupId}>
                    {i > 0 && (
                      <span className="text-muted">
                        {" "}
                        {connectorLabel(draft)}{" "}
                      </span>
                    )}
                    <strong>{markerLabel(index)}:</strong>{" "}
                    {markerGroupSentenceCustom(g, people)}
                  </span>
                ))
              ) : (
                <span className="text-muted">
                  {msg("marker_editor.no_markers", "No markers yet")}
                </span>
              )}
            </Modal.Body>
            <Modal.Body
              className="marker-editor-groups"
              aria-label={msg(
                "marker_editor.configurations",
                "Marker configurations"
              )}
            >
              {groups.map((g, index) => (
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
                  onClick={() => setGroupId(g.groupId)}
                >
                  {markerLabel(index)}
                  {isMarkerGroupEmptyCustom(g) && (
                    <small className="marker-editor-empty">
                      {" "}
                      · {msg("marker_editor.empty", "empty")}
                    </small>
                  )}
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
                            "Any matching marker hides the scene"
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
                    {msg("actions.remove", "Remove")} {markerLabel(groupIndex)}
                  </Button>
                </div>
              )}
              <div className="marker-editor-layout">
                <nav
                  className="marker-editor-outline"
                  aria-label={msg("marker_editor.sections", "Marker sections")}
                >
                  {(["tags", "vatos"] as const).map((s) => (
                    <Button
                      key={s}
                      variant="link"
                      className="marker-editor-section"
                      aria-pressed={section === s}
                      aria-controls="marker-editor-detail"
                      disabled={!!editing}
                      onClick={() => setSection(s)}
                    >
                      <span>
                        {s === "tags"
                          ? msg("tags", "Tags")
                          : msg("marker_editor.vatos", "Vatos")}
                      </span>
                      <small>
                        {s === "tags"
                          ? group.tag_ids.length
                            ? markerTagsSummaryCustom(group)
                            : unrestricted
                          : markerGroupPeopleCustom(group)
                              .map(
                                (p) =>
                                  `${
                                    MARKER_ROLE_PREFIX_CUSTOM[p.role]
                                  }${markerVatoLabelCustom(p, people)}`
                              )
                              .join(", ") || unrestricted}
                      </small>
                    </Button>
                  ))}
                </nav>
                <div className="marker-editor-detail" id="marker-editor-detail">
                  {editing ? (
                    renderEditingVato()
                  ) : section === "tags" ? (
                    <Form.Group>
                      <Form.Label>
                        {msg("tags", "Tags")}{" "}
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
                    renderVatos()
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
                disabled={!!editing || !applied?.isValid()}
                onClick={() => {
                  if (applied) setCriterion(applied);
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
