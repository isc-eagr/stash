import React from "react";
import cx from "classnames";
import { getSceneOwnerChipsCustom } from "./sceneOwnerChips_custom";

interface ISceneOwnerSwitcherProps {
  releases: { id: string; title?: string | null; play_order: number }[];
  activeReleaseId: string | null;
  onSelect: (releaseId: string | null) => void;
}

// Chooses whether the scene page is about the scene or one of its releases.
export const SceneOwnerSwitcher: React.FC<ISceneOwnerSwitcherProps> = ({
  releases,
  activeReleaseId,
  onSelect,
}) => {
  if (releases.length === 0) return null;

  return (
    <div className="scene-owner-switcher" role="group" aria-label="Viewing">
      {getSceneOwnerChipsCustom(releases).map((chip) => {
        const active = chip.releaseId === activeReleaseId;
        return (
          <button
            type="button"
            key={chip.releaseId ?? "scene"}
            className={cx("scene-owner-chip", {
              "scene-owner-chip--active": active,
            })}
            aria-pressed={active}
            title={chip.label}
            onClick={() => onSelect(chip.releaseId)}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
};
