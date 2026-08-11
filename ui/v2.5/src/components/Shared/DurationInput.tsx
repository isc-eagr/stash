import {
  faChevronDown,
  faChevronUp,
  faClock,
  faArrowRight, // CUSTOM
  faCopy, // CUSTOM
} from "@fortawesome/free-solid-svg-icons";
import React, { useMemo, useState } from "react";
import { Button, ButtonGroup, InputGroup, Form } from "react-bootstrap";
import { Icon } from "./Icon";
import TextUtils from "src/utils/text";

interface IProps {
  disabled?: boolean;
  value: number | null | undefined;
  setValue(value: number | null): void;
  onReset?(): void;
  onSeekTo?(): void; // CUSTOM
  onCopyFromMarker?(): void; // CUSTOM
  copyFromMarkerActive?: boolean; // CUSTOM
  className?: string;
  placeholder?: string;
  error?: string;
  allowNegative?: boolean;
}

const includeMS = true;

export const DurationInput: React.FC<IProps> = ({
  disabled,
  value,
  setValue,
  onReset,
  onSeekTo, // CUSTOM
  onCopyFromMarker, // CUSTOM
  copyFromMarkerActive = false, // CUSTOM
  className,
  placeholder,
  error,
  allowNegative = false,
}) => {
  const [tmpValue, setTmpValue] = useState<string>();

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setTmpValue(e.currentTarget.value);
  }

  function onBlur() {
    if (tmpValue !== undefined) {
      updateValue(TextUtils.timestampToSeconds(tmpValue));
      setTmpValue(undefined);
    }
  }

  function updateValue(v: number | null) {
    if (v !== null && !allowNegative && v < 0) {
      v = null;
    }
    setValue(v);
  }

  function increment() {
    setTmpValue(undefined);
    updateValue((value ?? 0) + 1);
  }

  function decrement() {
    setTmpValue(undefined);
    if (allowNegative) {
      updateValue((value ?? 0) - 1);
    } else {
      updateValue(value ? value - 1 : 0);
    }
  }

  function renderButtons() {
    if (!disabled) {
      return (
        <ButtonGroup vertical>
          <Button
            variant="secondary"
            className="duration-button"
            onClick={() => increment()}
          >
            <Icon icon={faChevronUp} />
          </Button>
          <Button
            variant="secondary"
            className="duration-button"
            onClick={() => decrement()}
          >
            <Icon icon={faChevronDown} />
          </Button>
        </ButtonGroup>
      );
    }
  }

  function maybeRenderReset() {
    if (onReset) {
      return (
        <Button variant="secondary" onClick={() => onReset()}>
          <Icon icon={faClock} />
        </Button>
      );
    }
  }

  // CUSTOM: begin
  function maybeRenderSeekTo() {
    if (onSeekTo) {
      return (
        <Button variant="secondary" onClick={() => onSeekTo()}>
          <Icon icon={faArrowRight} />
        </Button>
      );
    }
  }

  function maybeRenderCopyFromMarker() {
    if (onCopyFromMarker) {
      return (
        <Button
          variant={copyFromMarkerActive ? "info" : "secondary"}
          onClick={() => onCopyFromMarker()}
          aria-pressed={copyFromMarkerActive}
          title={
            copyFromMarkerActive
              ? "Cancel marker timestamp selection"
              : "Copy from an existing marker"
          }
        >
          <Icon icon={faCopy} />
        </Button>
      );
    }
  }
  // CUSTOM: end

  const inputValue = useMemo(() => {
    if (tmpValue !== undefined) {
      return tmpValue;
    } else if (value !== null && value !== undefined) {
      return TextUtils.secondsToTimestamp(value, includeMS);
    }
  }, [value, tmpValue]);

  const format = "hh:mm:ss.ms";

  if (placeholder) {
    placeholder = `${placeholder} (${format})`;
  } else {
    placeholder = format;
  }

  return (
    <div className={`duration-input ${className}`}>
      <InputGroup>
        <Form.Control
          className="duration-control text-input"
          disabled={disabled}
          value={inputValue}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
        />
        <InputGroup.Append>
          {maybeRenderReset()}
          {maybeRenderCopyFromMarker()} {/* CUSTOM */}
          {maybeRenderSeekTo()} {/* CUSTOM */}
          {renderButtons()}
        </InputGroup.Append>
        <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
      </InputGroup>
    </div>
  );
};
