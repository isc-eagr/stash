import React, { useEffect, useState } from "react";
import { Button } from "react-bootstrap";
import { type IRatingCardThresholds } from "src/utils/ratingCardStyles_custom";

export type RatingTierThresholdKey = keyof Required<IRatingCardThresholds>;

const thresholdKeys: RatingTierThresholdKey[] = [
  "bronze",
  "silver",
  "gold",
  "royalSapphire",
];

const thresholdLabels: Record<RatingTierThresholdKey, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  royalSapphire: "Royal Sapphire",
};

function RatingTierThresholdInput({
  entity,
  thresholdKey,
  value,
  onChange,
}: {
  entity: "scene" | "performer";
  thresholdKey: RatingTierThresholdKey;
  value: number;
  onChange: (key: RatingTierThresholdKey, value: number) => void;
}) {
  const id = `playground-${entity}-threshold-${thresholdKey}`;
  const [inputValue, setInputValue] = useState(String(value));
  useEffect(() => setInputValue(String(value)), [value]);
  const apply = () => {
    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed)) {
      setInputValue(String(value));
      return;
    }
    const normalized = Math.max(0, Math.min(100, Math.round(parsed)));
    setInputValue(String(normalized));
    onChange(thresholdKey, normalized);
  };
  return (
    <div className="rating-tier-threshold">
      <label htmlFor={id}>{thresholdLabels[thresholdKey]}</label>
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
        onBlur={apply}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
      />
    </div>
  );
}

export const RatingTierThresholds: React.FC<{
  entity: "scene" | "performer";
  draft: Required<IRatingCardThresholds>;
  changed: boolean;
  onChange: (value: Required<IRatingCardThresholds>) => void;
  onReset: () => void;
}> = ({ entity, draft, changed, onChange, onReset }) => (
  <section className="playground-panel rating-tier-threshold-panel">
    <div className="rating-tier-threshold-heading">
      <div>
        <h3>{entity === "scene" ? "Scene" : "Vato"} thresholds</h3>
        <p>Temporary preview only · saved settings stay unchanged.</p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        disabled={!changed}
        onClick={onReset}
      >
        Reset preview
      </Button>
    </div>
    <div className="rating-tier-thresholds">
      {thresholdKeys.map((key) => (
        <RatingTierThresholdInput
          key={key}
          entity={entity}
          thresholdKey={key}
          value={draft[key]}
          onChange={(thresholdKey, value) =>
            onChange({ ...draft, [thresholdKey]: value })
          }
        />
      ))}
    </div>
  </section>
);
