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
  // Get configuration FIRST so we can use it in queries
  const { configuration } = useConfigurationContext();
  const roleTagIds = configuration?.ui?.roleTagIds ?? {};

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
  // Use findPerformers with custom_filters to get counts
  const { data: strictTopData } = useQuery(
    gql`
      query FindPerformersStrictTop($filter: FindFilterType, $performer_filter: PerformerFilterType) {
        findPerformers(filter: $filter, performer_filter: $performer_filter) {
          count
        }
      }
    `,
    {
      variables: {
        filter: { per_page: 1 },
        performer_filter: {
          custom_filters: {
            type: "strict_tops",
            sex_tag_id: roleTagIds?.sexTagId,
            oral_tag_id: roleTagIds?.oralTagId,
            facial_tag_id: roleTagIds?.facialTagId,
          },
        },
      },
      skip: !roleTagIds?.sexTagId,
    }
  );

  const { data: lenientTopData } = useQuery(
    gql`
      query FindPerformersLenientTop($filter: FindFilterType, $performer_filter: PerformerFilterType) {
        findPerformers(filter: $filter, performer_filter: $performer_filter) {
          count
        }
      }
    `,
    {
      variables: {
        filter: { per_page: 1 },
        performer_filter: {
          custom_filters: {
            type: "lenient_tops",
            sex_tag_id: roleTagIds?.sexTagId,
            oral_tag_id: roleTagIds?.oralTagId,
            facial_tag_id: roleTagIds?.facialTagId,
          },
        },
      },
      skip: !roleTagIds?.sexTagId,
    }
  );

  const { data: strictBottomData } = useQuery(
    gql`
      query FindPerformersStrictBottom($filter: FindFilterType, $performer_filter: PerformerFilterType) {
        findPerformers(filter: $filter, performer_filter: $performer_filter) {
          count
        }
      }
    `,
    {
      variables: {
        filter: { per_page: 1 },
        performer_filter: {
          custom_filters: {
            type: "strict_bottoms",
            sex_tag_id: roleTagIds?.sexTagId,
            oral_tag_id: roleTagIds?.oralTagId,
            facial_tag_id: roleTagIds?.facialTagId,
          },
        },
      },
      skip: !roleTagIds?.sexTagId,
    }
  );

  const { data: lenientBottomData } = useQuery(
    gql`
      query FindPerformersLenientBottom($filter: FindFilterType, $performer_filter: PerformerFilterType) {
        findPerformers(filter: $filter, performer_filter: $performer_filter) {
          count
        }
      }
    `,
    {
      variables: {
        filter: { per_page: 1 },
        performer_filter: {
          custom_filters: {
            type: "lenient_bottoms",
            sex_tag_id: roleTagIds?.sexTagId,
            oral_tag_id: roleTagIds?.oralTagId,
            facial_tag_id: roleTagIds?.facialTagId,
          },
        },
      },
      skip: !roleTagIds?.sexTagId,
    }
  );
  const { data: litersData } = useQuery(ESTIMATED_LITERS);
  const { data: metersData } = useQuery(TOTAL_PENIS_METERS);
  const { data: orgasmTimeData } = useQuery(TOTAL_ORGASM_TIME);
  const { data: facialTimeData } = useQuery(TOTAL_FACIAL_TIME);

  // Extract individual tag IDs for convenience
  const {sexTagId} = roleTagIds;
  const {oralTagId} = roleTagIds;
  const {soloTagId} = roleTagIds;
  const {facialTagId} = roleTagIds;

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
    return NavUtils.makeScenesWithMarkerTagUrl(facialTag.id, facialTag.name, -1);
  };

  // Helper to generate random sort ID
  const getRandomSortId = () => Math.floor(Math.random() * 100000000);

  // Helper to create performer filter URLs with scene count
  const makePerformerSceneCountUrl = (sceneCount: number) => {
    const filter = new ListFilterModel(GQL.FilterMode.Performers, undefined);
    const criterion = filter.makeCriterion("scene_count");
    if (criterion) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (criterion as any).modifier = GQL.CriterionModifier.Equals;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (criterion as any).value = sceneCount;
      filter.criteria.push(criterion);
    }
    return `/performers?${filter.makeQueryParameters()}&sortby=random_${getRandomSortId()}`;
  };

  // Helper to create performer marker URLs with role
  // Note: depth 0 = exact tag match only, depth -1 = includes all subtags
  // Backend oral/facial counts use exact primary_tag_id match, so we use depth 0 to match
  const makePerformerMarkerRoleUrl = (
    tag: { id: string; name: string } | undefined,
    role: "top" | "bottom",
    depth: number = 0
  ) => {
    if (!tag) return "#";
    const criterionData = {
      type: "performer_markers",
      modifier: "INCLUDES_ALL",
      group: {
        tag_ids: [{ id: tag.id, label: tag.name }],
        depth,
        performer_ids: [],
        performer_ethnicities: [],
        performer_countries: [],
        performer_rating: null,
        performer_role: role,
        partner_ids: [],
        partner_ethnicities: [],
        partner_countries: [],
        partner_rating: null,
        partner_role: "any",
      },
    };
    return `/performers?c=${encodeURIComponent(JSON.stringify(criterionData))}&sortby=random_${getRandomSortId()}`;
  };

  // Helper to create solo-only performers URL (has solo markers but not sex/oral)
  const makeSoloOnlyPerformersUrl = () => {
    if (!soloTag) return "#";
    const criteria = [];
    
    // Include solo markers as top
    criteria.push({
      type: "performer_markers",
      modifier: "INCLUDES_ALL",
      group: {
        tag_ids: [{ id: soloTag.id, label: soloTag.name }],
        depth: -1,
        performer_ids: [],
        performer_ethnicities: [],
        performer_countries: [],
        performer_rating: null,
        performer_role: "top",
        partner_ids: [],
        partner_ethnicities: [],
        partner_countries: [],
        partner_rating: null,
        partner_role: "any",
      },
    });

    // Exclude sex and oral markers
    const excludeTags = [];
    if (oralTag) excludeTags.push({ id: oralTag.id, label: oralTag.name });
    if (sexTag) excludeTags.push({ id: sexTag.id, label: sexTag.name });
    
    if (excludeTags.length > 0) {
      criteria.push({
        type: "performer_markers_exclude",
        modifier: "INCLUDES_ALL",
        group: {
          tag_ids: excludeTags,
          depth: -1, // Use depth -1 to exclude all subtags
          performer_ids: [],
          performer_ethnicities: [],
          performer_countries: [],
          performer_rating: null,
          performer_role: "any",
          partner_ids: [],
          partner_ethnicities: [],
          partner_countries: [],
          partner_rating: null,
          partner_role: "any",
        },
      });
    }

    return `/performers?${criteria.map(c => `c=${encodeURIComponent(JSON.stringify(c))}`).join('&')}&sortby=random_${getRandomSortId()}`;
  };

  // Helper to create custom filter URLs
  const makeCustomFilterUrl = (filterType: "strict_tops" | "lenient_tops" | "strict_bottoms" | "lenient_bottoms") => {
    const criterion = {
      type: "custom_filters",
      value: filterType,
    };

    return `/performers?c=${encodeURIComponent(JSON.stringify(criterion))}&sortby=random_${getRandomSortId()}`;
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
    return `/scenes/markers?c=${encodeURIComponent(JSON.stringify(criterionData))}&sortby=title`;
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
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  disabled={(statsData as any).stats.facial_scene_count === 0}
                >
                  <img
                    src={goateeSvg}
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
        typeof facialTimeData?.totalFacialTime === "number" ||
        typeof litersData?.estimatedLiters === "number" ||
        typeof metersData?.totalPenisMeters === "number") && (
        <div className="col col-sm-8 m-sm-auto row stats">
          {typeof orgasmCountData?.sceneOrgasmCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makeMarkersTagUrl(allTags.find((t) => t.id === roleTagIds.orgasmTagId))}>
                  <FormattedNumber value={orgasmCountData.sceneOrgasmCount} />
                </Link>
              </p>
              <p className="heading">Total orgasms</p>
            </div>
          )}
          {typeof orgasmTimeData?.totalOrgasmTime === "number" && orgasmTimeData.totalOrgasmTime > 0 && (
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
                <Link to={makeMarkersTagUrl(allTags.find((t) => t.id === roleTagIds.facialTagId))}>
                  <FormattedNumber value={facialCountData.sceneFacialCount} />
                </Link>
              </p>
              <p className="heading">Total facials</p>
            </div>
          )}
          {typeof facialTimeData?.totalFacialTime === "number" && facialTimeData.totalFacialTime > 0 && (
            <div className="stats-element">
              <p className="title">
                {formatDuration(facialTimeData.totalFacialTime)}
              </p>
              <p className="heading">Total facial time</p>
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
        </div>
      )}

      {/* Performer Role Stats - in order: Top, Bottom, Strict Top, Lenient Top, Strict Bottom, Lenient Bottom, Oral Tops, Oral Bottoms, Facial Tops, Facial Bottoms */}
      {(typeof sexGivenData?.performersSexGivenCount === "number" ||
        typeof sexReceivedData?.performersSexReceivedCount === "number" ||
        typeof strictTopData?.findPerformers?.count === "number" ||
        typeof lenientTopData?.findPerformers?.count === "number" ||
        typeof strictBottomData?.findPerformers?.count === "number" ||
        typeof lenientBottomData?.findPerformers?.count === "number" ||
        typeof oralGivenData?.performersOralGivenCount === "number" ||
        typeof oralReceivedData?.performersOralReceivedCount === "number" ||
        typeof performersGivenData?.performersFacialGivenCount === "number" ||
        typeof performersReceivedData?.performersFacialReceivedCount ===
          "number") && (
        <div className="col col-sm-8 m-sm-auto row stats mt-4">
          {typeof sexGivenData?.performersSexGivenCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerMarkerRoleUrl(sexTag, "top")}>
                  <FormattedNumber value={sexGivenData.performersSexGivenCount} />
                </Link>
              </p>
              <p className="heading">Tops</p>
            </div>
          )}
          {typeof sexReceivedData?.performersSexReceivedCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerMarkerRoleUrl(sexTag, "bottom")}>
                  <FormattedNumber
                    value={sexReceivedData.performersSexReceivedCount}
                  />
                </Link>
              </p>
              <p className="heading">Bottoms</p>
            </div>
          )}
          {typeof strictTopData?.findPerformers?.count === "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makeCustomFilterUrl("strict_tops")}>
                  <FormattedNumber
                    value={strictTopData.findPerformers.count}
                  />
                </Link>
              </p>
              <p className="heading">Strict Tops</p>
            </div>
          )}
          {typeof lenientTopData?.findPerformers?.count === "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makeCustomFilterUrl("lenient_tops")}>
                  <FormattedNumber
                    value={lenientTopData.findPerformers.count}
                  />
                </Link>
              </p>
              <p className="heading">Lenient Tops</p>
            </div>
          )}
          {typeof strictBottomData?.findPerformers?.count === "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makeCustomFilterUrl("strict_bottoms")}>
                  <FormattedNumber
                    value={strictBottomData.findPerformers.count}
                  />
                </Link>
              </p>
              <p className="heading">Strict Bottoms</p>
            </div>
          )}
          {typeof lenientBottomData?.findPerformers?.count === "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makeCustomFilterUrl("lenient_bottoms")}>
                  <FormattedNumber
                    value={lenientBottomData.findPerformers.count}
                  />
                </Link>
              </p>
              <p className="heading">Lenient Bottoms</p>
            </div>
          )}
          {typeof oralGivenData?.performersOralGivenCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerMarkerRoleUrl(oralTag, "top")}>
                  <FormattedNumber
                    value={oralGivenData.performersOralGivenCount}
                  />
                </Link>
              </p>
              <p className="heading">Oral Tops</p>
            </div>
          )}
          {typeof oralReceivedData?.performersOralReceivedCount ===
            "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerMarkerRoleUrl(oralTag, "bottom")}>
                  <FormattedNumber
                    value={oralReceivedData.performersOralReceivedCount}
                  />
                </Link>
              </p>
              <p className="heading">Oral Bottoms</p>
            </div>
          )}
          {typeof performersGivenData?.performersFacialGivenCount ===
            "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerMarkerRoleUrl(facialTag, "top")}>
                  <FormattedNumber
                    value={performersGivenData.performersFacialGivenCount}
                  />
                </Link>
              </p>
              <p className="heading">Facial Tops</p>
            </div>
          )}
          {typeof performersReceivedData?.performersFacialReceivedCount ===
            "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerMarkerRoleUrl(facialTag, "bottom")}>
                  <FormattedNumber
                    value={performersReceivedData.performersFacialReceivedCount}
                  />
                </Link>
              </p>
              <p className="heading">Facial Bottoms</p>
            </div>
          )}
        </div>
      )}

      {/* Other Performer Stats */}
      {(typeof soloOnlyData?.performersSoloOnlyCount === "number" ||
        typeof oneSceneData?.performersOneSceneCount === "number") && (
        <div className="col col-sm-8 m-sm-auto row stats mt-4">
          {typeof soloOnlyData?.performersSoloOnlyCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <Link to={makeSoloOnlyPerformersUrl()}>
                  <FormattedNumber value={soloOnlyData.performersSoloOnlyCount} />
                </Link>
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
