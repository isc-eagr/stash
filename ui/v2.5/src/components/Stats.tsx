import React from "react";
import { gql, useQuery } from "@apollo/client";
import { useStats } from "src/core/StashService";
import { usePerformerEthnicityCountsQuery } from "src/core/generated-graphql";
import { FormattedMessage, FormattedNumber } from "react-intl";
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import TextUtils from "src/utils/text";
import { FileSize } from "./Shared/FileSize";

// Five-star performers by ethnicity
const PERFORMER_ETHNICITY_FIVE_STAR_COUNTS = gql`
  query PerformerEthnicityFiveStarCounts {
    performerEthnicityFiveStarCounts {
      ethnicity
      count
    }
  }
`;

export const Stats: React.FC = () => {
  const { data, error, loading } = useStats();
  const { data: ethData } = usePerformerEthnicityCountsQuery();
  const { data: fiveStarData } = useQuery(
    PERFORMER_ETHNICITY_FIVE_STAR_COUNTS
  );

  if (error) return <span>{error.message}</span>;
  if (loading || !data) return <LoadingIndicator />;

  const scenesDuration = TextUtils.secondsAsTimeString(
    data.stats.scenes_duration,
    3
  );

  const totalPlayDuration = TextUtils.secondsAsTimeString(
    data.stats.total_play_duration,
    3
  );

  return (
    <div className="mt-5">
      <div className="col col-sm-8 m-sm-auto row stats">
        <div className="stats-element">
          <p className="title">
            <FileSize size={data.stats.scenes_size} />
          </p>
          <p className="heading">
            <FormattedMessage id="stats.scenes_size" />
          </p>
        </div>
        <div className="stats-element">
          <p className="title">
            <FormattedNumber value={data.stats.scene_count} />
          </p>
          <p className="heading">
            <FormattedMessage id="scenes" />
          </p>
        </div>
        <div className="stats-element">
          <p className="title">
            <FormattedNumber value={data.stats.group_count} />
          </p>
          <p className="heading">
            <FormattedMessage id="groups" />
          </p>
        </div>
        <div className="stats-element">
          <p className="title">{scenesDuration || "-"}</p>
          <p className="heading">
            <FormattedMessage id="stats.scenes_duration" />
          </p>
        </div>
        <div className="stats-element">
          <p className="title">
            <FormattedNumber value={data.stats.performer_count} />
          </p>
          <p className="heading">
            <FormattedMessage id="performers" />
          </p>
        </div>
      </div>
      
      <div className="col col-sm-8 m-sm-auto row stats">
        <div className="stats-element">
          <p className="title">
            <FileSize size={data.stats.images_size} />
          </p>
          <p className="heading">
            <FormattedMessage id="stats.image_size" />
          </p>
        </div>
        <div className="stats-element">
          <p className="title">
            <FormattedNumber value={data.stats.gallery_count} />
          </p>
          <p className="heading">
            <FormattedMessage id="galleries" />
          </p>
        </div>
        <div className="stats-element">
          <p className="title">
            <FormattedNumber value={data.stats.image_count} />
          </p>
          <p className="heading">
            <FormattedMessage id="images" />
          </p>
        </div>
        <div className="stats-element">
          <p className="title">
            <FormattedNumber value={data.stats.studio_count} />
          </p>
          <p className="heading">
            <FormattedMessage id="studios" />
          </p>
        </div>
        <div className="stats-element">
          <p className="title">
            <FormattedNumber value={data.stats.tag_count} />
          </p>
          <p className="heading">
            <FormattedMessage id="tags" />
          </p>
        </div>
      </div>
      <div className="col col-sm-8 m-sm-auto row stats">
        <div className="stats-element">
          <p className="title">
            <FormattedNumber value={data.stats.total_o_count} />
          </p>
          <p className="heading">
            <FormattedMessage id="stats.total_o_count" />
          </p>
        </div>
        <div className="stats-element">
          <p className="title">
            <FormattedNumber value={data.stats.total_play_count} />
          </p>
          <p className="heading">
            <FormattedMessage id="stats.total_play_count" />
          </p>
        </div>
        <div className="stats-element">
          <p className="title">
            <FormattedNumber value={data.stats.scenes_played} />
          </p>
          <p className="heading">
            <FormattedMessage id="stats.scenes_played" />
          </p>
        </div>
        <div className="stats-element">
          <p className="title">{totalPlayDuration || "-"}</p>
          <p className="heading">
            <FormattedMessage id="stats.total_play_duration" />
          </p>
        </div>
      </div>
      {/* Extra spacing between core stats and ethnicity report */}
  <div className="my-5" aria-hidden="true" />
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
                        <td>{row.ethnicity}</td>
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
                        <td>{row.ethnicity}</td>
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
    </div>
  );
};

export default Stats;
