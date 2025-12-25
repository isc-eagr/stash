import React from "react";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { FormattedMessage } from "react-intl";
import { PatchComponent } from "src/patch";
import { Button, ButtonGroup, Card } from "react-bootstrap";
import { Icon } from "src/components/Shared/Icon";
import { faHand } from "@fortawesome/free-solid-svg-icons";
import NavUtils from "src/utils/navigation";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import goateeSvg from "src/assets/goatee.svg";

interface IPerformerRolesPanelProps {
  active: boolean;
  performer: GQL.PerformerDataFragment;
}

interface IRoleCardProps {
  title: string;
  icon: React.ReactNode;
  giverCount: number;
  receiverCount: number;
  giverLabel: string;
  receiverLabel: string;
  onGiverClick: () => void;
  onReceiverClick: () => void;
}

const RoleCard: React.FC<IRoleCardProps> = ({
  title,
  icon,
  giverCount,
  receiverCount,
  giverLabel,
  receiverLabel,
  onGiverClick,
  onReceiverClick,
}) => {
  const totalCount = giverCount + receiverCount;
  
  return (
    <Card className="role-card mb-3">
      <Card.Header className="d-flex align-items-center">
        <span className="role-icon mr-2">{icon}</span>
        <span className="role-title font-weight-bold">{title}</span>
        <span className="badge badge-primary ml-auto">{totalCount}</span>
      </Card.Header>
      <Card.Body>
        <div className="role-stats d-flex justify-content-around">
          <Button
            variant="outline-info"
            className="role-stat-button flex-fill mr-2"
            onClick={onGiverClick}
            disabled={giverCount === 0}
          >
            <div className="role-stat-label text-muted small">{giverLabel}</div>
            <div className="role-stat-count h4 mb-0">{giverCount}</div>
          </Button>
          <Button
            variant="outline-warning"
            className="role-stat-button flex-fill ml-2"
            onClick={onReceiverClick}
            disabled={receiverCount === 0}
          >
            <div className="role-stat-label text-muted small">{receiverLabel}</div>
            <div className="role-stat-count h4 mb-0">{receiverCount}</div>
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export const PerformerRolesPanel: React.FC<IPerformerRolesPanelProps> =
  PatchComponent("PerformerRolesPanel", ({ active, performer }) => {
    const { configuration } = useConfigurationContext();
    
    // Get role tag IDs from configuration
    const roleTagIds = configuration?.ui?.roleTagIds ?? {};
    const sexTagId = roleTagIds.sexTagId;
    const oralTagId = roleTagIds.oralTagId;
    const soloTagId = roleTagIds.soloTagId;
    const facialTagId = roleTagIds.facialTagId;

    if (!active) return null;

    // Check if any role tags are configured
    const hasAnyRoleTag = sexTagId || oralTagId || soloTagId || facialTagId;
    
    if (!hasAnyRoleTag) {
      return (
        <div className="text-muted p-3">
          <FormattedMessage 
            id="no_role_tags_configured" 
            defaultMessage="No role tags are configured. Go to Settings → Interface → Role Tags to configure Sex, Oral, Solo, and Facial tag IDs." 
          />
        </div>
      );
    }

    // Get counts from performer - using new giver/receiver fields
    const p = performer as any;
    const sexGiverCount = p.sex_giver_count ?? 0;
    const sexReceiverCount = p.sex_receiver_count ?? 0;
    const oralGiverCount = p.oral_giver_count ?? 0;
    const oralReceiverCount = p.oral_receiver_count ?? 0;
    const soloCount = p.solo_scene_count ?? 0;
    const facialGiverCount = p.facial_giver_count ?? 0;
    const facialReceiverCount = p.facial_receiver_count ?? 0;

    const navigateTo = (url: string) => {
      window.location.href = url;
    };

    return (
      <div className="performer-roles-panel p-3">
        <h4 className="mb-4">
          <FormattedMessage id="marker_roles" defaultMessage="Marker Roles" />
        </h4>
        
        <div className="row">
          {/* Sex Role Card */}
          {sexTagId && (
            <div className="col-md-6 col-lg-4">
              <RoleCard
                title="Sex"
                icon={<img src={gaySvg} alt="Sex" style={{ width: 24, height: 24 }} />}
                giverCount={sexGiverCount}
                receiverCount={sexReceiverCount}
                giverLabel="Top"
                receiverLabel="Bottom"
                onGiverClick={() => navigateTo(NavUtils.makePerformerMarkerScenesUrl(performer, sexTagId, "Sex"))}
                onReceiverClick={() => navigateTo(NavUtils.makePerformerMarkerScenesUrl(performer, sexTagId, "Sex"))}
              />
            </div>
          )}

          {/* Oral Role Card */}
          {oralTagId && (
            <div className="col-md-6 col-lg-4">
              <RoleCard
                title="Oral"
                icon={<img src={mouthSvg} alt="Oral" style={{ width: 24, height: 24 }} />}
                giverCount={oralGiverCount}
                receiverCount={oralReceiverCount}
                giverLabel="Top"
                receiverLabel="Bottom"
                onGiverClick={() => navigateTo(NavUtils.makePerformerMarkerScenesUrl(performer, oralTagId, "Oral"))}
                onReceiverClick={() => navigateTo(NavUtils.makePerformerMarkerScenesUrl(performer, oralTagId, "Oral"))}
              />
            </div>
          )}

          {/* Solo Card */}
          {soloTagId && (
            <div className="col-md-6 col-lg-4">
              <Card className="role-card mb-3">
                <Card.Header className="d-flex align-items-center">
                  <span className="role-icon mr-2">
                    <Icon icon={faHand} />
                  </span>
                  <span className="role-title font-weight-bold">Solo</span>
                  <span className="badge badge-primary ml-auto">{soloCount}</span>
                </Card.Header>
                <Card.Body>
                  <Button
                    variant="outline-secondary"
                    className="w-100"
                    onClick={() => navigateTo(NavUtils.makePerformerMarkerScenesUrl(performer, soloTagId, "Solo"))}
                    disabled={soloCount === 0}
                  >
                    <div className="role-stat-label text-muted small">Solo Scenes</div>
                    <div className="role-stat-count h4 mb-0">{soloCount}</div>
                  </Button>
                </Card.Body>
              </Card>
            </div>
          )}

          {/* Facial Role Card */}
          {facialTagId && (
            <div className="col-md-6 col-lg-4">
              <RoleCard
                title="Facial"
                icon={<img src={goateeSvg} alt="Facial" style={{ width: 24, height: 24 }} />}
                giverCount={facialGiverCount}
                receiverCount={facialReceiverCount}
                giverLabel="Top"
                receiverLabel="Bottom"
                onGiverClick={() => navigateTo(NavUtils.makePerformerMarkerScenesUrl(performer, facialTagId, "Facial"))}
                onReceiverClick={() => navigateTo(NavUtils.makePerformerMarkerScenesUrl(performer, facialTagId, "Facial"))}
              />
            </div>
          )}
        </div>
      </div>
    );
  });
