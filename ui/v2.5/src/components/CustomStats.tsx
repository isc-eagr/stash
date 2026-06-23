import React from "react";
import { gql, useQuery } from "@apollo/client";
import { useStats } from "src/core/StashService";
import * as GQL from "src/core/generated-graphql";
import { FormattedMessage, FormattedNumber } from "react-intl";
import { Helmet } from "react-helmet";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { Button } from "react-bootstrap";
import { Icon } from "./Shared/Icon";
import { faHand } from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import NavUtils from "src/utils/navigation";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import facialPng from "src/assets/facial.png"; // CUSTOM
import { useConfigurationContext } from "src/hooks/Config";
import { useTitleProps } from "src/hooks/title";

type PerformerEthnicityTierKey =
  | "bronze"
  | "silver"
  | "gold"
  | "royal_sapphire";

type PerformerEthnicityTierRow = {
  ethnicity: string;
  bronze: number;
  silver: number;
  gold: number;
  royal_sapphire: number;
};

// Performer rating tiers by ethnicity
const PERFORMER_ETHNICITY_TIER_COUNTS = gql`
  query PerformerEthnicityTierCounts {
    performerEthnicityTierCounts {
      ethnicity
      bronze
      silver
      gold
      royal_sapphire
    }
  }
`;

// Total orgasm marker-tag entries (tag name == 'orgasm')
const ORGASM_TOTAL_COUNT = gql`
  query SceneOrgasmCount {
    sceneOrgasmCount
  }
`;

// Total facial markers (primary or secondary), includes descendants of 'facial'
const FACIAL_TOTAL_COUNT = gql`
  query SceneFacialCount {
    sceneFacialCount
  }
`;

// Total orgasm time (sum of orgasm marker lengths, 20s default if no end time)
const TOTAL_ORGASM_TIME = gql`
  query TotalOrgasmTime {
    totalOrgasmTime
  }
`;

// Total facial time (sum of facial marker lengths, 20s default if no end time)
const TOTAL_FACIAL_TIME = gql`
  query TotalFacialTime {
    totalFacialTime
  }
`;

export const CustomStats: React.FC = () => {
  const titleProps = useTitleProps("CustomStats");
  // Get configuration FIRST so we can use it in queries
  const { configuration } = useConfigurationContext();
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};

  const { data: statsData, error, loading } = useStats();
  const { data: tierData } = useQuery(PERFORMER_ETHNICITY_TIER_COUNTS);
  const { data: orgasmCountData } = useQuery(ORGASM_TOTAL_COUNT);
  const { data: facialCountData } = useQuery(FACIAL_TOTAL_COUNT);
  const { data: orgasmTimeData } = useQuery(TOTAL_ORGASM_TIME);
  const { data: facialTimeData } = useQuery(TOTAL_FACIAL_TIME);

  // Extract individual tag IDs for convenience
  const { sexTagId } = roleTagIds;
  const { oralTagId } = roleTagIds;
  const { soloTagId } = roleTagIds;
  const { facialTagId } = roleTagIds;
  const performerRatingTiers = [
    {
      key: "bronze",
      label: "Bronze",
    },
    {
      key: "silver",
      label: "Silver",
    },
    {
      key: "gold",
      label: "Gold",
    },
    {
      key: "royal_sapphire",
      label: "Sapphire",
    },
  ] as const;
  const performerEthnicityTierRows = (tierData?.performerEthnicityTierCounts ??
    []) as PerformerEthnicityTierRow[];
  const performerRatingTierTotals = performerRatingTiers.reduce(
    (acc, tier) => ({
      ...acc,
      [tier.key]: performerEthnicityTierRows.reduce(
        (sum, row) => sum + row[tier.key],
        0
      ),
    }),
    {} as Record<PerformerEthnicityTierKey, number>
  );
  const performerRatingTierGrandTotal = performerRatingTiers.reduce(
    (sum, tier) => sum + performerRatingTierTotals[tier.key],
    0
  );
  // Query tags to get their names (for display and URL generation)
  const { data: tagsData } = GQL.useFindTagsQuery({
    variables: {
      filter: {
        per_page: -1,
      },
    },
  });

  // Map tag IDs to tag objects for display
  const allTags = tagsData?.findTags?.tags ?? [];
  const sexTag = allTags.find((t) => t.id === sexTagId);
  const oralTag = allTags.find((t) => t.id === oralTagId);
  const soloTag = allTags.find((t) => t.id === soloTagId);
  const facialTag = allTags.find((t) => t.id === facialTagId);

  // Helpers to create scene URLs with exclusive filtering (matching backend stats logic)
  // Sex: has sex markers (no exclusions)
  const makeSexScenesUrl = () => {
    if (!sexTag) return "#";
    return NavUtils.makeScenesWithMarkerTagUrl(sexTag.id, sexTag.name);
  };

  // Oral: has oral markers BUT NOT sex markers (depth -1 to include subtags)
  const makeOralScenesUrl = () => {
    if (!oralTag) return "#";
    const excludeTags = sexTag ? [{ id: sexTag.id, label: sexTag.name }] : [];
    return NavUtils.makeScenesWithExclusiveMarkerTagUrl(
      oralTag.id,
      oralTag.name,
      excludeTags,
      -1
    );
  };

  // Solo: has solo markers BUT NOT sex OR oral markers (depth -1 to include subtags)
  const makeSoloScenesUrl = () => {
    if (!soloTag) return "#";
    const excludeTags = [];
    if (sexTag) excludeTags.push({ id: sexTag.id, label: sexTag.name });
    if (oralTag) excludeTags.push({ id: oralTag.id, label: oralTag.name });
    return NavUtils.makeScenesWithExclusiveMarkerTagUrl(
      soloTag.id,
      soloTag.name,
      excludeTags,
      -1 // Use depth -1 for both include and exclude to catch all subtags
    );
  };

  // Facial: has facial markers (depth -1 to include subtags)
  const makeFacialScenesUrl = () => {
    if (!facialTag) return "#";
    return NavUtils.makeScenesWithMarkerTagUrl(
      facialTag.id,
      facialTag.name,
      -1
    );
  };

  // Helper to create marker page URLs for Total Orgasms/Facials links
  const makeMarkersTagUrl = (tag: { id: string; name: string } | undefined) => {
    if (!tag) return "#";
    const criterionData = {
      type: "marker_performers",
      modifier: "INCLUDES_ALL",
      tag_ids: [{ id: tag.id, label: tag.name }],
      include_subtags: true,
      top_performer_ids: [],
      top_ethnicities: [],
      top_countries: [],
      top_rating: null,
      bottom_performer_ids: [],
      bottom_ethnicities: [],
      bottom_countries: [],
      bottom_rating: null,
    };
    return `/scenes/markers?c=${encodeURIComponent(
      JSON.stringify(criterionData)
    )}&sortby=title`;
  };

  // Helper to format seconds into a human-readable duration string
  const formatDuration = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.round(totalSeconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (error)
    return (
      <>
        <Helmet {...titleProps} />
        <span>{error.message}</span>
      </>
    );
  if (loading || !statsData)
    return (
      <>
        <Helmet {...titleProps} />
        <LoadingIndicator />
      </>
    );

  return (
    <div className="mt-5">
      <Helmet {...titleProps} />

      {/* Scene Category Counts - based on roleTagIds configuration */}
      {statsData && (sexTag || oralTag || soloTag || facialTag) && (
        <div className="col col-sm-8 m-sm-auto row stats">
          {sexTag && (
            <div className="stats-element">
              <p className="title">
                <Button
                  className="stats-category-button sex-stats-button"
                  href={makeSexScenesUrl()}
                  disabled={statsData.stats.sex_scene_count === 0}
                >
                  <img src={gaySvg} alt="Sex" className="stats-category-icon" />
                  <span className="ml-2">
                    <FormattedNumber value={statsData.stats.sex_scene_count} />
                  </span>
                </Button>
              </p>
            </div>
          )}
          {oralTag && (
            <div className="stats-element">
              <p className="title">
                <Button
                  className="stats-category-button oral-stats-button"
                  href={makeOralScenesUrl()}
                  disabled={statsData.stats.oral_scene_count === 0}
                >
                  <img
                    src={mouthSvg}
                    alt="Oral"
                    className="stats-category-icon"
                  />
                  <span className="ml-2">
                    <FormattedNumber value={statsData.stats.oral_scene_count} />
                  </span>
                </Button>
              </p>
            </div>
          )}
          {soloTag && (
            <div
              className="stats-element solo-category-button-container"
              style={{ display: "block" }}
            >
              <p className="title">
                <Button
                  className="stats-category-button solo-stats-button"
                  href={makeSoloScenesUrl()}
                  disabled={statsData.stats.solo_scene_count === 0}
                >
                  <Icon icon={faHand} className="stats-category-icon-fa" />
                  <span className="ml-2">
                    <FormattedNumber value={statsData.stats.solo_scene_count} />
                  </span>
                </Button>
              </p>
            </div>
          )}
          {facialTag && (
            <div className="stats-element">
              <p className="title">
                <Button
                  className="stats-category-button facial-stats-button ml-4"
                  href={makeFacialScenesUrl()}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  disabled={(statsData as any).stats.facial_scene_count === 0}
                >
                  <img
                    src={facialPng}
                    alt="Facial"
                    className="stats-category-icon"
                  />
                  <span className="ml-2">
                    <FormattedNumber
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      value={(statsData as any).stats.facial_scene_count ?? 0}
                    />
                  </span>
                </Button>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Extra spacing between counts and ethnicity report */}
      <div className="my-5" aria-hidden="true" />

      {/* Orgasm + Facial Stats */}
      {(typeof orgasmCountData?.sceneOrgasmCount === "number" ||
        typeof facialCountData?.sceneFacialCount === "number" ||
        typeof orgasmTimeData?.totalOrgasmTime === "number" ||
        typeof facialTimeData?.totalFacialTime === "number") && (
        <div className="col col-sm-8 m-sm-auto row stats">
          {typeof orgasmCountData?.sceneOrgasmCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <Link
                  to={makeMarkersTagUrl(
                    allTags.find((t) => t.id === roleTagIds.orgasmTagId)
                  )}
                >
                  <FormattedNumber value={orgasmCountData.sceneOrgasmCount} />
                </Link>
              </p>
              <p className="heading">Total orgasms</p>
            </div>
          )}
          {typeof orgasmTimeData?.totalOrgasmTime === "number" &&
            orgasmTimeData.totalOrgasmTime > 0 && (
              <div className="stats-element">
                <p className="title">
                  {formatDuration(orgasmTimeData.totalOrgasmTime)}
                </p>
                <p className="heading">Total orgasm time</p>
              </div>
            )}
          {typeof facialCountData?.sceneFacialCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <Link
                  to={makeMarkersTagUrl(
                    allTags.find((t) => t.id === roleTagIds.facialTagId)
                  )}
                >
                  <FormattedNumber value={facialCountData.sceneFacialCount} />
                </Link>
              </p>
              <p className="heading">Total facials</p>
            </div>
          )}
          {typeof facialTimeData?.totalFacialTime === "number" &&
            facialTimeData.totalFacialTime > 0 && (
              <div className="stats-element">
                <p className="title">
                  {formatDuration(facialTimeData.totalFacialTime)}
                </p>
                <p className="heading">Total facial time</p>
              </div>
            )}
        </div>
      )}

      {/* Ethnicity tier report */}
      {performerEthnicityTierRows.length > 0 ? (
        <div className="row justify-content-center mt-5">
          <div className="col-12 col-md-auto" style={{ maxWidth: 700 }}>
            <h5 className="mb-3">
              <FormattedMessage
                id="stats.tier_performers_by_ethnicity"
                defaultMessage="Tier vatos by ethnicity"
              />
            </h5>
            <div className="table-responsive">
              <table className="table table-sm table-striped mb-0">
                <thead>
                  <tr>
                    <th>
                      <FormattedMessage
                        id="ethnicity"
                        defaultMessage="Ethnicity"
                      />
                    </th>
                    {performerRatingTiers.map((tier) => (
                      <th key={tier.key} className="text-right">
                        {tier.label}
                      </th>
                    ))}
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {performerEthnicityTierRows.map((row) => {
                    const rowTotal =
                      row.bronze + row.silver + row.gold + row.royal_sapphire;

                    return (
                      <tr key={`tiers-${row.ethnicity}`}>
                        <td>
                          <Link
                            to={NavUtils.makePerformersEthnicityUrl(
                              row.ethnicity
                            )}
                          >
                            {row.ethnicity}
                          </Link>
                        </td>
                        {performerRatingTiers.map((tier) => {
                          const count = row[tier.key];
                          return (
                            <td key={tier.key} className="text-right">
                              {count > 0 ? (
                                <Link
                                  to={NavUtils.makePerformersEthnicityMetallicRatingUrl(
                                    row.ethnicity,
                                    tier.key
                                  )}
                                >
                                  <FormattedNumber value={count} />
                                </Link>
                              ) : (
                                <FormattedNumber value={count} />
                              )}
                            </td>
                          );
                        })}
                        <td className="text-right">
                          <Link
                            to={NavUtils.makePerformersEthnicityAnyMetallicRatingUrl(
                              row.ethnicity
                            )}
                          >
                            <FormattedNumber value={rowTotal} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Total</th>
                    {performerRatingTiers.map((tier) => {
                      const total = performerRatingTierTotals[tier.key];
                      return (
                        <th key={tier.key} className="text-right">
                          {total > 0 ? (
                            <Link
                              to={NavUtils.makePerformersMetallicRatingUrl(
                                tier.key
                              )}
                            >
                              <FormattedNumber value={total} />
                            </Link>
                          ) : (
                            <FormattedNumber value={total} />
                          )}
                        </th>
                      );
                    })}
                    <th className="text-right">
                      <FormattedNumber value={performerRatingTierGrandTotal} />
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CustomStats;
