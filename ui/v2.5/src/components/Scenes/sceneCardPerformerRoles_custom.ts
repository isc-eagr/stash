import type { IUIConfig } from "src/core/config";

interface ISceneCardPerformerRoleTag {
  id: string;
  parents?: Array<{ id: string }>;
}

interface ISceneCardPerformerRoleMarker {
  id: string;
  primary_tag: ISceneCardPerformerRoleTag;
  tags: ISceneCardPerformerRoleTag[];
  top_performers: Array<{ id: string }>;
  bottom_performers: Array<{ id: string }>;
}

interface ISceneCardPerformerRoleScene {
  scene_markers: ISceneCardPerformerRoleMarker[];
  scene_marker_tag_ancestors?: Array<{
    tag_id: string;
    ancestor_ids: string[];
  }>;
}

type PartnerCategory = "sex" | "oral" | "facial";
type PartnerDirection = "top" | "bottom";

interface IPerformerRoleState {
  sexTop: boolean;
  sexBottom: boolean;
  oralTop: boolean;
  oralBottom: boolean;
  solo: boolean;
  facialTopCount: number;
  facialBottomCount: number;
  facialMarkerIDs: Set<string>;
  orgasmTopCount: number;
  feetTopCount: number;
  partners: Record<PartnerCategory, Record<PartnerDirection, Set<string>>>;
}

function newPerformerRoleState(): IPerformerRoleState {
  return {
    sexTop: false,
    sexBottom: false,
    oralTop: false,
    oralBottom: false,
    solo: false,
    facialTopCount: 0,
    facialBottomCount: 0,
    facialMarkerIDs: new Set<string>(),
    orgasmTopCount: 0,
    feetTopCount: 0,
    partners: {
      sex: { top: new Set<string>(), bottom: new Set<string>() },
      oral: { top: new Set<string>(), bottom: new Set<string>() },
      facial: { top: new Set<string>(), bottom: new Set<string>() },
    },
  };
}

function compareIDs(a: string, b: string) {
  const aNumber = Number(a);
  const bNumber = Number(b);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return a.localeCompare(b);
}

function addCountRole(roles: string[], prefix: string, count: number) {
  if (count > 0) roles.push(`${prefix}${count}`);
}

function addPartnerRoles(
  roles: string[],
  category: PartnerCategory,
  partners: Record<PartnerDirection, Set<string>>
) {
  const topIDs = [...partners.top].sort(compareIDs);
  const bottomIDs = [...partners.bottom].sort(compareIDs);
  const allIDs = [...new Set([...topIDs, ...bottomIDs])].sort(compareIDs);

  addCountRole(roles, `${category}_top_partners_`, topIDs.length);
  addCountRole(roles, `${category}_bottom_partners_`, bottomIDs.length);
  addCountRole(roles, `${category}_all_partners_`, allIDs.length);

  if (topIDs.length > 0) roles.push(`${category}_top_pids:${topIDs.join(",")}`);
  if (bottomIDs.length > 0)
    roles.push(`${category}_bottom_pids:${bottomIDs.join(",")}`);
}

/**
 * Builds the scene-context role strings consumed by PerformerCategoryStrip.
 * This mirrors the performer scene-marker-role resolver while reusing marker
 * data already loaded for scene cards instead of issuing one query per vato.
 */
export function getSceneCardPerformerMarkerRoles(
  scene: ISceneCardPerformerRoleScene,
  roleTagIds: IUIConfig["roleTagIds"]
) {
  const ancestorsByTagID = new Map(
    (scene.scene_marker_tag_ancestors ?? []).map(({ tag_id, ancestor_ids }) => [
      tag_id,
      new Set(ancestor_ids),
    ])
  );
  const states = new Map<string, IPerformerRoleState>();
  const getState = (performerID: string) => {
    let state = states.get(performerID);
    if (!state) {
      state = newPerformerRoleState();
      states.set(performerID, state);
    }
    return state;
  };
  const tagMatches = (
    tag: ISceneCardPerformerRoleTag,
    configuredTagID?: string
  ) =>
    !!configuredTagID &&
    (tag.id === configuredTagID ||
      tag.parents?.some((parent) => parent.id === configuredTagID) ||
      ancestorsByTagID.get(tag.id)?.has(configuredTagID));

  scene.scene_markers.forEach((marker) => {
    const tags = [marker.primary_tag, ...marker.tags];
    const markerMatches = (configuredTagID?: string) =>
      tags.some((tag) => tagMatches(tag, configuredTagID));
    const isSex = markerMatches(roleTagIds?.sexTagId);
    const isOral = markerMatches(roleTagIds?.oralTagId);
    const isSolo = markerMatches(roleTagIds?.soloTagId);
    const isFacial = markerMatches(roleTagIds?.facialTagId);
    const isOrgasm = markerMatches(roleTagIds?.orgasmTagId);
    const isFeet = markerMatches(roleTagIds?.feetTagId);
    const isSecondCamera = markerMatches(roleTagIds?.secondCameraTagId);
    const topIDs = new Set(marker.top_performers.map(({ id }) => id));
    const bottomIDs = new Set(marker.bottom_performers.map(({ id }) => id));
    const performerIDs = new Set([...topIDs, ...bottomIDs]);

    performerIDs.forEach((performerID) => {
      const state = getState(performerID);
      const isTop = topIDs.has(performerID);
      const isBottom = bottomIDs.has(performerID);

      if (isSex) {
        state.sexTop ||= isTop;
        state.sexBottom ||= isBottom;
        if (isTop)
          bottomIDs.forEach((id) => {
            if (id !== performerID) state.partners.sex.top.add(id);
          });
        if (isBottom)
          topIDs.forEach((id) => {
            if (id !== performerID) state.partners.sex.bottom.add(id);
          });
      }

      if (isOral) {
        state.oralTop ||= isTop;
        state.oralBottom ||= isBottom;
        if (isTop)
          bottomIDs.forEach((id) => {
            if (id !== performerID) state.partners.oral.top.add(id);
          });
        if (isBottom)
          topIDs.forEach((id) => {
            if (id !== performerID) state.partners.oral.bottom.add(id);
          });
      }

      if (isSolo && isTop) state.solo = true;

      if (isFacial) {
        if (isTop)
          bottomIDs.forEach((id) => {
            if (id !== performerID) state.partners.facial.top.add(id);
          });
        if (isBottom)
          topIDs.forEach((id) => {
            if (id !== performerID) state.partners.facial.bottom.add(id);
          });

        if (!isSecondCamera) {
          if (isTop) state.facialTopCount += 1;
          if (isBottom) state.facialBottomCount += 1;
          state.facialMarkerIDs.add(marker.id);
        }
      }

      if (isOrgasm && isTop && !isSecondCamera) state.orgasmTopCount += 1;
      if (isFeet && isTop) state.feetTopCount += 1;
    });
  });

  return new Map(
    [...states].map(([performerID, state]) => {
      const roles: string[] = [];
      if (state.sexTop) roles.push("sex_top");
      if (state.sexBottom) roles.push("sex_bottom");
      if (state.oralTop) roles.push("oral_top");
      if (state.oralBottom) roles.push("oral_bottom");
      if (state.solo) roles.push("solo");
      addCountRole(roles, "facial_top_", state.facialTopCount);
      addCountRole(roles, "facial_bottom_", state.facialBottomCount);
      addCountRole(roles, "facial_unique_", state.facialMarkerIDs.size);
      addPartnerRoles(roles, "sex", state.partners.sex);
      addPartnerRoles(roles, "oral", state.partners.oral);
      addPartnerRoles(roles, "facial", state.partners.facial);
      addCountRole(roles, "orgasm_top_", state.orgasmTopCount);
      addCountRole(roles, "feet_top_", state.feetTopCount);
      return [performerID, roles];
    })
  );
}
