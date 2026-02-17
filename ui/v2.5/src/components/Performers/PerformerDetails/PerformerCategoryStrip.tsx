import React from "react";
import { Badge } from "react-bootstrap";
import { Link } from "react-router-dom";
import { Icon } from "src/components/Shared/Icon";
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
import goateeSvg from "src/assets/goatee.svg";
import spermsSvg from "src/assets/sperms.svg";
import feetSvg from "src/assets/feet.svg";

interface IPerformerCategoryStripProps {
  performer: GQL.PerformerDataFragment;
  /** Scene ID for scene context - enables role badges based on marker roles */
  sceneId?: string;
  /** Marker roles in the current scene (used when sceneId is provided) */
  markerRoles?: string[];
  /** Number of performers in the scene - used to determine whether to show partner counts */
  scenePerformerCount?: number;
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
}) => {
  const { configuration } = useConfigurationContext();
  
  // Extra safety: ensure markerRoles is always an array
  const markerRoles = markerRolesProp ?? [];

  // Get role tag IDs from the new configuration
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};
  const {sexTagId} = roleTagIds;
  const {oralTagId} = roleTagIds;
  const {soloTagId} = roleTagIds;
  const {facialTagId} = roleTagIds;
  const {orgasmTagId} = roleTagIds;
  const {feetTagId} = roleTagIds;

  const p = performer as any;
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
  let sceneFacialTopPartners = 0;
  let sceneFacialBottomPartners = 0;
  let sceneFacialAllPartners = 0; // Unique across both roles

  // Build roles to show based on context
  let rolesToShow: Array<{
    category: "sex" | "oral" | "solo" | "facial";
    count?: number;
    topCount?: number;
    bottomCount?: number;
    isTop?: boolean;
    isBottom?: boolean;
    tagId?: string;
  }> = [];

  if (sceneId) {
    // Scene context: show roles based on marker roles in this scene only
    const sexRoles = markerRoles.filter((r: string) =>
      r.startsWith("sex_")
    );
    const oralRoles = markerRoles.filter((r: string) =>
      r.startsWith("oral_")
    );
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
    sceneFacialTotalCount = sceneFacialUniqueCount > 0 
      ? sceneFacialUniqueCount 
      : Math.max(sceneFacialTopCount, sceneFacialBottomCount);
    
    // Parse partner counts from marker roles (sex_top_partners_3, oral_bottom_partners_2, etc.)
    const sexTopPartnerRoles = markerRoles.filter((r: string) => r.startsWith("sex_top_partners_"));
    const sexBottomPartnerRoles = markerRoles.filter((r: string) => r.startsWith("sex_bottom_partners_"));
    const sexAllPartnerRoles = markerRoles.filter((r: string) => r.startsWith("sex_all_partners_"));
    const oralTopPartnerRoles = markerRoles.filter((r: string) => r.startsWith("oral_top_partners_"));
    const oralBottomPartnerRoles = markerRoles.filter((r: string) => r.startsWith("oral_bottom_partners_"));
    const oralAllPartnerRoles = markerRoles.filter((r: string) => r.startsWith("oral_all_partners_"));
    const facialTopPartnerRoles = markerRoles.filter((r: string) => r.startsWith("facial_top_partners_"));
    const facialBottomPartnerRoles = markerRoles.filter((r: string) => r.startsWith("facial_bottom_partners_"));
    const facialAllPartnerRoles = markerRoles.filter((r: string) => r.startsWith("facial_all_partners_"));
    
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
      const match = oralBottomPartnerRoles[0].match(/oral_bottom_partners_(\d+)/);
      if (match) sceneOralBottomPartners = parseInt(match[1], 10);
    }
    if (oralAllPartnerRoles.length > 0) {
      const match = oralAllPartnerRoles[0].match(/oral_all_partners_(\d+)/);
      if (match) sceneOralAllPartners = parseInt(match[1], 10);
    }
    if (facialTopPartnerRoles.length > 0) {
      const match = facialTopPartnerRoles[0].match(/facial_top_partners_(\d+)/);
      if (match) sceneFacialTopPartners = parseInt(match[1], 10);
    }
    if (facialBottomPartnerRoles.length > 0) {
      const match = facialBottomPartnerRoles[0].match(/facial_bottom_partners_(\d+)/);
      if (match) sceneFacialBottomPartners = parseInt(match[1], 10);
    }
    if (facialAllPartnerRoles.length > 0) {
      const match = facialAllPartnerRoles[0].match(/facial_all_partners_(\d+)/);
      if (match) sceneFacialAllPartners = parseInt(match[1], 10);
    }

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
      });
    }
    // Facial now shows counts in scene context
    if ((facialTopRoles.length > 0 || facialBottomRoles.length > 0) && facialTagId) {
      rolesToShow.push({
        category: "facial",
        count: sceneFacialTotalCount, // Total facial count (not unique partners)
        topCount: sceneFacialTopCount, // Actual top count (not unique partners)
        bottomCount: sceneFacialBottomCount, // Actual bottom count (not unique partners)
        isTop: sceneFacialTopCount > 0,
        isBottom: sceneFacialBottomCount > 0,
        tagId: facialTagId,
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
    const sexCount = p.sex_scene_count ?? 0;
    const oralCount = p.oral_scene_count ?? 0;
    const soloCount = p.solo_scene_count ?? 0;
    // Use marker count for facial (unique markers) instead of scene count
    const facialCount = p.facial_marker_count ?? 0;

    const sexWithTopCount = p.sex_with_top_count ?? 0;
    const sexWithBottomCount = p.sex_with_bottom_count ?? 0;
    const oralWithTopCount = p.oral_with_top_count ?? 0;
    const oralWithBottomCount = p.oral_with_bottom_count ?? 0;
    // Use marker counts for facial "with" counts (unique markers) instead of scene counts
    const facialWithTopCount = p.facial_marker_with_top_count ?? 0;
    const facialWithBottomCount = p.facial_marker_with_bottom_count ?? 0;

    orgasmTopCount = p.orgasm_top_count ?? 0;
    feetTopCount = p.feet_marker_count ?? 0;

    // Show category if performer has scenes OR has partner counts in that category
    if ((sexCount > 0 || sexWithTopCount > 0 || sexWithBottomCount > 0) && sexTagId) {
      rolesToShow.push({
        category: "sex",
        count: sexCount,
        topCount: p.sex_top_count ?? 0,
        bottomCount: p.sex_bottom_count ?? 0,
        tagId: sexTagId,
      });
    }
    if ((oralCount > 0 || oralWithTopCount > 0 || oralWithBottomCount > 0) && oralTagId) {
      rolesToShow.push({
        category: "oral",
        count: oralCount,
        topCount: p.oral_top_count ?? 0,
        bottomCount: p.oral_bottom_count ?? 0,
        tagId: oralTagId,
      });
    }
    if ((facialCount > 0 || facialWithTopCount > 0 || facialWithBottomCount > 0) && facialTagId) {
      rolesToShow.push({
        category: "facial",
        count: facialCount,
        // Use marker counts (unique markers) for facial in global context
        topCount: p.facial_marker_top_count ?? 0,
        bottomCount: p.facial_marker_bottom_count ?? 0,
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
  if (!hasAnyRoleTag || (rolesToShow.length === 0 && orgasmTopCount === 0 && feetTopCount === 0))
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
    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
    
    if (category === "solo") {
      return sceneId 
        ? `${name} has solo markers in this scene`
        : `${name} has appeared in ${count} solo scene${count !== 1 ? 's' : ''}`;
    }

    if (sceneId) {
      // Scene context
      if (type === "total") {
        if (category === "facial") {
          return `${name} participated in ${count} facial${count !== 1 ? 's' : ''} in this scene`;
        }
        return `${name} has ${count} ${category} partner${count !== 1 ? 's' : ''} in this scene`;
      } else if (type === "top") {
        if (category === "facial") {
          return `${name} gave ${count} facial${count !== 1 ? 's' : ''} in this scene`;
        }
        return scenePerformerCount > 2
          ? `${name} has ${count} ${category} partner${count !== 1 ? 's' : ''} as top in this scene`
          : `${name} was ${category} top in this scene`;
      } else {
        if (category === "facial") {
          return `${name} received ${count} facial${count !== 1 ? 's' : ''} in this scene`;
        }
        return scenePerformerCount > 2
          ? `${name} has ${count} ${category} partner${count !== 1 ? 's' : ''} as bottom in this scene`
          : `${name} was ${category} bottom in this scene`;
      }
    } else {
      // Global context
      if (type === "total") {
        if (category === "facial") {
          return `${name} has ${count} total facial marker${count !== 1 ? 's' : ''}`;
        }
        return `${name} has appeared in ${count} ${category} scene${count !== 1 ? 's' : ''}`;
      } else if (type === "top") {
        if (category === "facial") {
          return `${name} has given ${count} facial${count !== 1 ? 's' : ''}`;
        }
        return `${name} has topped ${count} unique partner${count !== 1 ? 's' : ''} in ${category}`;
      } else {
        if (category === "facial") {
          return `${name} has received ${count} facial${count !== 1 ? 's' : ''}`;
        }
        return `${name} has bottomed for ${count} unique partner${count !== 1 ? 's' : ''} in ${category}`;
      }
    }
  };

  return (
    <>
    <div className="performer-category-strip performer-role-badges d-flex align-items-center my-3">
      {safeRolesToShow.map((role, idx) => {
        const categoryIcon =
          role.category === "sex"
            ? gaySvg
            : role.category === "oral"
            ? mouthSvg
            : role.category === "facial"
            ? goateeSvg
            : null; // solo uses faHand

        const tagLabel =
          role.category.charAt(0).toUpperCase() + role.category.slice(1);
        const excludeTags = getExcludeTagsForCategory(role.category);

        // Use depth -1 for oral and facial to include subtags
        const markerDepth = role.category === "oral" || role.category === "facial" ? -1 : 0;

        // URLs for clickable badges
        // Facial uses /scenes/markers URL, others use /scenes URL
        let categoryUrl: string | undefined;
        let topUrl: string | undefined;
        let bottomUrl: string | undefined;
        let partnerTopUrl: string | undefined;
        let partnerBottomUrl: string | undefined;
        let allPartnersUrl: string | undefined;

        // Calculate unique partner count for this category
        let uniquePartnerCount = 0;
        if (role.category === "sex") {
          uniquePartnerCount = p.sex_unique_partner_count ?? 0;
        } else if (role.category === "oral") {
          uniquePartnerCount = p.oral_unique_partner_count ?? 0;
        } else if (role.category === "facial") {
          uniquePartnerCount = p.facial_unique_partner_count ?? 0;
        }

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
            const performerRef = { id: performer.id, label: performer.name || `Performer ${performer.id}` };
            
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
            
            allPartnersUrl = `/performers/${performer.id}/appearswithbyrole`;
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
            
            // Partner URLs for sex/oral (goes to /scenes)
            const performerRef = { id: performer.id, label: performer.name || `Performer ${performer.id}` };
            
            // Sex/oral top partner: performer is top, showing scenes
            partnerTopUrl = `/scenes?c=${encodeURIComponent(
              JSON.stringify({
                type: "scene_markers",
                modifier: "EQUALS",
                groups: [{
                  groupId: "A",
                  tag_ids: [{ id: role.tagId, label: tagLabel }],
                  depth: markerDepth,
                  performer_mode: "AND",
                  top_performer_ids: [performerRef],
                  bottom_performer_ids: [],
                }],
                unnamed_performers: [],
              })
            )}&sortby=date`;
            
            // Sex/oral bottom partner: performer is bottom, showing scenes
            partnerBottomUrl = `/scenes?c=${encodeURIComponent(
              JSON.stringify({
                type: "scene_markers",
                modifier: "EQUALS",
                groups: [{
                  groupId: "A",
                  tag_ids: [{ id: role.tagId, label: tagLabel }],
                  depth: markerDepth,
                  performer_mode: "AND",
                  top_performer_ids: [],
                  bottom_performer_ids: [performerRef],
                }],
                unnamed_performers: [],
              })
            )}&sortby=date`;
            
            allPartnersUrl = `/performers/${performer.id}/appearswithbyrole`;
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
          <div key={idx} className="role-badge-item">
            {/* Category icon on top - clickable */}
            <div className="category-icon-container" title={role.count ? getTooltipText(role.category, "total", role.count) : undefined}>
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
                  {role.category !== "solo" && !(sceneId && scenePerformerCount <= 2) && (
                    <span className="role-total-count">{role.count}</span>
                  )}
                </>
              )}
            </div>

            {/* Count below for solo, arrows below for sex/oral/facial */}
            {role.category === "solo" ? (
              <>
                <div className="solo-count" style={{ visibility: sceneId && role.category === "solo" ? 'hidden' : 'visible' }}>
                  {categoryUrl && !sceneId ? (
                    <Link to={categoryUrl} className="role-badge-link">
                      <span className="role-total-count">{role.count ?? 1}</span>
                    </Link>
                  ) : (
                    <span className="role-total-count">{role.count ?? 1}</span>
                  )}
                </div>
              </>
            ) : sceneId ? (
              // Scene context: show partner counts only if > 2 performers, otherwise just arrows
              <>
                {/* Top/Bottom role indicators */}
                <div className="role-arrows">
                  {role.isTop && (
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
                      }}
                    >
                      <Icon icon={faArrowUp} />
                      {scenePerformerCount > 2 && (
                        <span className="arrow-count">{role.topCount || 0}</span>
                      )}
                    </Badge>
                  )}
                  {role.isBottom && (
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
                      }}
                    >
                      <Icon icon={faArrowDown} />
                      {scenePerformerCount > 2 && (
                        <span className="arrow-count">{role.bottomCount || 0}</span>
                      )}
                    </Badge>
                  )}
                </div>
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
                {uniquePartnerCount > 0 && (
                  <div 
                    className="category-icon-container unique-partners-row"
                    title={`${p.name || "Performer"} has been with ${uniquePartnerCount} unique partner${uniquePartnerCount !== 1 ? 's' : ''} in ${role.category}`}
                  >
                    {allPartnersUrl ? (
                      <Link to={allPartnersUrl} className="role-badge-link">
                        <Icon icon={faUser} style={{ color: "white" }} />
                        <span className="role-total-count">{uniquePartnerCount}</span>
                      </Link>
                    ) : (
                      <>
                        <Icon icon={faUser} style={{ color: "white" }} />
                        <span className="role-total-count">{uniquePartnerCount}</span>
                      </>
                    )}
                  </div>
                )}
                

                {/* Row 4: Partner count badges*/}
                <div className="role-arrows">
                  {partnerTopUrl && (
                    (role.category === "sex" && (p.sex_with_top_count ?? 0) > 0) ||
                    (role.category === "oral" && (p.oral_with_top_count ?? 0) > 0) ||
                    (role.category === "facial" && (p.facial_marker_with_top_count ?? 0) > 0)
                  ) ? (
                    <Link to={partnerTopUrl} className="role-badge-link">
                      <Badge
                        pill
                        variant="success"
                        className="arrow-badge top-badge"
                        title={getTooltipText(
                          role.category,
                          "top",
                          role.category === "sex"
                            ? p.sex_with_top_count || 0
                            : role.category === "oral"
                            ? p.oral_with_top_count || 0
                            : role.category === "facial"
                            ? p.facial_marker_with_top_count || 0
                            : 0
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
                          {role.category === "sex"
                            ? p.sex_with_top_count || 0
                            : role.category === "oral"
                            ? p.oral_with_top_count || 0
                            : role.category === "facial"
                            ? p.facial_marker_with_top_count || 0
                            : 0}
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
                        role.category === "sex"
                          ? p.sex_with_top_count || 0
                          : role.category === "oral"
                          ? p.oral_with_top_count || 0
                          : role.category === "facial"
                          ? p.facial_marker_with_top_count || 0
                          : 0
                      )}
                      style={{
                        fontSize: 10,
                        padding: "3px 6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        visibility:
                          (role.category === "sex" && (p.sex_with_top_count ?? 0) > 0) ||
                          (role.category === "oral" && (p.oral_with_top_count ?? 0) > 0) ||
                        (role.category === "facial" && (p.facial_marker_with_top_count ?? 0) > 0)
                            ? 'visible'
                            : 'hidden',
                      }}
                    >
                      <Icon icon={faArrowUp} />
                      <span className="arrow-count">
                        {role.category === "sex"
                          ? p.sex_with_top_count || 0
                          : role.category === "oral"
                          ? p.oral_with_top_count || 0
                          : role.category === "facial"
                          ? p.facial_marker_with_top_count || 0
                          : 0}
                      </span>
                    </Badge>
                  )}
                  {partnerBottomUrl && (
                    (role.category === "sex" && (p.sex_with_bottom_count ?? 0) > 0) ||
                    (role.category === "oral" && (p.oral_with_bottom_count ?? 0) > 0) ||
                    (role.category === "facial" && (p.facial_marker_with_bottom_count ?? 0) > 0)
                  ) ? (
                    <Link to={partnerBottomUrl} className="role-badge-link">
                      <Badge
                        pill
                        variant="info"
                        className="arrow-badge bottom-badge"
                        title={getTooltipText(
                          role.category,
                          "bottom",
                          role.category === "sex"
                            ? p.sex_with_bottom_count || 0
                            : role.category === "oral"
                            ? p.oral_with_bottom_count || 0
                            : role.category === "facial"
                            ? p.facial_marker_with_bottom_count || 0
                            : 0
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
                          {role.category === "sex"
                            ? p.sex_with_bottom_count || 0
                            : role.category === "oral"
                            ? p.oral_with_bottom_count || 0
                            : role.category === "facial"
                            ? p.facial_marker_with_bottom_count || 0
                            : 0}
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
                        role.category === "sex"
                          ? p.sex_with_bottom_count || 0
                          : role.category === "oral"
                          ? p.oral_with_bottom_count || 0
                          : role.category === "facial"
                          ? p.facial_marker_with_bottom_count || 0
                          : 0
                      )}
                      style={{
                        fontSize: 10,
                        padding: "3px 6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        visibility:
                          (role.category === "sex" && (p.sex_with_bottom_count ?? 0) > 0) ||
                          (role.category === "oral" && (p.oral_with_bottom_count ?? 0) > 0) ||
                        (role.category === "facial" && (p.facial_marker_with_bottom_count ?? 0) > 0)
                            ? 'visible'
                            : 'hidden',
                      }}
                    >
                      <Icon icon={faArrowDown} />
                      <span className="arrow-count">
                        {role.category === "sex"
                          ? p.sex_with_bottom_count || 0
                          : role.category === "oral"
                          ? p.oral_with_bottom_count || 0
                          : role.category === "facial"
                          ? p.facial_marker_with_bottom_count || 0
                          : 0}
                      </span>
                    </Badge>
                  )}
                </div>
                
              </>
            )}
          </div>
        );
      })}

      {/* Orgasm icon at the end */}
      {orgasmTopCount > 0 && orgasmTagId && (
        <div className="role-badge-item orgasm-badge">
          <div 
            className="category-icon-container"
            title={sceneId 
              ? `${p.name || "Performer"} had ${orgasmTopCount} orgasm${orgasmTopCount !== 1 ? 's' : ''} in this scene`
              : `${p.name || "Performer"} has ${orgasmTopCount} total orgasm${orgasmTopCount !== 1 ? 's' : ''}`
            }
          >
            <Link
              to={NavUtils.makePerformerOrgasmMarkersUrl(
                performer,
                orgasmTagId,
                "Orgasm"
              )}
              className="role-badge-link"
            >
              <img src={spermsSvg} alt="Orgasm" className="category-icon" />
            </Link>
          </div>
          <div className="orgasm-count" style={{ visibility: sceneId && orgasmTopCount === 1 ? 'hidden' : 'visible' }}>
            <Link
              to={NavUtils.makePerformerOrgasmMarkersUrl(
                performer,
                orgasmTagId,
                "Orgasm"
              )}
              className="role-badge-link"
            >
              <span className="role-total-count">{orgasmTopCount}</span>
            </Link>
          </div>
        </div>
      )}

      {/* Feet icon */}
      {feetTopCount > 0 && feetTagId && (
        <div className="role-badge-item feet-badge">
          <div 
            className="category-icon-container"
            title={sceneId 
              ? `${p.name || "Performer"} has ${feetTopCount} feet marker${feetTopCount !== 1 ? 's' : ''} in this scene`
              : `${p.name || "Performer"} has ${feetTopCount} total feet marker${feetTopCount !== 1 ? 's' : ''}`
            }
          >
            {!sceneId ? (
              <Link
                to={NavUtils.makePerformerFeetMarkersUrl(
                  performer,
                  feetTagId,
                  "Feet"
                )}
                className="role-badge-link"
              >
                <img
                  src={feetSvg}
                  alt="Feet"
                  className="category-icon"
                />
              </Link>
            ) : (
              <img
                src={feetSvg}
                alt="Feet"
                className="category-icon"
              />
            )}
          </div>
          {!sceneId && (
            <div className="feet-count">
              <Link
                to={NavUtils.makePerformerFeetMarkersUrl(
                  performer,
                  feetTagId,
                  "Feet"
                )}
                className="role-badge-link"
              >
                <span className="role-total-count">{feetTopCount}</span>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  </>
  );
};
