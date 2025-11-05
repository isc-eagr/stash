import React, { useContext, useMemo } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import TextUtils from "src/utils/text";
import { TagLink } from "src/components/Shared/TagLink";
import { PerformerCard } from "src/components/Performers/PerformerCard";
import { sortPerformers } from "src/core/performers";
import { DirectorLink } from "src/components/Shared/Link";
import { ConfigurationContext } from "src/hooks/Config";

interface ISceneDetailProps {
  scene: GQL.SceneDataFragment;
}

export const SceneDetailPanel: React.FC<ISceneDetailProps> = (props) => {
  const intl = useIntl();
  const { configuration } = useContext(ConfigurationContext);

  // Determine if the scene has any explicit Top/Bottom tags among any performers.
  // This is used to suppress oral-based fallback icons for other performers without explicit roles.
  const sceneHasExplicitTopBottom = useMemo(() => {
    const cfg = configuration?.ui?.sceneTagAliases ?? {};
    const tagTop = (cfg.top ?? "top").toLowerCase();
    const tagBottom = (cfg.bottom ?? "bottom").toLowerCase();
    for (const p of props.scene.performers) {
      const sceneTags = (p as unknown as { scene_tags?: Array<{ id: string; name?: string | null }> }).scene_tags ?? [];
      for (const t of sceneTags) {
        const name = (t?.name ?? "").trim().toLowerCase();
        if (name === tagTop || name === tagBottom) return true;
      }
    }
    return false;
  }, [props.scene.performers, configuration?.ui]);

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

    // sceneHasExplicitTopBottom is computed at component level
    const cards = performers.map((performer) => (
      <PerformerCard
        key={performer.id}
        performer={performer}
        ageFromDate={props.scene.date ?? undefined}
        showInlineTags={true}
        showTagCounts={false}
        sceneHasExplicitTopBottom={sceneHasExplicitTopBottom}
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

  // filename should use entire row if there is no studio
  const sceneDetailsWidth = props.scene.studio ? "col-9" : "col-12";

  return (
    <>
      <div className="row">
        <div className={`${sceneDetailsWidth} col-12 scene-details`}>
          <h6>
            <FormattedMessage id="created_at" />:{" "}
            {TextUtils.formatDateTime(intl, props.scene.created_at)}{" "}
          </h6>
          <h6>
            <FormattedMessage id="updated_at" />:{" "}
            {TextUtils.formatDateTime(intl, props.scene.updated_at)}{" "}
          </h6>
          {props.scene.code && (
            <h6>
              <FormattedMessage id="scene_code" />: {props.scene.code}{" "}
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
        </div>
      </div>
    </>
  );
};

export default SceneDetailPanel;
