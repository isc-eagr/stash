// CUSTOM: Studio site sync button for studios with a supported site.
import React, { useCallback, useState } from "react";
import { Button, Form } from "react-bootstrap";
import { faDownload } from "@fortawesome/free-solid-svg-icons";
import { ModalComponent } from "src/components/Shared/Modal";
import {
  useStudioSiteSyncMutation,
  useStudioSiteSyncReportQuery,
} from "src/core/generated-graphql";
import { useToast } from "src/hooks/Toast";
import { useMonitorJob } from "src/utils/job";
import {
  SITE_SYNC_ALL_STEPS_CUSTOM,
  SiteSyncSelectionCustom,
  SiteSyncSiteCustom,
  siteSyncHasStepCustom,
  siteSyncInputCustom,
  siteSyncStepsCustom,
} from "./studioSiteSync_custom";
import { StudioSiteSyncReport } from "./StudioSiteSyncReport";

interface IStudioSiteSyncButtonProps {
  studioID: string;
  site: SiteSyncSiteCustom;
}

export const StudioSiteSyncButton: React.FC<IStudioSiteSyncButtonProps> = ({
  studioID,
  site,
}) => {
  const Toast = useToast();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [selection, setSelection] = useState<SiteSyncSelectionCustom>(
    SITE_SYNC_ALL_STEPS_CUSTOM
  );
  const [syncSite, { loading }] = useStudioSiteSyncMutation();
  const { data, refetch } = useStudioSiteSyncReportQuery({
    variables: { studio_id: studioID },
    fetchPolicy: "network-only",
  });
  const report = data?.studioSiteSyncReport;
  // The job just queued here, or one still running when the page opened.
  const [queuedJobID, setQueuedJobID] = useState<string>();
  const runningJobID =
    queuedJobID ?? (report && !report.finished ? report.job_id : undefined);
  const running = !!runningJobID;

  const onJobDone = useCallback(async () => {
    setQueuedJobID(undefined);
    await refetch();
    setShowReport(true);
  }, [refetch]);
  const { job } = useMonitorJob(runningJobID, onJobDone);

  async function onSync() {
    setShowConfirm(false);
    try {
      const result = await syncSite({
        variables: { input: siteSyncInputCustom(studioID, site, selection) },
      });
      setQueuedJobID(result.data?.studioSiteSync);
      Toast.success(
        `${site.name} sync queued. The report opens when it's done.`
      );
    } catch (e) {
      Toast.error(e);
    }
  }

  function syncLabel() {
    if (!running) return `Sync from ${site.name}…`;
    if (job?.progress === undefined || job?.progress === null) {
      return "Syncing…";
    }
    return `Syncing… ${Math.round(job.progress * 100)}%`;
  }

  return (
    <div>
      <Button
        variant="secondary"
        disabled={loading || running}
        onClick={() => setShowConfirm(true)}
      >
        {syncLabel()}
      </Button>
      {report?.finished && (
        <Button
          variant="link"
          className="ml-1"
          onClick={() => setShowReport(true)}
        >
          Last report
        </Button>
      )}
      <ModalComponent
        show={showConfirm}
        icon={faDownload}
        header={`Sync from ${site.name}`}
        accept={{ text: "Sync", onClick: onSync }}
        disabled={!siteSyncHasStepCustom(site, selection)}
        cancel={{ onClick: () => setShowConfirm(false), variant: "secondary" }}
      >
        {siteSyncStepsCustom(site).map((step) => (
          <Form.Group key={step.key} className="mb-2">
            <Form.Check
              id={`studio-site-sync-${step.key}`}
              checked={selection[step.key]}
              label={step.label}
              onChange={() =>
                setSelection({ ...selection, [step.key]: !selection[step.key] })
              }
            />
            <Form.Text className="text-muted ml-4">
              {step.description}
            </Form.Text>
          </Form.Group>
        ))}
      </ModalComponent>
      {report?.finished && (
        <StudioSiteSyncReport
          report={report}
          show={showReport}
          onHide={() => setShowReport(false)}
        />
      )}
    </div>
  );
};
