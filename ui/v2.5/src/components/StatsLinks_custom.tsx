import { faFilm, faSliders, faUsers } from "@fortawesome/free-solid-svg-icons";
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Icon } from "src/components/Shared/Icon";
import { SweatDrops } from "src/components/Shared/SweatDrops";

const customStatsLinks = [
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
  {
    label: "Insight Stats",
    href: "/insightstats",
    icon: <Icon icon={faSliders} />,
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
            to={link.href}
          >
            <span className="stats-links-icon">{link.icon}</span>
            <span>{link.label}</span>
          </Link>
        );
      })}
    </div>
  );
};
