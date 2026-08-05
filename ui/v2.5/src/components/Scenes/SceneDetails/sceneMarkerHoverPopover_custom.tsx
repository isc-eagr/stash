import React, { useMemo } from "react";
import cx from "classnames";
import { Badge } from "react-bootstrap";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import { Icon } from "src/components/Shared/Icon";
import { getRatingCardClass } from "src/utils/ratingCardStyles_custom";
import { useConfigurationContext } from "src/hooks/Config";
import {
  getChronologicalSceneMarkerHighlightPerformerOrgasmRank,
  getChronologicalSceneMarkerHighlightPerformers,
  type ISceneMarkerChronologyHighlightGroup,
  type ISceneMarkerChronologyHighlightPerformer,
  type ISceneMarkerChronologySearchMarker,
} from "./sceneMarkerChronologySearch_custom";
import { isChronologicalSceneMarkerGoatTagged } from "./sceneMarkerChronologyLayout_custom";

export type MarkerRatingCardClassGetter = (
  marker: Pick<GQL.SceneMarkerDataFragment, "primary_tag" | "tags">
) => string;

type SceneMarkerHoverPerformer = {
  id: string;
  name?: string | null;
  image_path?: string | null;
};

type SceneMarkerHoverMarker = ISceneMarkerChronologySearchMarker & {
  top_performers?: SceneMarkerHoverPerformer[];
  bottom_performers?: SceneMarkerHoverPerformer[];
};

export function useSceneMarkerRatingCardClassGetter() {
  const { configuration } = useConfigurationContext();

  return useMemo<MarkerRatingCardClassGetter>(
    () => (marker) => {
      const goatTagId = configuration?.ui.roleTagIds?.goatTagId;
      const directMarkerTags = [marker.primary_tag, ...marker.tags];
      const markerTags =
        goatTagId && isChronologicalSceneMarkerGoatTagged(marker, goatTagId)
          ? [...directMarkerTags, { id: goatTagId }]
          : directMarkerTags;

      return getRatingCardClass({
        tags: markerTags,
        goatTagId,
        theme: configuration?.ui.ratingCardTheme,
        thresholds: configuration?.ui.ratingCardThresholds,
        overrideTagIds: configuration?.ui.ratingCardOverrideTagIds,
      });
    },
    [
      configuration?.ui.ratingCardOverrideTagIds,
      configuration?.ui.ratingCardTheme,
      configuration?.ui.ratingCardThresholds,
      configuration?.ui.roleTagIds?.goatTagId,
    ]
  );
}

export const ActivityTypePerformerTile: React.FC<{
  performer: SceneMarkerHoverPerformer;
  role?: "Top" | "Bottom";
  className?: string;
  title?: string;
  children?: React.ReactNode;
}> = ({ performer, role, className, title, children }) => (
  <div
    key={`${role ?? "performer"}-${performer.id}`}
    className={cx(
      "scene-marker-activity-performer",
      role && `scene-marker-activity-performer-${role.toLowerCase()}`,
      className
    )}
    title={
      title ??
      (role ? `${role}: ${performer.name}` : performer.name ?? undefined)
    }
  >
    <div className="scene-marker-activity-performer-image">
      {performer.image_path ? (
        <img src={performer.image_path} alt={performer.name ?? ""} />
      ) : (
        <Icon icon={faUser} />
      )}
    </div>
    <div className="scene-marker-activity-performer-name">{performer.name}</div>
    {children}
  </div>
);

export const HighlightPerformerTagPills = <
  M extends ISceneMarkerChronologySearchMarker
>({
  performer,
}: {
  performer: ISceneMarkerChronologyHighlightPerformer<M>;
}) => (
  <div className="scene-marker-highlight-performer-tags">
    {performer.topTags.map((tag) => (
      <Badge
        key={`top-${tag.id}`}
        variant="secondary"
        className={cx(
          "tag-badge scene-marker-highlight-tag-top",
          performer.topOverlapTagIDs.has(tag.id) &&
            "scene-marker-highlight-tag-overlap"
        )}
      >
        {tag.name}
      </Badge>
    ))}
    {performer.bottomTags.map((tag) => (
      <Badge
        key={`bottom-${tag.id}`}
        variant="secondary"
        className={cx(
          "tag-badge scene-marker-highlight-tag-bottom",
          performer.bottomOverlapTagIDs.has(tag.id) &&
            "scene-marker-highlight-tag-overlap"
        )}
      >
        {tag.name}
      </Badge>
    ))}
  </div>
);

export const SceneMarkerHighlightPerformersPopover = <
  M extends SceneMarkerHoverMarker
>({
  group,
  orgasmTagId,
  getMarkerRatingCardClass,
}: {
  group: ISceneMarkerChronologyHighlightGroup<M>;
  orgasmTagId?: string;
  getMarkerRatingCardClass: (marker: M) => string;
}) => {
  const displayPerformers = group.performers
    .map((performer, index) => ({ performer, index }))
    .sort(
      (a, b) =>
        getChronologicalSceneMarkerHighlightPerformerOrgasmRank(
          a.performer,
          orgasmTagId
        ) -
          getChronologicalSceneMarkerHighlightPerformerOrgasmRank(
            b.performer,
            orgasmTagId
          ) || a.index - b.index
    )
    .map(({ performer }) => performer);
  const ratingClass = group.markers
    .map((marker) => getMarkerRatingCardClass(marker))
    .find(Boolean);

  return (
    <div className={cx("scene-marker-highlight-popover-card", ratingClass)}>
      {displayPerformers.length > 0 ? (
        <div className="scene-marker-activity-config-performers">
          {displayPerformers.map((performer) => (
            <ActivityTypePerformerTile
              key={performer.performer.id}
              performer={performer.performer}
              className="scene-marker-highlight-performer"
            >
              <HighlightPerformerTagPills performer={performer} />
            </ActivityTypePerformerTile>
          ))}
        </div>
      ) : (
        <div className="scene-marker-activity-config-empty">No performers</div>
      )}
    </div>
  );
};

export function getSceneMarkerHoverGroup<M extends SceneMarkerHoverMarker>(
  marker: M,
  allMarkers: M[]
): ISceneMarkerChronologyHighlightGroup<M> {
  const performers = getChronologicalSceneMarkerHighlightPerformers(
    marker,
    allMarkers
  );

  return {
    key: marker.id,
    performers,
    markers: [marker],
    segments: [
      {
        key: marker.id,
        seconds: marker.seconds,
        end_seconds: marker.end_seconds ?? marker.seconds,
        markers: [marker],
        representativeMarker: marker,
      },
    ],
  };
}
