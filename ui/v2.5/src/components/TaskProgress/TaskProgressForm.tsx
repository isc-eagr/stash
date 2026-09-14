import React, { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import { TagSelect } from "../Tags/TagSelect";
import { formatTaskProgressDate } from "../taskProgress_custom";
import {
  itemTypes,
  taskProgressStatusLabel,
  taskProgressStatuses,
  Tracker,
  useProgressText,
} from "./progressView_custom";

interface IProps {
  saveError?: string;
  tracker?: Tracker;
  busy: boolean;
  onClose: () => void;
  onSave: (
    input: GQL.TaskProgressTrackerCreateInput & {
      reset_goal?: boolean;
      status?: string;
    }
  ) => Promise<boolean>;
  onArchive?: () => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
}

export const TaskProgressForm: React.FC<IProps> = ({
  tracker,
  saveError,
  busy,
  onClose,
  onSave,
  onArchive,
  onDelete,
}) => {
  const t = useProgressText();
  const client = useApolloClient();
  const [title, setTitle] = useState(tracker?.title ?? "");
  const [description, setDescription] = useState(tracker?.description ?? "");
  const [tag, setTag] = useState({
    id: tracker?.tag_id ?? "",
    name: tracker?.tag_name ?? "",
  });
  const types = tracker?.item_types ?? itemTypes;
  const [mode, setMode] = useState(tracker?.mode ?? "BACKLOG");
  const [status, setStatus] = useState(tracker?.status ?? "ACTIVE");
  const [goalPerDay, setGoalPerDay] = useState(
    tracker?.goal_per_day?.toString() ?? ""
  );
  const [reset, setReset] = useState(false);
  const [preview, setPreview] = useState<number>();
  const [error, setError] = useState<string>();
  const [counting, setCounting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>();
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false);
  const scopeChanged =
    !!tracker &&
    (tag.id !== tracker.tag_id ||
      mode !== tracker.mode ||
      types.join(",") !== tracker.item_types.join(","));
  useEffect(() => {
    let current = true;
    setPreview(undefined);
    setError(undefined);
    if (!tag.id || !types.length) {
      setCounting(false);
      return () => {
        current = false;
      };
    }
    setCounting(true);
    client
      .query<GQL.TaskProgressPreviewQuery>({
        query: GQL.TaskProgressPreviewDocument,
        variables: { tag_id: tag.id, item_types: types },
        fetchPolicy: "network-only",
      })
      .then((result) => {
        if (current) setPreview(result.data.taskProgressPreview);
      })
      .catch((e) => {
        if (current) setError(e.message);
      })
      .finally(() => {
        if (current) setCounting(false);
      });
    return () => {
      current = false;
    };
  }, [client, tag.id, types]);
  const valid =
    title.trim() &&
    tag.id &&
    types.length &&
    !counting &&
    preview !== undefined;
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || busy) return;
    if (
      await onSave({
        title: title.trim(),
        description: description.trim(),
        tag_id: tag.id,
        item_types: types,
        mode,
        goal_per_day: goalPerDay ? Number(goalPerDay) : tracker ? 0 : undefined,
        reset_goal: reset || scopeChanged,
        ...(tracker ? { status } : {}),
      })
    )
      onClose();
  };
  const archiveTracker = async () => {
    if (!tracker || busy || !onArchive) return;
    if (await onArchive()) onClose();
  };
  const deleteTracker = async () => {
    if (!tracker || busy || !onDelete || !deleteAcknowledged) return;
    if (await onDelete()) {
      setDeleteStep(undefined);
      onClose();
    }
  };
  return (
    <Modal
      show
      onHide={() => {
        if (!busy) onClose();
      }}
      size="lg"
      dialogClassName="task-progress-form-modal"
    >
      <Form onSubmit={save}>
        <Modal.Header closeButton={!busy}>
          <Modal.Title>
            {t(tracker ? "Edit tracker" : "Add tracker")}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <fieldset disabled={busy}>
            <Form.Group controlId="progress-title">
              <Form.Label>{t("Title")}</Form.Label>
              <Form.Control
                autoFocus
                required
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="progress-description">
              <Form.Label>{t("Description")}</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                maxLength={5000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Form.Group>
            {tracker && (
              <Form.Group controlId="progress-status">
                <Form.Label>{t("Status")}</Form.Label>
                <Form.Control
                  as="select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {taskProgressStatuses.map((value) => (
                    <option key={value} value={value}>
                      {t(taskProgressStatusLabel(value))}
                    </option>
                  ))}
                </Form.Control>
              </Form.Group>
            )}
            <Form.Group controlId="progress-goal-per-day">
              <Form.Label>{t("Goal per day")}</Form.Label>
              <Form.Control
                inputMode="numeric"
                min={1}
                max={1000000}
                step={1}
                type="number"
                value={goalPerDay}
                onChange={(event) => {
                  const { value } = event.target;
                  setGoalPerDay(
                    value === ""
                      ? ""
                      : String(
                          Math.max(
                            1,
                            Math.min(1000000, Math.floor(Number(value) || 1))
                          )
                        )
                  );
                }}
                placeholder={t("Optional")}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label id="progress-tag-label">{t("Tag")}</Form.Label>
              <TagSelect
                isMulti={false}
                values={
                  tag.id
                    ? [
                        {
                          ...tag,
                          aliases: [],
                          image_path: null,
                          sort_name: tag.name,
                          stash_ids: [],
                        },
                      ]
                    : []
                }
                onSelect={(tags) =>
                  setTag({ id: tags[0]?.id ?? "", name: tags[0]?.name ?? "" })
                }
              />
            </Form.Group>
            <Form.Group controlId="progress-mode" className="mt-3">
              <Form.Label>{t("Tracking mode")}</Form.Label>
              <Form.Control
                as="select"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="BACKLOG">
                  {t("Ongoing backlog — includes incoming work")}
                </option>
                <option value="FIXED">
                  {t("Fixed batch — only items in this baseline")}
                </option>
              </Form.Control>
            </Form.Group>
            {tracker && (
              <>
                <p>
                  {t("Started on")}:{" "}
                  {formatTaskProgressDate(tracker.started_on)}
                </p>
                <Form.Check
                  id="progress-reset"
                  label={t("Reset baseline")}
                  checked={reset || scopeChanged}
                  disabled={scopeChanged}
                  onChange={(e) => setReset(e.target.checked)}
                />
                <Form.Text className="d-block">
                  {t(
                    "Sets today's items as the new baseline and keeps history."
                  )}
                </Form.Text>
              </>
            )}
            {(reset || scopeChanged) && (
              <Alert variant="warning" className="mt-3">
                {t("New baseline; history is kept.")} {tracker?.goal} →{" "}
                {preview ?? "…"}
              </Alert>
            )}
            <p className="mt-3" aria-live="polite">
              {t("Matching items")}:{" "}
              {counting ? "…" : preview ?? t("Unavailable")}
            </p>
            {(error || saveError) && (
              <Alert variant="danger" role="alert">
                {error || saveError}
              </Alert>
            )}
          </fieldset>
        </Modal.Body>
        <Modal.Footer>
          {tracker && onDelete && (
            <Button
              className="mr-auto"
              disabled={busy}
              onClick={() => {
                setDeleteAcknowledged(false);
                setDeleteStep(1);
              }}
              type="button"
              variant="outline-danger"
            >
              {t("Delete tracker")}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={!valid || busy}>
            {t(busy ? "Saving…" : "Save tracker")}
          </Button>
        </Modal.Footer>
      </Form>
      {tracker && deleteStep && (
        <Modal
          centered
          show
          onHide={() => {
            if (!busy) setDeleteStep(undefined);
          }}
        >
          <Modal.Header closeButton={!busy}>
            <Modal.Title className="text-danger">
              {t(
                deleteStep === 1
                  ? "Archive this tracker instead?"
                  : "Delete tracker permanently?"
              )}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {deleteStep === 1 ? (
              <>
                <Alert variant="warning">
                  {t(
                    "Archiving keeps this tracker and all of its progress history."
                  )}
                </Alert>
                <p>
                  {t(
                    "Deleting permanently removes this tracker, its event history, its tracked items, and its goal history. This cannot be undone."
                  )}
                </p>
              </>
            ) : (
              <>
                <Alert variant="danger">
                  {t(
                    "This is the final confirmation. Deleted tracker data cannot be recovered."
                  )}
                </Alert>
                <Form.Check
                  checked={deleteAcknowledged}
                  id="progress-delete-acknowledged"
                  label={t(
                    "I understand that this permanently deletes all tracker data."
                  )}
                  onChange={(event) =>
                    setDeleteAcknowledged(event.target.checked)
                  }
                />
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            {deleteStep === 1 ? (
              <>
                <Button
                  disabled={busy || !onArchive}
                  onClick={() => void archiveTracker()}
                  type="button"
                  variant="secondary"
                >
                  {t("Archive tracker")}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => setDeleteStep(2)}
                  type="button"
                  variant="danger"
                >
                  {t("I understand, continue")}
                </Button>
              </>
            ) : (
              <>
                <Button
                  disabled={busy}
                  onClick={() => setDeleteStep(undefined)}
                  type="button"
                  variant="secondary"
                >
                  {t("Cancel")}
                </Button>
                <Button
                  disabled={busy || !deleteAcknowledged}
                  onClick={() => void deleteTracker()}
                  type="button"
                  variant="danger"
                >
                  {t("Permanently delete tracker")}
                </Button>
              </>
            )}
          </Modal.Footer>
        </Modal>
      )}
    </Modal>
  );
};
