import React, { useState } from "react";
import { Alert, Button } from "react-bootstrap";
import { useHistory, useLocation } from "react-router-dom";
import * as GQL from "src/core/generated-graphql";
import type {
  TaskProgressMilestoneDataFragment as Milestone,
  TaskProgressTrackerDataFragment as Tracker,
} from "src/core/generated-graphql";
import { useProgressText } from "./progressView_custom";
import { TaskProgressFinishCalculator } from "./TaskProgressFinishCalculator";
import { TaskProgressMilestoneForm } from "./TaskProgressMilestoneForm";
import type { IMilestoneFormValues } from "./TaskProgressMilestoneForm";
import { milestoneFromSearch, milestoneSearch } from "./milestoneView_custom";
import { TaskProgressMilestoneGrowth } from "./TaskProgressMilestoneGrowth";
import { TaskProgressMilestoneLedger } from "./TaskProgressMilestoneLedger";
import { TaskProgressMilestoneModal } from "./TaskProgressMilestoneModal";
interface IProps {
  trackers: readonly Tracker[];
  onOpenTracker: (id: string) => void;
  onRefreshTrackers: () => Promise<void>;
}

export const TaskProgressMilestones: React.FC<IProps> = ({
  trackers,
  onOpenTracker,
  onRefreshTrackers,
}) => {
  const t = useProgressText();
  const history = useHistory();
  const location = useLocation();
  const query = GQL.useFindTaskProgressMilestonesQuery({
    fetchPolicy: "network-only",
    notifyOnNetworkStatusChange: true,
  });
  const [create] = GQL.useTaskProgressMilestoneCreateMutation();
  const [update] = GQL.useTaskProgressMilestoneUpdateMutation();
  const [destroy] = GQL.useTaskProgressMilestoneDestroyMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [editor, setEditor] = useState<Milestone | "new">();
  const [calculator, setCalculator] = useState(false);
  const milestones = query.data?.findTaskProgressMilestones ?? [];
  const detailsID = milestoneFromSearch(location.search);
  const details = milestones.find((item) => item.id === detailsID);
  const openDetails = (id?: string) => {
    history.push({ ...location, search: milestoneSearch(location.search, id) });
  };
  const run = async (action: () => Promise<unknown>) => {
    if (busy) return false;
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await query.refetch();
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const save = (values: IMilestoneFormValues) =>
    run(async () => {
      if (editor && editor !== "new") {
        await update({
          variables: {
            input: {
              id: editor.id,
              expected_version: editor.version,
              name: values.name,
              target_date: values.target_date,
              goal_per_day: values.goal_per_day,
              tracker_ids: values.members_changed
                ? values.tracker_ids
                : undefined,
            },
          },
        });
        return;
      }
      await create({
        variables: {
          input: {
            name: values.name,
            target_date: values.target_date || undefined,
            goal_per_day: values.goal_per_day || undefined,
            tracker_ids: values.tracker_ids,
          },
        },
      });
    });

  return (
    <>
      <div className="milestone-toolbar">
        <Button
          variant="secondary"
          disabled={busy || query.loading}
          onClick={() => {
            void Promise.all([query.refetch(), onRefreshTrackers()]).catch(
              (failure) =>
                setError(
                  failure instanceof Error ? failure.message : String(failure)
                )
            );
          }}
        >
          {t("Refresh")}
        </Button>
        <Button
          variant="secondary"
          disabled={!milestones.length}
          onClick={() => setCalculator(true)}
        >
          {t("Finish calculator")}
        </Button>
        <Button disabled={busy} onClick={() => setEditor("new")}>
          {t("Create milestone")}
        </Button>
      </div>
      {(error || query.error) && (
        <Alert variant="danger" role="alert">
          {error ?? query.error?.message}
        </Alert>
      )}
      {!!detailsID && !!query.data && !details && (
        <Alert variant="warning" dismissible onClose={() => openDetails()}>
          {t("This milestone is unavailable.")}
        </Alert>
      )}
      {query.loading && !query.data ? (
        <p role="status">{t("Loading milestones…")}</p>
      ) : !milestones.length ? (
        <p>{t("Create a milestone to group your trackers.")}</p>
      ) : (
        <>
          <TaskProgressMilestoneGrowth milestones={milestones} />
          <TaskProgressMilestoneLedger
            milestones={milestones}
            trackers={trackers}
            busy={busy}
            onDetails={openDetails}
            onEdit={setEditor}
            onOpenTracker={onOpenTracker}
          />
        </>
      )}
      {details && (
        <TaskProgressMilestoneModal
          key={details.id}
          milestone={details}
          onClose={() => openDetails()}
        />
      )}
      {calculator && (
        <TaskProgressFinishCalculator
          milestones={milestones}
          onClose={() => setCalculator(false)}
        />
      )}
      {editor && (
        <TaskProgressMilestoneForm
          key={
            editor === "new"
              ? "milestone-editor-new"
              : `milestone-editor-${editor.id}`
          }
          milestone={editor === "new" ? undefined : editor}
          milestones={milestones}
          trackers={trackers}
          busy={busy}
          onClose={() => setEditor(undefined)}
          onSave={save}
          onDelete={
            editor === "new"
              ? undefined
              : () =>
                  run(async () => {
                    await destroy({ variables: { id: editor.id } });
                    if (detailsID === editor.id) {
                      history.replace({
                        ...location,
                        search: milestoneSearch(location.search),
                      });
                    }
                  })
          }
        />
      )}
    </>
  );
};
