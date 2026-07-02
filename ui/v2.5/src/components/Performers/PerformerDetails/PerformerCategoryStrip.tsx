import React, { useCallback, useRef } from "react"; // CUSTOM
import { Badge } from "react-bootstrap";
import { Link } from "react-router-dom";
import { Icon } from "src/components/Shared/Icon";
import { HoverPopover } from "src/components/Shared/HoverPopover"; // CUSTOM
import { PerformerLink } from "src/components/Shared/TagLink"; // CUSTOM
import {
  faHand,
  faArrowUp,
  faArrowDown,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import { useConfigurationContext } from "src/hooks/Config";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import facialPng from "src/assets/facial.png"; // CUSTOM
import spermsSvg from "src/assets/sperms.svg";
import feetSvg from "src/assets/feet.svg";
import type { PerformerListData } from "../performerTypes_custom"; // CUSTOM

interface IPerformerCategoryStripProps {
  performer: PerformerListData;
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
  /** When scoped totals are active, hide global partner counts that are no longer accurate */
  hideUniquePartnerCounts?: boolean;
  /** When set, all badge links will be scoped to this studio */
  studioContext?: { id: string; label: string; depth: number }; // CUSTOM
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
  hideUniquePartnerCounts = false,
  studioContext, // CUSTOM
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

  // CUSTOM: begin - lazy queries for global/studio partner mini images
  const [fetchGlobalMiniImages, { data: globalMiniData }] =
    GQL.usePerformerCoPerformersMiniImagesLazyQuery();
  const [fetchStudioMiniImages, { data: studioMiniData }] =
    GQL.useStudioPerformerCoPerformersMiniImagesLazyQuery();
  const miniImagesFetched = useRef(false);

  const handleArrowHover = useCallback(() => {
    if (miniImagesFetched.current) return;
    miniImagesFetched.current = true;
    if (studioContext) {
      fetchStudioMiniImages({
        variables: {
          performer_id: performer.id,
          studio_id: studioContext.id,
          depth: studioContext.depth,
        },
      });
    } else {
      fetchGlobalMiniImages({ variables: { performer_id: performer.id } });
    }
  }, [
    performer.id,
    studioContext,
    fetchGlobalMiniImages,
    fetchStudioMiniImages,
  ]);

  // Helper: get the array of PerformerWithSceneCount for a category+direction from the lazy query result
  const getMiniPartners = useCallback(
    (
      category: "sex" | "oral" | "facial",
      direction: "top" | "bottom"
    ): Array<{ id: string; name: string; image_path?: string | null }> => {
      const src = studioContext
        ? studioMiniData?.studioPerformerCoPerformersByRole
        : globalMiniData?.performerCoPerformersByRole;
      if (!src) return [];
      const key = `${category}_as_${direction}` as keyof typeof src;
      const list = src[key] as
        | Array<{
            performer: { id: string; name: string; image_path?: string | null };
            scene_count: number;
          }>
        | undefined;
      return (list ?? []).map((x) => x.performer);
    },
    [studioContext, studioMiniData, globalMiniData]
  );

  const getAllMiniPartners = useCallback(
    (
      category: "sex" | "oral" | "facial"
    ): Array<{ id: string; name: string; image_path?: string | null }> => {
      const partnersById = new Map<
        string,
        { id: string; name: string; image_path?: string | null }
      >();
      for (const partner of [
        ...getMiniPartners(category, "top"),
        ...getMiniPartners(category, "bottom"),
      ]) {
        partnersById.set(partner.id, partner);
      }
      return [...partnersById.values()].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", undefined, {
          sensitivity: "base",
        })
      );
    },
    [getMiniPartners]
  );

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
            >
              <img
                className="image-thumbnail performer-hover-image-thumbnail"
                alt={partner.name ?? ""}
                src={partner.image_path ?? ""}
              />
            </Link>
            <PerformerLink performer={partner} className="d-block" />
          </div>
        ))}
      </div>
    ),
    []
  );

  const partnerHoverPopoverProps = {
    placement: "bottom" as const,
    popoverClassName: "performer-partner-hover-popover",
    onOpen: handleArrowHover,
  };
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

  // Build roles to show based on context
  let rolesToShow: Array<{
    category: "sex" | "oral" | "solo" | "facial";
    count?: number;
    topCount?: number;
    bottomCount?: number;
    partnerTopCount?: number; // CUSTOM
    partnerBottomCount?: number; // CUSTOM
    isTop?: boolean;
    isBottom?: boolean;
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
        topCount: sceneSexTopPartners,
        bottomCount: sceneSexBottomPartners,
        isTop: sexRoles.some((r: string) => r.endsWith("_top")),
        isBottom: sexRoles.some((r: string) => r.endsWith("_bottom")),
        tagId: sexTagId,
        topPids: sexTopPids, // CUSTOM
        bottomPids: sexBottomPids, // CUSTOM
      });
    }
    if (oralRoles.length > 0 && oralTagId) {
      rolesToShow.push({
        category: "oral",
        count: sceneOralAllPartners, // Unique partners across both roles (no double-counting)
        topCount: sceneOralTopPartners,
        bottomCount: sceneOralBottomPartners,
        isTop: oralRoles.some((r: string) => r.endsWith("_top")),
        isBottom: oralRoles.some((r: string) => r.endsWith("_bottom")),
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
        topCount: sceneFacialTopCount, // Actual top count (not unique partners)
        bottomCount: sceneFacialBottomCount, // Actual bottom count (not unique partners)
        isTop: sceneFacialTopCount > 0,
        isBottom: sceneFacialBottomCount > 0,
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
    const sexTopCount =
      globalStatsOverride?.sex_top_count ?? p.sex_top_count ?? 0;
    const sexBottomCount =
      globalStatsOverride?.sex_bottom_count ?? p.sex_bottom_count ?? 0;
    const oralTopCount =
      globalStatsOverride?.oral_top_count ?? p.oral_top_count ?? 0;
    const oralBottomCount =
      globalStatsOverride?.oral_bottom_count ?? p.oral_bottom_count ?? 0;
    const facialTopCount =
      globalStatsOverride?.facial_top_count ?? p.facial_marker_top_count ?? 0;
    const facialBottomCount =
      globalStatsOverride?.facial_bottom_count ??
      p.facial_marker_bottom_count ??
      0;

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
      (sexCount > 0 || sexWithTopCount > 0 || sexWithBottomCount > 0) &&
      sexTagId
    ) {
      rolesToShow.push({
        category: "sex",
        count: sexCount,
        topCount: sexTopCount,
        bottomCount: sexBottomCount,
        partnerTopCount: sexWithTopCount, // CUSTOM
        partnerBottomCount: sexWithBottomCount, // CUSTOM
        tagId: sexTagId,
      });
    }
    if (
      (oralCount > 0 || oralWithTopCount > 0 || oralWithBottomCount > 0) &&
      oralTagId
    ) {
      rolesToShow.push({
        category: "oral",
        count: oralCount,
        topCount: oralTopCount,
        bottomCount: oralBottomCount,
        partnerTopCount: oralWithTopCount, // CUSTOM
        partnerBottomCount: oralWithBottomCount, // CUSTOM
        tagId: oralTagId,
      });
    }
    if (
      (facialCount > 0 ||
        facialWithTopCount > 0 ||
        facialWithBottomCount > 0) &&
      facialTagId
    ) {
      rolesToShow.push({
        category: "facial",
        count: facialCount,
        // Use scoped counts when available, otherwise fall back to global facial marker counts.
        topCount: facialTopCount,
        bottomCount: facialBottomCount,
        partnerTopCount: facialWithTopCount, // CUSTOM
        partnerBottomCount: facialWithBottomCount, // CUSTOM
        tagId: facialTagId,
      });
    }
    if (soloCount > 0 && soloTagId) {
      rolesToShow.push({
        category: "solo",
        count: soloCount,
        tagId: soloTagId,
      });
    }
  }

  // Only show if at least one role tag is configured
  const hasAnyRoleTag = sexTagId || oralTagId || soloTagId || facialTagId;
  if (
    !hasAnyRoleTag ||
    (rolesToShow.length === 0 && orgasmTopCount === 0 && feetTopCount === 0)
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

  // Generate tooltip text based on context and category
  const getTooltipText = (
    category: "sex" | "oral" | "solo" | "facial",
    type: "total" | "top" | "bottom",
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

    if (sceneId) {
      // Scene context
      if (type === "total") {
        if (category === "facial") {
          return `${name} participated in ${count} facial${
            count !== 1 ? "s" : ""
          } in this scene`;
        }
        return `${name} has ${count} ${category} partner${
          count !== 1 ? "s" : ""
        } in this scene`;
      } else if (type === "top") {
        if (category === "facial") {
          return `${name} gave ${count} facial${
            count !== 1 ? "s" : ""
          } in this scene`;
        }
        return scenePerformerCount > 2
          ? `${name} has ${count} ${category} partner${
              count !== 1 ? "s" : ""
            } as top in this scene`
          : `${name} was ${category} top in this scene`;
      } else {
        if (category === "facial") {
          return `${name} received ${count} facial${
            count !== 1 ? "s" : ""
          } in this scene`;
        }
        return scenePerformerCount > 2
          ? `${name} has ${count} ${category} partner${
              count !== 1 ? "s" : ""
            } as bottom in this scene`
          : `${name} was ${category} bottom in this scene`;
      }
    } else {
      // Global context
      if (type === "total") {
        if (category === "facial") {
          return `${name} has ${count} total facial marker${
            count !== 1 ? "s" : ""
          }`;
        }
        return `${name} has appeared in ${count} ${category} scene${
          count !== 1 ? "s" : ""
        }`;
      } else if (type === "top") {
        if (category === "facial") {
          return `${name} has given ${count} facial${count !== 1 ? "s" : ""}`;
        }
        return `${name} has topped ${count} unique partner${
          count !== 1 ? "s" : ""
        } in ${category}`;
      } else {
        if (category === "facial") {
          return `${name} has received ${count} facial${
            count !== 1 ? "s" : ""
          }`;
        }
        return `${name} has bottomed for ${count} unique partner${
          count !== 1 ? "s" : ""
        } in ${category}`;
      }
    }
  };

  return (
    <>
      <div className="performer-category-strip performer-role-badges my-3">
        {safeRolesToShow.map((role, idx) => {
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
          const excludeTags = getExcludeTagsForCategory(role.category);

          // Use depth -1 for oral and facial to include subtags
          const markerDepth =
            role.category === "oral" || role.category === "facial" ? -1 : 0;

          // URLs for clickable badges
          // Facial uses /scenes/markers URL, others use /scenes URL
          let categoryUrl: string | undefined;
          let topUrl: string | undefined;
          let bottomUrl: string | undefined;
          let partnerTopUrl: string | undefined;
          let partnerBottomUrl: string | undefined;
          let allPartnersUrl: string | undefined;
          const performerPartnersUrl = `/performers/${performer.id}/appearswithbyrole`; // CUSTOM

          // Calculate unique partner count for this category
          let uniquePartnerCount = 0;
          if (hideUniquePartnerCounts) {
            uniquePartnerCount = 0;
          } else if (role.category === "sex") {
            uniquePartnerCount =
              globalStatsOverride?.sex_unique_partner_count ??
              p.sex_unique_partner_count ??
              0;
          } else if (role.category === "oral") {
            uniquePartnerCount =
              globalStatsOverride?.oral_unique_partner_count ??
              p.oral_unique_partner_count ??
              0;
          } else if (role.category === "facial") {
            uniquePartnerCount =
              globalStatsOverride?.facial_unique_partner_count ??
              p.facial_unique_partner_count ??
              0;
          }

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

              // Partner URLs for facial (goes to /scenes/markers)
              const performerRef = {
                id: performer.id,
                label: performer.name || `Vato ${performer.id}`,
              };

              // Facial top partner: performer is top (giver), showing scenes
              partnerTopUrl = `/scenes/markers?c=${encodeURIComponent(
                JSON.stringify({
                  type: "marker_performers",
                  modifier: "EQUALS",
                  tag_ids: [{ id: role.tagId, label: tagLabel }],
                  include_subtags: true,
                  performer_mode: "AND",
                  top_performer_ids: [performerRef],
                  bottom_performer_ids: [],
                  unnamed_performers: [],
                })
              )}&sortby=title`;

              // Facial bottom partner: performer is bottom (receiver), showing scenes
              partnerBottomUrl = `/scenes/markers?c=${encodeURIComponent(
                JSON.stringify({
                  type: "marker_performers",
                  modifier: "EQUALS",
                  tag_ids: [{ id: role.tagId, label: tagLabel }],
                  include_subtags: true,
                  performer_mode: "AND",
                  top_performer_ids: [],
                  bottom_performer_ids: [performerRef],
                  unnamed_performers: [],
                })
              )}&sortby=title`;

              allPartnersUrl = performerPartnersUrl;
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

              // CUSTOM: begin - role partner badges link to the performer Partners tab
              allPartnersUrl = performerPartnersUrl;
              partnerTopUrl = performerPartnersUrl;
              partnerBottomUrl = performerPartnersUrl;
              // CUSTOM: end
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
              topUrl = NavUtils.withStudioScope(
                topUrl,
                sc.id,
                sc.label,
                sc.depth
              );
            if (bottomUrl)
              bottomUrl = NavUtils.withStudioScope(
                bottomUrl,
                sc.id,
                sc.label,
                sc.depth
              );
            if (partnerTopUrl && partnerTopUrl !== performerPartnersUrl)
              partnerTopUrl = NavUtils.withStudioScope(
                partnerTopUrl,
                sc.id,
                sc.label,
                sc.depth
              );
            if (partnerBottomUrl && partnerBottomUrl !== performerPartnersUrl)
              partnerBottomUrl = NavUtils.withStudioScope(
                partnerBottomUrl,
                sc.id,
                sc.label,
                sc.depth
              );
          }
          // CUSTOM: end

          const categoryIconElement = categoryIcon ? (
            <img
              src={categoryIcon}
              alt={role.category}
              className="category-icon"
            />
          ) : (
            <Icon icon={faHand} className="category-icon-fa" />
          );

          return (
            <div
              key={idx}
              className={
                sceneId
                  ? "role-badge-item scene-context-role-badge-item"
                  : "role-badge-item"
              }
            >
              {/* Category icon on top - clickable */}
              <div
                className="category-icon-container"
                title={
                  role.count
                    ? getTooltipText(role.category, "total", role.count)
                    : undefined
                }
              >
                {categoryUrl && !sceneId ? (
                  <Link to={categoryUrl} className="role-badge-link">
                    {categoryIconElement}
                    {role.category !== "solo" && (
                      <span className="role-total-count">{role.count}</span>
                    )}
                  </Link>
                ) : (
                  <>
                    {categoryIconElement}
                    {role.category !== "solo" &&
                      !(sceneId && scenePerformerCount <= 2) && (
                        <span className="role-total-count">{role.count}</span>
                      )}
                  </>
                )}
              </div>

              {/* Count below for solo, arrows below for sex/oral/facial */}
              {role.category === "solo" ? (
                <>
                  <div
                    className="solo-count"
                    style={{
                      visibility:
                        sceneId && role.category === "solo"
                          ? "hidden"
                          : "visible",
                    }}
                  >
                    {categoryUrl && !sceneId ? (
                      <Link to={categoryUrl} className="role-badge-link">
                        <span className="role-total-count">
                          {role.count ?? 1}
                        </span>
                      </Link>
                    ) : (
                      <span className="role-total-count">
                        {role.count ?? 1}
                      </span>
                    )}
                  </div>
                </>
              ) : sceneId ? (
                // Scene context: show partner counts only if > 2 performers, otherwise just arrows
                <>
                  {/* Top/Bottom role indicators */}
                  {/* CUSTOM: begin - show mini performer images on hover when > 2 performers in scene */}
                  <div className="role-arrows scene-role-arrows">
                    {role.isTop &&
                      (() => {
                        const topPartners =
                          scenePerformerCount > 2
                            ? ((role.topPids ?? [])
                                .map((pid) =>
                                  scenePartnerPerformers?.find(
                                    (p2) => p2.id === pid
                                  )
                                )
                                .filter(Boolean) as Pick<
                                GQL.Performer,
                                "id" | "name" | "image_path"
                              >[])
                            : [];
                        const badgeEl = (
                          <Badge
                            variant="success"
                            className={`arrow-badge top-badge scene-role-badge ${
                              scenePerformerCount > 2
                                ? "scene-role-badge-with-count"
                                : "scene-role-badge-icon-only"
                            }`}
                            title={
                              topPartners.length === 0
                                ? getTooltipText(
                                    role.category,
                                    "top",
                                    role.topCount || 0
                                  )
                                : undefined
                            }
                            style={{
                              fontSize: 10,
                              padding: "3px 6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span className="arrow-main">
                              <Icon icon={faArrowUp} />
                              {scenePerformerCount > 2 && (
                                <span className="arrow-count">
                                  {role.topCount || 0}
                                </span>
                              )}
                            </span>
                          </Badge>
                        );
                        return topPartners.length > 0 ? (
                          <HoverPopover
                            key="top"
                            {...partnerHoverPopoverProps}
                            content={renderMiniPartnerRows(topPartners)}
                          >
                            {badgeEl}
                          </HoverPopover>
                        ) : (
                          badgeEl
                        );
                      })()}
                    {!role.isTop && (
                      <Badge
                        variant="success"
                        className={`arrow-badge top-badge scene-role-badge role-badge-placeholder ${
                          scenePerformerCount > 2
                            ? "scene-role-badge-with-count"
                            : "scene-role-badge-icon-only"
                        }`}
                        aria-hidden="true"
                      >
                        <span className="arrow-main">
                          <Icon icon={faArrowUp} />
                          {scenePerformerCount > 2 && (
                            <span className="arrow-count">0</span>
                          )}
                        </span>
                      </Badge>
                    )}
                    {role.isBottom &&
                      (() => {
                        const bottomPartners =
                          scenePerformerCount > 2
                            ? ((role.bottomPids ?? [])
                                .map((pid) =>
                                  scenePartnerPerformers?.find(
                                    (p2) => p2.id === pid
                                  )
                                )
                                .filter(Boolean) as Pick<
                                GQL.Performer,
                                "id" | "name" | "image_path"
                              >[])
                            : [];
                        const badgeEl = (
                          <Badge
                            variant="info"
                            className={`arrow-badge bottom-badge scene-role-badge ${
                              scenePerformerCount > 2
                                ? "scene-role-badge-with-count"
                                : "scene-role-badge-icon-only"
                            }`}
                            title={
                              bottomPartners.length === 0
                                ? getTooltipText(
                                    role.category,
                                    "bottom",
                                    role.bottomCount || 0
                                  )
                                : undefined
                            }
                            style={{
                              fontSize: 10,
                              padding: "3px 6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span className="arrow-main">
                              <Icon icon={faArrowDown} />
                              {scenePerformerCount > 2 && (
                                <span className="arrow-count">
                                  {role.bottomCount || 0}
                                </span>
                              )}
                            </span>
                          </Badge>
                        );
                        return bottomPartners.length > 0 ? (
                          <HoverPopover
                            key="bottom"
                            {...partnerHoverPopoverProps}
                            content={renderMiniPartnerRows(bottomPartners)}
                          >
                            {badgeEl}
                          </HoverPopover>
                        ) : (
                          badgeEl
                        );
                      })()}
                    {!role.isBottom && (
                      <Badge
                        variant="info"
                        className={`arrow-badge bottom-badge scene-role-badge role-badge-placeholder ${
                          scenePerformerCount > 2
                            ? "scene-role-badge-with-count"
                            : "scene-role-badge-icon-only"
                        }`}
                        aria-hidden="true"
                      >
                        <span className="arrow-main">
                          <Icon icon={faArrowDown} />
                          {scenePerformerCount > 2 && (
                            <span className="arrow-count">0</span>
                          )}
                        </span>
                      </Badge>
                    )}
                  </div>
                  {/* CUSTOM: end */}
                </>
              ) : (
                // Global context: show counts with arrows
                <>
                  {/* Row 2: Scene top/bottom counts 
                <div className="role-arrows">
                  {topUrl && (role.topCount ?? 0) > 0 ? (
                    <Link to={topUrl} className="role-badge-link">
                      <Badge
                        pill
                        variant="success"
                        className="arrow-badge top-badge"
                        title={getTooltipText(role.category, "top", role.topCount || 0)}
                        style={{
                          fontSize: 10,
                          padding: "3px 6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          visibility: (role.topCount ?? 0) > 0 ? 'visible' : 'hidden',
                        }}
                      >
                        <Icon icon={faArrowUp} />
                        <span className="arrow-count">{role.topCount || 0}</span>
                      </Badge>
                    </Link>
                  ) : (
                    <Badge
                      pill
                      variant="success"
                      className="arrow-badge top-badge"
                      title={getTooltipText(role.category, "top", role.topCount || 0)}
                      style={{
                        fontSize: 10,
                        padding: "3px 6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        visibility: (role.topCount ?? 0) > 0 ? 'visible' : 'hidden',
                      }}
                    >
                      <Icon icon={faArrowUp} />
                      <span className="arrow-count">{role.topCount || 0}</span>
                    </Badge>
                  )}
                  {bottomUrl && (role.bottomCount ?? 0) > 0 ? (
                    <Link to={bottomUrl} className="role-badge-link">
                      <Badge
                        pill
                        variant="info"
                        className="arrow-badge bottom-badge"
                        title={getTooltipText(role.category, "bottom", role.bottomCount || 0)}
                        style={{
                          fontSize: 10,
                          padding: "3px 6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          visibility: (role.bottomCount ?? 0) > 0 ? 'visible' : 'hidden',
                        }}
                      >
                        <Icon icon={faArrowDown} />
                        <span className="arrow-count">{role.bottomCount || 0}</span>
                      </Badge>
                    </Link>
                  ) : (
                    <Badge
                      pill
                      variant="info"
                      className="arrow-badge bottom-badge"
                      title={getTooltipText(role.category, "bottom", role.bottomCount || 0)}
                      style={{
                        fontSize: 10,
                        padding: "3px 6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        visibility: (role.bottomCount ?? 0) > 0 ? 'visible' : 'hidden',
                      }}
                    >
                      <Icon icon={faArrowDown} />
                      <span className="arrow-count">{role.bottomCount || 0}</span>
                    </Badge>
                  )}
                </div>
                */}

                  {/* Row 3: Unique partner count*/}
                  {uniquePartnerCount > 0 &&
                    (() => {
                      const allPartners = getAllMiniPartners(role.category);
                      return (
                        <HoverPopover
                          {...partnerHoverPopoverProps}
                          content={renderMiniPartnerRows(allPartners)}
                        >
                          <div className="category-icon-container unique-partners-row">
                            {allPartnersUrl ? (
                              <Link
                                to={allPartnersUrl}
                                className="role-badge-link"
                                title={`${
                                  p.name || "Performer"
                                } has been with ${uniquePartnerCount} unique partner${
                                  uniquePartnerCount !== 1 ? "s" : ""
                                } in ${role.category}`}
                              >
                                <Icon
                                  icon={faUser}
                                  style={{ color: "white" }}
                                />
                                <span className="role-total-count">
                                  {uniquePartnerCount}
                                </span>
                              </Link>
                            ) : (
                              <span
                                title={`${
                                  p.name || "Performer"
                                } has been with ${uniquePartnerCount} unique partner${
                                  uniquePartnerCount !== 1 ? "s" : ""
                                } in ${role.category}`}
                              >
                                <Icon
                                  icon={faUser}
                                  style={{ color: "white" }}
                                />
                                <span className="role-total-count">
                                  {uniquePartnerCount}
                                </span>
                              </span>
                            )}
                          </div>
                        </HoverPopover>
                      );
                    })()}

                  {/* Row 4: Partner count badges with lazy mini images on hover */}
                  {/* CUSTOM: begin - HoverPopover with lazy-loaded partner images */}
                  <div className="role-arrows">
                    {/* Top partner badge */}
                    {(() => {
                      const topBadge =
                        partnerTopUrl && partnerTopCount > 0 ? (
                          <Link to={partnerTopUrl} className="role-badge-link">
                            <Badge
                              pill
                              variant="success"
                              className="arrow-badge top-badge"
                              title={getTooltipText(
                                role.category,
                                "top",
                                partnerTopCount
                              )}
                              style={{
                                fontSize: 10,
                                padding: "3px 6px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Icon icon={faArrowUp} />
                              <span className="arrow-count">
                                {partnerTopCount}
                              </span>
                            </Badge>
                          </Link>
                        ) : (
                          <Badge
                            pill
                            variant="success"
                            className="arrow-badge top-badge"
                            title={getTooltipText(
                              role.category,
                              "top",
                              partnerTopCount
                            )}
                            style={{
                              fontSize: 10,
                              padding: "3px 6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              visibility:
                                partnerTopCount > 0 ? "visible" : "hidden",
                            }}
                          >
                            <Icon icon={faArrowUp} />
                            <span className="arrow-count">
                              {partnerTopCount}
                            </span>
                          </Badge>
                        );
                      if (partnerTopCount <= 0) return topBadge;
                      const topPartners = getMiniPartners(role.category, "top");
                      return topPartners.length > 0 ? (
                        <HoverPopover
                          {...partnerHoverPopoverProps}
                          content={renderMiniPartnerRows(topPartners)}
                        >
                          {topBadge}
                        </HoverPopover>
                      ) : (
                        <HoverPopover
                          {...partnerHoverPopoverProps}
                          content={[]}
                        >
                          {topBadge}
                        </HoverPopover>
                      );
                    })()}
                    {/* Bottom partner badge */}
                    {(() => {
                      const bottomBadge =
                        partnerBottomUrl && partnerBottomCount > 0 ? (
                          <Link
                            to={partnerBottomUrl}
                            className="role-badge-link"
                          >
                            <Badge
                              pill
                              variant="info"
                              className="arrow-badge bottom-badge"
                              title={getTooltipText(
                                role.category,
                                "bottom",
                                partnerBottomCount
                              )}
                              style={{
                                fontSize: 10,
                                padding: "3px 6px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <Icon icon={faArrowDown} />
                              <span className="arrow-count">
                                {partnerBottomCount}
                              </span>
                            </Badge>
                          </Link>
                        ) : (
                          <Badge
                            pill
                            variant="info"
                            className="arrow-badge bottom-badge"
                            title={getTooltipText(
                              role.category,
                              "bottom",
                              partnerBottomCount
                            )}
                            style={{
                              fontSize: 10,
                              padding: "3px 6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              visibility:
                                partnerBottomCount > 0 ? "visible" : "hidden",
                            }}
                          >
                            <Icon icon={faArrowDown} />
                            <span className="arrow-count">
                              {partnerBottomCount}
                            </span>
                          </Badge>
                        );
                      if (partnerBottomCount <= 0) return bottomBadge;
                      const bottomPartners = getMiniPartners(
                        role.category,
                        "bottom"
                      );
                      return bottomPartners.length > 0 ? (
                        <HoverPopover
                          {...partnerHoverPopoverProps}
                          content={renderMiniPartnerRows(bottomPartners)}
                        >
                          {bottomBadge}
                        </HoverPopover>
                      ) : (
                        <HoverPopover
                          {...partnerHoverPopoverProps}
                          content={[]}
                        >
                          {bottomBadge}
                        </HoverPopover>
                      );
                    })()}
                  </div>
                  {/* CUSTOM: end */}
                </>
              )}
            </div>
          );
        })}

        {/* Orgasm icon at the end */}
        {
          orgasmTopCount > 0 &&
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
                <div className="role-badge-item orgasm-badge">
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
                    <Link to={orgasmUrl} className="role-badge-link">
                      <img
                        src={spermsSvg}
                        alt="Orgasm"
                        className="category-icon"
                      />
                    </Link>
                  </div>
                  <div
                    className="orgasm-count"
                    style={{
                      visibility:
                        sceneId && orgasmTopCount === 1 ? "hidden" : "visible",
                    }}
                  >
                    <Link to={orgasmUrl} className="role-badge-link">
                      <span className="role-total-count">{orgasmTopCount}</span>
                    </Link>
                  </div>
                </div>
              );
            })()
          // CUSTOM: end
        }

        {/* Feet icon */}
        {
          feetTopCount > 0 &&
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
                <div className="role-badge-item feet-badge">
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
                      <Link to={feetUrl} className="role-badge-link">
                        <img
                          src={feetSvg}
                          alt="Feet"
                          className="category-icon"
                        />
                      </Link>
                    ) : (
                      <img src={feetSvg} alt="Feet" className="category-icon" />
                    )}
                  </div>
                  {!sceneId && (
                    <div className="feet-count">
                      <Link to={feetUrl} className="role-badge-link">
                        <span className="role-total-count">{feetTopCount}</span>
                      </Link>
                    </div>
                  )}
                </div>
              );
            })()
          // CUSTOM: end
        }
      </div>
    </>
  );
};
