import React from "react";

// CUSTOM: a count tile's icon and count. Full tiles (Vato and Studio
// details) put the icon left of the count and its label to save height.
export const RoleTileContent: React.FC<{
  icon: React.ReactNode;
  count?: number;
  label: string;
  full: boolean;
}> = ({ icon, count, label, full }) => {
  const countEl = count !== undefined && (
    <span className="role-total-count">{count}</span>
  );
  if (!full) {
    return (
      <>
        {icon}
        {countEl}
      </>
    );
  }
  return (
    <span className="role-tile-main">
      {icon}
      <span className="role-tile-text">
        {countEl}
        <span className="role-tile-label">{label}</span>
      </span>
    </span>
  );
};
