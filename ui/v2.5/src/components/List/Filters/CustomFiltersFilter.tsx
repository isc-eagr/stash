import React, { useCallback } from "react";
import { Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import {
  SceneCustomFiltersCriterion,
  SceneMarkerCustomFiltersCriterion,
} from "src/models/list-filter/criteria/custom-filters";
import { Criterion } from "src/models/list-filter/criteria/criterion";

interface ISceneCustomFiltersFilterProps {
  criterion: SceneCustomFiltersCriterion;
  setCriterion: (criterion: Criterion) => void;
}

export const SceneCustomFiltersFilter: React.FC<
  ISceneCustomFiltersFilterProps
> = ({ criterion, setCriterion }) => {
  const intl = useIntl();

  const onValueChanged = useCallback(
    (value: string) => {
      const newCriterion = criterion.clone() as SceneCustomFiltersCriterion;
      newCriterion.value = value;
      setCriterion(newCriterion);
    },
    [criterion, setCriterion]
  );

  return (
    <Form.Group>
      <Form.Label>
        <FormattedMessage id="custom_filters" />
      </Form.Label>
      <div>
        {SceneCustomFiltersCriterion.options.map((option) => (
          <div key={option}>
            <Form.Check
              type="radio"
              id={`scene-custom-filter-${option}`}
              name="scene-custom-filter"
              label={intl.formatMessage({ id: `custom_filters.${option}` })}
              checked={criterion.value === option}
              onChange={() => onValueChanged(option)}
            />
            <Form.Text className="text-muted" style={{ marginLeft: "1.5rem", fontSize: "0.85rem" }}>
              {intl.formatMessage({ id: `custom_filters.${option}_desc` })}
            </Form.Text>
          </div>
        ))}
      </div>
    </Form.Group>
  );
};

interface ISceneMarkerCustomFiltersFilterProps {
  criterion: SceneMarkerCustomFiltersCriterion;
  setCriterion: (criterion: Criterion) => void;
}

export const SceneMarkerCustomFiltersFilter: React.FC<
  ISceneMarkerCustomFiltersFilterProps
> = ({ criterion, setCriterion }) => {
  const intl = useIntl();

  const onValueChanged = useCallback(
    (value: string) => {
      const newCriterion =
        criterion.clone() as SceneMarkerCustomFiltersCriterion;
      newCriterion.value = value;
      setCriterion(newCriterion);
    },
    [criterion, setCriterion]
  );

  return (
    <Form.Group>
      <Form.Label>
        <FormattedMessage id="custom_filters" />
      </Form.Label>
      <div>
        {SceneMarkerCustomFiltersCriterion.options.map((option) => (
          <div key={option}>
            <Form.Check
              type="radio"
              id={`scene-marker-custom-filter-${option}`}
              name="scene-marker-custom-filter"
              label={intl.formatMessage({ id: `custom_filters.${option}` })}
              checked={criterion.value === option}
              onChange={() => onValueChanged(option)}
            />
            <Form.Text className="text-muted" style={{ marginLeft: "1.5rem", fontSize: "0.85rem" }}>
              {intl.formatMessage({ id: `custom_filters.${option}_marker_desc` })}
            </Form.Text>
          </div>
        ))}
      </div>
    </Form.Group>
  );
};
