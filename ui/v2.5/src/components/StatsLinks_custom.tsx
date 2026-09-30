import { faFilm, faSliders, faUsers } from "@fortawesome/free-solid-svg-icons";
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "src/components/Shared/Icon";
import { SweatDrops } from "src/components/Shared/SweatDrops";
import { addStatsDateRangeToPath } from "src/utils/statsDateRange_custom";

const customStatsLinks = [
  {
    label: "Playground",
    href: "/stats/playground",
    icon: <Icon icon={faSliders} />,
  },
  {
    label: "O Stats",
    href: "/ostats",
    icon: <SweatDrops />,
  },
  {
    label: "Scene Stats",
    href: "/scenestats",
    icon: <Icon icon={faFilm} />,
  },
  {
    label: "Vato Stats",
    href: "/vatostats",
    icon: <Icon icon={faUsers} />,
  },
];

export const StatsLinks: React.FC = () => {
  const location = useLocation();

  return (
    <div className="col col-sm-8 m-sm-auto stats-links">
      {customStatsLinks.map((link) => {
        const isActive = location.pathname.startsWith(link.href);

        return (
          <Link
            className={`stats-links-item${isActive ? " active" : ""}`}
            key={link.href}
            // Keep the selected date range when switching stats pages.
            to={addStatsDateRangeToPath(link.href, location.search)}
          >
            <span className="stats-links-icon">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        );
      })}
    </div>
  );
};
