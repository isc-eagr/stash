import React, { useState } from "react";
import { FormattedMessage, FormattedNumber, useIntl } from "react-intl";
import { useConfigureUI, useStats } from "src/core/StashService";
import * as GQL from "src/core/generated-graphql";
import { LoadingIndicator } from "../Shared/LoadingIndicator";
import { Button } from "react-bootstrap";
import { FrontPageConfig } from "./FrontPageConfig";
import { useToast } from "src/hooks/Toast";
import { Control } from "./Control";
import { ConfigurationContext } from "src/hooks/Config";
import {
  FrontPageContent,
  generateDefaultFrontPageContent,
  getFrontPageContent,
} from "src/core/config";
import { useScrollToTopOnMount } from "src/hooks/scrollToTop";
import { PatchComponent } from "src/patch";
import { Icon } from "../Shared/Icon";
import { faHand } from "@fortawesome/free-solid-svg-icons";
import NavUtils from "src/utils/navigation";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import goateeSvg from "src/assets/goatee.svg";

const FrontPage: React.FC = PatchComponent("FrontPage", () => {
  const intl = useIntl();
  const Toast = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [saveUI] = useConfigureUI();

  const { configuration, loading } = React.useContext(ConfigurationContext);
  const { data: statsData } = useStats();
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
  
  const { data: tagsData } = GQL.useFindTagsQuery({
    variables: {
      filter: {
        per_page: -1,
      },
    },
  });
  
  // Map tag names to IDs
  const allTags = tagsData?.findTags?.tags ?? [];
  const topTag = allTags.find(t => t.name.toLowerCase() === topTagName.toLowerCase());
  const bottomTag = allTags.find(t => t.name.toLowerCase() === bottomTagName.toLowerCase());
  const oralTopTag = allTags.find(t => t.name.toLowerCase() === oralTopTagName.toLowerCase());
  const oralBottomTag = allTags.find(t => t.name.toLowerCase() === oralBottomTagName.toLowerCase());
  const soloTag = allTags.find(t => t.name.toLowerCase() === soloTagName.toLowerCase());
  const facialGivenTag = allTags.find(t => t.name.toLowerCase() === facialGivenTagName.toLowerCase());
  const facialReceivedTag = allTags.find(t => t.name.toLowerCase() === facialReceivedTagName.toLowerCase());
  const selfFacialTag = allTags.find(t => t.name.toLowerCase() === selfFacialTagName.toLowerCase());

  useScrollToTopOnMount();

  async function onUpdateConfig(content?: FrontPageContent[]) {
    setIsEditing(false);

    if (!content) {
      return;
    }

    setSaving(true);
    try {
      await saveUI({
        variables: {
          input: {
            ...configuration?.ui,
            frontPageContent: content,
          },
        },
      });
    } catch (e) {
      Toast.error(e);
    }
    setSaving(false);
  }

  if (loading || saving) {
    return <LoadingIndicator />;
  }

  if (isEditing) {
    return <FrontPageConfig onClose={(content) => onUpdateConfig(content)} />;
  }

  const ui = configuration?.ui ?? {};

  if (!ui.frontPageContent) {
    const defaultContent = generateDefaultFrontPageContent(intl);
    onUpdateConfig(defaultContent);
  }

  const frontPageContent = getFrontPageContent(ui);

  return (
    <div className="recommendations-container">
      <div>
        {frontPageContent?.map((content, i) => (
          <Control key={i} content={content} />
        ))}
      </div>
      <div className="recommendations-footer">
        <Button onClick={() => setIsEditing(true)}>
          <FormattedMessage id={"actions.customise"} />
        </Button>
      </div>
      
      {/* Scene Category Counts */}
      {statsData && (topTag && bottomTag && oralTopTag && oralBottomTag && soloTag) && (
        <div className="col col-sm-8 m-sm-auto row stats mt-4">
          <div className="stats-element">
            <p className="title">
              <Button 
                className="stats-category-button sex-stats-button"
                href={topTag && bottomTag ? NavUtils.makeGlobalSexScenesUrl(topTag.id, topTag.name, bottomTag.id, bottomTag.name) : "#"}
                disabled={!topTag || !bottomTag || statsData.stats.sex_scene_count === 0}
              >
                <img src={gaySvg} alt="Sex" className="stats-category-icon" />
                <span className="ml-2"><FormattedNumber value={statsData.stats.sex_scene_count} /></span>
              </Button>
            </p>
          </div>
          <div className="stats-element">
            <p className="title">
              <Button 
                className="stats-category-button oral-stats-button"
                href={oralTopTag && oralBottomTag && topTag && bottomTag ? NavUtils.makeGlobalOralScenesUrl(
                  oralTopTag.id, oralTopTag.name, oralBottomTag.id, oralBottomTag.name,
                  topTag.id, topTag.name, bottomTag.id, bottomTag.name
                ) : "#"}
                disabled={!oralTopTag || !oralBottomTag || !topTag || !bottomTag || statsData.stats.oral_scene_count === 0}
              >
                <img src={mouthSvg} alt="Oral" className="stats-category-icon" />
                <span className="ml-2"><FormattedNumber value={statsData.stats.oral_scene_count} /></span>
              </Button>
            </p>
          </div>
          <div className="stats-element">
            <p className="title">
              <Button 
                className="stats-category-button solo-stats-button"
                href={soloTag && topTag && bottomTag && oralTopTag && oralBottomTag ? NavUtils.makeGlobalSoloScenesUrl(
                  soloTag.id, soloTag.name,
                  topTag.id, topTag.name, bottomTag.id, bottomTag.name,
                  oralTopTag.id, oralTopTag.name, oralBottomTag.id, oralBottomTag.name
                ) : "#"}
                disabled={!soloTag || !topTag || !bottomTag || !oralTopTag || !oralBottomTag || statsData.stats.solo_scene_count === 0}
              >
                <Icon icon={faHand} className="stats-category-icon-fa" />
                <span className="ml-2"><FormattedNumber value={statsData.stats.solo_scene_count} /></span>
              </Button>
            </p>
          </div>
          {(facialGivenTag || facialReceivedTag || selfFacialTag) ? (
            <div className="stats-element">
              <p className="title">
                <Button
                  className="stats-category-button facial-stats-button ml-4"
                  href={NavUtils.makeGlobalFacialScenesUrl(
                    (facialGivenTag ?? selfFacialTag)!.id,
                    (facialGivenTag ?? selfFacialTag)!.name,
                    (facialReceivedTag ?? selfFacialTag)!.id,
                    (facialReceivedTag ?? selfFacialTag)!.name,
                    selfFacialTag?.id,
                    selfFacialTag?.name
                  )}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  disabled={(statsData as any).stats.facial_scene_count === 0}
                >
                  <img src={goateeSvg} alt="Facial" className="stats-category-icon" />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <span className="ml-2"><FormattedNumber value={(statsData as any).stats.facial_scene_count ?? (statsData as any).stats.facialSceneCount ?? 0} /></span>
                </Button>
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
});

export default FrontPage;
