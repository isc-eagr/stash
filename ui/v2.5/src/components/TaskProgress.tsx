import React, { useState } from "react";
import { Alert, Button, Form, Nav } from "react-bootstrap"; // CUSTOM
import { useHistory, useLocation } from "react-router-dom"; // CUSTOM
import { TaskProgressCard } from "./TaskProgress/TaskProgressCard";
import {
  TaskProgressDetails,
  IDetailSelection,
} from "./TaskProgress/TaskProgressDetails";
import { TaskProgressForm } from "./TaskProgress/TaskProgressForm";
import { TaskProgressOverall } from "./TaskProgress/TaskProgressOverall";
import { TaskProgressTrackerModal } from "./TaskProgress/TaskProgressTrackerModal";
import { TaskProgressMilestones } from "./TaskProgress/TaskProgressMilestones"; // CUSTOM
import { milestoneSearch } from "./TaskProgress/milestoneView_custom"; // CUSTOM
import { TaskProgressTimerCountdown } from "./TaskProgress/TaskProgressTimerCountdown_custom";
import {
  taskProgressFilterFromSearch,
  taskProgressFilterValues,
  taskProgressSearchForFilter,
  taskProgressSortFromSearch,
  taskProgressSearchForSort,
} from "./TaskProgress/taskProgressNavigation_custom"; // CUSTOM
import {
  sortTaskProgressTrackers,
  taskProgressSortOptions,
} from "./TaskProgress/taskProgressSort_custom"; // CUSTOM
import { useTaskProgressFinishPlanVersion } from "./TaskProgress/taskProgressFinish_custom"; // CUSTOM
import { useTaskProgressTrackers } from "./TaskProgress/useTaskProgressTrackers_custom";
import {
  taskProgressStatusLabel,
  Tracker,
  useProgressText,
} from "./TaskProgress/progressView_custom";
import "./TaskProgress/taskProgressPage_custom.scss";
import "./TaskProgressHistoryChart.scss";
import "./TaskProgress/progressLedger_custom.scss"; // CUSTOM
import "./TaskProgress/taskProgressCheckpoints_custom.scss"; // CUSTOM
import "./TaskProgress/taskProgressScoreboard_custom.scss"; // CUSTOM

// CUSTOM: Shared by the tracker list and the status pill counts.
const trackerInFilter = (tracker: Tracker, filter: string) =>
  filter === "ALL" ||
  (filter === "CURRENT"
    ? tracker.status === "ACTIVE" || tracker.status === "PAUSED"
    : tracker.status === filter);

const trackerFilterCount = (trackers: readonly Tracker[], filter: string) =>
  trackers.filter((tracker) => trackerInFilter(tracker, filter)).length;

const TaskProgress: React.FC = () => {
  const data = useTaskProgressTrackers();
  const t = useProgressText();
  const [editor, setEditor] = useState<Tracker | "new">();
  const [details, setDetails] = useState<IDetailSelection>();
  // CUSTOM: Keep the selected tracker status in the URL so reloads preserve the view.
  const history = useHistory();
  const location = useLocation();
  const requestedView = new URLSearchParams(location.search).get("view");
  const view = requestedView === "milestones" ? requestedView : "trackers"; // CUSTOM
  const filter = taskProgressFilterFromSearch(location.search);
  const sort = taskProgressSortFromSearch(location.search);
  const manualOrder = sort === "manual";
  const [dragged, setDragged] = useState<string>();
  const [selectedTrackerID, setSelectedTrackerID] = useState<string>();
  // CUSTOM: Timer Countdown is a browser-local utility for the progress page.
  const [showTimer, setShowTimer] = useState(false);
  const trackers = data.trackers ?? [];
  // CUSTOM: Finish sorting follows plans saved in tracker Details.
  useTaskProgressFinishPlanVersion();
  const visible = sortTaskProgressTrackers(
    trackers.filter((tracker) => trackerInFilter(tracker, filter)),
    sort
  );
  const move = (id: string, to: number) => {
    if (!manualOrder) return;
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
          {view === "trackers" && (
            <Button
              variant="secondary"
              disabled={data.loading || data.busy}
              onClick={() => void data.refresh()}
            >
              {t("Refresh")}
            </Button>
          )}
          {/* CUSTOM: Open the browser-local countdown timer modal. */}
          {view === "trackers" && (
            <Button variant="secondary" onClick={() => setShowTimer(true)}>
              {t("Timer Countdown")}
            </Button>
          )}
          {view === "trackers" && (
            <Button onClick={() => setEditor("new")} disabled={data.busy}>
              {t("Add tracker")}
            </Button>
          )}
        </div>
      </div>
      {/* CUSTOM: Milestones share the progress page. */}
      <Nav
        variant="tabs"
        activeKey={view}
        className="progress-page-tabs"
        onSelect={(key) =>
          history.push({
            ...location,
            search: milestoneSearch(
              location.search,
              undefined,
              key === "milestones" ? key : "trackers"
            ),
          })
        }
      >
        <Nav.Item>
          <Nav.Link eventKey="trackers">{t("Trackers")}</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="milestones">{t("Milestones")}</Nav.Link>
        </Nav.Item>
      </Nav>
      {view === "trackers" ? (
        <>
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
          <div className="progress-tracker-toolbar">
            {/* CUSTOM: Status pills show each view's tracker count. */}
            <div
              className="progress-status-pills"
              role="group"
              aria-label={t("Show")}
            >
              {taskProgressFilterValues.map((v) => (
                <button
                  key={v}
                  type="button"
                  className={filter === v ? "active" : undefined}
                  aria-pressed={filter === v}
                  onClick={() =>
                    history.replace({
                      ...location,
                      search: taskProgressSearchForFilter(location.search, v),
                    })
                  }
                >
                  {t(taskProgressStatusLabel(v))}
                  <span>{trackerFilterCount(trackers, v)}</span>
                </button>
              ))}
            </div>
            <Form.Group controlId="progress-sort" className="mb-0">
              <Form.Label>{t("Sort")}</Form.Label>
              <Form.Control
                as="select"
                value={sort}
                onChange={(event) => {
                  setDragged(undefined);
                  history.replace({
                    ...location,
                    search: taskProgressSearchForSort(
                      location.search,
                      event.target.value
                    ),
                  });
                }}
              >
                {taskProgressSortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.label)}
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
            <div className="progress-tracker-list">
              {visible.map((tracker) => {
                const index = trackers.findIndex((v) => v.id === tracker.id);
                return (
                  // CUSTOM: Stack full-width trackers so progress bars align.
                  <TaskProgressCard
                    key={tracker.id}
                    tracker={tracker}
                    busy={data.busy}
                    reorderable={manualOrder}
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
                );
              })}
            </div>
          )}
          {data.trackers && !visible.length && (
            <p>{t("No trackers in this view.")}</p>
          )}
        </>
      ) : (
        <TaskProgressMilestones
          trackers={trackers}
          onOpenTracker={setSelectedTrackerID}
          onRefreshTrackers={data.refresh}
        />
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
          onArchive={
            editor === "new"
              ? undefined
              : () =>
                  data.update({
                    id: editor.id,
                    status: "ARCHIVED",
                    expected_version: editor.version,
                  })
          }
          onDelete={
            editor === "new" ? undefined : () => data.destroy(editor.id)
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
              error={data.error}
              onClose={() => setSelectedTrackerID(undefined)}
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
      {showTimer && (
        <TaskProgressTimerCountdown onClose={() => setShowTimer(false)} />
      )}
    </main>
  );
};

export default TaskProgress;
