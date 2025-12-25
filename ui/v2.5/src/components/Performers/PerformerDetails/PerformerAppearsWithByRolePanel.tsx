import React from "react";
import * as GQL from "src/core/generated-graphql";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { PerformerCard } from "../PerformerCard";
import { useConfigurationContext } from "src/hooks/Config";
import { FormattedMessage } from "react-intl";
import { PatchComponent } from "src/patch";

interface IPerformerAppearsWithByRolePanelProps {
  active: boolean;
  performer: GQL.PerformerDataFragment;
}

interface IRoleSectionProps {
  title: string;
  subtitle?: string;
  performers: GQL.PerformerDataFragment[];
  emptyMessage?: string;
}

const RoleSection: React.FC<IRoleSectionProps> = ({
  title,
  subtitle,
  performers,
  emptyMessage,
}) => {
  if (performers.length === 0 && !emptyMessage) return null;

  return (
    <div className="role-section mb-4">
      <h5 className="role-section-title mb-2">
        {title}
        {subtitle && <small className="text-muted ml-2">({subtitle})</small>}
        <span className="badge badge-secondary ml-2">{performers.length}</span>
      </h5>
      {performers.length > 0 ? (
        <div className="row">
          {performers.map((p) => (
            <div key={p.id} className="col-sm-6 col-md-4 col-lg-3 col-xl-2 mb-3">
              <PerformerCard performer={p} />
            </div>
          ))}
        </div>
      ) : emptyMessage ? (
        <p className="text-muted">{emptyMessage}</p>
      ) : null}
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
          <div className="role-category mb-5">
            <h4 className="role-category-title border-bottom pb-2 mb-3">
              <FormattedMessage id="sex" defaultMessage="Sex" />
            </h4>
            <RoleSection
              title="Fucked"
              subtitle="co-performers with the sex bottom role"
              performers={coPerformers.sex_as_giver ?? []}
            />
            <RoleSection
              title="Fucked By"
              subtitle="co-performers with the sex top role"
              performers={coPerformers.sex_as_receiver ?? []}
            />
          </div>
        )}

        {/* Oral Section */}
        {hasOralTag && (
          <div className="role-category mb-5">
            <h4 className="role-category-title border-bottom pb-2 mb-3">
              <FormattedMessage id="oral" defaultMessage="Oral" />
            </h4>
            <RoleSection
              title="Sucked His Dick"
              subtitle="co-performers with the oral bottom role"
              performers={coPerformers.oral_as_giver ?? []}
            />
            <RoleSection
              title="Dicks Sucked"
              subtitle="co-performers with the oral top role"
              performers={coPerformers.oral_as_receiver ?? []}
            />
          </div>
        )}

        {/* Facial Section */}
        {hasFacialTag && (
          <div className="role-category mb-5">
            <h4 className="role-category-title border-bottom pb-2 mb-3">
              <FormattedMessage id="facial" defaultMessage="Facial" />
            </h4>
            <RoleSection
              title="Facial Given"
              subtitle="co-performers with the facial bottom role"
              performers={coPerformers.facial_as_giver ?? []}
            />
            <RoleSection
              title="Facial Received"
              subtitle="co-performers with the facial top role"
              performers={coPerformers.facial_as_receiver ?? []}
            />
          </div>
        )}
      </div>
    );
  });
