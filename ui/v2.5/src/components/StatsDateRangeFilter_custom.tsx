import React from "react";
import { Form } from "react-bootstrap";
import {
  STATS_DATE_FIELDS,
  STATS_DATE_PRESETS,
  resolveStatsDateRange,
  type IStatsDateRange,
  type StatsDateField,
  type StatsDatePreset,
} from "src/utils/statsDateRange_custom";

interface IProps {
  range: IStatsDateRange;
  onChange: (range: IStatsDateRange) => void;
  // O Stats always filters by O date, so it hides the field picker.
  showField?: boolean;
}

export const StatsDateRangeFilter: React.FC<IProps> = ({
  range,
  onChange,
  showField = true,
}) => {
  function changePreset(preset: StatsDatePreset) {
    if (preset === "custom") {
      // Start a custom range from whatever the previous preset covered.
      const resolved = resolveStatsDateRange(range);
      onChange({ ...range, preset, from: resolved.from, to: resolved.to });
      return;
    }
    onChange({ preset, field: range.field });
  }

  return (
    <div className="stats-date-range-filter">
      <Form.Group controlId="statsDateRangePreset">
        <Form.Label>Dates</Form.Label>
        <Form.Control
          as="select"
          value={range.preset}
          onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
            changePreset(event.target.value as StatsDatePreset)
          }
        >
          {STATS_DATE_PRESETS.map((preset) => (
            <option key={preset.value} value={preset.value}>
              {preset.label}
            </option>
          ))}
        </Form.Control>
      </Form.Group>
      {range.preset === "custom" && (
        <>
          <Form.Group controlId="statsDateRangeFrom">
            <Form.Label>From</Form.Label>
            <Form.Control
              type="date"
              value={range.from ?? ""}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ ...range, from: event.target.value || undefined })
              }
            />
          </Form.Group>
          <Form.Group controlId="statsDateRangeTo">
            <Form.Label>To</Form.Label>
            <Form.Control
              type="date"
              value={range.to ?? ""}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                onChange({ ...range, to: event.target.value || undefined })
              }
            />
          </Form.Group>
        </>
      )}
      {showField && (
        <Form.Group controlId="statsDateRangeField">
          <Form.Label>Filter by</Form.Label>
          <Form.Control
            as="select"
            value={range.field}
            title="O date also limits O counts to the range"
            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
              onChange({
                ...range,
                field: event.target.value as StatsDateField,
              })
            }
          >
            {STATS_DATE_FIELDS.map((field) => (
              <option key={field.value} value={field.value}>
                {field.label}
              </option>
            ))}
          </Form.Control>
        </Form.Group>
      )}
    </div>
  );
};
