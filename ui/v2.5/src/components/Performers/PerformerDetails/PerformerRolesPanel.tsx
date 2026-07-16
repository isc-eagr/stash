import React from "react";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { FormattedMessage } from "react-intl";
import { PatchComponent } from "src/patch";
import { Button, Card } from "react-bootstrap";
import { Icon } from "src/components/Shared/Icon";
import { faHand } from "@fortawesome/free-solid-svg-icons";
import NavUtils from "src/utils/navigation";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import facialPng from "src/assets/facial.png"; // CUSTOM
import { ROLE_COLORS_CUSTOM } from "src/utils/roleColors_custom"; // CUSTOM

interface IPerformerRolesPanelProps {
  active: boolean;
  performer: GQL.PerformerDataFragment;
}

type RoleCountPerformer = GQL.PerformerDataFragment & {
  sex_top_count?: number | null;
  sex_bottom_count?: number | null;
  oral_top_count?: number | null;
  oral_bottom_count?: number | null;
  solo_scene_count?: number | null;
  facial_top_count?: number | null;
  facial_bottom_count?: number | null;
};

interface IRoleCardProps {
  title: string;
  icon: React.ReactNode;
  topCount: number;
  bottomCount: number;
  topLabel: string;
  bottomLabel: string;
  onTopClick: () => void;
  onBottomClick: () => void;
}

const RoleCard: React.FC<IRoleCardProps> = ({
  title,
  icon,
  topCount,
  bottomCount,
  topLabel,
  bottomLabel,
  onTopClick,
  onBottomClick,
}) => {
  const totalCount = topCount + bottomCount;

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
            variant={ROLE_COLORS_CUSTOM.top.outlineVariant}
            className="role-stat-button flex-fill mr-2"
            onClick={onTopClick}
            disabled={topCount === 0}
          >
            <div className="role-stat-label text-muted small">{topLabel}</div>
            <div className="role-stat-count h4 mb-0">{topCount}</div>
          </Button>
          <Button
            variant={ROLE_COLORS_CUSTOM.bottom.outlineVariant}
            className="role-stat-button flex-fill ml-2"
            onClick={onBottomClick}
            disabled={bottomCount === 0}
          >
            <div className="role-stat-label text-muted small">
              {bottomLabel}
            </div>
            <div className="role-stat-count h4 mb-0">{bottomCount}</div>
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
    const { sexTagId } = roleTagIds;
    const { oralTagId } = roleTagIds;
    const { soloTagId } = roleTagIds;
    const { facialTagId } = roleTagIds;

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

    // Get counts from performer - using new top/bottom fields
    const p = performer as RoleCountPerformer;
    const sexTopCount = p.sex_top_count ?? 0;
    const sexBottomCount = p.sex_bottom_count ?? 0;
    const oralTopCount = p.oral_top_count ?? 0;
    const oralBottomCount = p.oral_bottom_count ?? 0;
    const soloCount = p.solo_scene_count ?? 0;
    const facialTopCount = p.facial_top_count ?? 0;
    const facialBottomCount = p.facial_bottom_count ?? 0;

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
                icon={
                  <img
                    src={gaySvg}
                    alt="Sex"
                    style={{ width: 24, height: 24 }}
                  />
                }
                topCount={sexTopCount}
                bottomCount={sexBottomCount}
                topLabel="Top"
                bottomLabel="Bottom"
                onTopClick={() =>
                  navigateTo(
                    NavUtils.makePerformerMarkerScenesUrl(
                      performer,
                      sexTagId,
                      "Sex"
                    )
                  )
                }
                onBottomClick={() =>
                  navigateTo(
                    NavUtils.makePerformerMarkerScenesUrl(
                      performer,
                      sexTagId,
                      "Sex"
                    )
                  )
                }
              />
            </div>
          )}

          {/* Oral Role Card */}
          {oralTagId && (
            <div className="col-md-6 col-lg-4">
              <RoleCard
                title="Oral"
                icon={
                  <img
                    src={mouthSvg}
                    alt="Oral"
                    style={{ width: 24, height: 24 }}
                  />
                }
                topCount={oralTopCount}
                bottomCount={oralBottomCount}
                topLabel="Top"
                bottomLabel="Bottom"
                onTopClick={() =>
                  navigateTo(
                    NavUtils.makePerformerMarkerScenesUrl(
                      performer,
                      oralTagId,
                      "Oral"
                    )
                  )
                }
                onBottomClick={() =>
                  navigateTo(
                    NavUtils.makePerformerMarkerScenesUrl(
                      performer,
                      oralTagId,
                      "Oral"
                    )
                  )
                }
              />
            </div>
          )}

          {/* Solo Card */}
          {soloTagId && (
            <div className="col-md-6 col-lg-4">
              <Card className="role-card mb-3">
                <Card.Header className="d-flex align-items-center">
                  <span className="role-icon mr-2">
                    <Icon icon={faHand} className="category-icon-fa" />
                  </span>
                  <span className="role-title font-weight-bold">Solo</span>
                  <span className="badge badge-primary ml-auto">
                    {soloCount}
                  </span>
                </Card.Header>
                <Card.Body>
                  <Button
                    variant="outline-secondary"
                    className="w-100"
                    onClick={() =>
                      navigateTo(
                        NavUtils.makePerformerMarkerScenesUrl(
                          performer,
                          soloTagId,
                          "Solo"
                        )
                      )
                    }
                    disabled={soloCount === 0}
                  >
                    <div className="role-stat-label text-muted small">
                      Solo Scenes
                    </div>
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
                icon={
                  <img
                    src={facialPng}
                    alt="Facial"
                    style={{ width: 24, height: 24 }}
                  />
                }
                topCount={facialTopCount}
                bottomCount={facialBottomCount}
                topLabel="Top"
                bottomLabel="Bottom"
                onTopClick={() =>
                  navigateTo(
                    NavUtils.makePerformerMarkerScenesUrl(
                      performer,
                      facialTagId,
                      "Facial"
                    )
                  )
                }
                onBottomClick={() =>
                  navigateTo(
                    NavUtils.makePerformerMarkerScenesUrl(
                      performer,
                      facialTagId,
                      "Facial"
                    )
                  )
                }
              />
            </div>
          )}
        </div>
      </div>
    );
  });
