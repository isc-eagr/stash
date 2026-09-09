import React, { useState } from "react";
import { Alert, Button, Form } from "react-bootstrap";
import { TaskProgressCard } from "./TaskProgress/TaskProgressCard";
import {
  TaskProgressDetails,
  IDetailSelection,
} from "./TaskProgress/TaskProgressDetails";
import { TaskProgressForm } from "./TaskProgress/TaskProgressForm";
import { TaskProgressOverall } from "./TaskProgress/TaskProgressOverall";
import { TaskProgressTrackerModal } from "./TaskProgress/TaskProgressTrackerModal";
import { useTaskProgressTrackers } from "./TaskProgress/useTaskProgressTrackers_custom";
import {
  taskProgressStatusLabel,
  Tracker,
  useProgressText,
} from "./TaskProgress/progressView_custom";
import "./TaskProgress/taskProgressPage_custom.scss";
import "./TaskProgressHistoryChart.scss";

const TaskProgress: React.FC = () => {
  const data = useTaskProgressTrackers();
  const t = useProgressText();
  const [editor, setEditor] = useState<Tracker | "new">();
  const [details, setDetails] = useState<IDetailSelection>();
  const [filter, setFilter] = useState("CURRENT");
  const [dragged, setDragged] = useState<string>();
  const [deleted, setDeleted] = useState<Tracker>();
  const [selectedTrackerID, setSelectedTrackerID] = useState<string>();
  const trackers = data.trackers ?? [];
  const visible = trackers.filter(
    (tracker) =>
      filter === "ALL" ||
      (filter === "CURRENT"
        ? tracker.status === "ACTIVE" || tracker.status === "PAUSED"
        : tracker.status === filter)
  );
  const move = (id: string, to: number) => {
    const ids = trackers.map((tracker) => tracker.id);
    const from = ids.indexOf(id);
    if (from < 0 || to < 0 || to >= ids.length || from === to) return;
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    void data.reorder(ids);
  };
  return (
    <main className="task-progress-page">
      <div className="progress-page-heading mb-4">
        <div>
          <h2>{t("Task Progress")}</h2>
        </div>
        <div>
          <Button
            variant="secondary"
            disabled={data.loading || data.busy}
            onClick={() => void data.refresh()}
          >
            {t("Refresh")}
          </Button>
          <Button onClick={() => setEditor("new")} disabled={data.busy}>
            {t("Add tracker")}
          </Button>
        </div>
      </div>
      <TaskProgressOverall />
      {data.error && (
        <Alert variant="danger" role="alert">
          {data.error}{" "}
          {data.trackers && t("Showing the last successful results.")}{" "}
          <Button
            size="sm"
            variant="outline-light"
            onClick={() => void data.refresh()}
          >
            {t("Retry")}
          </Button>
        </Alert>
      )}
      {deleted && (
        <Alert variant="info">
          {t("Tracker deleted.")}{" "}
          <Button
            size="sm"
            disabled={data.busy}
            onClick={async () => {
              if (
                await data.update({
                  id: deleted.id,
                  status: deleted.status,
                })
              )
                setDeleted(undefined);
            }}
          >
            {t("Undo delete")}
          </Button>
        </Alert>
      )}
      <div className="progress-tracker-toolbar">
        <Form.Group controlId="progress-status" className="mb-0">
          <Form.Label className="mr-2">{t("Show")}</Form.Label>
          <Form.Control
            as="select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {[
              "CURRENT",
              "ACTIVE",
              "PAUSED",
              "COMPLETED",
              "ARCHIVED",
              "ALL",
            ].map((v) => (
              <option key={v} value={v}>
                {t(taskProgressStatusLabel(v))}
              </option>
            ))}
          </Form.Control>
        </Form.Group>
        <small aria-live="polite">
          {data.loading ? (
            t("Refreshing…")
          ) : data.lastUpdated ? (
            <>
              {t("Last refreshed")}: {data.lastUpdated.toLocaleTimeString()}
            </>
          ) : null}
        </small>
      </div>
      {!data.trackers && data.loading ? (
        <p role="status">{t("Loading trackers…")}</p>
      ) : (
        <div className="row">
          {visible.map((tracker) => {
            const index = trackers.findIndex((v) => v.id === tracker.id);
            return (
              <div key={tracker.id} className={"col-12 col-md-6 col-xl-4 mb-3"}>
                <TaskProgressCard
                  tracker={tracker}
                  busy={data.busy}
                  first={index === 0}
                  last={index === trackers.length - 1}
                  onOpen={() => setSelectedTrackerID(tracker.id)}
                  onEdit={() => setEditor(tracker)}
                  onMove={(direction) => move(tracker.id, index + direction)}
                  onDragStart={() => setDragged(tracker.id)}
                  onDragEnd={() => setDragged(undefined)}
                  onDrop={() => {
                    if (dragged) move(dragged, index);
                    setDragged(undefined);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
      {data.trackers && !visible.length && (
        <p>{t("No trackers in this view.")}</p>
      )}
      {editor && (
        <TaskProgressForm
          saveError={data.error}
          tracker={editor === "new" ? undefined : editor}
          busy={data.busy}
          onClose={() => setEditor(undefined)}
          onSave={({ reset_goal, status, ...input }) =>
            editor === "new"
              ? data.create(input)
              : data.update({
                  ...input,
                  reset_goal,
                  status,
                  id: editor.id,
                  expected_version: editor.version,
                })
          }
        />
      )}
      {selectedTrackerID &&
        (() => {
          const selected = trackers.find(
            (tracker) => tracker.id === selectedTrackerID
          );
          if (!selected) return null;
          return (
            <TaskProgressTrackerModal
              tracker={selected}
              busy={data.busy}
              error={data.error}
              onClose={() => setSelectedTrackerID(undefined)}
              onEdit={() => {
                setSelectedTrackerID(undefined);
                setEditor(selected);
              }}
              onDelete={async () => {
                if (await data.destroy(selected.id)) {
                  setSelectedTrackerID(undefined);
                  setDeleted(selected);
                }
              }}
              onDetails={setDetails}
            />
          );
        })()}
      {details && (
        <TaskProgressDetails
          key={`${details.tracker.id}-${details.date ?? details.itemType}`}
          selection={details}
          onClose={() => setDetails(undefined)}
        />
      )}
    </main>
  );
};

export default TaskProgress;
