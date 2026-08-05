import cx from "classnames";
import React from "react";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";

import { StatsLinks } from "./StatsLinks_custom";

import "./statsPage_custom.scss";

interface IStatsPageProps {
  className?: string;
  loading?: boolean;
  loadingMessage?: string;
  showNavigation?: boolean;
}

export const StatsPage: React.FC<IStatsPageProps> = ({
  children,
  className,
  loading = false,
  loadingMessage,
  showNavigation = true,
}) => (
  <div className={cx("stats-page", className)}>
    {showNavigation && <StatsLinks />}
    {loading ? (
      <div className="stats-page-loading">
        <LoadingIndicator message={loadingMessage} />
      </div>
    ) : (
      children
    )}
  </div>
);
