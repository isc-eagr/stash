import React from "react";
import { Button } from "react-bootstrap";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";
import { useCheckStashDbChangesMutation } from "src/core/generated-graphql";
import { useToast } from "src/hooks/Toast";
import { SettingSection } from "../SettingSection";
import { Setting } from "../Inputs";

// CUSTOM: queues the StashDB Changes check of scenes and vatos.
export const StashDBChangesTask: React.FC = () => {
  const intl = useIntl();
  const Toast = useToast();
  const [check] = useCheckStashDbChangesMutation();

  async function onCheck() {
    try {
      await check({ variables: { input: { scenes: true, performers: true } } });
      Toast.success(
        intl.formatMessage(
          { id: "config.tasks.added_job_to_queue" },
          { operation_name: intl.formatMessage({ id: "stashdb_changes" }) }
        )
      );
    } catch (e) {
      Toast.error(e);
    }
  }

  return (
    <SettingSection>
      <Setting
        headingID="stashdb_changes"
        subHeadingID="config.tasks.check_stashdb_changes_desc"
      >
        <Button variant="secondary" type="submit" onClick={onCheck}>
          Check
        </Button>
        <Link
          className="btn btn-secondary ml-2"
          to="/stashdb-changes"
          target="_blank"
          rel="noopener noreferrer"
        >
          Report
        </Link>
      </Setting>
    </SettingSection>
  );
};
