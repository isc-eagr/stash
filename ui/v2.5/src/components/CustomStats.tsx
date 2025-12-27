import React from "react";
import { gql, useQuery } from "@apollo/client";
import { useStats } from "src/core/StashService";
import { usePerformerEthnicityCountsQuery } from "src/core/generated-graphql";
import * as GQL from "src/core/generated-graphql";
import { FormattedMessage, FormattedNumber } from "react-intl";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import { Button } from "react-bootstrap";
import { Icon } from "./Shared/Icon";
import { faHand } from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import NavUtils from "src/utils/navigation";
import gaySvg from "src/assets/gay.svg";
import mouthSvg from "src/assets/mouth.svg";
import goateeSvg from "src/assets/goatee.svg";
import { useConfigurationContext } from "src/hooks/Config";
import { ListFilterModel } from "src/models/list-filter/filter";

// Five-star performers by ethnicity
const PERFORMER_ETHNICITY_FIVE_STAR_COUNTS = gql`
  query PerformerEthnicityFiveStarCounts {
    performerEthnicityFiveStarCounts {
      ethnicity
      count
    }
  }
`;

// Scene orgasm counts grouped by year
const SCENE_O_YEAR_COUNTS = gql`
  query SceneOYearCounts {
    sceneOYearCounts {
      year
      count
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

// Performers who have given facials (configurable tag)
const PERFORMERS_FACIAL_GIVEN_COUNT = gql`
  query PerformersFacialGivenCount {
    performersFacialGivenCount
  }
`;

// Performers who have received facials (configurable tag)
const PERFORMERS_FACIAL_RECEIVED_COUNT = gql`
  query PerformersFacialReceivedCount {
    performersFacialReceivedCount
  }
`;

// Performers who topped sexually (sex marker as top)
const PERFORMERS_SEX_GIVEN_COUNT = gql`
  query PerformersSexGivenCount {
    performersSexGivenCount
  }
`;

// Performers who bottomed sexually (sex marker as bottom)
const PERFORMERS_SEX_RECEIVED_COUNT = gql`
  query PerformersSexReceivedCount {
    performersSexReceivedCount
  }
`;

// Performers who topped orally (oral marker as top)
const PERFORMERS_ORAL_GIVEN_COUNT = gql`
  query PerformersOralGivenCount {
    performersOralGivenCount
  }
`;

// Performers who bottomed orally (oral marker as bottom)
const PERFORMERS_ORAL_RECEIVED_COUNT = gql`
  query PerformersOralReceivedCount {
    performersOralReceivedCount
  }
`;

const PERFORMERS_SOLO_ONLY_COUNT = gql`
  query PerformersSoloOnlyCount {
    performersSoloOnlyCount
  }
`;

const PERFORMERS_ONE_SCENE_COUNT = gql`
  query PerformersOneSceneCount {
    performersOneSceneCount
  }
`;

// Estimated liters from orgasms (orgasm count × 3ml)
const ESTIMATED_LITERS = gql`
  query EstimatedLiters {
    estimatedLiters
  }
`;

// Total penis meters (sum of penis lengths, default 17cm if missing, converted to meters)
const TOTAL_PENIS_METERS = gql`
  query TotalPenisMeters {
    totalPenisMeters
  }
`;

export const CustomStats: React.FC = () => {
  const { data: statsData, error, loading } = useStats();
  const { data: ethData } = usePerformerEthnicityCountsQuery();
  const { data: fiveStarData } = useQuery(PERFORMER_ETHNICITY_FIVE_STAR_COUNTS);
  const { data: oYearData } = useQuery(SCENE_O_YEAR_COUNTS);
  const { data: orgasmCountData } = useQuery(ORGASM_TOTAL_COUNT);
  const { data: facialCountData } = useQuery(FACIAL_TOTAL_COUNT);
  const { data: performersGivenData } = useQuery(PERFORMERS_FACIAL_GIVEN_COUNT);
  const { data: performersReceivedData } = useQuery(
    PERFORMERS_FACIAL_RECEIVED_COUNT
  );
  const { data: sexGivenData } = useQuery(PERFORMERS_SEX_GIVEN_COUNT);
  const { data: sexReceivedData } = useQuery(PERFORMERS_SEX_RECEIVED_COUNT);
  const { data: oralGivenData } = useQuery(PERFORMERS_ORAL_GIVEN_COUNT);
  const { data: oralReceivedData } = useQuery(PERFORMERS_ORAL_RECEIVED_COUNT);
  const { data: soloOnlyData } = useQuery(PERFORMERS_SOLO_ONLY_COUNT);
  const { data: oneSceneData } = useQuery(PERFORMERS_ONE_SCENE_COUNT);
  const { data: litersData } = useQuery(ESTIMATED_LITERS);
  const { data: metersData } = useQuery(TOTAL_PENIS_METERS);

  const { configuration } = useConfigurationContext();

  // Get role tag IDs from the new configuration
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};
  const sexTagId = roleTagIds.sexTagId;
  const oralTagId = roleTagIds.oralTagId;
  const soloTagId = roleTagIds.soloTagId;
  const facialTagId = roleTagIds.facialTagId;

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

  // Oral: has oral markers BUT NOT sex markers
  const makeOralScenesUrl = () => {
    if (!oralTag) return "#";
    const excludeTags = sexTag ? [{ id: sexTag.id, label: sexTag.name }] : [];
    return NavUtils.makeScenesWithExclusiveMarkerTagUrl(
      oralTag.id,
      oralTag.name,
      excludeTags
    );
  };

  // Solo: has solo markers BUT NOT sex OR oral markers
  const makeSoloScenesUrl = () => {
    if (!soloTag) return "#";
    const excludeTags = [];
    if (sexTag) excludeTags.push({ id: sexTag.id, label: sexTag.name });
    if (oralTag) excludeTags.push({ id: oralTag.id, label: oralTag.name });
    return NavUtils.makeScenesWithExclusiveMarkerTagUrl(
      soloTag.id,
      soloTag.name,
      excludeTags
    );
  };

  // Facial: has facial markers (no exclusions for now)
  const makeFacialScenesUrl = () => {
    if (!facialTag) return "#";
    return NavUtils.makeScenesWithMarkerTagUrl(facialTag.id, facialTag.name);
  };

  // Helper to create performer filter URLs with scene count
  const makePerformerSceneCountUrl = (sceneCount: number) => {
    const filter = new ListFilterModel(GQL.FilterMode.Performers, undefined);
    const criterion = filter.makeCriterion("scene_count");
    if (criterion) {
      (criterion as any).modifier = GQL.CriterionModifier.Equals;
      (criterion as any).value = sceneCount;
      filter.criteria.push(criterion);
    }
    return `/performers?${filter.makeQueryParameters()}`;
  };

  if (error) return <span>{error.message}</span>;
  if (loading || !statsData) return <LoadingIndicator />;

  return (
    <div className="mt-5">
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
                  disabled={(statsData as any).stats.facial_scene_count === 0}
                >
                  <img
                    src={goateeSvg}
                    alt="Facial"
                    className="stats-category-icon"
                  />
                  <span className="ml-2">
                    <FormattedNumber
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
        typeof performersGivenData?.performersFacialGivenCount === "number" ||
        typeof performersReceivedData?.performersFacialReceivedCount ===
          "number" ||
        typeof sexGivenData?.performersSexGivenCount === "number" ||
        typeof sexReceivedData?.performersSexReceivedCount === "number" ||
        typeof oralGivenData?.performersOralGivenCount === "number" ||
        typeof oralReceivedData?.performersOralReceivedCount === "number" ||
        typeof soloOnlyData?.performersSoloOnlyCount === "number" ||
        typeof oneSceneData?.performersOneSceneCount === "number" ||
        typeof litersData?.estimatedLiters === "number" ||
        typeof metersData?.totalPenisMeters === "number") && (
        <div className="col col-sm-8 m-sm-auto row stats">
          {typeof orgasmCountData?.sceneOrgasmCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <FormattedNumber value={orgasmCountData.sceneOrgasmCount} />
              </p>
              <p className="heading">Total orgasms</p>
            </div>
          )}
          {typeof litersData?.estimatedLiters === "number" && (
            <div className="stats-element">
              <p className="title">
                <FormattedNumber
                  value={litersData.estimatedLiters}
                  maximumFractionDigits={2}
                />{" "}
                L
              </p>
              <p className="heading">Estimated liters</p>
            </div>
          )}
          {typeof metersData?.totalPenisMeters === "number" && (
            <div className="stats-element">
              <p className="title">
                <FormattedNumber
                  value={metersData.totalPenisMeters}
                  maximumFractionDigits={2}
                />{" "}
                m
              </p>
              <p className="heading">Total penis meters</p>
            </div>
          )}
          {typeof facialCountData?.sceneFacialCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <FormattedNumber value={facialCountData.sceneFacialCount} />
              </p>
              <p className="heading">Total facials</p>
            </div>
          )}
          {typeof performersGivenData?.performersFacialGivenCount ===
            "number" && (
            <div className="stats-element">
              <p className="title">
                <FormattedNumber
                  value={performersGivenData.performersFacialGivenCount}
                />
              </p>
              <p className="heading">Performers given facials</p>
            </div>
          )}
          {typeof performersReceivedData?.performersFacialReceivedCount ===
            "number" && (
            <div className="stats-element">
              <p className="title">
                <FormattedNumber
                  value={performersReceivedData.performersFacialReceivedCount}
                />
              </p>
              <p className="heading">Performers received facials</p>
            </div>
          )}
          {typeof sexGivenData?.performersSexGivenCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <FormattedNumber value={sexGivenData.performersSexGivenCount} />
              </p>
              <p className="heading">Performers topped sexually</p>
            </div>
          )}
          {typeof sexReceivedData?.performersSexReceivedCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <FormattedNumber
                  value={sexReceivedData.performersSexReceivedCount}
                />
              </p>
              <p className="heading">Performers bottomed sexually</p>
            </div>
          )}
          {typeof oralGivenData?.performersOralGivenCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <FormattedNumber
                  value={oralGivenData.performersOralGivenCount}
                />
              </p>
              <p className="heading">Performers topped orally</p>
            </div>
          )}
          {typeof oralReceivedData?.performersOralReceivedCount ===
            "number" && (
            <div className="stats-element">
              <p className="title">
                <FormattedNumber
                  value={oralReceivedData.performersOralReceivedCount}
                />
              </p>
              <p className="heading">Performers bottomed orally</p>
            </div>
          )}
          {typeof soloOnlyData?.performersSoloOnlyCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <FormattedNumber value={soloOnlyData.performersSoloOnlyCount} />
              </p>
              <p className="heading">Solo only performers</p>
            </div>
          )}
          {typeof oneSceneData?.performersOneSceneCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerSceneCountUrl(1)}>
                  <FormattedNumber
                    value={oneSceneData.performersOneSceneCount}
                  />
                </Link>
              </p>
              <p className="heading">One scene performers</p>
            </div>
          )}
        </div>
      )}

      {/* Ethnicity reports side-by-side */}
      {(ethData?.performerEthnicityCounts?.length ?? 0) > 0 ||
      (fiveStarData?.performerEthnicityFiveStarCounts?.length ?? 0) > 0 ? (
        <div className="row justify-content-center mt-5">
          {(ethData?.performerEthnicityCounts?.length ?? 0) > 0 ? (
            <div className="col-12 col-md-auto" style={{ maxWidth: 420 }}>
              <h5 className="mb-3">
                <FormattedMessage
                  id="stats.performers_by_ethnicity"
                  defaultMessage="Performers by ethnicity"
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
                      <th className="text-right">
                        <FormattedMessage
                          id="performers"
                          defaultMessage="Performers"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ethData!.performerEthnicityCounts.map((row) => (
                      <tr key={row.ethnicity}>
                        <td>
                          <Link
                            to={NavUtils.makePerformersEthnicityUrl(
                              row.ethnicity
                            )}
                          >
                            {row.ethnicity}
                          </Link>
                        </td>
                        <td className="text-right">
                          <FormattedNumber value={row.count} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {(fiveStarData?.performerEthnicityFiveStarCounts?.length ?? 0) > 0 ? (
            <div
              className="col-12 col-md-auto mt-4 mt-md-0 ml-md-4"
              style={{ maxWidth: 420 }}
            >
              <h5 className="mb-3">
                <FormattedMessage
                  id="stats.five_star_performers_by_ethnicity"
                  defaultMessage="5-star performers by ethnicity"
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
                      <th className="text-right">
                        <FormattedMessage
                          id="performers"
                          defaultMessage="Performers"
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiveStarData!.performerEthnicityFiveStarCounts.map(
                      (row: { ethnicity: string; count: number }) => (
                        <tr key={`5star-${row.ethnicity}`}>
                          <td>
                            <Link
                              to={NavUtils.makePerformersEthnicityRatingUrl(
                                row.ethnicity,
                                100
                              )}
                            >
                              {row.ethnicity}
                            </Link>
                          </td>
                          <td className="text-right">
                            <FormattedNumber value={row.count} />
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {(oYearData?.sceneOYearCounts?.length ?? 0) > 0 ? (
        <div className="row justify-content-center mt-5">
          <div className="col-12 col-md-auto" style={{ maxWidth: 420 }}>
            <h5 className="mb-3">Scene O Counts by Year</h5>
            <div className="table-responsive">
              <table className="table table-sm table-striped mb-0">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th className="text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {oYearData!.sceneOYearCounts.map(
                    (row: { year: number; count: number }) => (
                      <tr key={`oyear-${row.year}`}>
                        <td>{row.year}</td>
                        <td className="text-right">
                          <FormattedNumber value={row.count} />
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CustomStats;
