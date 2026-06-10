import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../Icon";
import { faStar } from "@fortawesome/free-solid-svg-icons";
import { PatchComponent } from "src/patch";

export interface IRatingNumberProps {
  value: number | null;
  onSetRating?: (value: number | null) => void;
  disabled?: boolean;
  clickToRate?: boolean;
  max?: number;
  // true if we should indicate that this is a rating
  withoutContext?: boolean;
}

function clampRating(value: number, max?: number) {
  const rounded = Math.max(0, Math.round(value));
  return max === undefined ? rounded : Math.min(max, rounded);
}

function parseRating(value: string, max?: number) {
  if (value.trim() === "") return null;

  const parsed = Number(value);
  if (Number.isNaN(parsed)) return undefined;

  return clampRating(parsed, max);
}

export const RatingNumber = PatchComponent(
  "RatingNumber",
  (props: IRatingNumberProps) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(
      props.value === null ? "" : props.value.toString()
    );

    useEffect(() => {
      setDraft(props.value === null ? "" : props.value.toString());
    }, [props.value]);

    useEffect(() => {
      if (editing) {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }, [editing]);

    function commitDraft() {
      const parsed = parseRating(draft, props.max);
      if (parsed === undefined) {
        setDraft(props.value === null ? "" : props.value.toString());
        setEditing(false);
        return;
      }

      setDraft(parsed === null ? "" : parsed.toString());
      if (props.onSetRating && parsed !== props.value) {
        props.onSetRating(parsed);
      }
      setEditing(false);
    }

    function cancelEditing() {
      setDraft(props.value === null ? "" : props.value.toString());
      setEditing(false);
    }

    function renderIcon() {
      return props.withoutContext ? <Icon icon={faStar} /> : null;
    }

    if (props.disabled || !props.onSetRating) {
      return (
        <span className="rating-number disabled">
          {renderIcon()}
          <span className="rating-number-value">{props.value ?? 0}</span>
        </span>
      );
    }

    if (!editing) {
      return (
        <button
          className="rating-number rating-number-display"
          onClick={() => setEditing(true)}
          title="Edit rating"
          type="button"
        >
          {renderIcon()}
          <span className="rating-number-value">{props.value ?? 0}</span>
        </button>
      );
    }

    return (
      <div className="rating-number editing">
        {renderIcon()}
        <input
          ref={inputRef}
          className="text-input form-control"
          name="ratingnumber"
          type="number"
          inputMode="numeric"
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancelEditing();
            }
          }}
          value={draft}
          min="0"
          step="1"
          max={props.max}
          placeholder="0"
        />
      </div>
    );
  }
);
