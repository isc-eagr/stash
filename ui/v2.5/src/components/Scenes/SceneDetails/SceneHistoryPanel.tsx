import {
  faEllipsisV,
  faPlus,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import React from "react";
import { Button, Dropdown } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { AlertModal } from "src/components/Shared/Alert";
import { Counter } from "src/components/Shared/Counter";
import { DateInput } from "src/components/Shared/DateInput";
import { Icon } from "src/components/Shared/Icon";
import { ModalComponent } from "src/components/Shared/Modal";
import {
  useSceneDecrementO,
  useSceneDecrementPlayCount,
  useSceneIncrementO,
  useSceneIncrementPlayCount,
  useSceneResetO,
  useSceneResetPlayCount,
  useSceneResetActivity,
} from "src/core/StashService";
import * as GQL from "src/core/generated-graphql";
import { useConfigurationContext } from "src/hooks/Config";
import { useToast } from "src/hooks/Toast";
import { TextField } from "src/utils/field";
import { getPlayer } from "src/components/ScenePlayer/util"; // CUSTOM
import TextUtils from "src/utils/text";
import { isReleaseMarkerSeekableCustom } from "./sceneReleaseMarkerSeek_custom"; // CUSTOM
import {
  useSceneReleaseEditHistoryCustom,
  useSceneReleaseResetActivityCustom,
} from "../sceneReleaseActivity_custom"; // CUSTOM

const History: React.FC<{
  className?: string;
  history: string[];
  unknownDate?: string;
  onRemove: (date: string) => void;
  noneID: string;
  // CUSTOM: begin - optional parallel video timestamps + seek callback
  videoTimestamps?: Array<number | null>;
  maxDuration?: number | null; // CUSTOM
  // CUSTOM: end
}> = ({
  className,
  history,
  unknownDate,
  noneID,
  onRemove,
  videoTimestamps,
  maxDuration, // CUSTOM
}) => {
  // CUSTOM: videoTimestamps
  const intl = useIntl();

  if (history.length === 0) {
    return (
      <div>
        <FormattedMessage id={noneID} />
      </div>
    );
  }

  function renderDate(date: string) {
    if (date === unknownDate) {
      return intl.formatMessage({ id: "unknown_date" });
    }

    return TextUtils.formatDateTime(intl, date);
  }

  return (
    <div className="scene-history">
      <ul className={className}>
        {history.map((playdate, index) => (
          <li key={index}>
            <span>{renderDate(playdate)}</span>
            {/* CUSTOM: begin - show video position badge */}
            {(() => {
              const ts = videoTimestamps?.[index];
              if (ts === null || ts === undefined) return null;
              const h = Math.floor(ts / 3600);
              const m = Math.floor((ts % 3600) / 60);
              const s = Math.floor(ts % 60);
              const label =
                h > 0
                  ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(
                      2,
                      "0"
                    )}`
                  : `${m}:${String(s).padStart(2, "0")}`;
              return (
                <button
                  type="button"
                  className="o-video-ts-badge btn btn-link p-0 ms-2"
                  onClick={() => getPlayer()?.currentTime(ts)}
                  title={`Seek to ${label}`}
                  disabled={!isReleaseMarkerSeekableCustom(ts, maxDuration)} // CUSTOM
                >
                  ({label})
                </button>
              );
            })()}
            {/* CUSTOM: end */}
            <Button
              className="remove-date-button"
              size="sm"
              variant="minimal"
              onClick={() => onRemove(playdate)}
              title={intl.formatMessage({ id: "actions.remove_date" })}
            >
              <Icon icon={faTrash} />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const HistoryMenu: React.FC<{
  hasHistory: boolean;
  showResetResumeDuration: boolean;
  onAddDate: () => void;
  onClearDates: () => void;
  resetResume: () => void;
  resetDuration: () => void;
}> = ({
  hasHistory,
  showResetResumeDuration,
  onAddDate,
  onClearDates,
  resetResume,
  resetDuration,
}) => {
  const intl = useIntl();

  return (
    <Dropdown className="history-operations-dropdown">
      <Dropdown.Toggle
        variant="secondary"
        className="minimal"
        title={intl.formatMessage({ id: "operations" })}
      >
        <Icon icon={faEllipsisV} />
      </Dropdown.Toggle>
      <Dropdown.Menu className="bg-secondary text-white">
        <Dropdown.Item
          className="bg-secondary text-white"
          onClick={() => onAddDate()}
        >
          <FormattedMessage id="actions.add_manual_date" />
        </Dropdown.Item>
        {hasHistory && (
          <Dropdown.Item
            className="bg-secondary text-white"
            onClick={() => onClearDates()}
          >
            <FormattedMessage id="actions.clear_date_data" />
          </Dropdown.Item>
        )}
        {showResetResumeDuration && (
          <Dropdown.Item
            className="bg-secondary text-white"
            onClick={() => resetResume()}
          >
            <FormattedMessage id="actions.reset_resume_time" />
          </Dropdown.Item>
        )}
        {showResetResumeDuration && (
          <Dropdown.Item
            className="bg-secondary text-white"
            onClick={() => resetDuration()}
          >
            <FormattedMessage id="actions.reset_play_duration" />
          </Dropdown.Item>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
};

const DatePickerModal: React.FC<{
  show: boolean;
  onClose: (t?: string) => void;
}> = ({ show, onClose }) => {
  const intl = useIntl();
  const [date, setDate] = React.useState<string>(
    TextUtils.dateTimeToString(new Date())
  );

  return (
    <ModalComponent
      show={show}
      header={<FormattedMessage id="actions.choose_date" />}
      accept={{
        onClick: () => onClose(date),
        text: intl.formatMessage({ id: "actions.confirm" }),
      }}
      cancel={{
        variant: "secondary",
        onClick: () => onClose(),
        text: intl.formatMessage({ id: "actions.cancel" }),
      }}
    >
      <div>
        <DateInput value={date} onValueChange={(d) => setDate(d)} isTime />
      </div>
    </ModalComponent>
  );
};

interface ISceneHistoryProps {
  scene: GQL.SceneDataFragment;
  release?: GQL.SceneReleaseDataFragment; // CUSTOM
}

export const SceneHistoryPanel: React.FC<ISceneHistoryProps> = ({
  scene,
  release,
}) => {
  // CUSTOM
  const intl = useIntl();
  const Toast = useToast();

  const { configuration } = useConfigurationContext();
  const { sfwContentMode } = configuration.interface;

  const [dialogs, setDialogs] = React.useState({
    playHistory: false,
    oHistory: false,
    addPlay: false,
    addO: false,
  });

  function setDialogPartial(partial: Partial<typeof dialogs>) {
    setDialogs({ ...dialogs, ...partial });
  }

  const [incrementPlayCount] = useSceneIncrementPlayCount();
  const [decrementPlayCount] = useSceneDecrementPlayCount();
  const [clearPlayCount] = useSceneResetPlayCount();
  const [incrementOCount] = useSceneIncrementO(scene.id);
  const [decrementOCount] = useSceneDecrementO(scene.id);
  const [resetO] = useSceneResetO(scene.id);
  const [resetResume] = useSceneResetActivity(scene.id, true, false);
  const [resetDuration] = useSceneResetActivity(scene.id, false, true);
  const [editReleaseHistory] = useSceneReleaseEditHistoryCustom(); // CUSTOM
  const [resetReleaseActivity] = useSceneReleaseResetActivityCustom(); // CUSTOM

  async function editRelease(
    kind: "play" | "o",
    action: "add" | "delete" | "clear",
    at?: string
  ) {
    if (!release) return;
    try {
      await editReleaseHistory({
        variables: { id: release.id, kind, action, at },
      });
    } catch (e) {
      Toast.error(e);
    }
  }

  function dateStringToISOString(time: string) {
    const date = TextUtils.stringToFuzzyDateTime(time);
    if (!date) return null;
    return date.toISOString();
  }

  function handleAddPlayDate(time?: string) {
    if (release) return void editRelease("play", "add", time); // CUSTOM
    incrementPlayCount({
      variables: {
        id: scene.id,
        times: time ? [time] : undefined,
      },
    });
  }

  function handleDeletePlayDate(time: string) {
    if (release) return void editRelease("play", "delete", time); // CUSTOM
    decrementPlayCount({
      variables: {
        id: scene.id,
        times: time ? [time] : undefined,
      },
    });
  }

  function handleClearPlayDates() {
    setDialogPartial({ playHistory: false });
    if (release) return void editRelease("play", "clear"); // CUSTOM
    clearPlayCount({
      variables: {
        id: scene.id,
      },
    });
  }

  function handleAddODate(time?: string) {
    if (release) return void editRelease("o", "add", time); // CUSTOM
    incrementOCount({
      variables: {
        id: scene.id,
        times: time ? [time] : undefined,
      },
    });
  }

  function handleDeleteODate(time: string) {
    if (release) return void editRelease("o", "delete", time); // CUSTOM
    decrementOCount({
      variables: {
        id: scene.id,
        times: time ? [time] : undefined,
      },
    });
  }

  function handleClearODates() {
    setDialogPartial({ oHistory: false });
    if (release) return void editRelease("o", "clear"); // CUSTOM
    resetO({
      variables: {
        id: scene.id,
      },
    });
  }

  async function handleResetResume() {
    try {
      if (release) {
        await resetReleaseActivity({
          variables: { id: release.id, reset_resume: true },
        });
        return;
      } // CUSTOM
      await resetResume({
        variables: {
          id: scene.id,
          reset_resume: true,
          reset_duration: false,
        },
      });

      Toast.success(
        intl.formatMessage(
          { id: "toast.updated_entity" },
          {
            entity: intl.formatMessage({ id: "scene" }).toLocaleLowerCase(),
          }
        )
      );
    } catch (e) {
      Toast.error(e);
    }
  }

  async function handleResetDuration() {
    try {
      if (release) {
        await resetReleaseActivity({
          variables: { id: release.id, reset_duration: true },
        });
        return;
      } // CUSTOM
      await resetDuration({
        variables: {
          id: scene.id,
          reset_resume: false,
          reset_duration: true,
        },
      });

      Toast.success(
        intl.formatMessage(
          { id: "toast.updated_entity" },
          {
            entity: intl.formatMessage({ id: "scene" }).toLocaleLowerCase(),
          }
        )
      );
    } catch (e) {
      Toast.error(e);
    }
  }

  function maybeRenderDialogs() {
    const clearHistoryMessageID = sfwContentMode
      ? "dialogs.clear_o_history_confirm_sfw"
      : "dialogs.clear_play_history_confirm";
    return (
      <>
        <AlertModal
          show={dialogs.playHistory}
          text={intl.formatMessage({
            id: "dialogs.clear_play_history_confirm",
          })}
          confirmButtonText={intl.formatMessage({ id: "actions.clear" })}
          onConfirm={() => handleClearPlayDates()}
          onCancel={() => setDialogPartial({ playHistory: false })}
        />
        <AlertModal
          show={dialogs.oHistory}
          text={intl.formatMessage({ id: clearHistoryMessageID })}
          confirmButtonText={intl.formatMessage({ id: "actions.clear" })}
          onConfirm={() => handleClearODates()}
          onCancel={() => setDialogPartial({ oHistory: false })}
        />
        {/* add conditions here so that date is generated correctly */}
        {dialogs.addPlay && (
          <DatePickerModal
            show
            onClose={(t) => {
              const tt = t ? dateStringToISOString(t) : null;
              if (tt) {
                handleAddPlayDate(tt);
              }
              setDialogPartial({ addPlay: false });
            }}
          />
        )}
        {dialogs.addO && (
          <DatePickerModal
            show
            onClose={(t) => {
              const tt = t ? dateStringToISOString(t) : null;
              if (tt) {
                handleAddODate(tt);
              }
              setDialogPartial({ addO: false });
            }}
          />
        )}
      </>
    );
  }

  const playHistory = (
    release?.play_history ??
    scene.play_history ??
    []
  ).filter(
    // CUSTOM
    (h) => h != null
  ) as string[];
  const oHistory = (release?.o_history ?? scene.o_history ?? []).filter(
    (h) => h != null
  ) as string[]; // CUSTOM

  const oHistoryMessageID = sfwContentMode ? "o_history_sfw" : "o_history";
  const noneMessageID = sfwContentMode
    ? "odate_recorded_no_sfw"
    : "odate_recorded_no";

  return (
    <div>
      {maybeRenderDialogs()}
      {release && (
        <div className="text-muted small mb-2">
          Release: {release.title || release.id}
        </div>
      )}{" "}
      {/* CUSTOM */}
      <div className="play-history">
        <div className="history-header">
          <h5>
            <span>
              <FormattedMessage id="play_history" />
              <Counter count={playHistory.length} hideZero />
            </span>
            <span>
              <Button
                size="sm"
                variant="minimal"
                className="add-date-button"
                title={intl.formatMessage({ id: "actions.add_play" })}
                onClick={() => handleAddPlayDate()}
              >
                <Icon icon={faPlus} />
              </Button>
              <HistoryMenu
                hasHistory={playHistory.length > 0}
                showResetResumeDuration={true}
                onAddDate={() => setDialogPartial({ addPlay: true })}
                onClearDates={() => setDialogPartial({ playHistory: true })}
                resetResume={() => handleResetResume()}
                resetDuration={() => handleResetDuration()}
              />
            </span>
          </h5>
        </div>

        <History
          history={playHistory ?? []}
          noneID="playdate_recorded_no"
          unknownDate={release?.created_at ?? scene.created_at} // CUSTOM
          onRemove={(t) => handleDeletePlayDate(t)}
        />
        <dl className="details-list">
          <TextField
            id="media_info.play_duration"
            value={TextUtils.secondsToTimestamp(
              release?.play_duration ?? scene.play_duration ?? 0
            )} // CUSTOM
          />
        </dl>
      </div>
      <div className="o-history">
        <div className="history-header">
          <h5>
            <span>
              <FormattedMessage id={oHistoryMessageID} />
              <Counter count={oHistory.length} hideZero />
            </span>
            <span>
              <Button
                size="sm"
                variant="minimal"
                className="add-date-button"
                title={intl.formatMessage({ id: "actions.add_o" })}
                onClick={() => handleAddODate()}
              >
                <Icon icon={faPlus} />
              </Button>
              <HistoryMenu
                hasHistory={oHistory.length > 0}
                showResetResumeDuration={false}
                onAddDate={() => setDialogPartial({ addO: true })}
                onClearDates={() => setDialogPartial({ oHistory: true })}
                resetResume={() => handleResetResume()}
                resetDuration={() => handleResetDuration()}
              />
            </span>
          </h5>
        </div>
        <History
          history={oHistory}
          noneID={noneMessageID}
          unknownDate={release?.created_at ?? scene.created_at} // CUSTOM
          onRemove={(t) => handleDeleteODate(t)}
          videoTimestamps={release?.o_timestamps ?? scene.o_timestamps ?? []} // CUSTOM
          maxDuration={release?.files[0]?.duration} // CUSTOM
        />
      </div>
    </div>
  );
};

export default SceneHistoryPanel;
