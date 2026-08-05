import { PatchComponent } from "src/patch";
import { Button, ButtonGroup } from "react-bootstrap";
import React from "react";
import { Link } from "react-router-dom";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import { FormattedMessage } from "react-intl";
import { TruncatedText } from "../Shared/TruncatedText";
import { GridCard } from "../Shared/GridCard/GridCard";
import { PopoverCountButton } from "../Shared/PopoverCountButton";
import { Icon } from "../Shared/Icon";
import { faHeart } from "@fortawesome/free-solid-svg-icons";
import cx from "classnames";
import { useTagUpdate } from "src/core/StashService";
import { gql, useQuery } from "@apollo/client"; // CUSTOM
import { SortMetricBadgeCustom } from "../Shared/SortMetricBadge_custom"; // CUSTOM
import { getTagSortMetricCustom } from "./tagSortMetric_custom"; // CUSTOM
import {
  catalogCardSortHighlightClassCustom,
  isCatalogCardSortHighlightedCustom,
} from "../Shared/catalogCardSortHighlight_custom"; // CUSTOM

interface IProps {
  tag: GQL.TagDataFragment | GQL.TagListDataFragment;
  cardWidth?: number;
  zoomIndex: number;
  selecting?: boolean;
  selected?: boolean;
  onSelectedChanged?: (selected: boolean, shiftKey: boolean) => void;
  // CUSTOM: begin - extra TagCard props
  // when true only render the scene-count popover/button
  sceneCountOnly?: boolean;
  // optional performer context - when provided scene links use scene markers
  performerId?: string;
  performerName?: string;
  activeSortBy?: string;
  activeSortDirection?: GQL.SortDirectionEnum;
  activeSortValue?: string | null;
  // CUSTOM: end
}

type SceneOCountByTag = {
  tag_id: string;
  count: number;
};

// CUSTOM: begin - GQL query + hook for scene marker count by tag
// Query to count scene markers with this tag (represents performer associations via scene_marker_performers)
const COUNT_MARKERS_BY_TAG = gql`
  query CountMarkersByTag($scene_marker_filter: SceneMarkerFilterType) {
    findSceneMarkers(scene_marker_filter: $scene_marker_filter) {
      count
    }
  }
`;

const SCENE_O_COUNTS_BY_TAG = gql`
  query TagCardSceneOCountsByTag {
    sceneOCountsByTag {
      tag_id
      count
    }
  }
`;

function useSceneMarkerCountByTag(tagId?: string) {
  const skip = !tagId;
  const { data } = useQuery(COUNT_MARKERS_BY_TAG, {
    skip,
    variables: {
      scene_marker_filter: {
        tags: {
          value: tagId ? [tagId] : [],
          modifier: GQL.CriterionModifier.Includes,
          depth: 0,
        },
        has_marker_performers: true,
      },
    },
    fetchPolicy: "cache-first",
  });

  return data?.findSceneMarkers?.count ?? 0;
}

function useSceneOCountByTag(tagId?: string) {
  const { data } = useQuery<{ sceneOCountsByTag: SceneOCountByTag[] }>(
    SCENE_O_COUNTS_BY_TAG,
    {
      fetchPolicy: "cache-first",
    }
  );

  if (!tagId) {
    return 0;
  }

  return (
    data?.sceneOCountsByTag.find((item) => item.tag_id === tagId)?.count ?? 0
  );
}
// CUSTOM: end

const TagCardPopovers: React.FC<IProps> = PatchComponent(
  "TagCard.Popovers",
  ({ tag, sceneCountOnly, performerId, performerName, activeSortBy }) => {
    // CUSTOM: extra destructured props
    // CUSTOM: begin - scene marker count + sceneCountOnly early return
    // count scene markers with this tag that have performers assigned
    const sceneMarkerCount = useSceneMarkerCountByTag(tag.id);
    const sceneOCount = useSceneOCountByTag(tag.id);
    if (sceneCountOnly) {
      return (
        <>
          <hr />
          <ButtonGroup className="card-popovers">
            <PopoverCountButton
              className={cx(
                "scene-count",
                catalogCardSortHighlightClassCustom(
                  activeSortBy,
                  "scenes_count"
                )
              )} // CUSTOM
              type="scene"
              count={tag.scene_count}
              url={NavUtils.makeTagScenesUrl(
                tag,
                performerId
                  ? { id: performerId, name: performerName }
                  : undefined
              )}
              showZero={isCatalogCardSortHighlightedCustom(
                activeSortBy,
                "scenes_count"
              )} // CUSTOM
            />
          </ButtonGroup>
        </>
      );
    }
    // CUSTOM: end

    return (
      <>
        <hr />
        <ButtonGroup className="card-popovers">
          <PopoverCountButton
            className={cx(
              "scene-count",
              catalogCardSortHighlightClassCustom(activeSortBy, "scenes_count")
            )} // CUSTOM
            type="scene"
            count={tag.scene_count}
            // CUSTOM: begin - performer context in URL
            url={NavUtils.makeTagScenesUrl(
              tag,
              performerId ? { id: performerId, name: performerName } : undefined
            )}
            // CUSTOM: end
            showZero={isCatalogCardSortHighlightedCustom(
              activeSortBy,
              "scenes_count"
            )} // CUSTOM
          />
          <PopoverCountButton
            className={cx(
              "image-count",
              catalogCardSortHighlightClassCustom(activeSortBy, "images_count")
            )} // CUSTOM
            type="image"
            count={tag.image_count}
            url={NavUtils.makeTagImagesUrl(tag)}
            showZero={isCatalogCardSortHighlightedCustom(
              activeSortBy,
              "images_count"
            )} // CUSTOM
          />
          <PopoverCountButton
            className={cx(
              "gallery-count",
              catalogCardSortHighlightClassCustom(
                activeSortBy,
                "galleries_count"
              )
            )} // CUSTOM
            type="gallery"
            count={tag.gallery_count}
            url={NavUtils.makeTagGalleriesUrl(tag)}
            showZero={isCatalogCardSortHighlightedCustom(
              activeSortBy,
              "galleries_count"
            )} // CUSTOM
          />
          <PopoverCountButton
            className={cx(
              "group-count",
              catalogCardSortHighlightClassCustom(activeSortBy, "groups_count")
            )} // CUSTOM
            type="group"
            count={tag.group_count}
            url={NavUtils.makeTagGroupsUrl(tag)}
            showZero={isCatalogCardSortHighlightedCustom(
              activeSortBy,
              "groups_count"
            )} // CUSTOM
          />
          <PopoverCountButton
            className={cx(
              "marker-count",
              catalogCardSortHighlightClassCustom(
                activeSortBy,
                "scene_markers_count"
              )
            )} // CUSTOM
            type="marker"
            count={tag.scene_marker_count}
            url={NavUtils.makeTagSceneMarkersUrl(tag)}
            showZero={isCatalogCardSortHighlightedCustom(
              activeSortBy,
              "scene_markers_count"
            )} // CUSTOM
          />
          <PopoverCountButton
            className="o-count"
            type="o_count"
            count={sceneOCount}
            url={`/ostats/tag/${tag.id}`}
            showZero={false}
          />
          <PopoverCountButton
            className={cx(
              "performer-count",
              catalogCardSortHighlightClassCustom(
                activeSortBy,
                "performers_count"
              )
            )} // CUSTOM
            type="performer"
            count={tag.performer_count}
            url={NavUtils.makeTagPerformersUrl(tag)}
            showZero={isCatalogCardSortHighlightedCustom(
              activeSortBy,
              "performers_count"
            )} // CUSTOM
          />
          {/* CUSTOM: begin - performer-green scene marker count */}
          {/* Scene markers with this tag that have performers */}
          <PopoverCountButton
            className="performer-count performer-green"
            type="marker"
            count={sceneMarkerCount}
            url={NavUtils.makeTagPerformersBySceneTagsUrl(tag)}
            showZero={false}
          />
          {/* CUSTOM: end */}
          <PopoverCountButton
            className={cx(
              "studio-count",
              catalogCardSortHighlightClassCustom(activeSortBy, "studios_count")
            )} // CUSTOM
            type="studio"
            count={tag.studio_count}
            url={NavUtils.makeTagStudiosUrl(tag)}
            showZero={isCatalogCardSortHighlightedCustom(
              activeSortBy,
              "studios_count"
            )} // CUSTOM
          />
        </ButtonGroup>
      </>
    );
  }
);

const TagCardOverlays: React.FC<IProps> = PatchComponent(
  "TagCard.Overlays",
  ({ tag }) => {
    const [updateTag] = useTagUpdate();

    function renderFavoriteIcon() {
      return (
        <Link to="" onClick={(e) => e.preventDefault()}>
          <Button
            className={cx(
              "minimal",
              "mousetrap",
              "favorite-button",
              tag.favorite ? "favorite" : "not-favorite"
            )}
            onClick={() => onToggleFavorite!(!tag.favorite)}
          >
            <Icon icon={faHeart} size="2x" />
          </Button>
        </Link>
      );
    }

    function onToggleFavorite(v: boolean) {
      if (tag.id) {
        updateTag({
          variables: {
            input: {
              id: tag.id,
              favorite: v,
            },
          },
        });
      }
    }

    return <>{renderFavoriteIcon()}</>;
  }
);

const TagCardDetails: React.FC<IProps> = PatchComponent(
  "TagCard.Details",
  ({
    tag,
    sceneCountOnly,
    activeSortBy,
    activeSortDirection,
    activeSortValue,
  }) => {
    const sortDirection = activeSortDirection ?? GQL.SortDirectionEnum.Asc; // CUSTOM
    const sortMetric = getTagSortMetricCustom(
      activeSortBy,
      tag,
      activeSortValue
    ); // CUSTOM
    const embeddedSortMetric = isCatalogCardSortHighlightedCustom(
      activeSortBy,
      ...(sceneCountOnly
        ? ["scenes_count"]
        : [
            "galleries_count",
            "images_count",
            "performers_count",
            "scenes_count",
            "groups_count",
            "scene_markers_count",
            "studios_count",
          ])
    ); // CUSTOM
    function maybeRenderDescription() {
      if (tag.description) {
        return (
          <TruncatedText
            className="tag-description"
            text={tag.description}
            lineCount={3}
          />
        );
      }
    }

    function maybeRenderParents() {
      if (tag.parents.length === 1) {
        const parent = tag.parents[0];
        return (
          <div className="tag-parent-tags">
            <FormattedMessage
              id="sub_tag_of"
              values={{
                parent: <Link to={`/tags/${parent.id}`}>{parent.name}</Link>,
              }}
            />
          </div>
        );
      }

      if (tag.parents.length > 1) {
        return (
          <div className="tag-parent-tags">
            <FormattedMessage
              id="sub_tag_of"
              values={{
                parent: (
                  <Link to={NavUtils.makeParentTagsUrl(tag)}>
                    {tag.parents.length}&nbsp;
                    <FormattedMessage
                      id="countables.tags"
                      values={{ count: tag.parents.length }}
                    />
                  </Link>
                ),
              }}
            />
          </div>
        );
      }
    }

    function maybeRenderChildren() {
      if (tag.children.length > 0) {
        return (
          <div className="tag-sub-tags">
            <FormattedMessage
              id="parent_of"
              values={{
                children: (
                  <Link to={NavUtils.makeChildTagsUrl(tag)}>
                    {tag.children.length}&nbsp;
                    <FormattedMessage
                      id="countables.tags"
                      values={{ count: tag.children.length }}
                    />
                  </Link>
                ),
              }}
            />
          </div>
        );
      }
    }

    return (
      <>
        <SortMetricBadgeCustom
          metric={embeddedSortMetric ? undefined : sortMetric}
          sortDirection={sortDirection}
        />
        {maybeRenderDescription()}
        {maybeRenderParents()}
        {maybeRenderChildren()}
      </>
    );
  }
);

const TagCardImage: React.FC<IProps> = PatchComponent(
  "TagCard.Image",
  ({ tag }) => {
    return (
      <>
        <img
          loading="lazy"
          className="tag-card-image"
          alt={tag.name}
          src={tag.image_path ?? ""}
        />
      </>
    );
  }
);

const TagCardTitle: React.FC<IProps> = PatchComponent(
  "TagCard.Title",
  ({ tag }) => {
    return <>{tag.name ?? ""}</>;
  }
);

export const TagCard: React.FC<IProps> = PatchComponent("TagCard", (props) => {
  const { tag, cardWidth, zoomIndex, selecting, selected, onSelectedChanged } =
    props;

  return (
    <GridCard
      className={`tag-card zoom-${zoomIndex}`}
      url={`/tags/${tag.id}`}
      width={cardWidth}
      title={<TagCardTitle {...props} />}
      linkClassName="tag-card-header"
      image={<TagCardImage {...props} />}
      details={<TagCardDetails {...props} />}
      overlays={<TagCardOverlays {...props} />}
      popovers={<TagCardPopovers {...props} />}
      selected={selected}
      selecting={selecting}
      onSelectedChanged={onSelectedChanged}
    />
  );
});
