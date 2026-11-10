import React from "react";
import { faMedal, faTrophy } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import type { ITaskProgressAchievement } from "./taskProgressAchievements_custom";
import "./taskProgressCheckpoints_custom.scss";
import "./taskProgressAchievements_custom.scss";

/** Decorative achievement content inside the standard app toast header. */
export const TaskProgressAchievementContent: React.FC<{
  achievement: ITaskProgressAchievement;
  message: string;
}> = ({ achievement, message }) => (
  <span className="progress-achievement-content">
    <span
      aria-hidden="true"
      className={`progress-achievement-emblem${
        achievement.tier ? ` milestone-checkpoint-${achievement.threshold}` : ""
      }`}
    >
      <Icon icon={achievement.threshold === 100 ? faTrophy : faMedal} />
    </span>
    <span className="progress-achievement-message">{message}</span>
  </span>
);
