import React, { useMemo } from "react";
import { Button, ButtonGroup } from "react-bootstrap";
import * as GQL from "src/core/generated-graphql";
import { PatchComponent } from "src/patch";
import { GridCard } from "../Shared/GridCard/GridCard";
import { HoverPopover } from "../Shared/HoverPopover";
import { Icon } from "../Shared/Icon";
import { SceneLink, TagLink } from "../Shared/TagLink";
import { TruncatedText } from "../Shared/TruncatedText";
import { FormattedMessage } from "react-intl";
import { RatingBanner } from "../Shared/RatingBanner";
import { faPlayCircle, faTag } from "@fortawesome/free-solid-svg-icons";
import { RelatedGroupPopoverButton } from "./RelatedGroupPopover";
import { OCounterButton } from "../Shared/CountButton";
import cx from "classnames"; // CUSTOM
import { useConfigurationContext } from "src/hooks/Config"; // CUSTOM
import {
  getRatingCardClass,
  isRatingCardHomePage,
} from "src/utils/ratingCardStyles_custom"; // CUSTOM
import { SortMetricBadgeCustom } from "../Shared/SortMetricBadge_custom"; // CUSTOM
import { getGroupSortMetricCustom } from "./groupSortMetric_custom"; // CUSTOM
import {
  catalogCardSortHighlightClassCustom,
  hasCatalogCardSortValueCustom,
  isCatalogCardSortHighlightedCustom,
} from "../Shared/catalogCardSortHighlight_custom"; // CUSTOM

const Description: React.FC<{
  sceneNumber?: number;
  description?: string;
}> = ({ sceneNumber, description }) => {
  if (!sceneNumber && !description) return null;

  return (
    <>
      <hr />
      {sceneNumber !== undefined && (
        <span className="group-scene-number">
          <FormattedMessage id="scene" /> #{sceneNumber}
        </span>
      )}
      {description !== undefined && (
        <span className="group-containing-group-description">
          {description}
        </span>
      )}
    </>
  );
};

interface IProps {
  group: GQL.ListGroupDataFragment;
  cardWidth?: number;
  sceneNumber?: number;
  selecting?: boolean;
  selected?: boolean;
  zoomIndex?: number;
  onSelectedChanged?: (selected: boolean, shiftKey: boolean) => void;
  fromGroupId?: string;
  onMove?: (srcIds: string[], targetId: string, after: boolean) => void;
  activeSortBy?: string; // CUSTOM
  activeSortDirection?: GQL.SortDirectionEnum; // CUSTOM
  activeSortValue?: string | null; // CUSTOM
}

export const GroupCard: React.FC<IProps> = PatchComponent(
  "GroupCard",
  ({
    group,
    sceneNumber,
    cardWidth,
    selecting,
    selected,
    zoomIndex,
    onSelectedChanged,
    fromGroupId,
    onMove,
    activeSortBy,
    activeSortDirection,
    activeSortValue,
  }) => {
    // CUSTOM: begin - premium/classic rating card styling
    const { configuration } = useConfigurationContext();
    const ratingCardTheme = configuration?.ui?.ratingCardTheme;
    const goatTagId = configuration?.ui?.roleTagIds?.goatTagId;
    const ratingCardClass = getRatingCardClass({
      rating: group.rating100,
      tags: group.tags,
      goatTagId,
      theme: ratingCardTheme,
      thresholds: configuration?.ui?.ratingCardThresholds,
      overrideTagIds: configuration?.ui?.ratingCardOverrideTagIds,
      disabled: isRatingCardHomePage(),
    });
    // CUSTOM: end

    const groupDescription = useMemo(() => {
      if (!fromGroupId) {
        return undefined;
      }

      const containingGroup = group.containing_groups.find(
        (cg) => cg.group.id === fromGroupId
      );

      return containingGroup?.description ?? undefined;
    }, [fromGroupId, group.containing_groups]);
    const sortDirection = activeSortDirection ?? GQL.SortDirectionEnum.Asc; // CUSTOM
    const sortMetric = getGroupSortMetricCustom(
      activeSortBy,
      group,
      activeSortValue
    ); // CUSTOM
    const embeddedSortMetric =
      isCatalogCardSortHighlightedCustom(
        activeSortBy,
        "tag_count",
        "scenes_count",
        "o_counter"
      ) ||
      (isCatalogCardSortHighlightedCustom(activeSortBy, "date") &&
        hasCatalogCardSortValueCustom(group.date)) ||
      (isCatalogCardSortHighlightedCustom(activeSortBy, "rating") &&
        hasCatalogCardSortValueCustom(group.rating100)); // CUSTOM

    function maybeRenderScenesPopoverButton() {
      const highlighted = isCatalogCardSortHighlightedCustom(
        activeSortBy,
        "scenes_count"
      );
      if (group.scenes.length === 0 && !highlighted) return;

      const popoverContent = group.scenes.map((scene) => (
        <SceneLink key={scene.id} scene={scene} />
      ));

      return (
        <HoverPopover
          className={cx(
            "scene-count",
            catalogCardSortHighlightClassCustom(activeSortBy, "scenes_count")
          )} // CUSTOM
          placement="bottom"
          content={popoverContent}
        >
          <Button className="minimal">
            <Icon icon={faPlayCircle} />
            <span>{group.scene_count}</span> {/* CUSTOM: exact sort value */}
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderTagPopoverButton() {
      const highlighted = isCatalogCardSortHighlightedCustom(
        activeSortBy,
        "tag_count"
      );
      if (group.tags.length <= 0 && !highlighted) return;

      const popoverContent = group.tags.map((tag) => (
        <TagLink key={tag.id} linkType="group" tag={tag} />
      ));

      return (
        <HoverPopover placement="bottom" content={popoverContent}>
          <Button
            className={cx(
              "minimal tag-count",
              catalogCardSortHighlightClassCustom(activeSortBy, "tag_count")
            )}
          >
            <Icon icon={faTag} />
            <span>{group.tags.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    function maybeRenderOCounter() {
      const highlighted = isCatalogCardSortHighlightedCustom(
        activeSortBy,
        "o_counter"
      );
      if (!group.o_counter && !highlighted) return;

      return (
        <OCounterButton
          className={catalogCardSortHighlightClassCustom(
            activeSortBy,
            "o_counter"
          )}
          value={group.o_counter ?? 0}
        />
      );
    }

    function maybeRenderPopoverButtonGroup() {
      if (
        sceneNumber ||
        groupDescription ||
        group.scenes.length > 0 ||
        group.tags.length > 0 ||
        group.o_counter || // CUSTOM
        group.containing_groups.length > 0 ||
        group.sub_group_count > 0 ||
        isCatalogCardSortHighlightedCustom(
          activeSortBy,
          "tag_count",
          "scenes_count",
          "o_counter"
        ) // CUSTOM
      ) {
        return (
          <>
            <Description
              sceneNumber={sceneNumber}
              description={groupDescription}
            />
            <hr />
            <ButtonGroup className="card-popovers">
              {maybeRenderScenesPopoverButton()}
              {maybeRenderTagPopoverButton()}
              {(group.sub_group_count > 0 ||
                group.containing_groups.length > 0) && (
                <RelatedGroupPopoverButton group={group} />
              )}
              {maybeRenderOCounter()}
            </ButtonGroup>
          </>
        );
      }
    }

    return (
      <GridCard
        className={cx("group-card", `zoom-${zoomIndex}`, ratingCardClass)} // CUSTOM
        objectId={group.id}
        onMove={onMove}
        url={`/groups/${group.id}`}
        width={cardWidth}
        title={group.name}
        linkClassName="group-card-header"
        image={
          <>
            <img
              loading="lazy"
              className="group-card-image"
              alt={group.name ?? ""}
              src={group.front_image_path ?? ""}
            />
            <RatingBanner
              rating={group.rating100}
              compact
              className={catalogCardSortHighlightClassCustom(
                activeSortBy,
                "rating"
              )}
            />
          </>
        }
        details={
          <div className="group-card__details">
            <SortMetricBadgeCustom
              metric={embeddedSortMetric ? undefined : sortMetric}
              sortDirection={sortDirection}
            />
            <span
              className={cx(
                "group-card__date",
                hasCatalogCardSortValueCustom(group.date) &&
                  catalogCardSortHighlightClassCustom(activeSortBy, "date")
              )}
            >
              {group.date}
            </span>
            <TruncatedText
              className="group-card__description"
              text={group.synopsis}
              lineCount={3}
            />
          </div>
        }
        selected={selected}
        selecting={selecting}
        onSelectedChanged={onSelectedChanged}
        popovers={maybeRenderPopoverButtonGroup()}
      />
    );
  }
);
