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

interface IRoleSectionProps {
  title: string;
  subtitle?: string;
  performers: GQL.PerformerDataFragment[];
  emptyMessage?: string;
  currentPerformerId: string;
  roleCategory: 'sex' | 'oral' | 'facial';
  roleType: 'giver' | 'receiver';
}

// Custom compact card for role panel - no role badges, just scene count
interface ICoPerformerCardProps {
  performer: GQL.PerformerDataFragment;
  currentPerformerId: string;
  roleCategory: 'sex' | 'oral' | 'facial';
  roleType: 'giver' | 'receiver';
}

const CoPerformerCard: React.FC<ICoPerformerCardProps> = ({ 
  performer, 
  currentPerformerId,
  roleCategory,
  roleType 
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
  const tagId = roleCategory === 'sex' ? roleTagIds.sexTagId :
                roleCategory === 'oral' ? roleTagIds.oralTagId :
                roleTagIds.facialTagId;

  // Build URL for shared scenes with both performers in this specific role
  // Using scene_marker_tags criterion with giver/receiver performer IDs
  const tagLabel = roleCategory.charAt(0).toUpperCase() + roleCategory.slice(1);
  
  // Determine which performer is giver and which is receiver based on roleType
  // roleType indicates the CURRENT performer's role
  // If current performer was "giver", then co-performer was "receiver" and vice versa
  const giverPerformerId = roleType === 'giver' ? currentPerformerId : performer.id;
  const giverPerformerLabel = roleType === 'giver' ? "" : performer.name;
  const receiverPerformerId = roleType === 'giver' ? performer.id : currentPerformerId;
  const receiverPerformerLabel = roleType === 'giver' ? performer.name : "";

  const sharedScenesUrl = tagId 
    ? `/scenes?c=${encodeURIComponent(JSON.stringify({
        "type": "scene_marker_tags",
        "modifier": "EQUALS",
        "extendedGroups": [{
          "tags": [{ "id": tagId, "label": tagLabel }],
          "giver_performer_ids": [{ "id": giverPerformerId, "label": giverPerformerLabel }],
          "receiver_performer_ids": [{ "id": receiverPerformerId, "label": receiverPerformerLabel }],
          "both_roles_performer_ids": [],
          "performer_mode": "AND"
        }]
      }))}&sortby=date`
    : undefined;

  // Calculate shared scene count
  // This is a placeholder - ideally this would come from the GraphQL query
  // For now, we'll show a count button that navigates to the filtered scenes
  const sharedSceneCount = 1; // Placeholder - should be calculated from backend

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
        <div>
          <span className="performer-name">{performer.name}</span>
          {performer.disambiguation && (
            <span className="performer-disambiguation">
              {` (${performer.disambiguation})`}
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
        sharedScenesUrl && (
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
        )
      }
    />
  );
};

const RoleSection: React.FC<IRoleSectionProps> = ({
  title,
  subtitle,
  performers,
  emptyMessage,
  currentPerformerId,
  roleCategory,
  roleType,
}) => {
  if (performers.length === 0 && !emptyMessage) return null;

  return (
    <>
      <div className="d-inline-block align-top mr-2 mb-2 ml-4" style={{ minWidth: '120px' }}>
        <h6 className="mb-1" style={{ fontSize: '0.9rem', fontWeight: 600 }}>
          {title}
          {subtitle && <small className="text-muted ml-2">({subtitle})</small>}
        </h6>
        <span className="badge badge-secondary">{performers.length}</span>
      </div>
      {performers.length > 0 ? (
        performers.map((p) => (
          <div key={p.id} className="d-inline-block align-top mr-2 mb-2" style={{ width: '180px' }}>
            <CoPerformerCard 
              performer={p} 
              currentPerformerId={currentPerformerId}
              roleCategory={roleCategory}
              roleType={roleType}
            />
          </div>
        ))
      ) : emptyMessage ? (
        <span className="text-muted d-inline-block mr-2">{emptyMessage}</span>
      ) : null}
    </>
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
          <FormattedMessage id="no_performers_found" defaultMessage="No co-performers found" />
        </div>
      );
    }

    // Check if there's any data at all
    const hasAnyData = 
      (coPerformers.sex_as_giver?.length ?? 0) > 0 ||
      (coPerformers.sex_as_receiver?.length ?? 0) > 0 ||
      (coPerformers.oral_as_giver?.length ?? 0) > 0 ||
      (coPerformers.oral_as_receiver?.length ?? 0) > 0 ||
      (coPerformers.facial_as_giver?.length ?? 0) > 0 ||
      (coPerformers.facial_as_receiver?.length ?? 0) > 0;

    if (!hasAnyData) {
      return (
        <div className="text-muted p-3">
          <FormattedMessage 
            id="no_co_performers_with_roles" 
            defaultMessage="No co-performers with marker roles found. Add scene markers with giver/receiver assignments to see co-performers organized by role." 
          />
        </div>
      );
    }

    return (
      <div className="performer-appears-with-by-role-panel p-3">
        {/* Sex Section */}
        {hasSexTag && (
          <div className="d-inline-block align-top mr-3 mb-3 p-3" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div className="d-inline-block align-top mr-3 mb-2" style={{ minWidth: '60px' }}>
              <img src={gaySvg} alt="Sex" style={{ width: '32px', height: '32px', filter: 'brightness(0) invert(1)' }} />
            </div>
            <RoleSection
              title="Topped"
              subtitle=""
              performers={coPerformers.sex_as_giver ?? []}
              currentPerformerId={performer.id}
              roleCategory="sex"
              roleType="giver"
            />
            <RoleSection
              title="Bottomed For"
              subtitle=""
              performers={coPerformers.sex_as_receiver ?? []}
              currentPerformerId={performer.id}
              roleCategory="sex"
              roleType="receiver"
            />
          </div>
        )}

        {/* Oral Section */}
        {hasOralTag && (
          <div className="d-inline-block align-top mr-3 mb-3 p-3" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div className="d-inline-block align-top mr-3 mb-2" style={{ minWidth: '60px' }}>
              <img src={mouthSvg} alt="Oral" style={{ width: '32px', height: '32px', filter: 'brightness(0) invert(1)' }} />
            </div>
            <RoleSection
              title="Topped"
              subtitle=""
              performers={coPerformers.oral_as_giver ?? []}
              currentPerformerId={performer.id}
              roleCategory="oral"
              roleType="giver"
            />
            <RoleSection
              title="Bottomed For"
              subtitle=""
              performers={coPerformers.oral_as_receiver ?? []}
              currentPerformerId={performer.id}
              roleCategory="oral"
              roleType="receiver"
            />
          </div>
        )}

        {/* Facial Section */}
        {hasFacialTag && (
          <div className="d-inline-block align-top mr-3 mb-3 p-3" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.05)', 
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <div className="d-inline-block align-top mr-3 mb-2" style={{ minWidth: '60px' }}>
              <img src={goateeSvg} alt="Facial" style={{ width: '32px', height: '32px', filter: 'brightness(0) invert(1)' }} />
            </div>
            <RoleSection
              title="Given"
              subtitle=""
              performers={coPerformers.facial_as_giver ?? []}
              currentPerformerId={performer.id}
              roleCategory="facial"
              roleType="giver"
            />
            <RoleSection
              title="Received"
              subtitle=""
              performers={coPerformers.facial_as_receiver ?? []}
              currentPerformerId={performer.id}
              roleCategory="facial"
              roleType="receiver"
            />
          </div>
        )}
      </div>
    );
  });
