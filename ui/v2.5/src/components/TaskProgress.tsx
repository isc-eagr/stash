import React, { useState, useEffect } from "react";
import { useLazyQuery } from "@apollo/client";
import { FormattedMessage, FormattedNumber } from "react-intl";
import { LoadingIndicator } from "./Shared/LoadingIndicator";
import { Button, Form, Card, ProgressBar } from "react-bootstrap";
import { TagSelect, Tag } from "./Tags/TagSelect";
import { Icon } from "./Shared/Icon";
import { faPlus, faTrash, faEdit, faSave, faTimes } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import { useConfigureUISetting, useStats } from "src/core/StashService";
import { ConfigurationContext } from "src/hooks/Config";

interface ProgressTracker {
  id: string;
  name: string;
  initialValue: number;
  tagId: string;
  tagName: string;
}

const UI_KEY = "taskProgressTrackers";

const TaskProgress: React.FC = () => {
  const { configuration } = React.useContext(ConfigurationContext);
  const [saveUISetting] = useConfigureUISetting();
  const { data: statsData, loading: statsLoading } = useStats();
  
  const [trackers, setTrackers] = useState<ProgressTracker[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTracker, setNewTracker] = useState<Partial<ProgressTracker>>({
    name: "",
    initialValue: 0,
    tagId: "",
    tagName: "",
  });
  const [sceneCounts, setSceneCounts] = useState<Record<string, number>>({});
  const [organizedCount, setOrganizedCount] = useState<number>(0);

  // Load trackers from UI config on mount
  useEffect(() => {
    if (configuration?.ui) {
      const stored = (configuration.ui as any)[UI_KEY];
      if (stored && Array.isArray(stored)) {
        setTrackers(stored);
      }
    }
  }, [configuration]);

  // Save trackers to backend whenever they change
  const saveTrackers = async (newTrackers: ProgressTracker[]) => {
    try {
      await saveUISetting({
        variables: {
          key: UI_KEY,
          value: newTrackers,
        },
      });
    } catch (e) {
      console.error("Failed to save trackers:", e);
    }
  };

  // Query to count scenes by tag
  const [fetchSceneCount] = useLazyQuery(GQL.FindScenesDocument, {
    fetchPolicy: "network-only",
  });

  // Fetch organized scenes count
  const [fetchOrganizedScenes] = useLazyQuery(GQL.FindScenesDocument, {
    fetchPolicy: "network-only",
  });

  // Fetch organized scenes count on mount and when needed
  useEffect(() => {
    const fetchOrganized = async () => {
      try {
        const { data } = await fetchOrganizedScenes({
          variables: {
            scene_filter: {
              organized: true,
            },
          },
        });
        setOrganizedCount(data?.findScenes?.count ?? 0);
      } catch (e) {
        console.error("Failed to fetch organized scenes count:", e);
        setOrganizedCount(0);
      }
    };

    fetchOrganized();
  }, [fetchOrganizedScenes]);

  // Fetch scene counts for all trackers
  useEffect(() => {
    const fetchCounts = async () => {
      const counts: Record<string, number> = {};
      for (const tracker of trackers) {
        try {
          const { data } = await fetchSceneCount({
            variables: {
              scene_filter: {
                tags: {
                  value: [tracker.tagId],
                  modifier: GQL.CriterionModifier.Includes,
                },
              },
            },
          });
          counts[tracker.id] = data?.findScenes?.count ?? 0;
        } catch (e) {
          console.error(`Failed to fetch count for tracker ${tracker.id}:`, e);
          counts[tracker.id] = 0;
        }
      }
      setSceneCounts(counts);
    };

    if (trackers.length > 0) {
      fetchCounts();
    }
  }, [trackers, fetchSceneCount]);

  const addTracker = () => {
    if (!newTracker.name || !newTracker.tagId || !newTracker.initialValue) {
      return;
    }

    const tracker: ProgressTracker = {
      id: Date.now().toString(),
      name: newTracker.name,
      initialValue: newTracker.initialValue,
      tagId: newTracker.tagId,
      tagName: newTracker.tagName || "",
    };

    const newTrackers = [...trackers, tracker];
    setTrackers(newTrackers);
    saveTrackers(newTrackers);
    setNewTracker({ name: "", initialValue: 0, tagId: "", tagName: "" });
  };

  const deleteTracker = (id: string) => {
    const newTrackers = trackers.filter((t) => t.id !== id);
    setTrackers(newTrackers);
    saveTrackers(newTrackers);
    const newCounts = { ...sceneCounts };
    delete newCounts[id];
    setSceneCounts(newCounts);
  };

  const calculatePercentage = (tracker: ProgressTracker): number => {
    const count = sceneCounts[tracker.id] ?? 0;
    if (tracker.initialValue === 0) return 0;
    const done = tracker.initialValue - count;
    return Math.max((done / tracker.initialValue) * 100, 0);
  };

  const handleTagSelect = (tags: Tag[]) => {
    if (tags.length > 0) {
      const tag = tags[0];
      setNewTracker({
        ...newTracker,
        tagId: tag.id,
        tagName: tag.name || "",
      });
    } else {
      setNewTracker({
        ...newTracker,
        tagId: "",
        tagName: "",
      });
    }
  };

  return (
    <div className="mt-5">
      <div className="col col-sm-10 m-sm-auto">
        <h2 className="mb-4">
          <FormattedMessage id="task_progress" defaultMessage="Task Progress" />
        </h2>

        {/* Add new tracker form - compact version */}
        <Card className="mb-4" style={{ maxWidth: '600px', overflow: 'visible' }}>
          <Card.Body className="p-3" style={{ overflow: 'visible' }}>
            <h6 className="mb-3">
              <FormattedMessage
                id="add_progress_tracker"
                defaultMessage="Add Progress Tracker"
              />
            </h6>
            <Form>
              <div className="row">
                <div className="col-md-5 mb-2">
                  <Form.Control
                    type="text"
                    placeholder="Tracker name"
                    size="sm"
                    value={newTracker.name || ""}
                    onChange={(e) =>
                      setNewTracker({ ...newTracker, name: e.target.value })
                    }
                  />
                </div>
                <div className="col-md-3 mb-2">
                  <Form.Control
                    type="number"
                    min="1"
                    placeholder="Goal"
                    size="sm"
                    value={newTracker.initialValue || ""}
                    onChange={(e) =>
                      setNewTracker({
                        ...newTracker,
                        initialValue: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="col-md-4 mb-2" style={{ zIndex: 1000, position: 'relative' }}>
                  <TagSelect
                    isMulti={false}
                    onSelect={handleTagSelect}
                    values={
                      newTracker.tagId
                        ? [
                            {
                              id: newTracker.tagId,
                              name: newTracker.tagName,
                              aliases: [],
                              image_path: null,
                              sort_name: newTracker.tagName,
                            } as Tag,
                          ]
                        : []
                    }
                  />
                </div>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={addTracker}
                disabled={
                  !newTracker.name || !newTracker.tagId || !newTracker.initialValue
                }
              >
                <Icon icon={faPlus} className="mr-1" />
                <FormattedMessage id="add_tracker" defaultMessage="Add Tracker" />
              </Button>
            </Form>
          </Card.Body>
        </Card>

        {/* Overall Progress - Fixed tracker (moved below Add Progress Tracker) */}
        {!statsLoading && statsData && (
          <Card className="mb-4" style={{ maxWidth: '600px' }}>
            <Card.Body className="p-3">
              <h6 className="mb-2">Overall Progress</h6>
              <div className="mb-2">
                <div className="d-flex justify-content-between mb-1">
                  <span>
                    <FormattedNumber value={organizedCount} /> organized /{" "}
                    <FormattedNumber value={statsData.stats.scene_count} />{" "}
                    total scenes
                  </span>
                  <span>
                    <FormattedNumber
                      value={statsData.stats.scene_count > 0 
                        ? (organizedCount / statsData.stats.scene_count) * 100 
                        : 0}
                      maximumFractionDigits={1}
                    />
                    %
                  </span>
                </div>
                <ProgressBar
                  now={statsData.stats.scene_count > 0 
                    ? (organizedCount / statsData.stats.scene_count) * 100 
                    : 0}
                  variant={
                    organizedCount === statsData.stats.scene_count
                      ? "success"
                      : (organizedCount / statsData.stats.scene_count) * 100 >= 75
                      ? "info"
                      : (organizedCount / statsData.stats.scene_count) * 100 >= 50
                      ? "warning"
                      : "danger"
                  }
                />
              </div>
            </Card.Body>
          </Card>
        )}

        {/* Display trackers */}
        {trackers.length === 0 ? (
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
              const count = sceneCounts[tracker.id] ?? 0;
              const done = tracker.initialValue - count;
              const percentageComplete = calculatePercentage(tracker);

              return (
                <div key={tracker.id} className="col-12 col-sm-6 col-md-4 col-lg-3 mb-3">
                  <Card>
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <h5 className="mb-1">{tracker.name}</h5>
                          <small className="text-muted">
                            Tag: {tracker.tagName}
                          </small>
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => deleteTracker(tracker.id)}
                        >
                          <Icon icon={faTrash} />
                        </Button>
                      </div>

                      <div className="mb-2">
                        <div className="d-flex justify-content-between mb-1">
                          <span>
                            <FormattedNumber value={done} /> done /{" "}
                            <FormattedNumber value={tracker.initialValue} />{" "}
                            total
                          </span>
                          <span>
                            <FormattedNumber
                              value={percentageComplete}
                              maximumFractionDigits={1}
                            />
                            %
                          </span>
                        </div>
                        <ProgressBar
                          now={percentageComplete}
                          variant={
                            percentageComplete === 100
                              ? "success"
                              : percentageComplete >= 75
                              ? "info"
                              : percentageComplete >= 50
                              ? "warning"
                              : "danger"
                          }
                        />
                      </div>
                    </Card.Body>
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskProgress;
