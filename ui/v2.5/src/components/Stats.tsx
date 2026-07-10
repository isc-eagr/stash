import React from "react";
import { useStats } from "src/core/StashService";
import { FormattedMessage, FormattedNumber } from "react-intl";
import { Helmet } from "react-helmet"; // CUSTOM
import { LoadingIndicator } from "src/components/Shared/LoadingIndicator";
import TextUtils from "src/utils/text";
import { FileSize } from "./Shared/FileSize";
import { useConfigurationContext } from "src/hooks/Config";
import { useTitleProps } from "src/hooks/title"; // CUSTOM
import { StatsLinks } from "./StatsLinks_custom"; // CUSTOM

export const Stats: React.FC = () => {
  const titleProps = useTitleProps("Stats");
  const { configuration } = useConfigurationContext();
  const { sfwContentMode } = configuration.interface;

  const oCountID = sfwContentMode
    ? "stats.total_o_count_sfw"
    : "stats.total_o_count";

  const { data, error, loading } = useStats();

  if (error)
    return (
      <>
        <Helmet {...titleProps} />
        <span>{error.message}</span>
      </>
    );
  if (loading || !data)
    return (
      <>
        <Helmet {...titleProps} />
        <LoadingIndicator />
      </>
    );

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
      {/* CUSTOM */}
      <Helmet {...titleProps} />

      {/* CUSTOM: begin */}
      <StatsLinks />
      {/* CUSTOM: end */}

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
            <FormattedMessage id={oCountID} />
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
    </div>
  );
};

export default Stats;
