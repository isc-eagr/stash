import cloneDeep from "lodash-es/cloneDeep";
import React from "react";
import { Button, Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import {
  RatingCriteriaCriterion,
  RatingCriteriaChoice,
  RatingCriteriaNumericDefinition,
  RatingCriteriaPresenceDefinition,
  RatingPresenceSection,
  ratingCriteriaModifierOptions,
} from "src/models/list-filter/criteria/rating-criteria_custom";
import { ModifierSelectorButtons } from "../ModifierSelect";

// CUSTOM: begin - combined rating criteria filter editor
interface IRatingCriteriaFilter {
  criterion: RatingCriteriaCriterion;
  setCriterion: (c: RatingCriteriaCriterion) => void;
}

function firstChoice(definition: RatingCriteriaNumericDefinition) {
  return definition.choices[0]?.value ?? 0;
}

function lastChoice(definition: RatingCriteriaNumericDefinition) {
  return definition.choices[definition.choices.length - 1]?.value ?? 0;
}

function choiceIndex(
  definition: RatingCriteriaNumericDefinition,
  value: number | undefined
) {
  if (value === undefined) {
    return 0;
  }

  const exactIndex = definition.choices.findIndex((c) => c.value === value);
  if (exactIndex !== -1) {
    return exactIndex;
  }

  return definition.choices.reduce((closestIndex, choice, index) => {
    const closest = definition.choices[closestIndex];
    return Math.abs(choice.value - value) < Math.abs(closest.value - value)
      ? index
      : closestIndex;
  }, 0);
}

function choiceLabel(choice: RatingCriteriaChoice) {
  return `${choice.value} - ${choice.label}`;
}

export const RatingCriteriaFilter: React.FC<IRatingCriteriaFilter> = ({
  criterion,
  setCriterion,
}) => {
  const intl = useIntl();
  const { criteria, bonuses, penalties } = criterion.ratingCriteriaOption;

  function updateCriterion(next: RatingCriteriaCriterion) {
    setCriterion(next);
  }

  function enableNumeric(definition: RatingCriteriaNumericDefinition) {
    const next = cloneDeep(criterion);
    next.value.criteria[definition.key] = {
      modifier: CriterionModifier.GreaterThanEquals,
      value: {
        value: firstChoice(definition),
        value2: undefined,
      },
    };
    updateCriterion(next);
  }

  function updateNumericModifier(
    definition: RatingCriteriaNumericDefinition,
    modifier: CriterionModifier
  ) {
    const next = cloneDeep(criterion);
    const current = next.value.criteria[definition.key];
    if (!current) return;

    current.modifier = modifier;
    if (modifier === CriterionModifier.Between) {
      current.value.value2 = current.value.value2 ?? lastChoice(definition);
    } else {
      current.value.value2 = undefined;
    }
    updateCriterion(next);
  }

  function updateNumericValue(
    definition: RatingCriteriaNumericDefinition,
    property: "value" | "value2",
    choiceIndexValue: string
  ) {
    const next = cloneDeep(criterion);
    const current = next.value.criteria[definition.key];
    if (!current) return;

    const selectedChoice = definition.choices[Number(choiceIndexValue)];
    current.value[property] = selectedChoice?.value ?? firstChoice(definition);
    updateCriterion(next);
  }

  function clearNumeric(definition: RatingCriteriaNumericDefinition) {
    const next = cloneDeep(criterion);
    delete next.value.criteria[definition.key];
    updateCriterion(next);
  }

  function updatePresence(
    section: RatingPresenceSection,
    definition: RatingCriteriaPresenceDefinition,
    value: string
  ) {
    const next = cloneDeep(criterion);
    if (value === "") {
      delete next.value[section][definition.key];
    } else {
      next.value[section][definition.key] = value === "true";
    }
    updateCriterion(next);
  }

  function renderSlider(
    definition: RatingCriteriaNumericDefinition,
    property: "value" | "value2",
    labelID: string,
    value: number | undefined
  ) {
    const selectedIndex = choiceIndex(definition, value);
    const selectedChoice = definition.choices[selectedIndex];
    const listId = `rating-criteria-${definition.key}-${property}`;

    return (
      <Form.Group className="rating-criteria-filter-slider">
        <Form.Label className="rating-criteria-filter-slider-label">
          <FormattedMessage id={labelID} />
          {selectedChoice && (
            <span className="rating-criteria-filter-slider-value">
              {choiceLabel(selectedChoice)}
            </span>
          )}
        </Form.Label>
        <Form.Control
          custom
          list={listId}
          max={Math.max(definition.choices.length - 1, 0)}
          min={0}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
            updateNumericValue(definition, property, event.target.value)
          }
          step={1}
          type="range"
          value={selectedIndex}
        />
        <datalist id={listId}>
          {definition.choices.map((choice, index) => (
            <option key={choice.value} value={index} label={`${choice.value}`} />
          ))}
        </datalist>
      </Form.Group>
    );
  }

  function renderNumeric(definition: RatingCriteriaNumericDefinition) {
    const current = criterion.value.criteria[definition.key];
    if (!current) {
      return (
        <div className="rating-criteria-filter-row" key={definition.key}>
          <div className="rating-criteria-filter-label">{definition.label}</div>
          <Button
            className="rating-criteria-filter-action"
            onClick={() => enableNumeric(definition)}
          >
            <FormattedMessage id="actions.add" />
          </Button>
        </div>
      );
    }

    return (
      <div className="rating-criteria-filter-row" key={definition.key}>
        <div className="rating-criteria-filter-label">{definition.label}</div>
        <div className="rating-criteria-filter-controls">
          <ModifierSelectorButtons
            options={ratingCriteriaModifierOptions}
            value={current.modifier}
            onChanged={(modifier) => updateNumericModifier(definition, modifier)}
          />
          {renderSlider(
            definition,
            "value",
            current.modifier === CriterionModifier.LessThanEquals
              ? "criterion.less_than"
              : "criterion.value",
            current.value.value
          )}
          {current.modifier === CriterionModifier.Between && (
            renderSlider(
              definition,
              "value2",
              "criterion.less_than",
              current.value.value2
            )
          )}
          <Button
            className="rating-criteria-filter-action"
            onClick={() => clearNumeric(definition)}
          >
            <FormattedMessage id="actions.remove" />
          </Button>
        </div>
      </div>
    );
  }

  function renderPresence(definition: RatingCriteriaPresenceDefinition) {
    const current = criterion.value[definition.section][definition.key];
    return (
      <Form.Group className="rating-criteria-filter-row" key={definition.key}>
        <Form.Label className="rating-criteria-filter-label">
          {definition.label}
        </Form.Label>
        <Form.Control
          as="select"
          className="btn-secondary rating-criteria-filter-presence"
          onChange={(event) =>
            updatePresence(
              definition.section,
              definition,
              event.currentTarget.value
            )
          }
          value={
            current === undefined ? "" : current ? "true" : "false"
          }
        >
          <option value="">
            {intl.formatMessage({ id: "criterion.any" })}
          </option>
          <option value="true">
            {intl.formatMessage({ id: "rating_criteria.has" })}
          </option>
          <option value="false">
            {intl.formatMessage({ id: "rating_criteria.does_not_have" })}
          </option>
        </Form.Control>
      </Form.Group>
    );
  }

  return (
    <div className="rating-criteria-filter">
      <div className="rating-criteria-filter-section">
        <div className="rating-criteria-filter-heading">
          <FormattedMessage id="rating_criteria.dimensions" />
        </div>
        {criteria.map(renderNumeric)}
      </div>
      {bonuses.length > 0 && (
        <div className="rating-criteria-filter-section">
          <div className="rating-criteria-filter-heading">
            <FormattedMessage id="rating_criteria.bonuses" />
          </div>
          {bonuses.map(renderPresence)}
        </div>
      )}
      {penalties.length > 0 && (
        <div className="rating-criteria-filter-section">
          <div className="rating-criteria-filter-heading">
            <FormattedMessage id="rating_criteria.penalties" />
          </div>
          {penalties.map(renderPresence)}
        </div>
      )}
    </div>
  );
};
// CUSTOM: end
