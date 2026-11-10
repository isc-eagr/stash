// CUSTOM: Sex and Oral top → bottom ethnicity grids on Vato Stats.
import React, { useMemo } from "react";
import { gql, useQuery } from "@apollo/client";
import type { StatsDateRangeInput } from "src/core/generated-graphql";
import { StatsPairGrid } from "src/components/StatsCharts_custom";
import { openInsightEntityLink } from "src/utils/insightSceneLinks_custom";
import {
  buildVatoRolePairGrid,
  vatoRolePairKey,
  type IVatoStatsRolePair,
  type VatoStatsRolePairActivity,
} from "./vatoStatsRolePairs_custom";

const VATO_STATS_ROLE_PAIRS = gql`
  query VatoStatsRolePairs(
    $studioId: ID
    $depth: Int
    $dateRange: StatsDateRangeInput
  ) {
    vatoStatsRolePairs(
      studio_id: $studioId
      depth: $depth
      date_range: $dateRange
    ) {
      activity
      scene_id
      top_id
      bottom_id
    }
  }
`;

const SCENE_UNIT: [string, string] = ["scene", "scenes"];
const GRIDS: { activity: VatoStatsRolePairActivity; title: string }[] = [
  { activity: "SEX", title: "Sex: Top → Bottom Ethnicity" },
  { activity: "ORAL", title: "Oral: Top → Bottom Ethnicity" },
];

export const VatoStatsRolePairGrids: React.FC<{
  vatos: readonly { id: string; ethnicity?: string | null }[];
  // Vatos left by the page's chart filters; omit when nothing is filtered.
  selectedIds?: readonly string[];
  studioId?: string;
  depth?: number;
  dateRange?: StatsDateRangeInput | null;
}> = ({ vatos, selectedIds, studioId, depth, dateRange }) => {
  const { data } = useQuery<{ vatoStatsRolePairs: IVatoStatsRolePair[] }>(
    VATO_STATS_ROLE_PAIRS,
    {
      // One row per scene pair: keep the whole library out of the cache.
      fetchPolicy: "no-cache",
      variables: {
        dateRange: dateRange ?? null,
        depth: depth ?? null,
        studioId: studioId ?? null,
      },
    }
  );
  const grids = useMemo(() => {
    const selected = selectedIds ? new Set(selectedIds) : undefined;
    return GRIDS.map((grid) => ({
      ...grid,
      ...buildVatoRolePairGrid(
        data?.vatoStatsRolePairs ?? [],
        grid.activity,
        vatos,
        selected
      ),
    }));
  }, [data?.vatoStatsRolePairs, selectedIds, vatos]);

  return (
    <>
      {grids.map((grid) => (
        <StatsPairGrid
          action="View"
          key={grid.activity}
          title={grid.title}
          rowTitle="Top"
          columnTitle="Bottom"
          rows={grid.tops}
          columns={grid.bottoms}
          cell={(top, bottom) => {
            const ids = grid.cells.get(vatoRolePairKey(top, bottom));
            return ids
              ? {
                  count: ids.length,
                  onSelect: () =>
                    openInsightEntityLink(
                      "scene",
                      `${grid.title}: ${top} → ${bottom}`,
                      ids
                    ),
                }
              : undefined;
          }}
          unit={SCENE_UNIT}
          total={grid.sceneIds.length}
          totalNote="A scene counts once for each top → bottom pair in it, so cells can overlap."
          unknown={{
            count: grid.unknownSceneIds.length,
            onSelect: () =>
              openInsightEntityLink(
                "scene",
                `${grid.title}: Unknown`,
                grid.unknownSceneIds
              ),
          }}
        />
      ))}
    </>
  );
};
