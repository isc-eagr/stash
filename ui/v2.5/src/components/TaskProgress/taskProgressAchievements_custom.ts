import type {
  FindTaskProgressMilestonesQuery,
  FindTaskProgressTrackersQuery,
} from "src/core/generated-graphql";
import type { ITaskProgressHistoryEntry } from "../taskProgress_custom";
import {
  progressPercentage,
  taskProgressCompletedCount,
} from "./progressMath_custom";
import {
  taskProgressCheckpoints,
  taskProgressCheckpointTiers,
} from "./taskProgressCheckpoints_custom";

export interface ITaskProgressAchievementSnapshot {
  key: string;
  name: string;
  kind: "Tracker" | "Milestone";
  revision: string;
  percentage: number;
  history: readonly ITaskProgressHistoryEntry[];
  eligible: boolean;
}

export interface ITaskProgressAchievement {
  key: string;
  name: string;
  kind: ITaskProgressAchievementSnapshot["kind"];
  threshold: number;
  tier?: (typeof taskProgressCheckpointTiers)[number]["label"];
}

const achievementThresholds = {
  Tracker: [
    ...new Set([
      ...Array.from({ length: 10 }, (_, index) => (index + 1) * 10),
      ...taskProgressCheckpointTiers.map((tier) => tier.threshold),
    ]),
  ].sort((a, b) => a - b),
  Milestone: Array.from({ length: 20 }, (_, index) => (index + 1) * 5),
};

export function formatTaskProgressAchievement(
  achievement: ITaskProgressAchievement,
  translate: (label: string) => string = (label) => label
) {
  const tier = achievement.tier ? `${translate(achievement.tier)} · ` : "";
  return `${tier}${achievement.threshold}% ${translate("achieved")} · ${
    achievement.name
  }`;
}

export function taskProgressAchievementSnapshots(
  trackers: FindTaskProgressTrackersQuery["findTaskProgressTrackers"],
  milestones: FindTaskProgressMilestonesQuery["findTaskProgressMilestones"]
): ITaskProgressAchievementSnapshot[] {
  const historyEntries = (
    history: FindTaskProgressTrackersQuery["findTaskProgressTrackers"][number]["history"]
  ) =>
    history.map((day) => ({
      ...day,
      baselineCount: day.baseline_count ?? undefined,
    }));

  return [
    ...trackers.map((tracker) => ({
      key: `tracker:${tracker.id}`,
      name: tracker.title,
      kind: "Tracker" as const,
      revision: String(tracker.version),
      percentage: progressPercentage(tracker),
      history: historyEntries(tracker.history),
      eligible:
        tracker.status !== "ARCHIVED" &&
        tracker.status !== "DELETED" &&
        taskProgressCompletedCount(tracker) > 0,
    })),
    ...milestones.map((milestone) => ({
      key: `milestone:${milestone.id}`,
      name: milestone.name,
      kind: "Milestone" as const,
      // Member resets also recalculate milestone history without editing the milestone.
      revision: `${milestone.version}:${milestone.trackers
        .map((tracker) => `${tracker.id}:${tracker.version}`)
        .sort()
        .join(",")}`,
      percentage:
        milestone.total_count > 0
          ? Math.min(
              100,
              (milestone.completed_count / milestone.total_count) * 100
            )
          : 0,
      history: historyEntries(milestone.history),
      eligible: milestone.trackers.length > 0 && milestone.completed_count > 0,
    })),
  ];
}

/** Keep earned checkpoints through incoming work and repeated refreshes. */
export function createTaskProgressAchievementObserver() {
  let previous = new Map<string, { revision: string; reached: Set<number> }>();
  return (snapshots: readonly ITaskProgressAchievementSnapshot[]) => {
    const next = new Map<string, { revision: string; reached: Set<number> }>();
    const achievements: ITaskProgressAchievement[] = [];
    snapshots.forEach((snapshot) => {
      const prior = previous.get(snapshot.key);
      const sameRevision = prior?.revision === snapshot.revision;
      const reached = new Set(sameRevision ? prior.reached : []);
      taskProgressCheckpoints(
        snapshot.history,
        snapshot.percentage,
        undefined,
        achievementThresholds[snapshot.kind]
      ).forEach((checkpoint) => {
        if (!checkpoint.reached) return;
        if (
          sameRevision &&
          snapshot.eligible &&
          !reached.has(checkpoint.threshold)
        ) {
          const tier = taskProgressCheckpointTiers.find(
            (item) => item.threshold === checkpoint.threshold
          );
          achievements.push({
            key: `${snapshot.key}:${snapshot.revision}:${checkpoint.threshold}`,
            name: snapshot.name,
            kind: snapshot.kind,
            threshold: checkpoint.threshold,
            tier: tier?.label,
          });
        }
        reached.add(checkpoint.threshold);
      });
      next.set(snapshot.key, { revision: snapshot.revision, reached });
    });
    previous = next;
    return achievements;
  };
}

/** Serialize refreshes and repeat after writes made while a request was in flight. */
export function createTaskProgressAchievementWatcher(
  load: () => Promise<readonly ITaskProgressAchievementSnapshot[]>,
  onAchievements: (achievements: ITaskProgressAchievement[]) => void
) {
  const observe = createTaskProgressAchievementObserver();
  let active = false;
  let pending = false;
  let disposed = false;
  return {
    async refresh() {
      if (disposed) return;
      pending = true;
      if (active) return;
      active = true;
      try {
        while (pending && !disposed) {
          pending = false;
          try {
            const snapshots = await load();
            if (!disposed) {
              const achievements = observe(snapshots);
              if (achievements.length) onAchievements(achievements);
            }
          } catch {
            // Keep the last successful baseline; the next write or poll retries.
          }
        }
      } finally {
        active = false;
      }
    },
    dispose() {
      disposed = true;
    },
  };
}
