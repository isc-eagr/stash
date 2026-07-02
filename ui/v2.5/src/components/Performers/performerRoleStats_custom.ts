import { gql, useLazyQuery } from "@apollo/client";
import { useEffect, useMemo } from "react";
import type { IPerformerRoleStats } from "./PerformerCard";

// CUSTOM: shared lazy role stats loader for performer cards rendered outside PerformerCardGrid.
interface IPerformerCardRoleStatsQueryData {
  performerRoleStats: Array<{
    performer_id: string;
    sex_scene_count: number;
    oral_scene_count: number;
    solo_scene_count: number;
    facial_scene_count: number;
    sex_top_count: number;
    sex_bottom_count: number;
    oral_top_count: number;
    oral_bottom_count: number;
    facial_marker_count: number;
    facial_top_count: number;
    facial_bottom_count: number;
    facial_with_top_count: number;
    facial_with_bottom_count: number;
    facial_marker_with_top_count: number;
    facial_marker_with_bottom_count: number;
    orgasm_top_count: number;
    feet_top_count: number;
    sex_with_top_count: number;
    sex_with_bottom_count: number;
    oral_with_top_count: number;
    oral_with_bottom_count: number;
    sex_unique_partner_count: number;
    oral_unique_partner_count: number;
    facial_unique_partner_count: number;
  }>;
}

interface IPerformerCardRoleStatsQueryVariables {
  performer_ids: string[];
}

const PerformerCardRoleStatsQuery = gql`
  query PerformerCardRoleStats($performer_ids: [ID!]!) {
    performerRoleStats(performer_ids: $performer_ids) {
      performer_id
      sex_scene_count
      oral_scene_count
      solo_scene_count
      facial_scene_count
      sex_top_count
      sex_bottom_count
      oral_top_count
      oral_bottom_count
      facial_marker_count
      facial_top_count
      facial_bottom_count
      facial_with_top_count
      facial_with_bottom_count
      facial_marker_with_top_count
      facial_marker_with_bottom_count
      orgasm_top_count
      feet_top_count
      sex_with_top_count
      sex_with_bottom_count
      oral_with_top_count
      oral_with_bottom_count
      sex_unique_partner_count
      oral_unique_partner_count
      facial_unique_partner_count
    }
  }
`;

export function usePerformerCardRoleStats(
  performers: Array<{ id: string }>,
  skip?: boolean
) {
  const [loadRoleStats, { data: roleStatsData }] = useLazyQuery<
    IPerformerCardRoleStatsQueryData,
    IPerformerCardRoleStatsQueryVariables
  >(PerformerCardRoleStatsQuery, {
    fetchPolicy: "cache-first",
  });

  const performerIDs = useMemo(
    () => performers.map((p) => p.id).filter((id) => id !== ""),
    [performers]
  );

  useEffect(() => {
    if (skip || performerIDs.length === 0) return;

    const handle = window.setTimeout(() => {
      void loadRoleStats({
        variables: {
          performer_ids: performerIDs,
        },
      });
    }, 0);

    return () => window.clearTimeout(handle);
  }, [loadRoleStats, performerIDs, skip]);

  return useMemo(() => {
    const ret = new Map<string, IPerformerRoleStats>();

    roleStatsData?.performerRoleStats.forEach((p) => {
      ret.set(p.performer_id, {
        sex_scene_count: p.sex_scene_count,
        sex_top_count: p.sex_top_count,
        sex_bottom_count: p.sex_bottom_count,
        sex_with_top_count: p.sex_with_top_count,
        sex_with_bottom_count: p.sex_with_bottom_count,
        sex_unique_partner_count: p.sex_unique_partner_count,
        oral_scene_count: p.oral_scene_count,
        oral_top_count: p.oral_top_count,
        oral_bottom_count: p.oral_bottom_count,
        oral_with_top_count: p.oral_with_top_count,
        oral_with_bottom_count: p.oral_with_bottom_count,
        oral_unique_partner_count: p.oral_unique_partner_count,
        solo_scene_count: p.solo_scene_count,
        facial_scene_count: p.facial_scene_count,
        facial_top_count: p.facial_top_count,
        facial_bottom_count: p.facial_bottom_count,
        facial_with_top_count: p.facial_with_top_count,
        facial_with_bottom_count: p.facial_with_bottom_count,
        facial_marker_with_top_count: p.facial_marker_with_top_count,
        facial_marker_with_bottom_count: p.facial_marker_with_bottom_count,
        facial_unique_partner_count: p.facial_unique_partner_count,
        orgasm_top_count: p.orgasm_top_count,
        facial_marker_count: p.facial_marker_count,
        feet_top_count: p.feet_top_count,
      });
    });

    return ret;
  }, [roleStatsData]);
}
