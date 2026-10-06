import React from "react";

// CUSTOM: native disclosure starts closed and supports keyboard navigation.
export const StashDBMatchesStudioGroup: React.FC<{
  name: string;
  count: number;
}> = ({ name, count, children }) => (
  <details className="stashdb-matches-report-group">
    <summary>
      {name} <span className="text-muted">({count})</span>
    </summary>
    {children}
  </details>
);
