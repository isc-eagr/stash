import React, { useMemo } from "react"; // CUSTOM
import { FormattedMessage, useIntl } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import TextUtils from "src/utils/text";
import { sceneAgeFromDate } from "src/utils/scene";
import { TagLink } from "src/components/Shared/TagLink";
import { PerformerCard } from "src/components/Performers/PerformerCard";
import { sortPerformers } from "src/core/performers";
import { DirectorLink } from "src/components/Shared/Link";
import { CustomFields } from "src/components/Shared/CustomFields";
import { useScenePerformerOverview } from "./ScenePerformerOverviewPanel_custom"; // CUSTOM
import { usePerformerCardRoleStatsState } from "../../Performers/performerRoleStats_custom"; // CUSTOM
import { useConfigurationContext } from "src/hooks/Config"; // CUSTOM
import {
  getScenePerformerRoleSeconds,
  NO_SCENE_PERFORMER_ROLE_SECONDS,
} from "../scenePerformerRoleSeconds_custom"; // CUSTOM

interface ISceneDetailProps {
  scene: GQL.SceneDataFragment;
  ownerIsRelease?: boolean; // CUSTOM: marker roles are queried by scene id
}

export const SceneDetailPanel: React.FC<ISceneDetailProps> = (props) => {
  const intl = useIntl();
  // CUSTOM: Details contains descriptive content; maintenance dates and code live in Edit.
  const performerOverview = useScenePerformerOverview(); // CUSTOM
  const { roleStatsByPerformer } = usePerformerCardRoleStatsState(
    props.scene.performers
  ); // CUSTOM
  // CUSTOM: vato card sex/oral strips use Versatility by Time
  const { configuration } = useConfigurationContext();
  const roleSecondsByPerformer = useMemo(
    () =>
      getScenePerformerRoleSeconds(
        props.scene,
        configuration?.ui?.roleTagIds ?? {}
      ),
    [configuration?.ui?.roleTagIds, props.scene]
  );

  function renderDetails() {
    if (!props.scene.details || props.scene.details === "") return;
    return (
      <>
        <h6>
          <FormattedMessage id="details" />:{" "}
        </h6>
        <p className="pre">{props.scene.details}</p>
      </>
    );
  }

  function renderTags() {
    if (props.scene.tags.length === 0) return;
    const tags = props.scene.tags.map((tag) => (
      <TagLink key={tag.id} tag={tag} />
    ));
    return (
      <>
        <h6>
          <FormattedMessage
            id="countables.tags"
            values={{ count: props.scene.tags.length }}
          />
        </h6>
        {tags}
      </>
    );
  }

  function renderPerformers() {
    if (props.scene.performers.length === 0) return;
    const performers = sortPerformers(props.scene.performers);

    const ageFromDate = sceneAgeFromDate(
      props.scene.production_date,
      props.scene.effective_date ?? props.scene.date // CUSTOM: effective date
    );

    const cards = performers.map((performer) => (
      <PerformerCard
        key={performer.id}
        performer={performer}
        ageFromDate={ageFromDate}
        sceneId={props.scene.id} // CUSTOM
        sceneMarkerRolesSkip={props.ownerIsRelease} // CUSTOM
        scenePerformerCount={performers.length} // CUSTOM
        scenePartnerPerformers={performers} // CUSTOM
        sceneRoleSeconds={
          roleSecondsByPerformer.get(performer.id) ??
          NO_SCENE_PERFORMER_ROLE_SECONDS
        } // CUSTOM
        roleStats={roleStatsByPerformer.get(performer.id)} // CUSTOM: use the batched totals
        onOpenSceneOverview={performerOverview?.openPerformerOverview} // CUSTOM
      />
    ));

    return (
      <>
        <h6>
          <FormattedMessage
            id="countables.performers"
            values={{ count: props.scene.performers.length }}
          />
        </h6>
        <div className="row justify-content-center scene-performers">
          {cards}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="row">
        {/* CUSTOM: descriptive information uses the full row. */}
        <div className="col-12 scene-details">
          {props.scene.production_date && (
            <h6>
              <FormattedMessage id="production_date" />:{" "}
              {/* fuzzy, so that a year- or month-only production date isn't
                  rendered as the first of the month */}
              {TextUtils.formatFuzzyDate(intl, props.scene.production_date)}
            </h6>
          )}
          {props.scene.director && (
            <h6>
              <FormattedMessage id="director" />:{" "}
              <DirectorLink director={props.scene.director} linkType="scene" />
            </h6>
          )}
        </div>
      </div>
      <div className="row">
        <div className="col-12">
          {renderDetails()}
          {renderTags()}
          {renderPerformers()}
          <CustomFields values={props.scene.custom_fields} fullWidth />
        </div>
      </div>
    </>
  );
};

export default SceneDetailPanel;
