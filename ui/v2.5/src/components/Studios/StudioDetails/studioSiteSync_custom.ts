// CUSTOM: Studio site sync steps and report helpers.
import type {
  StudioSiteSync,
  StudioSiteSyncInput,
  StudioSiteSyncReportQuery,
} from "src/core/generated-graphql";

export type SiteSyncStepCustom =
  | "codes"
  | "metadata"
  | "pictures"
  | "galleries";
export type SiteSyncSelectionCustom = Record<SiteSyncStepCustom, boolean>;
export type SiteSyncReportCustom = NonNullable<
  StudioSiteSyncReportQuery["studioSiteSyncReport"]
>;
export type SiteSyncSceneChangeCustom = SiteSyncReportCustom["scenes"][number];
export type SiteSyncSiteCustom = Pick<StudioSiteSync, "name" | "pictures">;

interface ISiteSyncStepCustom {
  key: SiteSyncStepCustom;
  label: string;
  description: string;
}

const STEPS: ISiteSyncStepCustom[] = [
  {
    key: "codes",
    label: "Match codes",
    description:
      "Find codes for scenes without one. Scenes without a code are skipped by the other steps.",
  },
  {
    key: "metadata",
    label: "Fill metadata",
    description:
      "Empty titles, dates, details, links and covers. Values you set by hand stay put.",
  },
  {
    key: "pictures",
    label: "Download pictures",
    description: "Missing members picture sets, into the pictures folder.",
  },
  {
    key: "galleries",
    label: "Scan and make galleries",
    description:
      "Scan new picture folders and give each scene without one its gallery.",
  },
];

// Sites without downloads use folders added by hand, so they skip pictures.
export function siteSyncStepsCustom(
  site: SiteSyncSiteCustom
): ISiteSyncStepCustom[] {
  return STEPS.filter((step) => step.key !== "pictures" || site.pictures);
}

export const SITE_SYNC_ALL_STEPS_CUSTOM: SiteSyncSelectionCustom = {
  codes: true,
  metadata: true,
  pictures: true,
  galleries: true,
};

export function siteSyncInputCustom(
  studioID: string,
  site: SiteSyncSiteCustom,
  selection: SiteSyncSelectionCustom
): StudioSiteSyncInput {
  return {
    studio_id: studioID,
    codes: selection.codes,
    metadata: selection.metadata,
    pictures: site.pictures && selection.pictures,
    galleries: selection.galleries,
  };
}

export function siteSyncHasStepCustom(
  site: SiteSyncSiteCustom,
  selection: SiteSyncSelectionCustom
): boolean {
  return siteSyncStepsCustom(site).some((step) => selection[step.key]);
}

const FIELD_LABELS: Record<string, string> = {
  code: "Code",
  title: "Title",
  date: "Date",
  details: "Details",
  urls: "Links",
  cover: "Cover",
};

// What the run did to a scene, in the order the sync writes it.
export function siteSyncChangeLabelsCustom(
  scene: SiteSyncSceneChangeCustom
): string[] {
  const ret = scene.filled.map((field) => FIELD_LABELS[field] ?? field);
  if (scene.pictures) ret.push("Pictures");
  if (scene.gallery_id) ret.push("Gallery");
  return ret;
}

export function splitSiteSyncScenesCustom(scenes: SiteSyncSceneChangeCustom[]) {
  return {
    changed: scenes.filter(
      (scene) => siteSyncChangeLabelsCustom(scene).length > 0
    ),
    issues: scenes.filter((scene) => scene.issues.length > 0),
  };
}

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// One line per non-zero total.
export function siteSyncSummaryCustom(report: SiteSyncReportCustom): string[] {
  const { changed } = splitSiteSyncScenesCustom(report.scenes);
  const filled = changed.filter((scene) => scene.filled.length > 0).length;
  const pictures = changed.filter((scene) => scene.pictures).length;
  const galleries = changed.filter((scene) => scene.gallery_id).length;
  const ret = [`Checked ${count(report.checked, "scene")}`];
  if (report.postponed) ret.push(`${report.postponed} postponed`);
  if (filled) ret.push(`${count(filled, "scene")} updated`);
  if (pictures) ret.push(`${count(pictures, "picture set")} downloaded`);
  if (report.scanned_folders) {
    ret.push(`${count(report.scanned_folders, "folder")} scanned`);
  }
  if (galleries) ret.push(`${count(galleries, "gallery", "galleries")} made`);
  if (report.no_pictures) {
    ret.push(`${count(report.no_pictures, "scene")} without pictures`);
  }
  return ret;
}
