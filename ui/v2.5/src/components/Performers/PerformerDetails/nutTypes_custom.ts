import type { IUIConfig } from "src/core/config";

// CUSTOM: Nut tile pips on Vato and Studio details: nuts (top row) and
// facials (bottom row), each plain, Really Hot, and GOAT.
export type NutTypeRowCustom = "nut" | "facial";
export type NutQualityCustom = "plain" | "really_hot" | "goat";

type LabeledTag = { id: string; label: string };

// Marker tags behind one pip: nuts leave out facials, Really Hot leaves out
// GOAT, plain leaves out both, and 2nd camera markers never count. Undefined
// when a needed tag isn't configured.
export function nutTypeMarkerTagsCustom(
  row: NutTypeRowCustom,
  quality: NutQualityCustom,
  roleTagIds: IUIConfig["roleTagIds"]
): { tags: LabeledTag[]; excludeTags: LabeledTag[] } | undefined {
  const tag = (id: string | undefined, label: string) =>
    id ? [{ id, label }] : [];
  const facial = tag(roleTagIds?.facialTagId, "Facial");
  const rowTag =
    row === "facial" ? facial : tag(roleTagIds?.orgasmTagId, "Nut");
  if (rowTag.length === 0) return undefined;
  const goat = tag(roleTagIds?.goatTagId, "GOAT");
  const reallyHot = tag(roleTagIds?.reallyHotTagId, "Really Hot");
  const qualityTags = { plain: [], really_hot: reallyHot, goat }[quality];
  if (quality !== "plain" && qualityTags.length === 0) return undefined;
  return {
    tags: [...rowTag, ...qualityTags],
    excludeTags: [
      ...(row === "nut" ? facial : []),
      ...(quality === "plain" ? [...reallyHot, ...goat] : []),
      ...(quality === "really_hot" ? goat : []),
      ...tag(roleTagIds?.secondCameraTagId, "2nd Camera"),
    ],
  };
}
