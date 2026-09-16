import React, { useEffect, useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { useProgressText } from "./progressView_custom";
import {
  formatTimerCountdown,
  taskProgressTimerMaxMinutes,
  timerCountdownColor,
  timerCountdownMinutesToSeconds,
  timerCountdownPercentage,
  timerCountdownTiming,
} from "./taskProgressTimer_custom";

interface IProps {
  onClose: () => void;
}

const defaultMinutes = "5";
const defaultSeconds =
  timerCountdownMinutesToSeconds(Number(defaultMinutes)) ?? 0;

export const TaskProgressTimerCountdown: React.FC<IProps> = ({ onClose }) => {
  const t = useProgressText();
  const [minutes, setMinutes] = useState(defaultMinutes);
  const [totalSeconds, setTotalSeconds] = useState(defaultSeconds);
  const [remainingSeconds, setRemainingSeconds] = useState(defaultSeconds);
  const [overtimeSeconds, setOvertimeSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [endAt, setEndAt] = useState<number>();
  const [paused, setPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [totalTimeTakenSeconds, setTotalTimeTakenSeconds] = useState<number>();
  const running = endAt !== undefined;
  const requestedSeconds = timerCountdownMinutesToSeconds(Number(minutes));
  const percentage = timerCountdownPercentage(remainingSeconds, totalSeconds);
  const color = timerCountdownColor(percentage);
  const display =
    overtimeSeconds > 0
      ? `+${formatTimerCountdown(overtimeSeconds)}`
      : formatTimerCountdown(remainingSeconds);

  useEffect(() => {
    if (endAt === undefined || stopped) return undefined;

    const update = () => {
      const timing = timerCountdownTiming(endAt, totalSeconds);
      setRemainingSeconds(timing.remainingSeconds);
      setOvertimeSeconds(timing.overtimeSeconds);
      setElapsedSeconds(timing.elapsedSeconds);
    };

    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [endAt, stopped, totalSeconds]);

  const handleMinutesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setMinutes(value);
    if (endAt === undefined && !stopped) {
      setPaused(false);
      setHasStarted(false);
      setOvertimeSeconds(0);
      setElapsedSeconds(0);
      setTotalTimeTakenSeconds(undefined);
      const seconds = timerCountdownMinutesToSeconds(Number(value)) ?? 0;
      setTotalSeconds(seconds);
      setRemainingSeconds(seconds);
    }
  };

  const start = (event: React.FormEvent) => {
    event.preventDefault();
    if (
      running ||
      paused ||
      hasStarted ||
      stopped ||
      requestedSeconds === undefined
    )
      return;

    setTotalSeconds(requestedSeconds);
    setRemainingSeconds(requestedSeconds);
    setOvertimeSeconds(0);
    setElapsedSeconds(0);
    setTotalTimeTakenSeconds(undefined);
    setHasStarted(true);
    setPaused(false);
    setEndAt(Date.now() + requestedSeconds * 1000);
  };

  const pause = () => {
    if (!running || endAt === undefined || stopped) return;

    const timing = timerCountdownTiming(endAt, totalSeconds);
    setRemainingSeconds(timing.remainingSeconds);
    setOvertimeSeconds(timing.overtimeSeconds);
    setElapsedSeconds(timing.elapsedSeconds);
    setEndAt(undefined);
    setPaused(true);
  };

  const resume = () => {
    if (!paused || stopped) return;

    setPaused(false);
    setEndAt(
      overtimeSeconds > 0
        ? Date.now() - overtimeSeconds * 1000
        : Date.now() + remainingSeconds * 1000
    );
  };

  const stop = () => {
    if (stopped || !hasStarted) return;

    const timing =
      running && endAt !== undefined
        ? timerCountdownTiming(endAt, totalSeconds)
        : {
            remainingSeconds,
            overtimeSeconds,
            elapsedSeconds,
          };
    setRemainingSeconds(timing.remainingSeconds);
    setOvertimeSeconds(timing.overtimeSeconds);
    setElapsedSeconds(timing.elapsedSeconds);
    setTotalTimeTakenSeconds(timing.elapsedSeconds);
    setEndAt(undefined);
    setPaused(false);
    setStopped(true);
  };

  return (
    <Modal
      centered
      show
      onHide={onClose}
      dialogClassName="task-progress-timer-modal"
    >
      <Form onSubmit={start}>
        <Modal.Header closeButton>
          <Modal.Title>{t("Timer Countdown")}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="task-progress-timer-body">
          <Form.Group controlId="task-progress-timer-minutes">
            <Form.Label>{t("Minutes")}</Form.Label>
            <Form.Control
              autoFocus
              disabled={running}
              inputMode="numeric"
              max={taskProgressTimerMaxMinutes}
              min={1}
              onChange={handleMinutesChange}
              step={1}
              type="number"
              value={minutes}
            />
            <Form.Text>
              {t(`Enter 1–${taskProgressTimerMaxMinutes} minutes.`)}
            </Form.Text>
          </Form.Group>
          <div
            aria-label={`${display} ${
              overtimeSeconds > 0 ? t("overtime") : t("remaining")
            }`}
            aria-live="polite"
            className={`task-progress-timer-display task-progress-timer-${color}`}
            role="timer"
          >
            {display}
          </div>
          <div className="task-progress-timer-status" aria-live="polite">
            {stopped
              ? t("Stopped")
              : running && remainingSeconds === 0
              ? t("Overtime")
              : running
              ? t("Running")
              : paused
              ? t("Paused")
              : remainingSeconds === 0 && totalSeconds > 0
              ? t("Finished")
              : `${Math.round(percentage)}% ${t("remaining")}`}
          </div>
          {stopped && totalTimeTakenSeconds !== undefined && (
            <div className="task-progress-timer-total" role="status">
              <span>{t("Total time taken")}</span>
              <strong>{formatTimerCountdown(totalTimeTakenSeconds)}</strong>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onClose}>
            {t("Close")}
          </Button>
          <Button
            disabled={
              running ||
              paused ||
              hasStarted ||
              stopped ||
              requestedSeconds === undefined
            }
            type="submit"
          >
            {t("Start")}
          </Button>
          {running && (
            <Button variant="warning" onClick={pause} type="button">
              {t("Pause")}
            </Button>
          )}
          {paused && (
            <Button onClick={resume} type="button">
              {t("Resume")}
            </Button>
          )}
          {(running || paused) && (
            <Button variant="danger" onClick={stop} type="button">
              {t("Stop")}
            </Button>
          )}
        </Modal.Footer>
      </Form>
    </Modal>
  );
};
