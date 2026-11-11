export interface ISceneOwnerChip {
  // null is the scene itself.
  releaseId: string | null;
  label: string;
}

interface IChipRelease {
  id: string;
  title?: string | null;
  play_order: number;
}

// Scene first, then releases in play order (ties keep their original order).
export const getSceneOwnerChipsCustom = (
  releases: IChipRelease[]
): ISceneOwnerChip[] => [
  { releaseId: null, label: "Scene" },
  ...releases
    .map((release, index) => ({ release, index }))
    .sort(
      (a, b) => a.release.play_order - b.release.play_order || a.index - b.index
    )
    .map(({ release }) => ({
      releaseId: release.id,
      label: release.title?.trim() || "Untitled Release",
    })),
];
