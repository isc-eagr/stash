import React, { useCallback } from "react"; // CUSTOM
import { Link } from "react-router-dom";
import {
  PerformerCardVersatilityRow,
  PerformerCardVersatilityTimeRow,
} from "./PerformerCardVersatility_custom"; // CUSTOM
import type { IScenePerformerRoleSeconds } from "src/components/Scenes/scenePerformerRoleSeconds_custom"; // CUSTOM
import { Icon } from "src/components/Shared/Icon";
import { PerformerLink } from "src/components/Shared/TagLink"; // CUSTOM
import { faHand } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import { useConfigurationContext } from "src/hooks/Config";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import facialPng from "src/assets/facial.png"; // CUSTOM
import spermsSvg from "src/assets/sperms.svg";
import feetSvg from "src/assets/feet.svg";
import type { PerformerListData } from "../performerTypes_custom"; // CUSTOM
import {
  catalogCardSortHighlightClassCustom,
  isCatalogCardSortHighlightedCustom,
} from "src/components/Shared/catalogCardSortHighlight_custom"; // CUSTOM
import cx from "classnames"; // CUSTOM

type PerformerCategoryStripData = Pick<PerformerListData, "id" | "name"> &
  Partial<PerformerListData>; // CUSTOM: scene-card hovers only load compact performer data

interface IPerformerCategoryStripProps {
  performer: PerformerCategoryStripData;
  /** Scene ID for scene context - enables role badges based on marker roles */
  sceneId?: string;
  /** Marker roles in the current scene (used when sceneId is provided) */
  markerRoles?: string[];
  /** Number of performers in the scene - used to determine whether to show partner counts */
  scenePerformerCount?: number;
  /** All performers in the scene, used to show mini images in partner tooltips (scene context only) */
  scenePartnerPerformers?: Pick<GQL.Performer, "id" | "name" | "image_path">[]; // CUSTOM
  /** Optional scoped totals used outside scene context, for example studio-filtered performer cards */
  globalStatsOverride?: {
    sex_scene_count: number;
    sex_top_count: number;
    sex_bottom_count: number;
    sex_with_top_count: number;
    sex_with_bottom_count: number;
    sex_unique_partner_count: number;
    oral_scene_count: number;
    oral_top_count: number;
    oral_bottom_count: number;
    oral_with_top_count: number;
    oral_with_bottom_count: number;
    oral_unique_partner_count: number;
    solo_scene_count: number;
    facial_scene_count: number;
    facial_top_count: number;
    facial_bottom_count: number;
    facial_with_top_count: number;
    facial_with_bottom_count: number;
    facial_marker_with_top_count: number;
    facial_marker_with_bottom_count: number;
    facial_unique_partner_count: number;
    orgasm_top_count: number;
    facial_marker_count: number; // CUSTOM
    feet_top_count: number; // CUSTOM
  } | null;
  /** When set, all badge links will be scoped to this studio */
  studioContext?: { id: string; label: string; depth: number }; // CUSTOM
  /** Active performer-list sort, used to emphasize an already visible role count. */
  activeSortBy?: string; // CUSTOM
  /** Optional target used by embedded overview surfaces. */
  linkTarget?: React.HTMLAttributeAnchorTarget; // CUSTOM
  /** Removes the standard vertical margin inside compact embedded surfaces. */
  flushMargins?: boolean; // CUSTOM
  /** Performer cards only: sex/oral/facial become one-line versatility strips,
   * counting partners in the scene when sceneId is set. */
  versatilityCard?: boolean; // CUSTOM
  /** Scene-card hovers: sex/oral rows show top vs bottom time instead of partners. */
  roleSeconds?: IScenePerformerRoleSeconds; // CUSTOM
}

/**
 * PerformerCategoryStrip - Shows marker-based role badges with top/bottom breakdown
 * Uses roleTagIds configuration for tag IDs and counts from performer data.
 * Can show global counts or scene-specific roles depending on context.
 *
 * Scene Context (sceneId provided):
 * - Shows roles based on markers in that specific scene
 * - Count = total unique partners (sex/oral) or unique markers (facial)
 * - Top/Bottom counts = unique partners for that role in the scene
 *
 * Global Context (no sceneId):
 * - Shows cumulative counts across all scenes
 * - Count = total scenes
 * - Top/Bottom counts = scenes where performer had that role
 *
 * Used in both performer cards (with sceneId/markerRoles) and detail pages (global).
 */
export const PerformerCategoryStrip: React.FC<IPerformerCategoryStripProps> = ({
  performer,
  sceneId,
  markerRoles: markerRolesProp = [],
  scenePerformerCount = 0,
  scenePartnerPerformers, // CUSTOM
  globalStatsOverride,
  studioContext, // CUSTOM
  activeSortBy, // CUSTOM
  linkTarget, // CUSTOM
  flushMargins = false, // CUSTOM
  versatilityCard = false, // CUSTOM
  roleSeconds, // CUSTOM
}) => {
  const { configuration } = useConfigurationContext();

  // Extra safety: ensure markerRoles is always an array
  const markerRoles = markerRolesProp ?? [];

  // Get role tag IDs from the new configuration
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};
  const { sexTagId } = roleTagIds;
  const { oralTagId } = roleTagIds;
  const { soloTagId } = roleTagIds;
  const { facialTagId } = roleTagIds;
  const { orgasmTagId } = roleTagIds;
  const { feetTagId } = roleTagIds;

  // Sort shown by each role's total: scene counts for sex/oral, facials for facial.
  const roleTotalSortKey = (category: "sex" | "oral" | "facial") =>
    category === "facial" ? "facial_count" : `${category}_scenes_count`;
  const isRoleSortHighlighted = (...sortKeys: string[]) =>
    !sceneId && isCatalogCardSortHighlightedCustom(activeSortBy, ...sortKeys);
  const shouldRenderRoleForActiveSort = (
    category: "sex" | "oral" | "solo" | "facial"
  ) => {
    if (category === "solo") {
      return isRoleSortHighlighted("solo_scenes_count");
    }

    return isRoleSortHighlighted(
      roleTotalSortKey(category),
      `${category}_topped_partners`,
      `${category}_bottomed_partners`
    );
  }; // CUSTOM

  const renderMiniPartnerRows = useCallback(
    (
      partners: Array<{ id: string; name: string; image_path?: string | null }>
    ) => (
      <div className="performer-hover-grid performer-partner-hover-grid">
        {partners.map((partner) => (
          <div
            className="performer-tag-container performer-hover-row"
            key={partner.id}
          >
            <Link
              to={`/performers/${partner.id}`}
              className="performer-tag performer-hover-image-link zoom-2"
              target={linkTarget} // CUSTOM
              rel={linkTarget === "_blank" ? "noopener noreferrer" : undefined} // CUSTOM
            >
              <img
                className="image-thumbnail performer-hover-image-thumbnail"
                alt={partner.name ?? ""}
                src={partner.image_path ?? ""}
              />
            </Link>
            <PerformerLink
              performer={partner}
              className="d-block"
              target={linkTarget} // CUSTOM
            />
          </div>
        ))}
      </div>
    ),
    [linkTarget]
  );

  // CUSTOM: end

  const p = performer;
  let orgasmTopCount = 0;
  let feetTopCount = 0;
  let sceneFacialTopCount = 0;
  let sceneFacialBottomCount = 0;
  let sceneFacialTotalCount = 0;
  let sceneFacialUniqueCount = 0; // Unique marker count from backend

  // Scene-specific partner counts (unique partners per role)
  let sceneSexTopPartners = 0;
  let sceneSexBottomPartners = 0;
  let sceneSexAllPartners = 0; // Unique across both roles
  let sceneOralTopPartners = 0;
  let sceneOralBottomPartners = 0;
  let sceneOralAllPartners = 0; // Unique across both roles
  let sceneFacialTopPartners = 0; // CUSTOM
  let sceneFacialBottomPartners = 0; // CUSTOM

  // Build roles to show based on context
  let rolesToShow: Array<{
    category: "sex" | "oral" | "solo" | "facial";
    count?: number;
    partnerTopCount?: number; // CUSTOM
    partnerBottomCount?: number; // CUSTOM
    tagId?: string;
    topPids?: string[]; // CUSTOM: partner performer IDs for top role mini images
    bottomPids?: string[]; // CUSTOM: partner performer IDs for bottom role mini images
  }> = [];

  if (sceneId) {
    // Scene context: show roles based on marker roles in this scene only
    const sexRoles = markerRoles.filter((r: string) => r.startsWith("sex_"));
    const oralRoles = markerRoles.filter((r: string) => r.startsWith("oral_"));
    const soloRoles = markerRoles.filter((r: string) => r === "solo");
    // Facial roles now come as "facial_top_X" and "facial_bottom_X" with counts
    const facialTopRoles = markerRoles.filter((r: string) =>
      r.startsWith("facial_top_")
    );
    const facialBottomRoles = markerRoles.filter((r: string) =>
      r.startsWith("facial_bottom_")
    );
    const facialUniqueRoles = markerRoles.filter((r: string) =>
      r.startsWith("facial_unique_")
    );
    const orgasmRoles = markerRoles.filter((r: string) =>
      r.startsWith("orgasm_top_")
    );

    // Parse orgasm count from "orgasm_top_X" format
    if (orgasmRoles.length > 0 && orgasmTagId) {
      const match = orgasmRoles[0].match(/orgasm_top_(\d+)/);
      if (match) {
        orgasmTopCount = parseInt(match[1], 10);
      }
    }

    // Check for feet roles (feet_top_X format)
    const feetRoles = markerRoles.filter((r: string) =>
      r.startsWith("feet_top_")
    );

    // Parse feet count from "feet_top_X" format
    if (feetRoles.length > 0 && feetTagId) {
      const match = feetRoles[0].match(/feet_top_(\d+)/);
      if (match) {
        feetTopCount = parseInt(match[1], 10);
      }
    }

    // Parse facial top count from "facial_top_X" format
    if (facialTopRoles.length > 0 && facialTagId) {
      const match = facialTopRoles[0].match(/facial_top_(\d+)/);
      if (match) {
        sceneFacialTopCount = parseInt(match[1], 10);
      }
    }

    // Parse facial bottom count from "facial_bottom_X" format
    if (facialBottomRoles.length > 0 && facialTagId) {
      const match = facialBottomRoles[0].match(/facial_bottom_(\d+)/);
      if (match) {
        sceneFacialBottomCount = parseInt(match[1], 10);
      }
    }

    // Parse unique facial marker count from "facial_unique_X" format (preferred)
    if (facialUniqueRoles.length > 0 && facialTagId) {
      const match = facialUniqueRoles[0].match(/facial_unique_(\d+)/);
      if (match) {
        sceneFacialUniqueCount = parseInt(match[1], 10);
      }
    }

    // Calculate total facial count for this scene
    // Prefer the unique count from backend (which correctly handles when performer is both top and bottom)
    // Fall back to max of top/bottom if unique count not available (for backward compatibility)
    sceneFacialTotalCount =
      sceneFacialUniqueCount > 0
        ? sceneFacialUniqueCount
        : Math.max(sceneFacialTopCount, sceneFacialBottomCount);

    // Parse partner counts from marker roles (sex_top_partners_3, oral_bottom_partners_2, etc.)
    const sexTopPartnerRoles = markerRoles.filter((r: string) =>
      r.startsWith("sex_top_partners_")
    );
    const sexBottomPartnerRoles = markerRoles.filter((r: string) =>
      r.startsWith("sex_bottom_partners_")
    );
    const sexAllPartnerRoles = markerRoles.filter((r: string) =>
      r.startsWith("sex_all_partners_")
    );
    const oralTopPartnerRoles = markerRoles.filter((r: string) =>
      r.startsWith("oral_top_partners_")
    );
    const oralBottomPartnerRoles = markerRoles.filter((r: string) =>
      r.startsWith("oral_bottom_partners_")
    );
    const oralAllPartnerRoles = markerRoles.filter((r: string) =>
      r.startsWith("oral_all_partners_")
    );
    if (sexTopPartnerRoles.length > 0) {
      const match = sexTopPartnerRoles[0].match(/sex_top_partners_(\d+)/);
      if (match) sceneSexTopPartners = parseInt(match[1], 10);
    }
    if (sexBottomPartnerRoles.length > 0) {
      const match = sexBottomPartnerRoles[0].match(/sex_bottom_partners_(\d+)/);
      if (match) sceneSexBottomPartners = parseInt(match[1], 10);
    }
    if (sexAllPartnerRoles.length > 0) {
      const match = sexAllPartnerRoles[0].match(/sex_all_partners_(\d+)/);
      if (match) sceneSexAllPartners = parseInt(match[1], 10);
    }
    if (oralTopPartnerRoles.length > 0) {
      const match = oralTopPartnerRoles[0].match(/oral_top_partners_(\d+)/);
      if (match) sceneOralTopPartners = parseInt(match[1], 10);
    }
    if (oralBottomPartnerRoles.length > 0) {
      const match = oralBottomPartnerRoles[0].match(
        /oral_bottom_partners_(\d+)/
      );
      if (match) sceneOralBottomPartners = parseInt(match[1], 10);
    }
    if (oralAllPartnerRoles.length > 0) {
      const match = oralAllPartnerRoles[0].match(/oral_all_partners_(\d+)/);
      if (match) sceneOralAllPartners = parseInt(match[1], 10);
    }
    // CUSTOM: facial partner counts for the scene card versatility strip
    const parseCount = (pattern: RegExp) => {
      const match = markerRoles
        .map((r: string) => r.match(pattern))
        .find(Boolean);
      return match ? parseInt(match[1], 10) : 0;
    };
    sceneFacialTopPartners = parseCount(/^facial_top_partners_(\d+)$/);
    sceneFacialBottomPartners = parseCount(/^facial_bottom_partners_(\d+)$/);
    // CUSTOM: begin - parse partner performer ID strings for mini image tooltips
    // Format: "sex_top_pids:3,7,12" etc.
    const parsePIDs = (prefix: string): string[] => {
      const role = markerRoles.find((r: string) => r.startsWith(prefix));
      if (!role) return [];
      const idx = role.indexOf(":");
      if (idx < 0) return [];
      return role
        .slice(idx + 1)
        .split(",")
        .filter(Boolean);
    };
    const sexTopPids = parsePIDs("sex_top_pids:");
    const sexBottomPids = parsePIDs("sex_bottom_pids:");
    const oralTopPids = parsePIDs("oral_top_pids:");
    const oralBottomPids = parsePIDs("oral_bottom_pids:");
    const facialTopPids = parsePIDs("facial_top_pids:");
    const facialBottomPids = parsePIDs("facial_bottom_pids:");
    // CUSTOM: end

    // Fixed order: Sex, Oral, Facial, Solo
    if (sexRoles.length > 0 && sexTagId) {
      rolesToShow.push({
        category: "sex",
        count: sceneSexAllPartners, // Unique partners across both roles (no double-counting)
        partnerTopCount: sceneSexTopPartners, // CUSTOM
        partnerBottomCount: sceneSexBottomPartners, // CUSTOM
        tagId: sexTagId,
        topPids: sexTopPids, // CUSTOM
        bottomPids: sexBottomPids, // CUSTOM
      });
    }
    if (oralRoles.length > 0 && oralTagId) {
      rolesToShow.push({
        category: "oral",
        count: sceneOralAllPartners, // Unique partners across both roles (no double-counting)
        partnerTopCount: sceneOralTopPartners, // CUSTOM
        partnerBottomCount: sceneOralBottomPartners, // CUSTOM
        tagId: oralTagId,
        topPids: oralTopPids, // CUSTOM
        bottomPids: oralBottomPids, // CUSTOM
      });
    }
    // Facial now shows counts in scene context
    if (
      (facialTopRoles.length > 0 || facialBottomRoles.length > 0) &&
      facialTagId
    ) {
      rolesToShow.push({
        category: "facial",
        count: sceneFacialTotalCount, // Total facial count (not unique partners)
        partnerTopCount: sceneFacialTopPartners, // CUSTOM
        partnerBottomCount: sceneFacialBottomPartners, // CUSTOM
        tagId: facialTagId,
        topPids: facialTopPids, // CUSTOM
        bottomPids: facialBottomPids, // CUSTOM
      });
    }
    if (soloRoles.length > 0 && soloTagId) {
      rolesToShow.push({
        category: "solo",
        tagId: soloTagId,
      });
    }
  } else {
    // Global context: show total counts from performer data
    const sexCount =
      globalStatsOverride?.sex_scene_count ?? p.sex_scene_count ?? 0;
    const oralCount =
      globalStatsOverride?.oral_scene_count ?? p.oral_scene_count ?? 0;
    const soloCount =
      globalStatsOverride?.solo_scene_count ?? p.solo_scene_count ?? 0;
    // Use marker count for facial (unique markers) instead of scene count
    const facialCount =
      globalStatsOverride?.facial_marker_count ?? p.facial_marker_count ?? 0; // CUSTOM - use facial_marker_count from override (individual markers, not scenes)

    const sexWithTopCount =
      globalStatsOverride?.sex_with_top_count ?? p.sex_with_top_count ?? 0;
    const sexWithBottomCount =
      globalStatsOverride?.sex_with_bottom_count ??
      p.sex_with_bottom_count ??
      0;
    const oralWithTopCount =
      globalStatsOverride?.oral_with_top_count ?? p.oral_with_top_count ?? 0;
    const oralWithBottomCount =
      globalStatsOverride?.oral_with_bottom_count ??
      p.oral_with_bottom_count ??
      0;
    // Use marker counts for facial "with" counts (unique markers) instead of scene counts
    const facialWithTopCount =
      globalStatsOverride?.facial_marker_with_top_count ??
      p.facial_marker_with_top_count ??
      0;
    const facialWithBottomCount =
      globalStatsOverride?.facial_marker_with_bottom_count ??
      p.facial_marker_with_bottom_count ??
      0;

    if (globalStatsOverride) {
      orgasmTopCount = globalStatsOverride.orgasm_top_count ?? 0;
      feetTopCount = globalStatsOverride.feet_top_count ?? 0; // CUSTOM
    } else {
      orgasmTopCount = p.orgasm_top_count ?? 0;
      feetTopCount = p.feet_marker_count ?? 0;
    }

    // Show category if performer has scenes OR has partner counts in that category
    if (
      (sexCount > 0 ||
        sexWithTopCount > 0 ||
        sexWithBottomCount > 0 ||
        shouldRenderRoleForActiveSort("sex")) &&
      sexTagId
    ) {
      rolesToShow.push({
        category: "sex",
        count: sexCount,
        partnerTopCount: sexWithTopCount, // CUSTOM
        partnerBottomCount: sexWithBottomCount, // CUSTOM
        tagId: sexTagId,
      });
    }
    if (
      (oralCount > 0 ||
        oralWithTopCount > 0 ||
        oralWithBottomCount > 0 ||
        shouldRenderRoleForActiveSort("oral")) &&
      oralTagId
    ) {
      rolesToShow.push({
        category: "oral",
        count: oralCount,
        partnerTopCount: oralWithTopCount, // CUSTOM
        partnerBottomCount: oralWithBottomCount, // CUSTOM
        tagId: oralTagId,
      });
    }
    if (
      (facialCount > 0 ||
        facialWithTopCount > 0 ||
        facialWithBottomCount > 0 ||
        shouldRenderRoleForActiveSort("facial")) &&
      facialTagId
    ) {
      rolesToShow.push({
        category: "facial",
        count: facialCount,
        // Use scoped counts when available, otherwise fall back to global facial marker counts.
        partnerTopCount: facialWithTopCount, // CUSTOM
        partnerBottomCount: facialWithBottomCount, // CUSTOM
        tagId: facialTagId,
      });
    }
    if ((soloCount > 0 || shouldRenderRoleForActiveSort("solo")) && soloTagId) {
      rolesToShow.push({
        category: "solo",
        count: soloCount,
        tagId: soloTagId,
      });
    }
  }

  // Only show if at least one role tag is configured
  const hasAnyRoleTag =
    sexTagId ||
    oralTagId ||
    soloTagId ||
    facialTagId ||
    orgasmTagId ||
    feetTagId; // CUSTOM
  const hasActiveStandaloneRoleSort =
    (!!orgasmTagId && isRoleSortHighlighted("orgasm_count")) ||
    (!!feetTagId && isRoleSortHighlighted("feet_markers_count")); // CUSTOM
  if (
    !hasAnyRoleTag ||
    (rolesToShow.length === 0 &&
      orgasmTopCount === 0 &&
      feetTopCount === 0 &&
      !hasActiveStandaloneRoleSort)
  )
    return null;

  // Extra safety: ensure rolesToShow is always an array
  const safeRolesToShow = rolesToShow ?? [];

  // Build exclude tags for oral (exclude sex) and solo (exclude sex + oral)
  const getExcludeTagsForCategory = (
    category: "sex" | "oral" | "solo" | "facial"
  ) => {
    const excludeTags: Array<{ id: string; label: string }> = [];
    if (category === "oral") {
      // Oral should exclude sex tag
      if (sexTagId) excludeTags.push({ id: sexTagId, label: "Sex" });
    } else if (category === "solo") {
      // Solo should exclude both sex and oral tags
      if (sexTagId) excludeTags.push({ id: sexTagId, label: "Sex" });
      if (oralTagId) excludeTags.push({ id: oralTagId, label: "Oral" });
    }
    return excludeTags.length > 0 ? excludeTags : undefined;
  };

  // Category icon tooltip: scene partners in a scene, scene counts elsewhere.
  const getTooltipText = (
    category: "sex" | "oral" | "solo" | "facial",
    count: number
  ) => {
    const name = p.name || "Performer";
    if (category === "solo") {
      return sceneId
        ? `${name} has solo markers in this scene`
        : `${name} has appeared in ${count} solo scene${
            count !== 1 ? "s" : ""
          }`;
    }
    if (category === "facial") {
      return sceneId
        ? `${name} participated in ${count} facial${
            count !== 1 ? "s" : ""
          } in this scene`
        : `${name} has ${count} total facial marker${count !== 1 ? "s" : ""}`;
    }
    return sceneId
      ? `${name} has ${count} ${category} partner${
          count !== 1 ? "s" : ""
        } in this scene`
      : `${name} has appeared in ${count} ${category} scene${
          count !== 1 ? "s" : ""
        }`;
  };

  // CUSTOM: begin - card versatility rows sit above the remaining icons
  const roleTimeSeconds = (category: "sex" | "oral") => ({
    top: roleSeconds?.[`${category}TopSeconds`] ?? 0,
    bottom: roleSeconds?.[`${category}BottomSeconds`] ?? 0,
  });
  // Scene cards skip rows without scene partners, e.g. a self-facial.
  const versatilityRoles = versatilityCard
    ? safeRolesToShow.filter(
        (role) =>
          role.category !== "solo" &&
          (!sceneId ||
            (roleSeconds && role.category !== "facial"
              ? roleTimeSeconds(role.category).top +
                  roleTimeSeconds(role.category).bottom >
                0
              : (role.partnerTopCount ?? 0) + (role.partnerBottomCount ?? 0) >
                0))
      )
    : [];
  // Scene cards already show sex/oral/facial in the versatility rows
  const stripRoles =
    versatilityCard && sceneId
      ? safeRolesToShow.filter((role) => role.category === "solo")
      : safeRolesToShow;
  const scenePartnerRows = (pids: string[] | undefined) => {
    if (scenePerformerCount <= 2) return undefined;
    const partners = (pids ?? [])
      .map((pid) => scenePartnerPerformers?.find((p2) => p2.id === pid))
      .filter(Boolean) as Pick<GQL.Performer, "id" | "name" | "image_path">[];
    return partners.length > 0 ? renderMiniPartnerRows(partners) : undefined;
  };
  const showOrgasmIcon =
    (orgasmTopCount > 0 || isRoleSortHighlighted("orgasm_count")) &&
    !!orgasmTagId;
  const showFeetIcon =
    (feetTopCount > 0 || isRoleSortHighlighted("feet_markers_count")) &&
    !!feetTagId;
  const showStrip = stripRoles.length > 0 || showOrgasmIcon || showFeetIcon;
  // Facial strips count unique partners like sex/oral, not facial markers.
  const cardFacialPartners = {
    top:
      globalStatsOverride?.facial_with_top_count ??
      p.facial_with_top_count ??
      0,
    bottom:
      globalStatsOverride?.facial_with_bottom_count ??
      p.facial_with_bottom_count ??
      0,
  };
  // CUSTOM: end

  const renderRole = (
    role: (typeof safeRolesToShow)[number],
    idx: number,
    inStrip = false // CUSTOM: card strips below the versatility rows use the plain icon + count columns
  ) => {
    const categoryIcon =
      role.category === "sex"
        ? gaySvg
        : role.category === "oral"
        ? mouthSvg
        : role.category === "facial"
        ? facialPng
        : null; // solo uses faHand

    const tagLabel =
      role.category.charAt(0).toUpperCase() + role.category.slice(1);
    // CUSTOM: card rows count oral partners in any scene, so links keep sex scenes
    const excludeTags =
      versatilityCard && !inStrip && role.category === "oral"
        ? undefined
        : getExcludeTagsForCategory(role.category);

    // Use depth -1 for oral and facial to include subtags
    const markerDepth =
      role.category === "oral" || role.category === "facial" ? -1 : 0;

    // URLs for clickable badges
    // Facial uses /scenes/markers URL, others use /scenes URL
    let categoryUrl: string | undefined;
    let topUrl: string | undefined;
    let bottomUrl: string | undefined;
    const partnerTopCount =
      role.category === "sex"
        ? role.partnerTopCount ??
          globalStatsOverride?.sex_with_top_count ??
          p.sex_with_top_count ??
          0
        : role.category === "oral"
        ? role.partnerTopCount ??
          globalStatsOverride?.oral_with_top_count ??
          p.oral_with_top_count ??
          0
        : role.category === "facial"
        ? role.partnerTopCount ??
          globalStatsOverride?.facial_with_top_count ??
          p.facial_with_top_count ??
          0
        : 0;
    const partnerBottomCount =
      role.category === "sex"
        ? role.partnerBottomCount ??
          globalStatsOverride?.sex_with_bottom_count ??
          p.sex_with_bottom_count ??
          0
        : role.category === "oral"
        ? role.partnerBottomCount ??
          globalStatsOverride?.oral_with_bottom_count ??
          p.oral_with_bottom_count ??
          0
        : role.category === "facial"
        ? role.partnerBottomCount ??
          globalStatsOverride?.facial_with_bottom_count ??
          p.facial_with_bottom_count ??
          0
        : 0;

    if (role.tagId) {
      if (role.category === "facial") {
        // Facial goes to /scenes/markers
        categoryUrl = NavUtils.makePerformerFacialMarkersWithRoleUrl(
          performer,
          role.tagId,
          tagLabel,
          undefined
        );
        topUrl = NavUtils.makePerformerFacialMarkersWithRoleUrl(
          performer,
          role.tagId,
          tagLabel,
          "top"
        );
        bottomUrl = NavUtils.makePerformerFacialMarkersWithRoleUrl(
          performer,
          role.tagId,
          tagLabel,
          "bottom"
        );
      } else if (role.category === "sex" || role.category === "oral") {
        // Sex, oral go to /scenes
        categoryUrl = NavUtils.makePerformerMarkerScenesWithRoleUrl(
          performer,
          role.tagId,
          tagLabel,
          undefined,
          excludeTags,
          markerDepth
        );
        topUrl = NavUtils.makePerformerMarkerScenesWithRoleUrl(
          performer,
          role.tagId,
          tagLabel,
          "top",
          excludeTags,
          markerDepth
        );
        bottomUrl = NavUtils.makePerformerMarkerScenesWithRoleUrl(
          performer,
          role.tagId,
          tagLabel,
          "bottom",
          excludeTags,
          markerDepth
        );
      } else {
        // Solo - no role-based URLs
        categoryUrl = NavUtils.makePerformerMarkerScenesWithRoleUrl(
          performer,
          role.tagId,
          tagLabel,
          undefined,
          excludeTags,
          markerDepth
        );
      }
    }

    // CUSTOM: begin - scope all badge URLs to studio when studioContext is set
    if (studioContext) {
      const sc = studioContext;
      if (categoryUrl)
        categoryUrl = NavUtils.withStudioScope(
          categoryUrl,
          sc.id,
          sc.label,
          sc.depth
        );
      if (topUrl)
        topUrl = NavUtils.withStudioScope(topUrl, sc.id, sc.label, sc.depth);
      if (bottomUrl)
        bottomUrl = NavUtils.withStudioScope(
          bottomUrl,
          sc.id,
          sc.label,
          sc.depth
        );
    }
    // CUSTOM: end

    const categoryIconElement = categoryIcon ? (
      <img src={categoryIcon} alt={role.category} className="category-icon" />
    ) : (
      <Icon icon={faHand} className="category-icon-fa" />
    );

    // CUSTOM: begin - card versatility rows replace the role columns; scene
    // cards count scene partners and skip the all-scenes links
    if (versatilityCard && !inStrip && role.category !== "solo") {
      if (roleSeconds && role.category !== "facial") {
        const seconds = roleTimeSeconds(role.category);
        return (
          <PerformerCardVersatilityTimeRow
            key={idx}
            bottomSeconds={seconds.bottom}
            category={role.category}
            icon={categoryIconElement}
            topSeconds={seconds.top}
          />
        );
      }
      const useCardFacialPartners = role.category === "facial" && !sceneId;
      return (
        <PerformerCardVersatilityRow
          key={idx}
          bottomUrl={sceneId ? undefined : bottomUrl}
          bottomPartners={
            sceneId ? scenePartnerRows(role.bottomPids) : undefined
          }
          bottomedPartners={
            useCardFacialPartners
              ? cardFacialPartners.bottom
              : partnerBottomCount
          }
          activeSortBy={sceneId ? undefined : activeSortBy}
          category={role.category}
          categoryUrl={sceneId ? undefined : categoryUrl}
          icon={categoryIconElement}
          linkTarget={linkTarget}
          showPercentages={!sceneId} // CUSTOM: catalog cards show role percentages beside the track
          topPartners={sceneId ? scenePartnerRows(role.topPids) : undefined}
          topUrl={sceneId ? undefined : topUrl}
          toppedPartners={
            useCardFacialPartners ? cardFacialPartners.top : partnerTopCount
          }
        />
      );
    }
    // CUSTOM: end

    return (
      <div key={idx} className="role-badge-item">
        {/* Category icon on top - clickable */}
        <div
          className={cx(
            "category-icon-container",
            catalogCardSortHighlightClassCustom(
              activeSortBy,
              role.category === "solo"
                ? "solo_scenes_count"
                : roleTotalSortKey(role.category)
            )
          )}
          title={
            role.count ? getTooltipText(role.category, role.count) : undefined
          }
        >
          {categoryUrl && !sceneId ? (
            <Link
              to={categoryUrl}
              className="role-badge-link"
              target={linkTarget} // CUSTOM
              rel={linkTarget === "_blank" ? "noopener noreferrer" : undefined} // CUSTOM
            >
              {categoryIconElement}
              <span className="role-total-count">
                {role.category === "solo" ? role.count ?? 1 : role.count}
              </span>
            </Link>
          ) : (
            <>
              {categoryIconElement}
              {role.category !== "solo" && (
                <span className="role-total-count">{role.count}</span>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* CUSTOM: begin */}
      {versatilityRoles.length > 0 && (
        <div
          className={cx("performer-card-versatility", {
            "mt-3": !flushMargins,
          })}
        >
          {versatilityRoles.map((role, idx) => renderRole(role, idx))}
        </div>
      )}
      {showStrip && (
        <div
          className={cx("performer-category-strip performer-role-badges", {
            "my-3": !flushMargins && !versatilityCard,
            "performer-category-strip--card-icons": versatilityCard,
          })} // CUSTOM
        >
          {stripRoles.map((role, idx) => renderRole(role, idx, true))}

          {/* Orgasm icon at the end */}
          {
            (orgasmTopCount > 0 || isRoleSortHighlighted("orgasm_count")) &&
              orgasmTagId &&
              // CUSTOM: begin - scoped orgasm URL
              (() => {
                let orgasmUrl = NavUtils.makePerformerOrgasmMarkersUrl(
                  performer,
                  orgasmTagId,
                  "Orgasm"
                );
                if (studioContext)
                  orgasmUrl = NavUtils.withStudioScope(
                    orgasmUrl,
                    studioContext.id,
                    studioContext.label,
                    studioContext.depth
                  );
                return (
                  <div
                    className={cx(
                      "role-badge-item orgasm-badge",
                      catalogCardSortHighlightClassCustom(
                        activeSortBy,
                        "orgasm_count"
                      )
                    )}
                  >
                    <div
                      className="category-icon-container"
                      title={
                        sceneId
                          ? `${
                              p.name || "Performer"
                            } had ${orgasmTopCount} orgasm${
                              orgasmTopCount !== 1 ? "s" : ""
                            } in this scene`
                          : `${
                              p.name || "Performer"
                            } has ${orgasmTopCount} total orgasm${
                              orgasmTopCount !== 1 ? "s" : ""
                            }`
                      }
                    >
                      {!sceneId ? (
                        <Link
                          to={orgasmUrl}
                          className="role-badge-link"
                          target={linkTarget} // CUSTOM
                          rel={
                            linkTarget === "_blank"
                              ? "noopener noreferrer"
                              : undefined
                          } // CUSTOM
                        >
                          <img
                            src={spermsSvg}
                            alt="Orgasm"
                            className="category-icon"
                          />
                          <span className="role-total-count">
                            {orgasmTopCount}
                          </span>
                        </Link>
                      ) : (
                        <>
                          <img
                            src={spermsSvg}
                            alt="Orgasm"
                            className="category-icon"
                          />
                          <span className="role-total-count">
                            {orgasmTopCount}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()
            // CUSTOM: end
          }

          {/* Feet icon */}
          {
            (feetTopCount > 0 || isRoleSortHighlighted("feet_markers_count")) &&
              feetTagId &&
              // CUSTOM: begin - scoped feet URL
              (() => {
                let feetUrl = NavUtils.makePerformerFeetMarkersUrl(
                  performer,
                  feetTagId,
                  "Feet"
                );
                if (studioContext)
                  feetUrl = NavUtils.withStudioScope(
                    feetUrl,
                    studioContext.id,
                    studioContext.label,
                    studioContext.depth
                  );
                return (
                  <div
                    className={cx(
                      "role-badge-item feet-badge",
                      catalogCardSortHighlightClassCustom(
                        activeSortBy,
                        "feet_markers_count"
                      )
                    )}
                  >
                    <div
                      className="category-icon-container"
                      title={
                        sceneId
                          ? `${
                              p.name || "Performer"
                            } has ${feetTopCount} feet marker${
                              feetTopCount !== 1 ? "s" : ""
                            } in this scene`
                          : `${
                              p.name || "Performer"
                            } has ${feetTopCount} total feet marker${
                              feetTopCount !== 1 ? "s" : ""
                            }`
                      }
                    >
                      {!sceneId ? (
                        <Link
                          to={feetUrl}
                          className="role-badge-link"
                          target={linkTarget} // CUSTOM
                          rel={
                            linkTarget === "_blank"
                              ? "noopener noreferrer"
                              : undefined
                          } // CUSTOM
                        >
                          <img
                            src={feetSvg}
                            alt="Feet"
                            className="category-icon"
                          />
                          <span className="role-total-count">
                            {feetTopCount}
                          </span>
                        </Link>
                      ) : (
                        <>
                          <img
                            src={feetSvg}
                            alt="Feet"
                            className="category-icon"
                          />
                          <span className="role-total-count">
                            {feetTopCount}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })()
            // CUSTOM: end
          }
        </div>
      )}
      {/* CUSTOM: end */}
    </>
  );
};
