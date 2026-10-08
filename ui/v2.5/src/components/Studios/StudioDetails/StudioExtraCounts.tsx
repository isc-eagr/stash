import React from "react";
import { Button } from "react-bootstrap";
import { Icon } from "src/components/Shared/Icon";
import { faUserPlus } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import { useRoleTags } from "src/hooks/useRoleTags";
import facialPng from "src/assets/facial.png"; // CUSTOM
import { STUDIO_FACIALS_TOOLTIP } from "../studioFacialsTooltip_custom"; // CUSTOM

interface IStudioExtraCountsProps {
  studio: GQL.StudioDetailDataFragment;
  includeChildStudios: boolean;
}

/**
 * Facial and unique-vato links beside the studio rating.
 * Uses roleTagIds configuration for tag IDs.
 */
export const StudioExtraCounts: React.FC<IStudioExtraCountsProps> = ({
  studio,
  includeChildStudios,
}) => {
  // Use shared hook to get role tags (Apollo-cached, no redundant queries)
  const { facialTag } = useRoleTags();

  const facialCount = studio.facial_count ?? 0;

  // Facials (marker count) - facial icon, links to this studio's facial markers
  function maybeRenderFacialsButton() {
    if (!facialTag) return null;

    const url = NavUtils.makeStudioMarkersUrl(
      studio,
      facialTag.id,
      facialTag.name
    );

    return (
      <Button
        className="minimal scene-category-count facial-marker-count ml-3"
        href={url}
        title={STUDIO_FACIALS_TOOLTIP}
        disabled={facialCount === 0}
      >
        <img src={facialPng} alt="Facial" className="category-icon" />
        <span>{facialCount}</span>
      </Button>
    );
  }

  // Unique performers (performers with only 1 scene in database, for this studio)
  function maybeRenderUniquePerformersButton() {
    const count =
      (includeChildStudios
        ? studio.unique_performer_count_all
        : studio.unique_performer_count) ?? 0;
    if (count === 0) return null;

    const url = NavUtils.makeStudioDetailUniquePerformersUrl(studio);

    return (
      <Button
        className="minimal scene-category-count unique-performer-count ml-3"
        href={url}
        title={`Unique vatos (only 1 scene)`}
        disabled={count === 0}
      >
        <Icon icon={faUserPlus} className="category-icon-fa" />
        <span>{count}</span>
      </Button>
    );
  }

  return (
    <span className="studio-extra-counts">
      {maybeRenderFacialsButton()}
      {maybeRenderUniquePerformersButton()}
    </span>
  );
};
