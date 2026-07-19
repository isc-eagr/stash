// CUSTOM: Keep scrubber marker focus scrolling inside the scene tab panel.
interface ICenteredSceneMarkerScrollInput {
  containerClientHeight: number;
  containerScrollTop: number;
  containerTop: number;
  markerHeight: number;
  markerTop: number;
}

interface ISceneMarkerFocusElement {
  getAttribute(name: string): string | null;
}

function representedSceneMarkerIds(element: ISceneMarkerFocusElement) {
  return (element.getAttribute("data-scene-marker-ids") ?? "")
    .split(",")
    .filter(Boolean);
}

export function findSceneMarkerFocusElement<T extends ISceneMarkerFocusElement>(
  elements: Iterable<T>,
  markerId: string
): T | undefined {
  const candidates = Array.from(elements);

  return (
    candidates.find(
      (element) => element.getAttribute("data-scene-marker-id") === markerId
    ) ??
    candidates.find((element) =>
      representedSceneMarkerIds(element).includes(markerId)
    )
  );
}

export function getCenteredSceneMarkerScrollTop({
  containerClientHeight,
  containerScrollTop,
  containerTop,
  markerHeight,
  markerTop,
}: ICenteredSceneMarkerScrollInput): number {
  const markerOffset = markerTop - containerTop + containerScrollTop;
  return Math.max(0, markerOffset - (containerClientHeight - markerHeight) / 2);
}

export function isSceneTabScrollContainer(overflowY: string): boolean {
  return overflowY === "auto" || overflowY === "scroll";
}

export function scrollSceneMarkerIntoTabView(
  scrollElement: HTMLElement,
  markerElement: HTMLElement
): void {
  if (
    !isSceneTabScrollContainer(window.getComputedStyle(scrollElement).overflowY)
  ) {
    markerElement.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }

  const containerRect = scrollElement.getBoundingClientRect();
  const markerRect = markerElement.getBoundingClientRect();

  scrollElement.scrollTo({
    behavior: "smooth",
    top: getCenteredSceneMarkerScrollTop({
      containerClientHeight: scrollElement.clientHeight,
      containerScrollTop: scrollElement.scrollTop,
      containerTop: containerRect.top,
      markerHeight: markerRect.height,
      markerTop: markerRect.top,
    }),
  });
}
