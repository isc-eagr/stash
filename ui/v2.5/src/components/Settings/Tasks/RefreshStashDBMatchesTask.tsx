import React from "react";
import { Button } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { useRefreshStashDbMatchesMutation } from "src/core/generated-graphql";
import { useToast } from "src/hooks/Toast";
import { SettingSection } from "../SettingSection";
import { Setting } from "../Inputs";

// CUSTOM: queues the StashDB Matches refresh job.
export const RefreshStashDBMatchesTask: React.FC = () => {
  const intl = useIntl();
  const Toast = useToast();
  const [refresh] = useRefreshStashDbMatchesMutation();

  async function onRefresh() {
    try {
      await refresh();
      Toast.success(
        intl.formatMessage(
          { id: "config.tasks.added_job_to_queue" },
          { operation_name: intl.formatMessage({ id: "stashdb_matches" }) }
        )
      );
    } catch (e) {
      Toast.error(e);
    }
  }

  return (
    <SettingSection>
      <Setting
        headingID="stashdb_matches"
        subHeadingID="config.tasks.refresh_stashdb_matches_desc"
      >
        <Button variant="secondary" type="submit" onClick={onRefresh}>
          <FormattedMessage id="actions.refresh" />
        </Button>
        <Link
          className="btn btn-secondary ml-2"
          to="/stashdb-matches/report"
          target="_blank"
          rel="noopener noreferrer"
        >
          Report
        </Link>
      </Setting>
    </SettingSection>
  );
};
