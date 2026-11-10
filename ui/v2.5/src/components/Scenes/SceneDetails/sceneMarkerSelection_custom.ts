// CUSTOM: Selection helpers for the chronological scene markers panel.

export type SceneMarkerSelectionState = "all" | "none" | "some";

export function getSceneMarkerSelectionState(
  itemKeys: Iterable<string>,
  selectedKeys: ReadonlySet<string>
): SceneMarkerSelectionState {
  const uniqueItemKeys = new Set(itemKeys);
  let selectedCount = 0;

  uniqueItemKeys.forEach((key) => {
    if (selectedKeys.has(key)) {
      selectedCount += 1;
    }
  });

  if (selectedCount === 0 || uniqueItemKeys.size === 0) {
    return "none";
  }

  return selectedCount === uniqueItemKeys.size ? "all" : "some";
}

export function getSceneMarkerSelectionCounts(
  selectedKeys: Iterable<string>,
  visibleKeys: ReadonlySet<string>
) {
  const uniqueSelectedKeys = new Set(selectedKeys);
  let visible = 0;

  uniqueSelectedKeys.forEach((key) => {
    if (visibleKeys.has(key)) {
      visible += 1;
    }
  });

  return {
    hidden: uniqueSelectedKeys.size - visible,
    total: uniqueSelectedKeys.size,
    visible,
  };
}
