import React, { useMemo } from "react";
import { Button, Form } from "react-bootstrap";
import Select from "react-select";
import { statsCountryName } from "src/utils/statsCountry_custom";
import {
  emptyPlaygroundFilters,
  playgroundFilterCount,
  updatePlaygroundFilter,
  type IPlaygroundConfig,
  type IPlaygroundEntry,
  type IPlaygroundFilters,
} from "./playgroundData_custom";
import {
  playgroundAdjustments,
  playgroundFacialOptions,
  playgroundMetallicOptions,
  playgroundSceneTypeOptions,
} from "./playgroundCatalog_custom";
import type { SceneRatingModeCustom } from "../Shared/groupSceneRating_custom";

const modeLabels: Record<SceneRatingModeCustom | "all", string> = {
  all: "All",
  default: "Standard",
  solo: "Solo",
  group: "Group (4+ vatos)",
};

export const PlaygroundSceneFilters: React.FC<{
  idPrefix: string;
  entries: readonly IPlaygroundEntry[];
  mode: SceneRatingModeCustom | "all";
  showMode?: boolean;
  filters: IPlaygroundFilters;
  config: IPlaygroundConfig;
  disabled?: boolean;
  onChange: (filters: IPlaygroundFilters) => void;
  onModeChange?: (mode: SceneRatingModeCustom | "all") => void;
}> = ({
  idPrefix,
  entries,
  mode,
  showMode = false,
  filters,
  config,
  disabled,
  onChange,
  onModeChange,
}) => {
  const options = useMemo(() => {
    const distinct = (key: "ethnicities" | "countries") =>
      [...new Set(entries.flatMap((entry) => entry[key]))]
        .map((value) => ({
          value,
          label: key === "countries" ? statsCountryName(value) : value,
        }))
        .sort((a, b) => a.label.localeCompare(b.label))
        .concat({ value: "unknown", label: "Unknown" });
    return {
      ethnicities: distinct("ethnicities"),
      countries: distinct("countries"),
      counts: [
        ...new Set(entries.map((entry) => entry.scene.performers.length)),
      ]
        .sort((a, b) => a - b)
        .map((count) => ({ value: String(count), label: String(count) })),
    };
  }, [entries]);
  const adjustments = useMemo(
    () =>
      mode === "all"
        ? [
            ...new Map(
              (["default", "solo", "group"] as const)
                .flatMap((rubric) => playgroundAdjustments(rubric))
                .map((option) => [option.value, option])
            ).values(),
          ]
        : playgroundAdjustments(mode),
    [mode]
  );
  const filterCount =
    playgroundFilterCount(filters) + (showMode && mode !== "all" ? 1 : 0);

  function renderFilter(
    key: keyof IPlaygroundFilters,
    label: string,
    choices: { label: string; value: string }[],
    filterDisabled = false
  ) {
    return (
      <Form.Group controlId={`${idPrefix}-${key}`}>
        <Form.Label
          title={
            key === "facial"
              ? filterDisabled
                ? "Set the Facial role tag in Settings."
                : !config.roleTagIds?.reallyHotTagId
                ? "Set the Really Hot role tag in Settings to distinguish hot facials."
                : undefined
              : undefined
          }
        >
          {label}
        </Form.Label>
        <Select
          inputId={`${idPrefix}-${key}`}
          className="react-select"
          classNamePrefix="react-select"
          isMulti
          isClearable
          closeMenuOnSelect={false}
          placeholder="Any"
          options={choices}
          isDisabled={disabled || filterDisabled}
          value={filters[key].map(
            (value) =>
              choices.find((choice) => choice.value === value) ?? {
                value,
                label: value,
              }
          )}
          onChange={(selected) =>
            onChange(
              updatePlaygroundFilter(
                filters,
                key,
                selected.map((choice) => choice.value)
              )
            )
          }
        />
      </Form.Group>
    );
  }

  return (
    <details className="playground-panel playground-filters" open>
      <summary>
        Filters {filterCount > 0 && <span>({filterCount})</span>}
      </summary>
      <div className="playground-filter-grid">
        {showMode && (
          <Form.Group controlId={`${idPrefix}-mode`}>
            <Form.Label>Rating Mode</Form.Label>
            <Form.Control
              as="select"
              value={mode}
              disabled={disabled}
              onChange={(event) => {
                const nextMode = event.target.value as
                  | SceneRatingModeCustom
                  | "all";
                onModeChange?.(nextMode);
              }}
            >
              {Object.entries(modeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
        )}
        {renderFilter("sceneTypes", "Scene Type", playgroundSceneTypeOptions)}
        {renderFilter("ethnicities", "Vato Ethnicity", options.ethnicities)}
        {renderFilter("countries", "Vato Country", options.countries)}
        {renderFilter("counts", "Vato Count", options.counts)}
        {renderFilter("metallic", "Metallic Rating", playgroundMetallicOptions)}
        {renderFilter(
          "facial",
          "Facial",
          playgroundFacialOptions,
          !config.roleTagIds?.facialTagId
        )}
        {renderFilter("present", "Bonuses & penalties: present", adjustments)}
        {renderFilter("absent", "Bonuses & penalties: absent", adjustments)}
      </div>
      <div className="playground-filter-footer">
        <Button
          variant="link"
          size="sm"
          disabled={!filterCount && (!showMode || mode === "all")}
          onClick={() => {
            onChange(emptyPlaygroundFilters);
            if (showMode) onModeChange?.("all");
          }}
        >
          Clear filters
        </Button>
      </div>
    </details>
  );
};
