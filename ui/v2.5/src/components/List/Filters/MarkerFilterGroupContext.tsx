import React, { createContext, useContext, useMemo } from "react";
import { Criterion } from "src/models/list-filter/criteria/criterion";
import { MarkerTagsCriterion } from "src/models/list-filter/criteria/marker-tags";

export interface IMarkerTagGroupInfo {
  groupId: string;
  tagLabels: string[];
  depth: number;
  performerMode: "AND" | "OR";
}

interface IMarkerFilterGroupContextValue {
  groups: IMarkerTagGroupInfo[];
  hasGroups: boolean;
}

const MarkerFilterGroupContext = createContext<IMarkerFilterGroupContextValue>({
  groups: [],
  hasGroups: false,
});

export function useMarkerFilterGroups(): IMarkerFilterGroupContextValue {
  return useContext(MarkerFilterGroupContext);
}

interface IMarkerFilterGroupProviderProps {
  criteria: Criterion[];
  children: React.ReactNode;
}

/**
 * Provider that extracts groups from MarkerTagsCriterion
 * and exposes them as selectable groups for Top/Bottom filters.
 */
export const MarkerFilterGroupProvider: React.FC<
  IMarkerFilterGroupProviderProps
> = ({ criteria, children }) => {
  const value = useMemo(() => {
    // Find the MarkerTagsCriterion (there should be at most one)
    const markerTagsCriterion = criteria.find(
      (c): c is MarkerTagsCriterion => c instanceof MarkerTagsCriterion
    );

    const groups: IMarkerTagGroupInfo[] = markerTagsCriterion
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
