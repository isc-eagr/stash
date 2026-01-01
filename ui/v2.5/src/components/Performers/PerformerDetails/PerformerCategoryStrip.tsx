import React from "react";
import { Badge } from "react-bootstrap";
import { Link } from "react-router-dom";
import { Icon } from "src/components/Shared/Icon";
import {
  faHand,
  faArrowUp,
  faArrowDown,
} from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import { useConfigurationContext } from "src/hooks/Config";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import goateeSvg from "src/assets/goatee.svg";
import spermsSvg from "src/assets/sperms.svg";

interface IPerformerCategoryStripProps {
  performer: GQL.PerformerDataFragment;
  /** Scene ID for scene context - enables role badges based on marker roles */
  sceneId?: string;
  /** Marker roles in the current scene (used when sceneId is provided) */
  markerRoles?: string[];
}

/**
 * PerformerCategoryStrip - Shows marker-based role badges with top/bottom breakdown
 * Uses roleTagIds configuration for tag IDs and counts from performer data.
 * Can show global counts or scene-specific roles depending on context.
 * Used in both performer cards (with sceneId/markerRoles) and detail pages (global).
 */
export const PerformerCategoryStrip: React.FC<IPerformerCategoryStripProps> = ({
  performer,
  sceneId,
  markerRoles = [],
}) => {
  const { configuration } = useConfigurationContext();

  // Get role tag IDs from the new configuration
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};
  const sexTagId = roleTagIds.sexTagId;
  const oralTagId = roleTagIds.oralTagId;
  const soloTagId = roleTagIds.soloTagId;
  const facialTagId = roleTagIds.facialTagId;
  const orgasmTagId = roleTagIds.orgasmTagId;

  const p = performer as any;
  let orgasmTopCount = 0;

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

  if (sceneId && markerRoles.length > 0) {
    // Scene context: show roles based on marker roles in this scene only
    const sexRoles = markerRoles.filter((r: string) =>
      r.startsWith("sex_")
    );
    const oralRoles = markerRoles.filter((r: string) =>
      r.startsWith("oral_")
    );
    const soloRoles = markerRoles.filter((r: string) => r === "solo");
    const facialRoles = markerRoles.filter((r: string) =>
      r.startsWith("facial_")
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

    // Fixed order: Sex, Oral, Solo, Facial
    if (sexRoles.length > 0 && sexTagId) {
      rolesToShow.push({
        category: "sex",
        isTop: sexRoles.some((r: string) => r.endsWith("_top")),
        isBottom: sexRoles.some((r: string) => r.endsWith("_bottom")),
        tagId: sexTagId,
      });
    }
    if (oralRoles.length > 0 && oralTagId) {
      rolesToShow.push({
        category: "oral",
        isTop: oralRoles.some((r: string) => r.endsWith("_top")),
        isBottom: oralRoles.some((r: string) => r.endsWith("_bottom")),
        tagId: oralTagId,
      });
    }
    if (soloRoles.length > 0 && soloTagId) {
      rolesToShow.push({
        category: "solo",
        tagId: soloTagId,
      });
    }
    if (facialRoles.length > 0 && facialTagId) {
      rolesToShow.push({
        category: "facial",
        isTop: facialRoles.some((r: string) => r.endsWith("_top")),
        isBottom: facialRoles.some((r: string) => r.endsWith("_bottom")),
        tagId: facialTagId,
      });
    }
  } else {
    // Global context: show total counts from performer data
    const sexCount = p.sex_scene_count ?? 0;
    const oralCount = p.oral_scene_count ?? 0;
    const soloCount = p.solo_scene_count ?? 0;
    const facialCount = p.facial_scene_count ?? 0;

    orgasmTopCount = p.orgasm_top_count ?? 0;

    if (sexCount > 0 && sexTagId) {
      rolesToShow.push({
        category: "sex",
        count: sexCount,
        topCount: p.sex_top_count ?? 0,
        bottomCount: p.sex_bottom_count ?? 0,
        tagId: sexTagId,
      });
    }
    if (oralCount > 0 && oralTagId) {
      rolesToShow.push({
        category: "oral",
        count: oralCount,
        topCount: p.oral_top_count ?? 0,
        bottomCount: p.oral_bottom_count ?? 0,
        tagId: oralTagId,
      });
    }
    if (soloCount > 0 && soloTagId) {
      rolesToShow.push({
        category: "solo",
        count: soloCount,
        tagId: soloTagId,
      });
    }
    if (facialCount > 0 && facialTagId) {
      rolesToShow.push({
        category: "facial",
        count: facialCount,
        topCount: p.facial_top_count ?? 0,
        bottomCount: p.facial_bottom_count ?? 0,
        tagId: facialTagId,
      });
    }
  }

  // Only show if at least one role tag is configured
  const hasAnyRoleTag = sexTagId || oralTagId || soloTagId || facialTagId;
  if (!hasAnyRoleTag || (rolesToShow.length === 0 && orgasmTopCount === 0))
    return null;

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

  return (
    <div className="performer-category-strip performer-role-badges d-flex align-items-center my-3">
      {rolesToShow.map((role, idx) => {
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

        // URLs for clickable badges
        const categoryUrl = role.tagId
          ? NavUtils.makePerformerMarkerScenesWithRoleUrl(
              performer,
              role.tagId,
              tagLabel,
              undefined,
              excludeTags
            )
          : undefined;
        const topUrl = role.tagId
          ? NavUtils.makePerformerMarkerScenesWithRoleUrl(
              performer,
              role.tagId,
              tagLabel,
              "top",
              excludeTags
            )
          : undefined;
        const bottomUrl = role.tagId
          ? NavUtils.makePerformerMarkerScenesWithRoleUrl(
              performer,
              role.tagId,
              tagLabel,
              "bottom",
              excludeTags
            )
          : undefined;

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
            <div className="category-icon-container">
              {categoryUrl ? (
                <Link to={categoryUrl} className="role-badge-link">
                  {categoryIconElement}
                  {role.category !== "solo" && (
                    <span className="role-total-count">{role.count}</span>
                  )}
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

            {/* Count below for solo, arrows below for sex/oral/facial */}
            {role.category === "solo" ? (
              <>
                <div className="solo-count" style={{ visibility: sceneId && role.category === "solo" ? 'hidden' : 'visible' }}>
                  <span className="role-total-count">{role.count ?? 1}</span>
                </div>
              </>
            ) : sceneId ? (
              // Scene context: show top/bottom indicators as badges
              <div className="role-arrows">
                {role.isTop &&
                  (topUrl ? (
                    <Link to={topUrl} className="role-badge-link">
                      <Badge
                        pill
                        variant="success"
                        className="arrow-badge top-badge"
                        style={{
                          fontSize: 10,
                          padding: "3px 6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Icon icon={faArrowUp} />
                      </Badge>
                    </Link>
                  ) : (
                    <Badge
                      pill
                      variant="success"
                      className="arrow-badge top-badge"
                      style={{
                        fontSize: 10,
                        padding: "3px 6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Icon icon={faArrowUp} />
                    </Badge>
                  ))}
                {role.isBottom &&
                  (bottomUrl ? (
                    <Link to={bottomUrl} className="role-badge-link">
                      <Badge
                        pill
                        variant="info"
                        className="arrow-badge bottom-badge"
                        style={{
                          fontSize: 10,
                          padding: "3px 6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Icon icon={faArrowDown} />
                      </Badge>
                    </Link>
                  ) : (
                    <Badge
                      pill
                      variant="info"
                      className="arrow-badge bottom-badge"
                      style={{
                        fontSize: 10,
                        padding: "3px 6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Icon icon={faArrowDown} />
                    </Badge>
                  ))}
              </div>
            ) : (
              // Global context: show counts with arrows
              <div className="role-arrows">
                {(role.topCount ?? 0) > 0 &&
                  (topUrl ? (
                    <Link to={topUrl} className="role-badge-link">
                      <Badge
                        pill
                        variant="success"
                        className="arrow-badge top-badge"
                        style={{
                          fontSize: 10,
                          padding: "3px 6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Icon icon={faArrowUp} />
                        <span className="arrow-count">{role.topCount}</span>
                      </Badge>
                    </Link>
                  ) : (
                    <Badge
                      pill
                      variant="success"
                      className="arrow-badge top-badge"
                      style={{
                        fontSize: 10,
                        padding: "3px 6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Icon icon={faArrowUp} />
                      <span className="arrow-count">{role.topCount}</span>
                    </Badge>
                  ))}
                {(role.bottomCount ?? 0) > 0 &&
                  (bottomUrl ? (
                    <Link to={bottomUrl} className="role-badge-link">
                      <Badge
                        pill
                        variant="info"
                        className="arrow-badge bottom-badge"
                        style={{
                          fontSize: 10,
                          padding: "3px 6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Icon icon={faArrowDown} />
                        <span className="arrow-count">{role.bottomCount}</span>
                      </Badge>
                    </Link>
                  ) : (
                    <Badge
                      pill
                      variant="info"
                      className="arrow-badge bottom-badge"
                      style={{
                        fontSize: 10,
                        padding: "3px 6px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Icon icon={faArrowDown} />
                      <span className="arrow-count">{role.bottomCount}</span>
                    </Badge>
                  ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Orgasm icon at the end */}
      {orgasmTopCount > 0 && orgasmTagId && (
        <div className="role-badge-item orgasm-badge">
          <div className="category-icon-container">
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
            <span className="role-total-count">{orgasmTopCount}</span>
          </div>
        </div>
      )}
    </div>
  );
};
