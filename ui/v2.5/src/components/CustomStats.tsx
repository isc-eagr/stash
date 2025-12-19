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
import { ConfigurationContext } from "src/hooks/Config";
import { ListFilterModel } from "src/models/list-filter/filter";
import { PerformerSceneTagsInPerformerFilterOption, TagsCriterion } from "src/models/list-filter/criteria/tags";

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

// Position-based performer counts
const PERFORMERS_STRICT_TOP_COUNT = gql`
  query PerformersStrictTopCount {
    performersStrictTopCount
  }
`;

const PERFORMERS_STRICT_BOTTOM_COUNT = gql`
  query PerformersStrictBottomCount {
    performersStrictBottomCount
  }
`;

const PERFORMERS_LENIENT_TOP_COUNT = gql`
  query PerformersLenientTopCount {
    performersLenientTopCount
  }
`;

const PERFORMERS_LENIENT_BOTTOM_COUNT = gql`
  query PerformersLenientBottomCount {
    performersLenientBottomCount
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

export const CustomStats: React.FC = () => {
  const { data: statsData, error, loading } = useStats();
  const { data: ethData } = usePerformerEthnicityCountsQuery();
  const { data: fiveStarData } = useQuery(
    PERFORMER_ETHNICITY_FIVE_STAR_COUNTS
  );
  const { data: oYearData } = useQuery(SCENE_O_YEAR_COUNTS);
  const { data: orgasmCountData } = useQuery(ORGASM_TOTAL_COUNT);
  const { data: facialCountData } = useQuery(FACIAL_TOTAL_COUNT);
  const { data: performersGivenData } = useQuery(PERFORMERS_FACIAL_GIVEN_COUNT);
  const { data: performersReceivedData } = useQuery(PERFORMERS_FACIAL_RECEIVED_COUNT);
  const { data: strictTopData } = useQuery(PERFORMERS_STRICT_TOP_COUNT);
  const { data: strictBottomData } = useQuery(PERFORMERS_STRICT_BOTTOM_COUNT);
  const { data: lenientTopData } = useQuery(PERFORMERS_LENIENT_TOP_COUNT);
  const { data: lenientBottomData } = useQuery(PERFORMERS_LENIENT_BOTTOM_COUNT);
  const { data: soloOnlyData } = useQuery(PERFORMERS_SOLO_ONLY_COUNT);
  const { data: oneSceneData } = useQuery(PERFORMERS_ONE_SCENE_COUNT);
  
  const { configuration } = React.useContext(ConfigurationContext);
  const cfg = (configuration?.ui as any)?.sceneTagAliases ?? {};

  // Query for tag IDs based on configured tag names
  const topTagName = cfg.top ?? "top";
  const bottomTagName = cfg.bottom ?? "bottom";
  const oralTopTagName = cfg.oraltop ?? "oraltop";
  const oralBottomTagName = cfg.oralbottom ?? "oralbottom";
  const soloTagName = cfg.solo ?? "solo";
  const facialGivenTagName = cfg.facialgiven ?? "facialgiven";
  const facialReceivedTagName = cfg.facialreceived ?? "facialreceived";
  const selfFacialTagName = cfg.selffacial ?? "selffacial";
  
  const { data: tagsData } = GQL.useFindTagsQuery({
    variables: {
      filter: {
        per_page: -1,
      },
    },
  });
  
  // Map tag names to IDs
  const allTags = tagsData?.findTags?.tags ?? [];
  const topTag = allTags.find(t => t.name.toLowerCase() === topTagName.toLowerCase());
  const bottomTag = allTags.find(t => t.name.toLowerCase() === bottomTagName.toLowerCase());
  const oralTopTag = allTags.find(t => t.name.toLowerCase() === oralTopTagName.toLowerCase());
  const oralBottomTag = allTags.find(t => t.name.toLowerCase() === oralBottomTagName.toLowerCase());
  const soloTag = allTags.find(t => t.name.toLowerCase() === soloTagName.toLowerCase());
  const facialGivenTag = allTags.find(t => t.name.toLowerCase() === facialGivenTagName.toLowerCase());
  const facialReceivedTag = allTags.find(t => t.name.toLowerCase() === facialReceivedTagName.toLowerCase());
  const selfFacialTag = allTags.find(t => t.name.toLowerCase() === selfFacialTagName.toLowerCase());

  // Helper to create performer filter URLs with performer_scene_tags
  const makePerformerPositionUrl = (includeTags: { id: string; name: string }[], excludeTags: { id: string; name: string }[]) => {
    const filter = new ListFilterModel(GQL.FilterMode.Performers, undefined);
    const criterion = PerformerSceneTagsInPerformerFilterOption.makeCriterion() as TagsCriterion;
    criterion.modifier = GQL.CriterionModifier.IncludesAll;
    criterion.value = {
      items: includeTags.map(t => ({ id: t.id, label: t.name })),
      excluded: excludeTags.map(t => ({ id: t.id, label: t.name })),
      depth: 0,
    };
    filter.criteria.push(criterion);
    return `/performers?${filter.makeQueryParameters()}`;
  };

  // Helper for strict positions using INCLUDES modifier
  const makePerformerStrictPositionUrl = (includeTags: { id: string; name: string }[], excludeTags: { id: string; name: string }[]) => {
    const filter = new ListFilterModel(GQL.FilterMode.Performers, undefined);
    const criterion = PerformerSceneTagsInPerformerFilterOption.makeCriterion() as TagsCriterion;
    criterion.modifier = GQL.CriterionModifier.Includes;
    criterion.value = {
      items: includeTags.map(t => ({ id: t.id, label: t.name })),
      excluded: excludeTags.map(t => ({ id: t.id, label: t.name })),
      depth: 0,
    };
    filter.criteria.push(criterion);
    return `/performers?${filter.makeQueryParameters()}`;
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
      {/* Scene Category Counts */}
      {statsData && (topTag || bottomTag || oralTopTag || oralBottomTag || soloTag || facialGivenTag || facialReceivedTag || selfFacialTag) && (
        <div className="col col-sm-8 m-sm-auto row stats">
          {topTag && bottomTag && (
          <div className="stats-element">
            <p className="title">
              <Button 
                className="stats-category-button sex-stats-button"
                href={NavUtils.makeGlobalSexScenesUrl(topTag.id, topTag.name, bottomTag.id, bottomTag.name)}
                disabled={statsData.stats.sex_scene_count === 0}
              >
                <img src={gaySvg} alt="Sex" className="stats-category-icon" />
                <span className="ml-2"><FormattedNumber value={statsData.stats.sex_scene_count} /></span>
              </Button>
            </p>
          </div>
          )}
          {oralTopTag && oralBottomTag && topTag && bottomTag && (
          <div className="stats-element">
            <p className="title">
              <Button 
                className="stats-category-button oral-stats-button"
                href={NavUtils.makeGlobalOralScenesUrl(
                  oralTopTag.id, oralTopTag.name, oralBottomTag.id, oralBottomTag.name,
                  topTag.id, topTag.name, bottomTag.id, bottomTag.name
                )}
                disabled={statsData.stats.oral_scene_count === 0}
              >
                <img src={mouthSvg} alt="Oral" className="stats-category-icon" />
                <span className="ml-2"><FormattedNumber value={statsData.stats.oral_scene_count} /></span>
              </Button>
            </p>
          </div>
          )}
          {soloTag && statsData?.stats && (
          <div className="stats-element solo-category-button-container" style={{ display: 'block' }}>
            <p className="title">
              <Button 
                className="stats-category-button solo-stats-button"
                href={soloTag && topTag && bottomTag && oralTopTag && oralBottomTag ? NavUtils.makeGlobalSoloScenesUrl(
                  soloTag.id, soloTag.name,
                  topTag.id, topTag.name, bottomTag.id, bottomTag.name,
                  oralTopTag.id, oralTopTag.name, oralBottomTag.id, oralBottomTag.name
                ) : "#"}
                disabled={(!topTag || !bottomTag || !oralTopTag || !oralBottomTag) || statsData.stats.solo_scene_count === 0}
              >
                <Icon icon={faHand} className="stats-category-icon-fa" />
                <span className="ml-2"><FormattedNumber value={statsData.stats.solo_scene_count} /></span>
              </Button>
            </p>
          </div>
          )}
          {(facialGivenTag || facialReceivedTag || selfFacialTag) && (
            <div className="stats-element">
              <p className="title">
                <Button
                  className="stats-category-button facial-stats-button ml-4"
                  href={NavUtils.makeGlobalFacialScenesUrl(
                    (facialGivenTag ?? selfFacialTag)!.id,
                    (facialGivenTag ?? selfFacialTag)!.name,
                    (facialReceivedTag ?? selfFacialTag)!.id,
                    (facialReceivedTag ?? selfFacialTag)!.name,
                    selfFacialTag?.id,
                    selfFacialTag?.name
                  )}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  disabled={(statsData as any).stats.facial_scene_count === 0}
                >
                  <img src={goateeSvg} alt="Facial" className="stats-category-icon" />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <span className="ml-2"><FormattedNumber value={(statsData as any).stats.facial_scene_count ?? (statsData as any).stats.facialSceneCount ?? 0} /></span>
                </Button>
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Extra spacing between counts and ethnicity report */}
      <div className="my-5" aria-hidden="true" />

      {/* Orgasm + Facial Stats (moved above tables) */}
      {(
        typeof orgasmCountData?.sceneOrgasmCount === "number" ||
        typeof facialCountData?.sceneFacialCount === "number" ||
        typeof performersGivenData?.performersFacialGivenCount === "number" ||
        typeof performersReceivedData?.performersFacialReceivedCount === "number" ||
        typeof strictTopData?.performersStrictTopCount === "number" ||
        typeof strictBottomData?.performersStrictBottomCount === "number" ||
        typeof lenientTopData?.performersLenientTopCount === "number" ||
        typeof lenientBottomData?.performersLenientBottomCount === "number" ||
        typeof soloOnlyData?.performersSoloOnlyCount === "number" ||
        typeof oneSceneData?.performersOneSceneCount === "number"
      ) && (
        <div className="col col-sm-8 m-sm-auto row stats">
          {typeof orgasmCountData?.sceneOrgasmCount === "number" && (
            <div className="stats-element">
              <p className="title">
                <FormattedNumber value={orgasmCountData.sceneOrgasmCount} />
              </p>
              <p className="heading">Total orgasms</p>
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
          {typeof performersGivenData?.performersFacialGivenCount === "number" && facialGivenTag && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerPositionUrl(
                  [{ id: facialGivenTag.id, name: facialGivenTag.name }],
                  []
                )}>
                  <FormattedNumber value={performersGivenData.performersFacialGivenCount} />
                </Link>
              </p>
              <p className="heading">Performers given facials</p>
            </div>
          )}
          {typeof performersReceivedData?.performersFacialReceivedCount === "number" && facialReceivedTag && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerPositionUrl(
                  [{ id: facialReceivedTag.id, name: facialReceivedTag.name }],
                  []
                )}>
                  <FormattedNumber value={performersReceivedData.performersFacialReceivedCount} />
                </Link>
              </p>
              <p className="heading">Performers received facials</p>
            </div>
          )}
          {typeof strictTopData?.performersStrictTopCount === "number" && topTag && oralTopTag && bottomTag && oralBottomTag && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerStrictPositionUrl(
                  [{ id: topTag.id, name: topTag.name }, { id: oralTopTag.id, name: oralTopTag.name }],
                  [{ id: bottomTag.id, name: bottomTag.name }, { id: oralBottomTag.id, name: oralBottomTag.name }]
                )}>
                  <FormattedNumber value={strictTopData.performersStrictTopCount} />
                </Link>
              </p>
              <p className="heading">Strict tops</p>
            </div>
          )}
          {typeof strictBottomData?.performersStrictBottomCount === "number" && topTag && oralTopTag && bottomTag && oralBottomTag && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerStrictPositionUrl(
                  [{ id: bottomTag.id, name: bottomTag.name }, { id: oralBottomTag.id, name: oralBottomTag.name }],
                  [{ id: topTag.id, name: topTag.name }, { id: oralTopTag.id, name: oralTopTag.name }]
                )}>
                  <FormattedNumber value={strictBottomData.performersStrictBottomCount} />
                </Link>
              </p>
              <p className="heading">Strict bottoms</p>
            </div>
          )}
          {typeof lenientTopData?.performersLenientTopCount === "number" && topTag && bottomTag && oralBottomTag && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerPositionUrl(
                  [{ id: topTag.id, name: topTag.name }, { id: oralBottomTag.id, name: oralBottomTag.name }],
                  [{ id: bottomTag.id, name: bottomTag.name }]
                )}>
                  <FormattedNumber value={lenientTopData.performersLenientTopCount} />
                </Link>
              </p>
              <p className="heading">Lenient tops</p>
            </div>
          )}
          {typeof lenientBottomData?.performersLenientBottomCount === "number" && topTag && bottomTag && oralTopTag && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerPositionUrl(
                  [{ id: bottomTag.id, name: bottomTag.name }, { id: oralTopTag.id, name: oralTopTag.name }],
                  [{ id: topTag.id, name: topTag.name }]
                )}>
                  <FormattedNumber value={lenientBottomData.performersLenientBottomCount} />
                </Link>
              </p>
              <p className="heading">Lenient bottoms</p>
            </div>
          )}
          {typeof soloOnlyData?.performersSoloOnlyCount === "number" && soloTag && topTag && bottomTag && oralTopTag && oralBottomTag && (
            <div className="stats-element">
              <p className="title">
                <Link to={makePerformerPositionUrl(
                  [{ id: soloTag.id, name: soloTag.name }],
                  [
                    { id: topTag.id, name: topTag.name },
                    { id: bottomTag.id, name: bottomTag.name },
                    { id: oralTopTag.id, name: oralTopTag.name },
                    { id: oralBottomTag.id, name: oralBottomTag.name }
                  ]
                )}>
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
                  <FormattedNumber value={oneSceneData.performersOneSceneCount} />
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
                <FormattedMessage id="stats.performers_by_ethnicity" defaultMessage="Performers by ethnicity" />
              </h5>
              <div className="table-responsive">
                <table className="table table-sm table-striped mb-0">
                  <thead>
                    <tr>
                      <th>
                        <FormattedMessage id="ethnicity" defaultMessage="Ethnicity" />
                      </th>
                      <th className="text-right">
                        <FormattedMessage id="performers" defaultMessage="Performers" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ethData!.performerEthnicityCounts.map((row) => (
                      <tr key={row.ethnicity}>
                        <td>
                          <Link to={NavUtils.makePerformersEthnicityUrl(row.ethnicity)}>
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
            <div className="col-12 col-md-auto mt-4 mt-md-0 ml-md-4" style={{ maxWidth: 420 }}>
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
                        <FormattedMessage id="ethnicity" defaultMessage="Ethnicity" />
                      </th>
                      <th className="text-right">
                        <FormattedMessage id="performers" defaultMessage="Performers" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fiveStarData!.performerEthnicityFiveStarCounts.map((row: { ethnicity: string; count: number }) => (
                      <tr key={`5star-${row.ethnicity}`}>
                        <td>
                          <Link to={NavUtils.makePerformersEthnicityRatingUrl(row.ethnicity, 100)}>
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
                  {oYearData!.sceneOYearCounts.map((row: { year: number; count: number }) => (
                    <tr key={`oyear-${row.year}`}>
                      <td>{row.year}</td>
                      <td className="text-right">
                        <FormattedNumber value={row.count} />
                      </td>
                    </tr>
                  ))}
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
