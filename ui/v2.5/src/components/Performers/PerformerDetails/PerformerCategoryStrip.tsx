import React, { useContext } from "react";
import { Button, ButtonGroup } from "react-bootstrap";
import { Icon } from "src/components/Shared/Icon";
import { faHand } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import { ConfigurationContext } from "src/hooks/Config";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import goateeSvg from "src/assets/goatee.svg";

interface IPerformerCategoryStripProps {
  performer: GQL.PerformerDataFragment;
}

export const PerformerCategoryStrip: React.FC<IPerformerCategoryStripProps> = ({
  performer,
}) => {
  const { configuration } = useContext(ConfigurationContext);
  const cfg = (configuration?.ui as any)?.sceneTagAliases ?? {};

  // Query for tag IDs based on configured tag names
  const topTagName = cfg.top ?? "top";
  const bottomTagName = cfg.bottom ?? "bottom";
  const oralTopTagName = cfg.oraltop ?? "oraltop";
  const oralBottomTagName = cfg.oralbottom ?? "oralbottom";
  const soloTagName = cfg.solo ?? "solo";
  const facialGivenTagName = cfg.facialgiven ?? "facialgiven";
  const facialReceivedTagName = cfg.facialreceived ?? "facialreceived";
  const selfFacialTagName = cfg.selffacial ?? "selffacial";

  // Query all tags and filter client-side
  const { data: tagsData } = GQL.useFindTagsQuery({
    variables: {
      filter: {
        per_page: -1, // Get all tags
      },
    },
  });

  // Map tag names to IDs
  const allTags = tagsData?.findTags?.tags ?? [];
  const topTag = allTags.find(
    (t) => t.name.toLowerCase() === topTagName.toLowerCase()
  );
  const bottomTag = allTags.find(
    (t) => t.name.toLowerCase() === bottomTagName.toLowerCase()
  );
  const oralTopTag = allTags.find(
    (t) => t.name.toLowerCase() === oralTopTagName.toLowerCase()
  );
  const oralBottomTag = allTags.find(
    (t) => t.name.toLowerCase() === oralBottomTagName.toLowerCase()
  );
  const soloTag = allTags.find(
    (t) => t.name.toLowerCase() === soloTagName.toLowerCase()
  );
  const facialGivenTag = allTags.find(
    (t) => t.name.toLowerCase() === facialGivenTagName.toLowerCase()
  );
  const facialReceivedTag = allTags.find(
    (t) => t.name.toLowerCase() === facialReceivedTagName.toLowerCase()
  );
  const selfFacialTag = allTags.find(
    (t) => t.name.toLowerCase() === selfFacialTagName.toLowerCase()
  );

  // Sex scenes (top/bottom tags) - gay icon
  function maybeRenderSexScenesButton() {
    if (!topTag || !bottomTag) return null;

    const count = performer.sex_scene_count ?? 0;
    const url = NavUtils.makePerformerDetailSexScenesUrl(
      performer,
      topTag.id,
      topTag.name,
      bottomTag.id,
      bottomTag.name
    );

    return (
      <Button
        className="minimal scene-category-count sex-scene-count"
        href={url}
        title={`Sex scenes (${topTag.name}/${bottomTag.name})`}
        disabled={count === 0}
      >
        <img src={gaySvg} alt="Sex" className="category-icon" />
        <span>{count}</span>
      </Button>
    );
  }

  // Oral scenes (oral tags without top/bottom) - mouth icon
  function maybeRenderOralScenesButton() {
    if (!oralTopTag || !oralBottomTag || !topTag || !bottomTag) return null;

    const count = performer.oral_scene_count ?? 0;
    const url = NavUtils.makePerformerDetailOralScenesUrl(
      performer,
      oralTopTag.id,
      oralTopTag.name,
      oralBottomTag.id,
      oralBottomTag.name,
      topTag.id,
      topTag.name,
      bottomTag.id,
      bottomTag.name
    );

    return (
      <Button
        className="minimal scene-category-count oral-scene-count"
        href={url}
        title={`Oral scenes (${oralTopTag.name}/${oralBottomTag.name})`}
        disabled={count === 0}
      >
        <img src={mouthSvg} alt="Oral" className="category-icon" />
        <span>{count}</span>
      </Button>
    );
  }

  // Solo scenes (solo tags without top/bottom/oral) - hand icon
  function maybeRenderSoloScenesButton() {
    if (!soloTag || !topTag || !bottomTag || !oralTopTag || !oralBottomTag)
      return null;

    const count = performer.solo_scene_count ?? 0;
    const url = NavUtils.makePerformerDetailSoloScenesUrl(
      performer,
      soloTag.id,
      soloTag.name,
      topTag.id,
      topTag.name,
      bottomTag.id,
      bottomTag.name,
      oralTopTag.id,
      oralTopTag.name,
      oralBottomTag.id,
      oralBottomTag.name
    );

    return (
      <Button
        className="minimal scene-category-count solo-scene-count"
        href={url}
        title={`Solo scenes (${soloTag.name})`}
        disabled={count === 0}
      >
        <Icon icon={faHand} className="category-icon-fa" />
        <span>{count}</span>
      </Button>
    );
  }

  // Facial scenes (facialgiven or facialreceived) - goatee icon
  function maybeRenderFacialScenesButton() {
    // At least one facial tag must be configured/found
    if (!facialGivenTag && !facialReceivedTag && !selfFacialTag) return null;

    const count = performer.facial_scene_count ?? 0;
    const primary1 = (facialGivenTag ?? selfFacialTag)!;
    const primary2 = (facialReceivedTag ?? selfFacialTag)!;
    const url = NavUtils.makePerformerDetailFacialScenesUrl(
      performer,
      primary1.id,
      primary1.name,
      primary2.id,
      primary2.name,
      selfFacialTag?.id,
      selfFacialTag?.name
    );

    return (
      <Button
        className="minimal scene-category-count facial-scene-count ml-3"
        href={url}
        title={`Facial scenes`}
        disabled={count === 0}
      >
        <img src={goateeSvg} alt="Facial" className="category-icon" />
        <span>{count}</span>
      </Button>
    );
  }

  const hasCategoryButtons = !!(
    topTag &&
    bottomTag &&
    oralTopTag &&
    oralBottomTag &&
    soloTag
  );

  if (!hasCategoryButtons) return null;

  return (
    <div className="performer-category-strip scene-category-buttons d-flex align-items-center my-3">
      <ButtonGroup>
        {maybeRenderSexScenesButton()}
        {maybeRenderOralScenesButton()}
        {maybeRenderSoloScenesButton()}
      </ButtonGroup>
      {maybeRenderFacialScenesButton()}
    </div>
  );
};
