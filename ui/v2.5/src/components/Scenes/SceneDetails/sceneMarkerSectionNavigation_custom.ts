const sceneMarkerJumpSectionKeys = new Set([
  "oral",
  "sex",
  "solo",
  "feet",
  "orgasm",
  "facial",
  "other-highlights",
]);

interface ISceneMarkerSectionScrollTarget {
  scrollIntoView: (options?: ScrollIntoViewOptions) => void;
}

interface ISceneMarkerSectionDocument {
  getElementById: (id: string) => ISceneMarkerSectionScrollTarget | null;
}

export function isSceneMarkerJumpSection(sectionKey: string) {
  return sceneMarkerJumpSectionKeys.has(sectionKey);
}

export function getSceneMarkerSectionAnchorId(sectionKey: string) {
  return `scene-marker-section-${sectionKey}`;
}

export function scrollToSceneMarkerSection(
  sectionKey: string,
  targetDocument: ISceneMarkerSectionDocument = document
) {
  const target = targetDocument.getElementById(
    getSceneMarkerSectionAnchorId(sectionKey)
  );

  if (!target) {
    return false;
  }

  target.scrollIntoView({
    behavior: "smooth",
    block: "start",
    inline: "nearest",
  });

  return true;
}
