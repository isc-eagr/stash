import React, { useEffect } from "react";
import { useApolloClient } from "@apollo/client";
import { useIntl } from "react-intl";
import { useToast } from "src/hooks/Toast";
import { taskProgressAchievementToastPriority } from "src/hooks/toastQueue_custom";
import * as GQL from "src/core/generated-graphql";
import { subscribeTaskProgressChanges } from "src/core/taskProgressMutationLink_custom";
import { TaskProgressAchievementContent } from "./TaskProgressAchievementContent";
import {
  createTaskProgressAchievementWatcher,
  formatTaskProgressAchievement,
  taskProgressAchievementSnapshots,
} from "./taskProgressAchievements_custom";

/** Mounted outside the route switch so catalog work can earn tracker/milestone medals. */
export const TaskProgressAchievementMonitor: React.FC = () => {
  const client = useApolloClient();
  const { toast } = useToast();
  const intl = useIntl();
  useEffect(() => {
    const watcher = createTaskProgressAchievementWatcher(
      async () => {
        const [trackers, milestones] = await Promise.all([
          client.query<GQL.FindTaskProgressTrackersQuery>({
            query: GQL.FindTaskProgressTrackersDocument,
            fetchPolicy: "no-cache",
          }),
          client.query<GQL.FindTaskProgressMilestonesQuery>({
            query: GQL.FindTaskProgressMilestonesDocument,
            fetchPolicy: "no-cache",
          }),
        ]);
        return taskProgressAchievementSnapshots(
          trackers.data.findTaskProgressTrackers,
          milestones.data.findTaskProgressMilestones
        );
      },
      (achievements) =>
        achievements.forEach((achievement) =>
          toast({
            content: (
              <TaskProgressAchievementContent
                achievement={achievement}
                message={formatTaskProgressAchievement(achievement, (label) =>
                  intl.formatMessage({
                    id: `task_progress_v2.${label
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "_")}`,
                    defaultMessage: label,
                  })
                )}
              />
            ),
            enqueue: true,
            priority: taskProgressAchievementToastPriority,
            delay: 6000,
            className: achievement.tier
              ? `progress-toast-tier-${achievement.threshold}`
              : "progress-toast-achievement",
          })
        )
    );
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeTaskProgressChanges(() => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void watcher.refresh(), 300);
    });
    const refreshVisible = () => {
      if (!document.hidden) void watcher.refresh();
    };
    // Other tabs and background jobs can also change progress.
    const poll = setInterval(refreshVisible, 60000);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener("focus", refreshVisible);
    void watcher.refresh();
    return () => {
      watcher.dispose();
      unsubscribe();
      clearTimeout(debounce);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener("focus", refreshVisible);
    };
  }, [client, toast, intl]);

  return null;
};
