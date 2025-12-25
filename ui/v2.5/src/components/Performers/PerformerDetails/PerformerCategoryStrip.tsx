import React from "react";
import { Badge } from "react-bootstrap";
import { Link } from "react-router-dom";
import { Icon } from "src/components/Shared/Icon";
import { faHand, faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import { useConfigurationContext } from "src/hooks/Config";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import goateeSvg from "src/assets/goatee.svg";

interface IPerformerCategoryStripProps {
  performer: GQL.PerformerDataFragment;
}

/**
 * PerformerCategoryStrip - Shows marker-based role badges with giver/receiver breakdown
 * Uses roleTagIds configuration for tag IDs and counts from performer data.
 * Same style as performer card role badges but for the detail page.
 */
export const PerformerCategoryStrip: React.FC<IPerformerCategoryStripProps> = ({
  performer,
}) => {
  const { configuration } = useConfigurationContext();
  
  // Get role tag IDs from the new configuration
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};
  const sexTagId = roleTagIds.sexTagId;
  const oralTagId = roleTagIds.oralTagId;
  const soloTagId = roleTagIds.soloTagId;
  const facialTagId = roleTagIds.facialTagId;

  // Get counts from performer - using giver/receiver fields
  const p = performer as any;
  const sexGiverCount = p.sex_giver_count ?? 0;
  const sexReceiverCount = p.sex_receiver_count ?? 0;
  const sexCount = p.sex_scene_count ?? 0;
  
  const oralGiverCount = p.oral_giver_count ?? 0;
  const oralReceiverCount = p.oral_receiver_count ?? 0;
  const oralCount = p.oral_scene_count ?? 0;
  
  const soloCount = p.solo_scene_count ?? 0;
  
  const facialGiverCount = p.facial_giver_count ?? 0;
  const facialReceiverCount = p.facial_receiver_count ?? 0;
  const facialCount = p.facial_scene_count ?? 0;

  // Build roles to show (same logic as PerformerCard)
  const rolesToShow: Array<{
    category: 'sex' | 'oral' | 'solo' | 'facial';
    count: number;
    giverCount?: number;
    receiverCount?: number;
    tagId?: string;
  }> = [];

  if (sexCount > 0 && sexTagId) {
    rolesToShow.push({
      category: 'sex',
      count: sexCount,
      giverCount: sexGiverCount,
      receiverCount: sexReceiverCount,
      tagId: sexTagId,
    });
  }
  if (oralCount > 0 && oralTagId) {
    rolesToShow.push({
      category: 'oral',
      count: oralCount,
      giverCount: oralGiverCount,
      receiverCount: oralReceiverCount,
      tagId: oralTagId,
    });
  }
  if (soloCount > 0 && soloTagId) {
    rolesToShow.push({
      category: 'solo',
      count: soloCount,
      tagId: soloTagId,
    });
  }
  if (facialCount > 0 && facialTagId) {
    rolesToShow.push({
      category: 'facial',
      count: facialCount,
      giverCount: facialGiverCount,
      receiverCount: facialReceiverCount,
      tagId: facialTagId,
    });
  }

  // Only show if at least one role tag is configured
  const hasAnyRoleTag = sexTagId || oralTagId || soloTagId || facialTagId;
  if (!hasAnyRoleTag || rolesToShow.length === 0) return null;

  // Build exclude tags for oral (exclude sex) and solo (exclude sex + oral)
  const getExcludeTagsForCategory = (category: 'sex' | 'oral' | 'solo' | 'facial') => {
    const excludeTags: Array<{ id: string; label: string }> = [];
    if (category === 'oral') {
      // Oral should exclude sex tag
      if (sexTagId) excludeTags.push({ id: sexTagId, label: 'Sex' });
    } else if (category === 'solo') {
      // Solo should exclude both sex and oral tags
      if (sexTagId) excludeTags.push({ id: sexTagId, label: 'Sex' });
      if (oralTagId) excludeTags.push({ id: oralTagId, label: 'Oral' });
    }
    return excludeTags.length > 0 ? excludeTags : undefined;
  };

  return (
    <div className="performer-category-strip performer-role-badges d-flex align-items-center my-3">
      {rolesToShow.map((role, idx) => {
        const categoryIcon = 
          role.category === 'sex' ? gaySvg :
          role.category === 'oral' ? mouthSvg :
          role.category === 'facial' ? goateeSvg :
          null; // solo uses faHand
        
        const tagLabel = role.category.charAt(0).toUpperCase() + role.category.slice(1);
        const excludeTags = getExcludeTagsForCategory(role.category);
        
        // URLs for clickable badges
        const categoryUrl = role.tagId 
          ? NavUtils.makePerformerMarkerScenesWithRoleUrl(performer, role.tagId, tagLabel, undefined, excludeTags)
          : undefined;
        const giverUrl = role.tagId 
          ? NavUtils.makePerformerMarkerScenesWithRoleUrl(performer, role.tagId, tagLabel, "giver", excludeTags)
          : undefined;
        const receiverUrl = role.tagId 
          ? NavUtils.makePerformerMarkerScenesWithRoleUrl(performer, role.tagId, tagLabel, "receiver", excludeTags)
          : undefined;

        const categoryIconElement = categoryIcon ? (
          <img src={categoryIcon} alt={role.category} className="category-icon" />
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
                  <span className="role-total-count">{role.count}</span>
                </Link>
              ) : (
                <>
                  {categoryIconElement}
                  <span className="role-total-count">{role.count}</span>
                </>
              )}
            </div>
            
            {/* Arrows below (only for sex/oral/facial, not solo) */}
            {role.category !== 'solo' && (
              <div className="role-arrows">
                {(role.giverCount ?? 0) > 0 && (
                  giverUrl ? (
                    <Link to={giverUrl} className="role-badge-link">
                      <Badge pill variant="success" className="arrow-badge giver-badge" style={{ fontSize: 10, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon icon={faArrowUp} />
                        <span className="arrow-count">{role.giverCount}</span>
                      </Badge>
                    </Link>
                  ) : (
                    <Badge pill variant="success" className="arrow-badge giver-badge" style={{ fontSize: 10, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon icon={faArrowUp} />
                      <span className="arrow-count">{role.giverCount}</span>
                    </Badge>
                  )
                )}
                {(role.receiverCount ?? 0) > 0 && (
                  receiverUrl ? (
                    <Link to={receiverUrl} className="role-badge-link">
                      <Badge pill variant="info" className="arrow-badge receiver-badge" style={{ fontSize: 10, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Icon icon={faArrowDown} />
                        <span className="arrow-count">{role.receiverCount}</span>
                      </Badge>
                    </Link>
                  ) : (
                    <Badge pill variant="info" className="arrow-badge receiver-badge" style={{ fontSize: 10, padding: '3px 6px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Icon icon={faArrowDown} />
                      <span className="arrow-count">{role.receiverCount}</span>
                    </Badge>
                  )
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
