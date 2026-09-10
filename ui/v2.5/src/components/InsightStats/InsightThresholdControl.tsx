import { useEffect, useState } from "react";
import type { SceneCardInsightThresholdKey } from "../Scenes/sceneCardInsightTypes_custom";
import { insightThresholdLabels } from "./insightStatsCatalog_custom";

export function InsightThresholdControl({
  thresholdKey,
  value,
  onChange,
  prefix = "page",
}: {
  thresholdKey: SceneCardInsightThresholdKey;
  value: number;
  onChange: (key: SceneCardInsightThresholdKey, value: string) => void;
  prefix?: string;
}) {
  const id = `insight-threshold-${prefix}-${thresholdKey}`;
  const max = thresholdKey === "visibleInsightLimit" ? 20 : 100;
  const min = thresholdKey === "visibleInsightLimit" ? 1 : 0;
  const [inputValue, setInputValue] = useState(String(value));
  useEffect(() => {
    setInputValue(String(value));
  }, [value]);
  return (
    <div className="insight-stats-threshold">
      <label htmlFor={id}>{insightThresholdLabels[thresholdKey]}</label>
      <div>
        <input
          className="form-control"
          id={id}
          type="number"
          min={min}
          max={max}
          step={1}
          value={inputValue}
          title="Apply with Enter or by leaving this field"
          onChange={(event) => setInputValue(event.target.value)}
          onBlur={() => {
            onChange(thresholdKey, inputValue);
            setInputValue(String(value));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      </div>
    </div>
  );
}
