import React, { useCallback } from "react";
import { Form } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import {
  SceneSceneTypeCriterion,
  PerformerSceneTypeCriterion,
} from "src/models/list-filter/criteria/scene-type";
import { Criterion } from "src/models/list-filter/criteria/criterion";

// ===================== Scene Scene Type Filter =====================
// Sex/Oral/Solo are mutually exclusive (radio buttons), Facial is independent (checkbox)

interface ISceneSceneTypeFilterProps {
  criterion: SceneSceneTypeCriterion;
  setCriterion: (criterion: Criterion) => void;
}

export const SceneSceneTypeFilter: React.FC<ISceneSceneTypeFilterProps> = ({
  criterion,
  setCriterion,
}) => {
  const intl = useIntl();

  const selectedPrimary = criterion.value.find((v) =>
    SceneSceneTypeCriterion.primaryOptions.some((option) => option === v)
  );
  const hasFacial = criterion.value.includes("facial");

  const onPrimaryChanged = useCallback(
    (value: string) => {
      const newCriterion = criterion.clone() as SceneSceneTypeCriterion;
      // Set primary (replace any existing primary), keep facial if selected
      const newValue: string[] = [value];
      if (hasFacial) {
        newValue.push("facial");
      }
      newCriterion.value = newValue;
      setCriterion(newCriterion);
    },
    [criterion, setCriterion, hasFacial]
  );

  const onFacialToggled = useCallback(() => {
    const newCriterion = criterion.clone() as SceneSceneTypeCriterion;
    if (hasFacial) {
      // Remove facial
      newCriterion.value = newCriterion.value.filter((v) => v !== "facial");
    } else {
      // Add facial
      newCriterion.value = [...newCriterion.value, "facial"];
    }
    setCriterion(newCriterion);
  }, [criterion, setCriterion, hasFacial]);

  return (
    <Form.Group>
      <Form.Label>
        <FormattedMessage id="scene_type" />
      </Form.Label>
      <div>
        {SceneSceneTypeCriterion.primaryOptions.map((option) => (
          <div key={option}>
            <Form.Check
              type="radio"
              id={`scene-type-${option}`}
              name="scene-type-primary"
              label={intl.formatMessage({ id: `scene_type.${option}` })}
              checked={selectedPrimary === option}
              onChange={() => onPrimaryChanged(option)}
            />
            <Form.Text
              className="text-muted"
              style={{ marginLeft: "1.5rem", fontSize: "0.85rem" }}
            >
              {intl.formatMessage({ id: `scene_type.${option}_desc` })}
            </Form.Text>
          </div>
        ))}
        <hr style={{ margin: "0.5rem 0" }} />
        {SceneSceneTypeCriterion.secondaryOptions.map((option) => (
          <div key={option}>
            <Form.Check
              type="checkbox"
              id={`scene-type-${option}`}
              label={intl.formatMessage({ id: `scene_type.${option}` })}
              checked={criterion.value.includes(option)}
              onChange={onFacialToggled}
            />
            <Form.Text
              className="text-muted"
              style={{ marginLeft: "1.5rem", fontSize: "0.85rem" }}
            >
              {intl.formatMessage({ id: `scene_type.${option}_desc` })}
            </Form.Text>
          </div>
        ))}
      </div>
    </Form.Group>
  );
};

// ===================== Performer Scene Type Filter =====================
// All 4 options are independent checkboxes

interface IPerformerSceneTypeFilterProps {
  criterion: PerformerSceneTypeCriterion;
  setCriterion: (criterion: Criterion) => void;
}

export const PerformerSceneTypeFilter: React.FC<
  IPerformerSceneTypeFilterProps
> = ({ criterion, setCriterion }) => {
  const intl = useIntl();

  const onToggle = useCallback(
    (option: string) => {
      const newCriterion = criterion.clone() as PerformerSceneTypeCriterion;
      if (newCriterion.value.includes(option)) {
        newCriterion.value = newCriterion.value.filter((v) => v !== option);
      } else {
        newCriterion.value = [...newCriterion.value, option];
      }
      setCriterion(newCriterion);
    },
    [criterion, setCriterion]
  );

  return (
    <Form.Group>
      <Form.Label>
        <FormattedMessage id="scene_type" />
      </Form.Label>
      <div>
        {PerformerSceneTypeCriterion.allOptions.map((option) => (
          <div key={option}>
            <Form.Check
              type="checkbox"
              id={`performer-scene-type-${option}`}
              label={intl.formatMessage({ id: `scene_type.${option}` })}
              checked={criterion.value.includes(option)}
              onChange={() => onToggle(option)}
            />
            <Form.Text
              className="text-muted"
              style={{ marginLeft: "1.5rem", fontSize: "0.85rem" }}
            >
              {intl.formatMessage({
                id: `scene_type.${option}_performer_desc`,
                defaultMessage: intl.formatMessage({
                  id: `scene_type.${option}_desc`,
                }),
              })}
            </Form.Text>
          </div>
        ))}
      </div>
    </Form.Group>
  );
};
