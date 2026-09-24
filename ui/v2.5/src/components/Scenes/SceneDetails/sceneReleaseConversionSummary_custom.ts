interface IActivityOwnerCustom {
  files: readonly unknown[];
  play_history: readonly unknown[];
  o_history: readonly unknown[];
}

export function summarizeReleaseConversionCustom(owner: IActivityOwnerCustom) {
  return {
    files: owner.files.length,
    plays: owner.play_history.length,
    oEvents: owner.o_history.length,
  };
}

export function summarizeSceneConversionCustom(
  scene: IActivityOwnerCustom & { releases: readonly IActivityOwnerCustom[] }
) {
  return [scene, ...scene.releases].reduce(
    (total, owner) => {
      const summary = summarizeReleaseConversionCustom(owner);
      total.files += summary.files;
      total.plays += summary.plays;
      total.oEvents += summary.oEvents;
      return total;
    },
    { files: 0, plays: 0, oEvents: 0 }
  );
}
