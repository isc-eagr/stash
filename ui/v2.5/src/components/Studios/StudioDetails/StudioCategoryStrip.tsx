import React from "react";
import { Button, ButtonGroup } from "react-bootstrap";
import { Icon } from "src/components/Shared/Icon";
import { faHand, faUserPlus } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import { useConfigurationContext } from "src/hooks/Config";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import goateeSvg from "src/assets/goatee.svg";

interface IStudioCategoryStripProps {
  studio: GQL.StudioDataFragment;
}

/**
 * StudioCategoryStrip - Shows marker-based scene category counts
 * Uses roleTagIds configuration for tag IDs.
 */
export const StudioCategoryStrip: React.FC<IStudioCategoryStripProps> = ({
  studio,
}) => {
  const { configuration } = useConfigurationContext();

  // Get role tag IDs from the new configuration
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};
  const sexTagId = roleTagIds.sexTagId;
  const oralTagId = roleTagIds.oralTagId;
  const soloTagId = roleTagIds.soloTagId;
  const facialTagId = roleTagIds.facialTagId;

  // Query all tags to get their names for display
  const { data: tagsData } = GQL.useFindTagsQuery({
    variables: {
      filter: {
        per_page: -1, // Get all tags
      },
    },
  });

  // Map tag IDs to tag objects
  const allTags = tagsData?.findTags?.tags ?? [];
  const sexTag = allTags.find((t) => t.id === sexTagId);
  const oralTag = allTags.find((t) => t.id === oralTagId);
  const soloTag = allTags.find((t) => t.id === soloTagId);
  const facialTag = allTags.find((t) => t.id === facialTagId);

  // Get counts from studio
  const studioAny = studio as any;
  const sexCount = studioAny.sex_scene_count ?? 0;
  const oralCount = studioAny.oral_scene_count ?? 0;
  const soloCount = studioAny.solo_scene_count ?? 0;
  const facialCount = studioAny.facial_scene_count ?? 0;

  // Sex scenes (marker-based) - gay icon
  function maybeRenderSexScenesButton() {
    if (!sexTag) return null;

    const url = NavUtils.makeStudioMarkerScenesUrl(studio, sexTag.id, "Sex");

    return (
      <Button
        className="minimal scene-category-count sex-scene-count"
        href={url}
        title={`Sex scenes (${sexTag.name})`}
        disabled={sexCount === 0}
      >
        <img src={gaySvg} alt="Sex" className="category-icon" />
        <span>{sexCount}</span>
      </Button>
    );
  }

  // Oral scenes (marker-based) - mouth icon
  function maybeRenderOralScenesButton() {
    if (!oralTag) return null;

    // Use depth -1 to include subtags
    const url = NavUtils.makeStudioMarkerScenesUrl(studio, oralTag.id, "Oral", undefined, -1);

    return (
      <Button
        className="minimal scene-category-count oral-scene-count"
        href={url}
        title={`Oral scenes (${oralTag.name})`}
        disabled={oralCount === 0}
      >
        <img src={mouthSvg} alt="Oral" className="category-icon" />
        <span>{oralCount}</span>
      </Button>
    );
  }

  // Solo scenes (marker-based) - hand icon
  function maybeRenderSoloScenesButton() {
    if (!soloTag) return null;

    const url = NavUtils.makeStudioMarkerScenesUrl(studio, soloTag.id, "Solo");

    return (
      <Button
        className="minimal scene-category-count solo-scene-count"
        href={url}
        title={`Solo scenes (${soloTag.name})`}
        disabled={soloCount === 0}
      >
        <Icon icon={faHand} className="category-icon-fa" />
        <span>{soloCount}</span>
      </Button>
    );
  }

  // Facial scenes (marker-based) - goatee icon
  function maybeRenderFacialScenesButton() {
    if (!facialTag) return null;

    // Use depth -1 to include subtags
    const url = NavUtils.makeStudioMarkerScenesUrl(
      studio,
      facialTag.id,
      "Facial",
      undefined,
      -1
    );

    return (
      <Button
        className="minimal scene-category-count facial-scene-count ml-3"
        href={url}
        title={`Facial scenes (${facialTag.name})`}
        disabled={facialCount === 0}
      >
        <img src={goateeSvg} alt="Facial" className="category-icon" />
        <span>{facialCount}</span>
      </Button>
    );
  }

  // Unique performers (performers with only 1 scene in database, for this studio)
  function maybeRenderUniquePerformersButton() {
    const count = studioAny.unique_performer_count ?? 0;
    if (count === 0) return null;

    const url = NavUtils.makeStudioDetailUniquePerformersUrl(studio);

    return (
      <Button
        className="minimal scene-category-count unique-performer-count ml-3"
        href={url}
        title={`Unique performers (only 1 scene)`}
        disabled={count === 0}
      >
        <Icon icon={faUserPlus} className="category-icon-fa" />
        <span>{count}</span>
      </Button>
    );
  }

  // Only show if at least one role tag is configured
  const hasAnyRoleTag = sexTag || oralTag || soloTag || facialTag;
  if (!hasAnyRoleTag) return null;

  return (
    <div className="studio-category-strip scene-category-buttons d-flex align-items-center my-3">
      <ButtonGroup>
        {maybeRenderSexScenesButton()}
        {maybeRenderOralScenesButton()}
        {maybeRenderSoloScenesButton()}
      </ButtonGroup>
      {maybeRenderFacialScenesButton()}
      {maybeRenderUniquePerformersButton()}
    </div>
  );
};
