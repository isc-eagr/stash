import React, { createContext, useContext, useMemo } from "react";
import { Criterion } from "src/models/list-filter/criteria/criterion";
import {
  MarkerTagsCriterion,
  IMarkerTagGroup,
} from "src/models/list-filter/criteria/marker-tags";

export interface MarkerTagGroupInfo {
  groupId: string;
  tagLabels: string[];
  depth: number;
  performerMode: "AND" | "OR";
}

interface MarkerFilterGroupContextValue {
  groups: MarkerTagGroupInfo[];
  hasGroups: boolean;
}

const MarkerFilterGroupContext = createContext<MarkerFilterGroupContextValue>({
  groups: [],
  hasGroups: false,
});

export function useMarkerFilterGroups(): MarkerFilterGroupContextValue {
  return useContext(MarkerFilterGroupContext);
}

interface MarkerFilterGroupProviderProps {
  criteria: Criterion[];
  children: React.ReactNode;
}

/**
 * Provider that extracts groups from MarkerTagsCriterion
 * and exposes them as selectable groups for Top/Bottom filters.
 */
export const MarkerFilterGroupProvider: React.FC<
  MarkerFilterGroupProviderProps
> = ({ criteria, children }) => {
  const value = useMemo(() => {
    // Find the MarkerTagsCriterion (there should be at most one)
    const markerTagsCriterion = criteria.find(
      (c): c is MarkerTagsCriterion => c instanceof MarkerTagsCriterion
    );

    const groups: MarkerTagGroupInfo[] = markerTagsCriterion
      ? markerTagsCriterion.value.groups.map((g) => ({
          groupId: g.groupId,
          tagLabels: g.tags.map((t) => t.label),
          depth: g.depth,
          performerMode: g.performerMode,
        }))
      : [];

    return {
      groups,
      hasGroups: groups.length > 0,
    };
  }, [criteria]);

  return (
    <MarkerFilterGroupContext.Provider value={value}>
      {children}
    </MarkerFilterGroupContext.Provider>
  );
};

export default MarkerFilterGroupContext;
