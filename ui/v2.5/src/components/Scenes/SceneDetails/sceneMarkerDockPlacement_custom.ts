// CUSTOM: Local marker placement and scroll-container helpers.
export type SceneMarkerPlacement = "sidebar" | "below";

export const sceneMarkerPlacementStorageKey = "stash.sceneMarkerPlacement";
export const sceneMarkerDockMediaQuery = "(min-width: 1200px)";

export function parseSceneMarkerPlacement(value: string | null) {
  return value === "below" ? "below" : "sidebar";
}

export function readSceneMarkerPlacement(): SceneMarkerPlacement {
  try {
    return parseSceneMarkerPlacement(
      localStorage.getItem(sceneMarkerPlacementStorageKey)
    );
  } catch {
    return "sidebar";
  }
}

export function saveSceneMarkerPlacement(placement: SceneMarkerPlacement) {
  try {
    localStorage.setItem(sceneMarkerPlacementStorageKey, placement);
  } catch {
    // Keep the toggle usable when browser storage is unavailable.
  }
}

export function shouldDockSceneMarkers(
  placement: SceneMarkerPlacement,
  isDesktop: boolean,
  isVisible: boolean,
  collapsed: boolean
) {
  return placement === "below" && isDesktop && isVisible && !collapsed;
}

export function getSceneMarkerScrollElement(element?: Element | null) {
  return element
    ? element.closest<HTMLElement>(
        "[data-scene-marker-scroll-container], .tab-content"
      )
    : document.querySelector<HTMLElement>(
        "[data-scene-marker-scroll-container]"
      ) ?? document.querySelector<HTMLElement>(".scene-tabs .tab-content");
}

export function moveSceneMarkerDock(
  container: HTMLElement,
  target: HTMLElement
) {
  if (container.parentElement === target) return;

  const activeElement = container.ownerDocument
    .activeElement as HTMLElement | null;
  const restoreFocus = activeElement && container.contains(activeElement);
  target.appendChild(container);
  if (restoreFocus) activeElement.focus({ preventScroll: true });
}
