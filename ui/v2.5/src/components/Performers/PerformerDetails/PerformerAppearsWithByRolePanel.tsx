import React from "react";
import { Link } from "react-router-dom";
import * as GQL from "src/core/generated-graphql";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { useConfigurationContext } from "src/hooks/Config";
import { FormattedMessage } from "react-intl";
import { PatchComponent } from "src/patch";
import { GridCard } from "../../Shared/GridCard/GridCard";
import { CountryFlag } from "../../Shared/CountryFlag";
import { FavoriteIcon } from "../../Shared/FavoriteIcon";
import { RatingBanner } from "../../Shared/RatingBanner";
import GenderIcon from "../GenderIcon";
import { usePerformerUpdate } from "src/core/StashService";
import { ButtonGroup } from "react-bootstrap";
import NavUtils from "src/utils/navigation";
import TextUtils from "src/utils/text";
import { useIntl } from "react-intl";
import { PopoverCountButton } from "../../Shared/PopoverCountButton";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import goateeSvg from "src/assets/goatee.svg";

interface IPerformerAppearsWithByRolePanelProps {
  active: boolean;
  performer: GQL.PerformerDataFragment;
}

interface IPerformerWithCount {
  performer: GQL.PerformerDataFragment;
  sceneCount: number;
}

interface IRoleSectionProps {
  title: string;
  subtitle?: string;
  performers: IPerformerWithCount[];
  emptyMessage?: string;
  currentPerformer: GQL.PerformerDataFragment;
  roleCategory: "sex" | "oral" | "facial";
  roleType: "top" | "bottom";
}

// Custom compact card for role panel - shows scene count badge
interface ICoPerformerCardProps {
  performer: GQL.PerformerDataFragment;
  sceneCount: number;
  currentPerformer: GQL.PerformerDataFragment;
  roleCategory: "sex" | "oral" | "facial";
  roleType: "top" | "bottom";
}

const CoPerformerCard: React.FC<ICoPerformerCardProps> = ({
  performer,
  sceneCount,
  currentPerformer,
  roleCategory,
  roleType,
}) => {
  const intl = useIntl();
  const { configuration } = useConfigurationContext();
  const [updatePerformer] = usePerformerUpdate();

  const age = TextUtils.age(performer.birthdate, performer.death_date);
  const ageL10String = intl.formatMessage({
    id: "years_old",
    defaultMessage: "years old",
  });
  const ageString = intl.formatMessage(
    { id: "media_info.performer_card.age" },
    { age, years_old: ageL10String }
  );

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

  // Get role tag IDs
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};
  const tagId =
    roleCategory === "sex"
      ? roleTagIds.sexTagId
      : roleCategory === "oral"
      ? roleTagIds.oralTagId
      : roleTagIds.facialTagId;

  // Build URL for shared scenes with both performers in this specific role
  // Using new scene_marker_tags filter structure with top/bottom performer attributes
  const tagLabel = roleCategory.charAt(0).toUpperCase() + roleCategory.slice(1);

  // Determine which performer is top and which is bottom based on roleType
  // roleType indicates the CURRENT performer's role
  // If current performer was "top", then co-performer was "bottom" and vice versa
  const topPerformerId =
    roleType === "top" ? currentPerformer.id : performer.id;
  const topPerformerLabel =
    roleType === "top" ? currentPerformer.name || "" : performer.name || "";
  const bottomPerformerId =
    roleType === "top" ? performer.id : currentPerformer.id;
  const bottomPerformerLabel =
    roleType === "top" ? performer.name || "" : currentPerformer.name || "";

  // Use depth -1 for oral and facial to include subtags
  const markerDepth = roleCategory === "sex" ? 0 : -1;

  const sharedScenesUrl = tagId
    ? `/scenes?c=${encodeURIComponent(
        JSON.stringify({
          type: "scene_markers",
          modifier: "INCLUDES_ALL",
          groups: [
            {
              groupId: "A",
              tag_ids: [{ id: tagId, label: tagLabel }],
              depth: markerDepth,
              top_performer_ids: [{ id: topPerformerId, label: topPerformerLabel }],
              top_ethnicities: [],
              top_countries: [],
              top_rating: null,
              bottom_performer_ids: [{ id: bottomPerformerId, label: bottomPerformerLabel }],
              bottom_ethnicities: [],
              bottom_countries: [],
              bottom_rating: null,
            },
          ],
        })
      )}&sortby=date`
    : undefined;

  // Use the scene count from GraphQL query
  const sharedSceneCount = sceneCount;

  // Determine rating class for special styling
  const getRatingClass = () => {
    if (!performer.rating100) return "";
    // 5 stars = 100, 4 stars = 80, 3 stars = 60
    if (performer.rating100 === 100) return "rating-5-stars";
    if (performer.rating100 === 80) return "rating-4-stars";
    if (performer.rating100 === 60) return "rating-3-stars";
    return "";
  };

  return (
    <GridCard
      className={`performer-card co-performer-card ${getRatingClass()}`}
      url={`/performers/${performer.id}`}
      width={180}
      pretitleIcon={
        <GenderIcon className="gender-icon" gender={performer.gender} />
      }
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className="performer-name">{performer.name}</span>
          {sharedSceneCount > 1 && (
            <span
              className="badge badge-primary"
              style={{
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.7rem",
                padding: 0,
              }}
            >
              {sharedSceneCount}
            </span>
          )}
        </div>
      }
      image={
        <img
          loading="lazy"
          decoding="async"
          className="performer-card-image"
          alt={performer.name ?? ""}
          src={performer.image_path ?? ""}
        />
      }
      overlays={
        <>
          <FavoriteIcon
            favorite={performer.favorite}
            onToggleFavorite={onToggleFavorite}
            size="2x"
            className="hide-not-favorite"
          />
          {performer.rating100 && <RatingBanner rating={performer.rating100} />}
          {performer.country && (
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
          )}
        </>
      }
      details={
        <div className="performer-card__age">
          {age !== 0 ? ageString : "\u00A0"}
        </div>
      }
      popovers={
        sharedScenesUrl && sharedSceneCount > 0 ? (
          <>
            <hr />
            <ButtonGroup className="card-popovers">
              <PopoverCountButton
                className="scene-count"
                type="scene"
                count={sharedSceneCount}
                url={sharedScenesUrl}
              />
            </ButtonGroup>
          </>
        ) : undefined
      }
    />
  );
};

const RoleSection: React.FC<IRoleSectionProps> = ({
  title,
  subtitle,
  performers,
  emptyMessage,
  currentPerformer,
  roleCategory,
  roleType,
}) => {
  if (performers.length === 0 && !emptyMessage) return null;

  return (
    <div
      className="role-section mb-3"
      style={{
        display: "block",
        width: "100%",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        paddingBottom: "12px",
      }}
    >
      <div className="role-section-header mb-2" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <h6 className="mb-0" style={{ fontSize: "0.9rem", fontWeight: 600 }}>
          {title}
          {subtitle && <small className="text-muted ml-2">({subtitle})</small>}
        </h6>
        <span className="badge badge-secondary">{performers.length}</span>
      </div>
      <div
        className="role-section-performers"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        {performers.length > 0 ? (
          performers.map((p) => (
            <div
              key={p.performer.id}
              style={{ width: "180px" }}
            >
              <CoPerformerCard
                performer={p.performer}
                sceneCount={p.sceneCount}
                currentPerformer={currentPerformer}
                roleCategory={roleCategory}
                roleType={roleType}
              />
            </div>
          ))
        ) : emptyMessage ? (
          <span className="text-muted">{emptyMessage}</span>
        ) : null}
      </div>
    </div>
  );
};

export const PerformerAppearsWithByRolePanel: React.FC<IPerformerAppearsWithByRolePanelProps> =
  PatchComponent("PerformerAppearsWithByRolePanel", ({ active, performer }) => {
    const { configuration } = useConfigurationContext();

    // Get role tag IDs from configuration
    const roleTagIds = configuration?.ui?.roleTagIds ?? {};
    const hasSexTag = !!roleTagIds.sexTagId;
    const hasOralTag = !!roleTagIds.oralTagId;
    const hasFacialTag = !!roleTagIds.facialTagId;

    // Query co-performers by role
    const { data, loading, error } = GQL.usePerformerCoPerformersByRoleQuery({
      variables: { performer_id: performer.id },
      skip: !active,
    });

    if (!active) return null;

    if (loading) return <LoadingIndicator />;
    if (error) {
      return (
        <div className="text-danger p-3">
          Error loading co-performers: {error.message}
        </div>
      );
    }

    const coPerformers = data?.performerCoPerformersByRole;
    if (!coPerformers) {
      return (
        <div className="text-muted p-3">
          <FormattedMessage
            id="no_performers_found"
            defaultMessage="No co-performers found"
          />
        </div>
      );
    }

    // Map GraphQL response to IPerformerWithCount format and sort alphabetically by performer name
    const mapToPerformerWithCount = (items: any[] | null | undefined): IPerformerWithCount[] => {
      if (!items) return [];
      return items
        .map((item) => ({
          performer: item.performer,
          sceneCount: item.scene_count,
        }))
        .sort((a, b) => {
          const nameA = (a.performer.name ?? "").toLowerCase();
          const nameB = (b.performer.name ?? "").toLowerCase();
          return nameA.localeCompare(nameB);
        });
    };

    const sexAsTop = mapToPerformerWithCount(coPerformers.sex_as_top);
    const sexAsBottom = mapToPerformerWithCount(coPerformers.sex_as_bottom);
    const oralAsTop = mapToPerformerWithCount(coPerformers.oral_as_top);
    const oralAsBottom = mapToPerformerWithCount(coPerformers.oral_as_bottom);
    const facialAsTop = mapToPerformerWithCount(coPerformers.facial_as_top);
    const facialAsBottom = mapToPerformerWithCount(coPerformers.facial_as_bottom);

    // Check if there's any data at all
    const hasAnyData =
      sexAsTop.length > 0 ||
      sexAsBottom.length > 0 ||
      oralAsTop.length > 0 ||
      oralAsBottom.length > 0 ||
      facialAsTop.length > 0 ||
      facialAsBottom.length > 0;

    if (!hasAnyData) {
      return (
        <div className="text-muted p-3">
          <FormattedMessage
            id="no_co_performers_with_roles"
            defaultMessage="No co-performers with marker roles found. Add scene markers with top/bottom assignments to see co-performers organized by role."
          />
        </div>
      );
    }

    return (
      <div className="performer-appears-with-by-role-panel p-3">
        {/* Sex Section */}
        {hasSexTag && (
          <div
            className="category-section mb-4 p-3"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div
              className="category-header mb-3"
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              <img
                src={gaySvg}
                alt="Sex"
                style={{
                  width: "32px",
                  height: "32px",
                  filter: "brightness(0) invert(1)",
                }}
              />
              <h5 className="mb-0" style={{ fontWeight: 600 }}>Sex</h5>
            </div>
            <RoleSection
              title="Topped"
              subtitle=""
              performers={sexAsTop}
              currentPerformer={performer}
              roleCategory="sex"
              roleType="top"
            />
            <RoleSection
              title="Bottomed For"
              subtitle=""
              performers={sexAsBottom}
              currentPerformer={performer}
              roleCategory="sex"
              roleType="bottom"
            />
          </div>
        )}

        {/* Oral Section */}
        {hasOralTag && (
          <div
            className="category-section mb-4 p-3"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div
              className="category-header mb-3"
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              <img
                src={mouthSvg}
                alt="Oral"
                style={{
                  width: "32px",
                  height: "32px",
                  filter: "brightness(0) invert(1)",
                }}
              />
              <h5 className="mb-0" style={{ fontWeight: 600 }}>Oral</h5>
            </div>
            <RoleSection
              title="Topped"
              subtitle=""
              performers={oralAsTop}
              currentPerformer={performer}
              roleCategory="oral"
              roleType="top"
            />
            <RoleSection
              title="Bottomed For"
              subtitle=""
              performers={oralAsBottom}
              currentPerformer={performer}
              roleCategory="oral"
              roleType="bottom"
            />
          </div>
        )}

        {/* Facial Section */}
        {hasFacialTag && (
          <div
            className="category-section mb-4 p-3"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div
              className="category-header mb-3"
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              <img
                src={goateeSvg}
                alt="Facial"
                style={{
                  width: "32px",
                  height: "32px",
                  filter: "brightness(0) invert(1)",
                }}
              />
              <h5 className="mb-0" style={{ fontWeight: 600 }}>Facial</h5>
            </div>
            <RoleSection
              title="Given"
              subtitle=""
              performers={facialAsTop}
              currentPerformer={performer}
              roleCategory="facial"
              roleType="top"
            />
            <RoleSection
              title="Received"
              subtitle=""
              performers={facialAsBottom}
              currentPerformer={performer}
              roleCategory="facial"
              roleType="bottom"
            />
          </div>
        )}
      </div>
    );
  });
