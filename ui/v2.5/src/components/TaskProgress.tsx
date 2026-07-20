import React, { useCallback, useEffect, useState } from "react";
import { useLazyQuery } from "@apollo/client";
import { FormattedMessage, FormattedNumber } from "react-intl";
import { Badge, Button, Card, Form, Modal, ProgressBar } from "react-bootstrap";
import {
  faGripVertical,
  faPencilAlt,
  faPlayCircle,
  faPlus,
  faSyncAlt,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import { useStats } from "src/core/StashService";
import { Icon } from "./Shared/Icon";
import { Tag, TagSelect } from "./Tags/TagSelect";
import {
  getTagItemCount,
  getTrackerProgress,
  IProgressTracker,
  reorderProgressTrackers,
  toggleProgressTrackerWorkingOn,
} from "./taskProgress_custom";

interface ITrackerDraft {
  title: string;
  description: string;
  tagId: string;
  tagName: string;
}

const EMPTY_DRAFT: ITrackerDraft = {
  title: "",
  description: "",
  tagId: "",
  tagName: "",
};

function selectedTag(draft: ITrackerDraft): Tag[] {
  if (!draft.tagId) return [];

  return [
    {
      id: draft.tagId,
      name: draft.tagName,
      aliases: [],
      image_path: null,
      sort_name: draft.tagName,
      stash_ids: [],
    } as Tag,
  ];
}

function progressVariant(percentage: number) {
  if (percentage >= 75) return "success";
  if (percentage >= 50) return "info";
  if (percentage >= 25) return "warning";
  return "danger";
}

function fromDatabaseTracker(
  tracker: GQL.TaskProgressTrackerDataFragment
): IProgressTracker {
  return {
    id: tracker.id,
    title: tracker.title,
    description: tracker.description,
    goal: tracker.goal,
    tagId: tracker.tag_id,
    tagName: tracker.tag_name,
    isWorkingOn: tracker.is_working_on,
  };
}

const TaskProgress: React.FC = () => {
  const { data: statsData, loading: statsLoading } = useStats();
  const {
    data: trackerData,
    loading: trackersLoading,
    error: trackersError,
  } = GQL.useFindTaskProgressTrackersQuery({ fetchPolicy: "network-only" });
  const [createTrackerMutation] = GQL.useTaskProgressTrackerCreateMutation();
  const [updateTrackerMutation] = GQL.useTaskProgressTrackerUpdateMutation();
  const [destroyTrackerMutation] = GQL.useTaskProgressTrackerDestroyMutation();
  const [reorderTrackersMutation] =
    GQL.useTaskProgressTrackersReorderMutation();

  const [trackers, setTrackers] = useState<IProgressTracker[]>([]);
  const [newTracker, setNewTracker] = useState<ITrackerDraft>(EMPTY_DRAFT);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [organizedCount, setOrganizedCount] = useState(0);
  const [itemsPerDay, setItemsPerDay] = useState<Record<string, number>>({});
  const [overallItemsPerDay, setOverallItemsPerDay] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const [editingTracker, setEditingTracker] = useState<IProgressTracker>();
  const [editDraft, setEditDraft] = useState<ITrackerDraft>(EMPTY_DRAFT);
  const [editGoal, setEditGoal] = useState(0);
  const [editGoalTagId, setEditGoalTagId] = useState("");
  const [editTaggedCount, setEditTaggedCount] = useState(0);
  const [editCountError, setEditCountError] = useState<string>();
  const [isRefreshingEditGoal, setIsRefreshingEditGoal] = useState(false);
  const [draggedTrackerId, setDraggedTrackerId] = useState<string>();
  const [dragTargetId, setDragTargetId] = useState<string>();

  useEffect(() => {
    if (trackerData?.findTaskProgressTrackers) {
      setTrackers(
        trackerData.findTaskProgressTrackers.map(fromDatabaseTracker)
      );
    }
  }, [trackerData]);

  // CUSTOM: Query to count all tagged item types for progress trackers
  const [fetchTagCount] = useLazyQuery(GQL.FindTagDocument, {
    fetchPolicy: "network-only",
  });

  const fetchCurrentTagCount = useCallback(
    async (tagId: string) => {
      const { data } = await fetchTagCount({ variables: { id: tagId } });
      return data?.findTag ? getTagItemCount(data.findTag) : 0;
    },
    [fetchTagCount]
  );

  const [fetchOrganizedScenes] = useLazyQuery(GQL.FindScenesDocument, {
    fetchPolicy: "network-only",
  });

  useEffect(() => {
    const fetchOrganized = async () => {
      try {
        const { data } = await fetchOrganizedScenes({
          variables: { scene_filter: { organized: true } },
        });
        setOrganizedCount(data?.findScenes?.count ?? 0);
      } catch (error) {
        console.error("Failed to fetch organized scenes count:", error);
        setOrganizedCount(0);
      }
    };

    fetchOrganized();
  }, [fetchOrganizedScenes]);

  useEffect(() => {
    const fetchCounts = async () => {
      const countEntries = await Promise.all(
        trackers.map(async (tracker): Promise<[string, number]> => {
          try {
            return [tracker.id, await fetchCurrentTagCount(tracker.tagId)];
          } catch (error) {
            console.error(
              `Failed to fetch count for tracker ${tracker.id}:`,
              error
            );
            return [tracker.id, 0];
          }
        })
      );
      setItemCounts(Object.fromEntries(countEntries));
    };

    if (trackers.length > 0) {
      fetchCounts();
    } else {
      setItemCounts({});
    }
  }, [trackers, fetchCurrentTagCount]);

  const handleNewTagSelect = (tags: Tag[]) => {
    const tag = tags[0];
    setNewTracker((current) => ({
      ...current,
      tagId: tag?.id ?? "",
      tagName: tag?.name ?? "",
    }));
  };

  const addTracker = async () => {
    if (!newTracker.title.trim() || !newTracker.tagId || isCreating) return;

    setIsCreating(true);
    setCreateError(undefined);
    try {
      const { data } = await createTrackerMutation({
        variables: {
          input: {
            title: newTracker.title.trim(),
            description: newTracker.description.trim(),
            tag_id: newTracker.tagId,
          },
        },
      });
      if (!data?.taskProgressTrackerCreate) {
        throw new Error("The server did not return the created tracker");
      }

      const tracker = fromDatabaseTracker(data.taskProgressTrackerCreate);
      setTrackers((current) => [...current, tracker]);
      setItemCounts((current) => ({
        ...current,
        [tracker.id]: tracker.goal,
      }));
      setNewTracker(EMPTY_DRAFT);
    } catch (error) {
      console.error("Failed to create task progress tracker:", error);
      setCreateError("Could not save the tracker in the database.");
    } finally {
      setIsCreating(false);
    }
  };

  const deleteTracker = async (id: string) => {
    try {
      await destroyTrackerMutation({ variables: { id } });
      setTrackers((current) => current.filter((tracker) => tracker.id !== id));
      setItemCounts((current) => {
        const nextCounts = { ...current };
        delete nextCounts[id];
        return nextCounts;
      });
    } catch (error) {
      console.error("Failed to delete task progress tracker:", error);
    }
  };

  const openEditTracker = async (tracker: IProgressTracker) => {
    setEditingTracker(tracker);
    setEditDraft({
      title: tracker.title,
      description: tracker.description,
      tagId: tracker.tagId,
      tagName: tracker.tagName,
    });
    setEditGoal(tracker.goal);
    setEditGoalTagId(tracker.tagId);
    setEditTaggedCount(itemCounts[tracker.id] ?? 0);
    setEditCountError(undefined);

    try {
      setIsRefreshingEditGoal(true);
      setEditTaggedCount(await fetchCurrentTagCount(tracker.tagId));
    } catch (error) {
      console.error("Failed to refresh tracker tag count:", error);
      setEditCountError("Could not refresh the current tagged item count.");
    } finally {
      setIsRefreshingEditGoal(false);
    }
  };

  const handleEditTagSelect = async (tags: Tag[]) => {
    const tag = tags[0];
    const tagId = tag?.id ?? "";
    setEditDraft((current) => ({
      ...current,
      tagId,
      tagName: tag?.name ?? "",
    }));
    if (!tagId) return;

    if (tagId === editingTracker?.tagId) {
      setEditGoal(editingTracker.goal);
      setEditGoalTagId(editingTracker.tagId);
      setEditTaggedCount(itemCounts[editingTracker.id] ?? 0);
      setEditCountError(undefined);
      return;
    }

    try {
      setIsRefreshingEditGoal(true);
      setEditGoalTagId("");
      setEditCountError(undefined);
      const currentCount = await fetchCurrentTagCount(tagId);
      setEditTaggedCount(currentCount);
      setEditGoal(currentCount);
      setEditGoalTagId(tagId);
    } catch (error) {
      console.error("Failed to calculate the new tag goal:", error);
      setEditCountError("Could not calculate a goal for the selected tag.");
    } finally {
      setIsRefreshingEditGoal(false);
    }
  };

  const refreshEditGoal = async () => {
    if (!editDraft.tagId) return;

    try {
      setIsRefreshingEditGoal(true);
      setEditCountError(undefined);
      const currentCount = await fetchCurrentTagCount(editDraft.tagId);
      setEditTaggedCount(currentCount);
      setEditGoal(currentCount);
      setEditGoalTagId(editDraft.tagId);
    } catch (error) {
      console.error("Failed to update tracker goal:", error);
      setEditCountError("Could not refresh the goal. Please try again.");
    } finally {
      setIsRefreshingEditGoal(false);
    }
  };

  const saveEditedTracker = async () => {
    if (
      !editingTracker ||
      !editDraft.title.trim() ||
      !editDraft.tagId ||
      editGoalTagId !== editDraft.tagId ||
      isRefreshingEditGoal
    ) {
      return;
    }

    try {
      const { data } = await updateTrackerMutation({
        variables: {
          input: {
            id: editingTracker.id,
            title: editDraft.title.trim(),
            description: editDraft.description.trim(),
            tag_id: editDraft.tagId,
            reset_goal:
              editDraft.tagId !== editingTracker.tagId ||
              editGoal !== editingTracker.goal,
          },
        },
      });
      if (!data?.taskProgressTrackerUpdate) {
        throw new Error("The server did not return the updated tracker");
      }

      const updated = fromDatabaseTracker(data.taskProgressTrackerUpdate);
      setTrackers((current) =>
        current.map((tracker) =>
          tracker.id === updated.id ? updated : tracker
        )
      );
      setItemCounts((current) => ({
        ...current,
        [updated.id]: editTaggedCount,
      }));
      setEditingTracker(undefined);
    } catch (error) {
      console.error("Failed to update task progress tracker:", error);
      setEditCountError("Could not save the tracker in the database.");
    }
  };

  const handleDrop = async (targetId: string) => {
    if (!draggedTrackerId) return;

    const previousTrackers = trackers;
    const nextTrackers = reorderProgressTrackers(
      trackers,
      draggedTrackerId,
      targetId
    );
    if (nextTrackers !== trackers) {
      setTrackers(nextTrackers);
      try {
        const { data } = await reorderTrackersMutation({
          variables: { ids: nextTrackers.map((tracker) => tracker.id) },
        });
        if (data?.taskProgressTrackersReorder) {
          setTrackers(
            data.taskProgressTrackersReorder.map(fromDatabaseTracker)
          );
        }
      } catch (error) {
        console.error("Failed to reorder task progress trackers:", error);
        setTrackers(previousTrackers);
      }
    }
    setDraggedTrackerId(undefined);
    setDragTargetId(undefined);
  };

  const toggleWorkingOn = async (trackerId: string) => {
    const previousTrackers = trackers;
    const nextTrackers = toggleProgressTrackerWorkingOn(trackers, trackerId);
    setTrackers(nextTrackers);
    const toggled = nextTrackers.find((tracker) => tracker.id === trackerId);
    if (!toggled) return;

    try {
      const { data } = await updateTrackerMutation({
        variables: {
          input: {
            id: trackerId,
            is_working_on: toggled.isWorkingOn,
          },
        },
      });
      if (data?.taskProgressTrackerUpdate) {
        const updated = fromDatabaseTracker(data.taskProgressTrackerUpdate);
        setTrackers((current) =>
          current.map((tracker) =>
            tracker.id === updated.id ? updated : tracker
          )
        );
      }
    } catch (error) {
      console.error("Failed to update working-on state:", error);
      setTrackers(previousTrackers);
    }
  };

  return (
    <div className="mt-5">
      <div className="col col-sm-10 m-sm-auto">
        <h2 className="mb-4">
          <FormattedMessage id="task_progress" defaultMessage="Task Progress" />
        </h2>

        <Card
          className="mb-4"
          style={{ maxWidth: "600px", overflow: "visible" }}
        >
          <Card.Body className="p-3" style={{ overflow: "visible" }}>
            <h6 className="mb-3">
              <FormattedMessage
                id="add_progress_tracker"
                defaultMessage="Add Progress Tracker"
              />
            </h6>
            <Form>
              <Form.Group controlId="new-tracker-title">
                <Form.Label>Title</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Tracker title"
                  size="sm"
                  value={newTracker.title}
                  onChange={(event) =>
                    setNewTracker((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </Form.Group>
              <Form.Group controlId="new-tracker-description">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="What are you tracking?"
                  size="sm"
                  value={newTracker.description}
                  onChange={(event) =>
                    setNewTracker((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                />
              </Form.Group>
              <Form.Group controlId="new-tracker-tag">
                <Form.Label>Tag</Form.Label>
                <div style={{ zIndex: 1000, position: "relative" }}>
                  <TagSelect
                    isMulti={false}
                    onSelect={handleNewTagSelect}
                    values={selectedTag(newTracker)}
                  />
                </div>
                <Form.Text className="text-muted">
                  The goal will be set to this tag&apos;s current item count.
                </Form.Text>
              </Form.Group>
              {createError && (
                <div className="text-danger mb-2">{createError}</div>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={addTracker}
                disabled={
                  !newTracker.title.trim() || !newTracker.tagId || isCreating
                }
              >
                <Icon icon={faPlus} className="mr-1" />
                {isCreating ? "Counting items..." : "Add Tracker"}
              </Button>
            </Form>
          </Card.Body>
        </Card>

        {!statsLoading && statsData && (
          <Card className="mb-4" style={{ maxWidth: "600px" }}>
            <Card.Body className="p-3">
              <h6 className="mb-2">Overall Progress</h6>
              <div className="mb-2">
                <div className="d-flex justify-content-between mb-1">
                  <span>
                    <FormattedNumber value={organizedCount} /> organized /{" "}
                    <FormattedNumber
                      value={Math.max(
                        statsData.stats.scene_count - organizedCount,
                        0
                      )}
                    />{" "}
                    remaining /{" "}
                    <FormattedNumber value={statsData.stats.scene_count} />{" "}
                    total scenes
                  </span>
                  <span>
                    <FormattedNumber
                      value={
                        statsData.stats.scene_count > 0
                          ? (organizedCount / statsData.stats.scene_count) * 100
                          : 0
                      }
                      maximumFractionDigits={1}
                    />
                    %
                  </span>
                </div>
                <ProgressBar
                  now={
                    statsData.stats.scene_count > 0
                      ? (organizedCount / statsData.stats.scene_count) * 100
                      : 0
                  }
                  variant={progressVariant(
                    statsData.stats.scene_count > 0
                      ? (organizedCount / statsData.stats.scene_count) * 100
                      : 0
                  )}
                />
              </div>
              {statsData.stats.scene_count - organizedCount > 0 && (
                <div className="mt-2 pt-2 border-top">
                  <div
                    className="d-flex align-items-center mb-1"
                    style={{ gap: "0.4rem" }}
                  >
                    <small className="text-muted text-nowrap">Items/day:</small>
                    <Form.Control
                      type="number"
                      min="1"
                      size="sm"
                      style={{ width: "70px" }}
                      value={overallItemsPerDay || ""}
                      onChange={(event) =>
                        setOverallItemsPerDay(
                          parseInt(event.target.value, 10) || 0
                        )
                      }
                      placeholder="e.g. 5"
                    />
                  </div>
                  {overallItemsPerDay > 0 &&
                    (() => {
                      const remaining = Math.max(
                        statsData.stats.scene_count - organizedCount,
                        0
                      );
                      const daysLeft = Math.ceil(
                        remaining / overallItemsPerDay
                      );
                      const completionDate = new Date();
                      completionDate.setDate(
                        completionDate.getDate() + daysLeft
                      );
                      const completionDateText =
                        completionDate.toLocaleDateString("en-US", {
                          month: "2-digit",
                          day: "2-digit",
                          year: "numeric",
                        });
                      return (
                        <small className="text-muted d-block">
                          Done by <strong>{completionDateText}</strong> (
                          {daysLeft} day{daysLeft !== 1 ? "s" : ""}) at{" "}
                          {overallItemsPerDay}/day
                        </small>
                      );
                    })()}
                </div>
              )}
            </Card.Body>
          </Card>
        )}

        {trackersError ? (
          <div className="text-danger my-4">
            Could not load progress trackers from the database:{" "}
            {trackersError.message}
          </div>
        ) : trackersLoading ? (
          <div className="text-muted my-4">Loading progress trackers...</div>
        ) : trackers.length === 0 ? (
          <div className="text-center text-muted my-5">
            <p>
              <FormattedMessage
                id="no_trackers"
                defaultMessage="No progress trackers yet. Add one above to get started!"
              />
            </p>
          </div>
        ) : (
          <div className="row">
            {trackers.map((tracker) => {
              const progress = getTrackerProgress(
                tracker.goal,
                itemCounts[tracker.id] ?? 0
              );

              return (
                <div
                  key={tracker.id}
                  className="col-12 col-sm-6 col-md-4 col-lg-3 mb-3"
                  onDragEnter={() => setDragTargetId(tracker.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(tracker.id)}
                  style={{
                    opacity:
                      draggedTrackerId && dragTargetId === tracker.id
                        ? 0.65
                        : 1,
                  }}
                >
                  <Card
                    className={`h-100 ${
                      tracker.isWorkingOn ? "border-info" : ""
                    }`}
                    style={
                      tracker.isWorkingOn
                        ? {
                            backgroundColor: "rgba(23, 162, 184, 0.08)",
                            boxShadow: "0 0 0 0.2rem rgba(23, 162, 184, 0.2)",
                          }
                        : undefined
                    }
                  >
                    <Card.Body className="d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="pr-2">
                          <h5 className="mb-1">{tracker.title}</h5>
                          <small className="text-muted d-block">
                            Tag: {tracker.tagName}
                          </small>
                          {tracker.isWorkingOn && (
                            <Badge variant="info" className="mt-2">
                              Working on
                            </Badge>
                          )}
                        </div>
                        <div className="d-flex">
                          <Button
                            variant="link"
                            size="sm"
                            className={`p-1 ${
                              tracker.isWorkingOn ? "text-info" : "text-muted"
                            }`}
                            aria-label={`${
                              tracker.isWorkingOn ? "Stop" : "Start"
                            } working on ${tracker.title}`}
                            aria-pressed={tracker.isWorkingOn}
                            title={
                              tracker.isWorkingOn
                                ? "Stop marking as currently working on"
                                : "Mark as currently working on"
                            }
                            onClick={() => toggleWorkingOn(tracker.id)}
                          >
                            <Icon icon={faPlayCircle} />
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-muted p-1"
                            draggable
                            aria-label={`Reorder ${tracker.title}`}
                            title="Drag to reorder"
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData(
                                "text/plain",
                                tracker.id
                              );
                              setDraggedTrackerId(tracker.id);
                            }}
                            onDragEnd={() => {
                              setDraggedTrackerId(undefined);
                              setDragTargetId(undefined);
                            }}
                          >
                            <Icon icon={faGripVertical} />
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-info p-1"
                            aria-label={`Edit ${tracker.title}`}
                            title="Edit tracker"
                            onClick={() => openEditTracker(tracker)}
                          >
                            <Icon icon={faPencilAlt} />
                          </Button>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-danger p-1"
                            aria-label={`Delete ${tracker.title}`}
                            title="Delete tracker"
                            onClick={() => deleteTracker(tracker.id)}
                          >
                            <Icon icon={faTrash} />
                          </Button>
                        </div>
                      </div>

                      {tracker.description && (
                        <p
                          className="small mb-3"
                          style={{ whiteSpace: "pre-wrap" }}
                        >
                          {tracker.description}
                        </p>
                      )}

                      <div className="mb-2">
                        <div className="mb-1">
                          <FormattedNumber value={progress.done} /> done /{" "}
                          <FormattedNumber value={progress.remaining} />{" "}
                          remaining / <FormattedNumber value={tracker.goal} />{" "}
                          goal
                        </div>
                        <ProgressBar
                          now={progress.percentage}
                          variant={progressVariant(progress.percentage)}
                        />
                        <div className="mt-3 text-center">
                          <div
                            style={{ fontSize: "1.75rem", fontWeight: "bold" }}
                          >
                            <FormattedNumber
                              value={progress.percentage}
                              maximumFractionDigits={2}
                            />
                            %
                          </div>
                        </div>
                      </div>

                      {progress.remaining > 0 && (
                        <div className="mt-auto pt-2 border-top">
                          <div
                            className="d-flex align-items-center mb-1"
                            style={{ gap: "0.4rem" }}
                          >
                            <small className="text-muted text-nowrap">
                              Items/day:
                            </small>
                            <Form.Control
                              type="number"
                              min="1"
                              size="sm"
                              style={{ width: "70px" }}
                              value={itemsPerDay[tracker.id] ?? ""}
                              onChange={(event) =>
                                setItemsPerDay((current) => ({
                                  ...current,
                                  [tracker.id]:
                                    parseInt(event.target.value, 10) || 0,
                                }))
                              }
                              placeholder="e.g. 5"
                            />
                          </div>
                          {(itemsPerDay[tracker.id] ?? 0) > 0 &&
                            (() => {
                              const perDay = itemsPerDay[tracker.id];
                              const daysLeft = Math.ceil(
                                progress.remaining / perDay
                              );
                              const completionDate = new Date();
                              completionDate.setDate(
                                completionDate.getDate() + daysLeft
                              );
                              const completionDateText =
                                completionDate.toLocaleDateString("en-US", {
                                  month: "2-digit",
                                  day: "2-digit",
                                  year: "numeric",
                                });
                              return (
                                <small className="text-muted d-block">
                                  Done by <strong>{completionDateText}</strong>{" "}
                                  ({daysLeft} day{daysLeft !== 1 ? "s" : ""}) at{" "}
                                  {perDay}/day
                                </small>
                              );
                            })()}
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        show={!!editingTracker}
        onHide={() => setEditingTracker(undefined)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Edit Progress Tracker</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ overflow: "visible" }}>
          <Form.Group controlId="edit-tracker-title">
            <Form.Label>Title</Form.Label>
            <Form.Control
              value={editDraft.title}
              onChange={(event) =>
                setEditDraft((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </Form.Group>
          <Form.Group controlId="edit-tracker-description">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={editDraft.description}
              onChange={(event) =>
                setEditDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </Form.Group>
          <Form.Group controlId="edit-tracker-tag">
            <Form.Label>Tag</Form.Label>
            <div style={{ zIndex: 1051, position: "relative" }}>
              <TagSelect
                isMulti={false}
                onSelect={handleEditTagSelect}
                values={selectedTag(editDraft)}
              />
            </div>
          </Form.Group>
          <Form.Group controlId="edit-tracker-goal">
            <Form.Label>Goal</Form.Label>
            <div className="d-flex" style={{ gap: "0.5rem" }}>
              <Form.Control type="number" value={editGoal} readOnly />
              <Button
                variant="secondary"
                onClick={refreshEditGoal}
                disabled={!editDraft.tagId || isRefreshingEditGoal}
              >
                <Icon icon={faSyncAlt} className="mr-1" />
                {isRefreshingEditGoal ? "Counting..." : "Use current count"}
              </Button>
            </div>
            <Form.Text className="text-muted">
              Current tagged items: <FormattedNumber value={editTaggedCount} />.
              The goal cannot be entered manually.
            </Form.Text>
            {editCountError && (
              <Form.Text className="text-danger">{editCountError}</Form.Text>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setEditingTracker(undefined)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={saveEditedTracker}
            disabled={
              !editDraft.title.trim() ||
              !editDraft.tagId ||
              editGoalTagId !== editDraft.tagId ||
              isRefreshingEditGoal
            }
          >
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TaskProgress;
