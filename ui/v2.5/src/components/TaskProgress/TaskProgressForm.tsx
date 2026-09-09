import React, { useEffect, useState } from "react";
import { useApolloClient } from "@apollo/client";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import { TagSelect } from "../Tags/TagSelect";
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
}

export const TaskProgressForm: React.FC<IProps> = ({
  tracker,
  saveError,
  busy,
  onClose,
  onSave,
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
  const [reset, setReset] = useState(false);
  const [preview, setPreview] = useState<number>();
  const [error, setError] = useState<string>();
  const [counting, setCounting] = useState(false);
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
        reset_goal: reset || scopeChanged,
        ...(tracker ? { status } : {}),
      })
    )
      onClose();
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
                  {t("Started on")}: {tracker.started_on}
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
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button type="submit" disabled={!valid || busy}>
            {t(busy ? "Saving…" : "Save tracker")}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};
