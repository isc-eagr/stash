import React, { useMemo, useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { Link, useParams } from "react-router-dom";
import { useIntl } from "react-intl";
import * as GQL from "src/core/generated-graphql";
import NavUtils from "src/utils/navigation";
import TextUtils from "src/utils/text";
import { GridCard } from "../Shared/GridCard/GridCard";
import { CountryFlag } from "../Shared/CountryFlag";
import { SweatDrops } from "../Shared/SweatDrops";
import { HoverPopover } from "../Shared/HoverPopover";
import { Icon } from "../Shared/Icon";
import { TagLink } from "../Shared/TagLink";
import { Button, ButtonGroup, Modal, Badge, OverlayTrigger, Tooltip } from "react-bootstrap";
import {
  ModifierCriterion,
  CriterionValue,
} from "src/models/list-filter/criteria/criterion";
import { PopoverCountButton } from "../Shared/PopoverCountButton";
import GenderIcon from "./GenderIcon";
import { faTag, faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons";
import { RatingBanner } from "../Shared/RatingBanner";
import { usePerformerUpdate, getClient } from "src/core/StashService";
import { useTagsEdit } from "src/hooks/tagsEdit";
import { useToast } from "src/hooks/Toast";
import { ILabeledId } from "src/models/list-filter/types";
import { FavoriteIcon } from "../Shared/FavoriteIcon";
import { PatchComponent } from "src/patch";

export interface IPerformerCardExtraCriteria {
  scenes?: ModifierCriterion<CriterionValue>[];
  images?: ModifierCriterion<CriterionValue>[];
  galleries?: ModifierCriterion<CriterionValue>[];
  groups?: ModifierCriterion<CriterionValue>[];
  performer?: ILabeledId;
}

interface IPerformerCardProps {
  performer: GQL.PerformerDataFragment;
  cardWidth?: number;
  ageFromDate?: string;
  selecting?: boolean;
  selected?: boolean;
  zoomIndex?: number;
  onSelectedChanged?: (selected: boolean, shiftKey: boolean) => void;
  extraCriteria?: IPerformerCardExtraCriteria;
  // optional: show a compact tag button in the card which will open the tag editor
  showTagButton?: boolean;
  onOpenTagEditor?: (performer: GQL.PerformerDataFragment) => void;
  // optional: show an inline tag editor below the performer card
  showInlineTags?: boolean;
  // optional: show counts next to tags in inline tag strip and tooltip (default: true)
  showTagCounts?: boolean;
}

type TagRef = { id: string; name?: string | null };

// Inline tag editor component rendered beneath a performer card when requested
const PerformerTagEditor: React.FC<{
  performer: GQL.PerformerDataFragment;
  onSaved?: () => void;
}> = ({ performer, onSaved }) => {
  const [updatePerformer] = usePerformerUpdate();
  const params = useParams<{ id?: string; sceneId?: string }>();
  const sceneId = params?.sceneId ?? params?.id;
  // Map lightweight TagRef into the Tag shape expected by useTagsEdit.
  // Memoize to avoid recreating array each render, which would reset TagSelect state and break typing
  const initialEditableTags = useMemo(() => {
    const hasSceneTagsField = Object.prototype.hasOwnProperty.call(
      performer as Record<string, unknown>,
      "scene_tags"
    );
    const baseTags: TagRef[] = hasSceneTagsField
      ? ((performer as unknown as { scene_tags?: TagRef[] }).scene_tags ?? [])
      : ((performer.tags as unknown as TagRef[]) ?? []);

    return baseTags.map((t) => ({
      id: t.id,
      name: t.name ?? "",
      sort_name: t.name ?? null,
      aliases: [] as string[],
      image_path: null as string | null,
    }));
  }, [performer]);

  const { tags, tagsControl } = useTagsEdit(
    initialEditableTags,
    // noop - we capture tags via hook state and push on save
    () => {}
  );
  const Toast = useToast();
  const [isSaving, setIsSaving] = useState(false);

  return (
    <div className="performer-tag-editor">
  {tagsControl({ disableHoverPopovers: true })}
      <div className="tag-editor-actions mt-2">
        <Button
          variant="primary"
          disabled={isSaving}
          onClick={async () => {
            if (!performer.id) return;
            setIsSaving(true);
            try {
              if (sceneId) {
                await updatePerformer({
                  variables: {
                    input: {
                      id: performer.id,
                      scene_tags: [
                        {
                          scene_id: sceneId,
                          tag_ids: tags.map((t) => t.id),
                        },
                      ],
                    },
                  },
                });
                try {
                  await getClient().query({
                    query: GQL.FindSceneDocument,
                    variables: { id: sceneId },
                    fetchPolicy: "network-only",
                  });
                } catch (_err) {
                  // ignore refetch failure
                }
              } else {
                await updatePerformer({
                  variables: {
                    input: {
                      id: performer.id,
                      tag_ids: tags.map((t) => t.id),
                    },
                  },
                });
              }

              Toast.success(`Performer tagged: ${performer.name ?? performer.id}`);
              onSaved?.();
            } catch (e: unknown) {
              Toast.error(e as Error);
            } finally {
              setIsSaving(false);
            }
          }}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
};

const PerformerCardPopovers: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard.Popovers",
  ({ performer, extraCriteria }) => {
    const [showTagModal, setShowTagModal] = useState(false);
    function maybeRenderEditButton() {
      // Only show the scene-tags edit button on Scene pages. We detect this
      // by the presence of the `scene_tags` field on the performer fragment
      // (FindScene supplies this). On other pages, don't render the button.
      const hasSceneTagsField = Object.prototype.hasOwnProperty.call(
        performer as Record<string, unknown>,
        "scene_tags"
      );
      if (!hasSceneTagsField) return null;
      const sceneTags: TagRef[] = (
        (performer as unknown as { scene_tags?: TagRef[] }).scene_tags ?? []
      );
      const sceneTagCount = sceneTags.length;

      const editButton = (
        <div>
          <OverlayTrigger
            placement="bottom"
            overlay={
              <Tooltip id={`tt-edit-tags-${performer.id}`}>
                Edit Performer Scene Tags
              </Tooltip>
            }
          >
            <Button
              className="minimal edit-tags"
              onClick={() => setShowTagModal(true)}
              aria-label={`Edit tags for ${performer.name ?? performer.id}`}
            >
              <Icon icon={faTag} />
              {sceneTags && sceneTags.length > 0 ? <span>{sceneTagCount}</span> : null}
            </Button>
          </OverlayTrigger>
        </div>
      );

      // Remove tooltip/popover from the green edit-tags button; return plain button only
      return editButton;
    }
    function maybeRenderScenesPopoverButton() {
      if (!performer.scene_count) return;

      return (
        <PopoverCountButton
          className="scene-count"
          type="scene"
          count={performer.scene_count}
          url={NavUtils.makePerformerScenesUrl(
            performer,
            extraCriteria?.performer,
            extraCriteria?.scenes
          )}
        />
      );
    }

    function maybeRenderImagesPopoverButton() {
      if (!performer.image_count) return;

      return (
        <PopoverCountButton
          className="image-count"
          type="image"
          count={performer.image_count}
          url={NavUtils.makePerformerImagesUrl(
            performer,
            extraCriteria?.performer,
            extraCriteria?.images
          )}
        />
      );
    }

    function maybeRenderGalleriesPopoverButton() {
      if (!performer.gallery_count) return;

      return (
        <PopoverCountButton
          className="gallery-count"
          type="gallery"
          count={performer.gallery_count}
          url={NavUtils.makePerformerGalleriesUrl(
            performer,
            extraCriteria?.performer,
            extraCriteria?.galleries
          )}
        />
      );
    }

    function maybeRenderOCounter() {
      if (!performer.o_counter) return;

      return (
        <div className="o-counter">
          <Button className="minimal">
            <span className="fa-icon">
              <SweatDrops />
            </span>
            <span>{performer.o_counter}</span>
          </Button>
        </div>
      );
    }

    function maybeRenderTagPopoverButton() {
      // Use global performer tags for the hover popover (scene-scoped tags are edited in the modal)
  const displayTags: TagRef[] = (performer.tags as unknown as TagRef[]) ?? [];

      if (!displayTags || displayTags.length <= 0) {
        // no tag-count rendered when there are no tags (original behavior)
        return null;
      }

      const sortedDisplayTags = [...displayTags].sort((a, b) =>
        (a?.name ?? "").localeCompare(b?.name ?? "", undefined, {
          sensitivity: "base",
        })
      );
      
      const popoverContent: JSX.Element[] = sortedDisplayTags.map((tag) => (
        <TagLink
          key={tag.id}
          linkType="performer"
          tag={{ id: tag.id, name: tag.name ?? undefined }}
        />
      ));

      return (
        <HoverPopover placement="bottom" content={popoverContent}>
          <Button className="minimal tag-count">
            <Icon icon={faTag} />
            <span>{displayTags.length}</span>
          </Button>
        </HoverPopover>
      );
    }

    // Removed Performers page green tag navigation button per request.

    function maybeRenderGroupsPopoverButton() {
      if (!performer.group_count) return;

      return (
        <PopoverCountButton
          className="group-count"
          type="group"
          count={performer.group_count}
          url={NavUtils.makePerformerGroupsUrl(
            performer,
            extraCriteria?.performer,
            extraCriteria?.groups
          )}
        />
      );
    }

    const hasAnyPopover = !!(
      performer.scene_count ||
      performer.image_count ||
      performer.gallery_count ||
      performer.tags.length > 0 ||
      performer.o_counter ||
      performer.group_count
    );

    if (hasAnyPopover) {
      return (
        <>
          <hr />
          <ButtonGroup className="card-popovers">
            {maybeRenderEditButton && maybeRenderEditButton()}
            {maybeRenderTagPopoverButton()}
            {maybeRenderScenesPopoverButton()}
            {maybeRenderGroupsPopoverButton()}
            {maybeRenderImagesPopoverButton()}
            {maybeRenderGalleriesPopoverButton()}
            {maybeRenderOCounter()}
            {/* Performers page green tag navigation button removed */}
          </ButtonGroup>
          <Modal
            show={showTagModal}
            onHide={() => setShowTagModal(false)}
            centered
            dialogClassName="scene-tags-modal"
          >
            <Modal.Header closeButton>
              <Modal.Title>Scene Tags for {performer.name ?? performer.id}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="scene-tags-body">
              <PerformerTagEditor performer={performer} onSaved={() => setShowTagModal(false)} />
            </Modal.Body>
          </Modal>
        </>
      );
    }

    // If there are no other popovers, still render a minimal edit button so tags can be edited
    return (
      <>
        <hr />
        <ButtonGroup className="card-popovers">
          {maybeRenderEditButton && maybeRenderEditButton()}
          {/* Performers page green tag navigation button removed */}
        </ButtonGroup>
      </>
    );
  }
);

const PerformerCardOverlays: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard.Overlays",
  ({ performer }) => {
    const [updatePerformer] = usePerformerUpdate();

    // Helper: detect Scene-page presence and role flags
    function getSceneRoleFlags(): {
      hasSceneTagsField: boolean;
      isTop: boolean;
      isBottom: boolean;
    } {
      const hasSceneTagsField = Object.prototype.hasOwnProperty.call(
        performer as Record<string, unknown>,
        "scene_tags"
      );
      if (!hasSceneTagsField)
        return { hasSceneTagsField, isTop: false, isBottom: false };

      const sceneTags: Array<{ id: string; name?: string | null }> = (
        (performer as unknown as {
          scene_tags?: Array<{ id: string; name?: string | null }>;
        }).scene_tags ?? []
      );
      const names = new Set(
        sceneTags
          .map((t) => (t?.name ?? "").trim().toLowerCase())
          .filter((n) => n.length > 0)
      );
      // Primary: use explicit Top/Bottom tags if present
      const explicitTop = names.has("top");
      const explicitBottom = names.has("bottom");
      let isTop = explicitTop;
      let isBottom = explicitBottom;
      // Fallback: only if neither Top nor Bottom are present, map synonyms
      if (!explicitTop && !explicitBottom) {
        if (names.has("dicksucked")) isTop = true; // treat as Top
        if (names.has("suckeddick")) isBottom = true; // treat as Bottom
      }
      return {
        hasSceneTagsField,
        isTop,
        isBottom,
      };
    }

    function onToggleFavorite(v: boolean) {
      if (performer.id) {
        updatePerformer({
          variables: {
            input: {
              id: performer.id,
              favorite: v,
            },
          },
        });
      }
    }

    function maybeRenderRatingBanner() {
      if (!performer.rating100) {
        return;
      }
      return <RatingBanner rating={performer.rating100} />;
    }

    function maybeRenderFlag() {
      if (performer.country) {
        return (
          <Link to={NavUtils.makePerformersCountryUrl(performer)}>
            <CountryFlag
              className="performer-card__country-flag"
              country={performer.country}
              includeOverlay
            />
            <span className="performer-card__country-string">
              {performer.country}
            </span>
          </Link>
        );
      }
    }


    // Scene-page-only role badges (Top/Bottom) derived from scene-scoped tags
    function maybeRenderTopBottomRoleBadges() {
      const { hasSceneTagsField, isTop, isBottom } = getSceneRoleFlags();
      if (!hasSceneTagsField || (!isTop && !isBottom)) return null;

      // Bottom-left corner to avoid conflict with favorite (top-right) and rating banner
      return (
        <div
          className="performer-role-badges"
          style={{
            position: "absolute",
            left: 6,
            bottom: 6,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            zIndex: 2,
            pointerEvents: "none", // let clicks fall through to the card
          }}
        >
          {isTop && (
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip id={`tt-performer-top-${performer.id}`}>Top</Tooltip>}
            >
              <Badge
                pill
                variant="success"
                style={{
                  fontSize: 10,
                  padding: "3px 6px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  pointerEvents: "auto", // re-enable for tooltip hover
                }}
              >
                <Icon icon={faArrowUp} />
              </Badge>
            </OverlayTrigger>
          )}
          {isBottom && (
            <OverlayTrigger
              placement="top"
              overlay={<Tooltip id={`tt-performer-bottom-${performer.id}`}>Bottom</Tooltip>}
            >
              <Badge
                pill
                variant="info"
                style={{
                  fontSize: 10,
                  padding: "3px 6px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  pointerEvents: "auto",
                }}
              >
                <Icon icon={faArrowDown} />
              </Badge>
            </OverlayTrigger>
          )}
        </div>
      );
    }

    return (
      <>
        <FavoriteIcon
          favorite={performer.favorite}
          onToggleFavorite={onToggleFavorite}
          size="2x"
          className="hide-not-favorite"
        />
        {maybeRenderTopBottomRoleBadges()}
        {maybeRenderRatingBanner()}
        {maybeRenderFlag()}
      </>
    );
  }
);
 

// (removed duplicate PerformerTagEditor; hoisted definition above Popovers)
 

const PerformerCardDetails: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard.Details",
  ({ performer, ageFromDate, showTagCounts }) => {
    const intl = useIntl();
    const age = TextUtils.age(
      performer.birthdate,
      ageFromDate ?? performer.death_date
    );
    const ageL10nId = ageFromDate
      ? "media_info.performer_card.age_context"
      : "media_info.performer_card.age";
    const ageL10String = intl.formatMessage({
      id: "years_old",
      defaultMessage: "years old",
    });
    const ageString = intl.formatMessage(
      { id: ageL10nId },
      { age, years_old: ageL10String }
    );

    // Scene tags for this performer within the current scene context (if present)
    const hasSceneTagsField = Object.prototype.hasOwnProperty.call(
      performer as Record<string, unknown>,
      "scene_tags"
    );
    const { data: globalSceneTagsData } = GQL.useFindTagsQuery({
      variables: {
        tag_filter: {
          performer_scene_tags: {
            modifier: GQL.CriterionModifier.IncludesAll,
            value: [performer.id],
          },
        },
        filter: { per_page: 100 },
      },
      skip: hasSceneTagsField, // skip when the scene-specific field is already present
    });

    const globalSceneTags: TagRef[] = ((globalSceneTagsData?.findTags?.tags ?? []) as { id: string; name?: string | null }[])
      .map((t) => ({ id: t.id, name: t.name }));

    const sceneTags: TagRef[] = useMemo(() => {
      return hasSceneTagsField
        ? ((performer as unknown as { scene_tags?: TagRef[] }).scene_tags ?? [])
        : globalSceneTags;
    }, [hasSceneTagsField, globalSceneTags, performer]);

    const uppercaseFirstComparator = (aName: string, bName: string) => {
      const aN = aName ?? "";
      const bN = bName ?? "";
      const isAUpper = !!(
        aN[0] &&
        aN[0] !== aN[0].toLowerCase() &&
        aN[0] === aN[0].toUpperCase()
      );
      const isBUpper = !!(
        bN[0] &&
        bN[0] !== bN[0].toLowerCase() &&
        bN[0] === bN[0].toUpperCase()
      );
      if (isAUpper !== isBUpper) return isAUpper ? -1 : 1;
      const lowerCmp = aN
        .toLowerCase()
        .localeCompare(bN.toLowerCase(), undefined, { sensitivity: "base" });
      if (lowerCmp !== 0) return lowerCmp;
      return aN.localeCompare(bN);
    };

    // Query counts of performer_scene_tags per tag for this performer, limited to the
    // tags we actually render in the strip/tooltip. We then sort by count desc.
    // Hoist the document to avoid re-creation per render.
    const PERFORMER_TAG_SCENE_COUNTS = gql`
      query PerformerTagSceneCounts($performer_id: ID!, $tag_ids: [ID!]!) {
        performerTagSceneCounts(performer_id: $performer_id, tag_ids: $tag_ids) {
          tag_id
          count
        }
      }
    `;

    const tagIds = useMemo(() => sceneTags.map((t) => t.id), [sceneTags]);
    const { data: tagCountData } = useQuery(PERFORMER_TAG_SCENE_COUNTS, {
      variables: { performer_id: performer.id, tag_ids: tagIds },
      // Always fetch counts when there are tags; we'll use them for display even on /scenes
      skip: tagIds.length === 0,
      fetchPolicy: "cache-first",
    });

    const countByTagId: Record<string, number> = useMemo(() => {
      const m: Record<string, number> = {};
      const rows = tagCountData?.performerTagSceneCounts ?? [];
      for (const r of rows as Array<{ tag_id: string; count: number }>) {
        m[r.tag_id] = r.count ?? 0;
      }
      return m;
    }, [tagCountData]);

    const sortedSceneTags = useMemo(() => {
      if (hasSceneTagsField) {
        // On /scenes, revert to alphabetical sorting (no frequency-based order)
        return [...sceneTags].sort((a, b) =>
          uppercaseFirstComparator(a.name ?? "", b.name ?? "")
        );
      }
      // On /performers (global), keep frequency-based sorting
      return [...sceneTags].sort((a, b) => {
        const ca = countByTagId[a.id] ?? 0;
        const cb = countByTagId[b.id] ?? 0;
        if (cb !== ca) return cb - ca;
        return uppercaseFirstComparator(a.name ?? "", b.name ?? "");
      });
    }, [hasSceneTagsField, sceneTags, countByTagId]);

  const showCounts = showTagCounts !== false;
    const tooltipContent = sortedSceneTags.map((tag) => (
      <Badge key={tag.id} className="tag-item" variant="secondary">
        <Link
          to={NavUtils.makeTagScenesUrl(
            { id: tag.id, name: tag.name ?? undefined },
            { id: performer.id, name: performer.name ?? undefined }
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {tag.name}
          {showCounts && typeof countByTagId[tag.id] === "number" && countByTagId[tag.id] > 0
            ? ` (${countByTagId[tag.id]})`
            : ""}
        </Link>
      </Badge>
    ));

    return (
      <>
        {/* Age line first */}
        <div className="performer-card__age">
          {age !== 0 ? ageString : "\u00A0"}
        </div>

        {/* Scene tag strip under age; always shows tooltip with full list */}
        <HoverPopover placement="top" content={tooltipContent}>
          <div className="performer-card__scene-tags mt-1">
            {sortedSceneTags.length > 0
              ? sortedSceneTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    className="tag-item tag-link"
                    variant="secondary"
                  >
                    <Link
                      to={NavUtils.makeTagScenesUrl(
                        { id: tag.id, name: tag.name ?? undefined },
                        { id: performer.id, name: performer.name ?? undefined }
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {tag.name}
                      {showCounts && typeof countByTagId[tag.id] === "number" && countByTagId[tag.id] > 0
                        ? ` (${countByTagId[tag.id]})`
                        : ""}
                    </Link>
                  </Badge>
                ))
              : null}
          </div>
        </HoverPopover>
      </>
    );
  }
);

const PerformerCardImage: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard.Image",
  ({ performer }) => {
    return (
      <>
        <img
          loading="lazy"
          className="performer-card-image"
          alt={performer.name ?? ""}
          src={performer.image_path ?? ""}
        />
      </>
    );
  }
);

const PerformerCardTitle: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard.Title",
  ({ performer }) => {
    return (
      <div>
        <span className="performer-name">{performer.name}</span>
        {performer.disambiguation && (
          <span className="performer-disambiguation">
            {` (${performer.disambiguation})`}
          </span>
        )}
        {/* Age and scene-tag strip moved to details to align with the gender icon */}
      </div>
    );
  }
);

export const PerformerCard: React.FC<IPerformerCardProps> = PatchComponent(
  "PerformerCard",
  (props) => {
    const {
      performer,
      cardWidth,
      selecting,
      selected,
      onSelectedChanged,
      zoomIndex,
    } = props;

    return (
      <div className={`performer-card-wrapper`}>
        <GridCard
          className={`performer-card zoom-${zoomIndex}`}
          url={`/performers/${performer.id}`}
          width={cardWidth}
          pretitleIcon={
            <GenderIcon className="gender-icon" gender={performer.gender} />
          }
          title={<PerformerCardTitle {...props} />}
          image={<PerformerCardImage {...props} />}
          overlays={<PerformerCardOverlays {...props} />}
          details={<PerformerCardDetails {...props} />}
          popovers={<PerformerCardPopovers {...props} />}
          selected={selected}
          selecting={selecting}
          onSelectedChanged={onSelectedChanged}
        />
        {/* PerformerTagEditor is available via the tag-count button which opens a modal */}
      </div>
    );
  }
);
