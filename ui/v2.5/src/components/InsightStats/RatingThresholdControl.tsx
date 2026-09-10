import { useEffect, useState } from "react";
import type { IRatingCardThresholds } from "../../utils/ratingCardStyles_custom";

export type RatingThresholdKey = keyof Required<IRatingCardThresholds>;

const ratingThresholdLabels: Record<RatingThresholdKey, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  royalSapphire: "Royal Sapphire",
};

export function RatingThresholdControl({
  entity,
  thresholdKey,
  value,
  onChange,
}: {
  entity: "scene" | "performer";
  thresholdKey: RatingThresholdKey;
  value: number;
  onChange: (
    entity: "scene" | "performer",
    key: RatingThresholdKey,
    value: number
  ) => void;
}) {
  const id = `rating-threshold-${entity}-${thresholdKey}`;
  const [inputValue, setInputValue] = useState(String(value));
  useEffect(() => setInputValue(String(value)), [value]);

  const apply = (rawValue: string) => {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      setInputValue(String(value));
      return;
    }
    onChange(entity, thresholdKey, Math.max(0, Math.min(100, parsed)));
  };

  return (
    <div className="insight-stats-threshold">
      <label htmlFor={id}>{ratingThresholdLabels[thresholdKey]}</label>
      <div>
        <input
          className="form-control"
          id={id}
          type="number"
          min={0}
          max={100}
          step={1}
          value={inputValue}
          title="Apply with Enter or by leaving this field"
          onChange={(event) => setInputValue(event.target.value)}
          onBlur={() => apply(inputValue)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </div>
    </div>
  );
}
