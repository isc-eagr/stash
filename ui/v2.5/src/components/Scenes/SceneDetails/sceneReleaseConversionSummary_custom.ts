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
