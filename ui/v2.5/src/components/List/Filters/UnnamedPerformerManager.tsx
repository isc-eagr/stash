import React, { useState } from "react";
import { Button, Card, Col, Form, Row } from "react-bootstrap";
import Select, {
  components as selectComponents,
  OptionProps,
  MultiValueProps,
} from "react-select";
import { FormattedMessage, useIntl } from "react-intl";
import {
  CriterionModifier,
  usePerformerEthnicitiesQuery,
} from "src/core/generated-graphql";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { getCountries } from "src/utils/country";
import { CountryFlag } from "src/components/Shared/CountryFlag";
import { RatingSystem } from "src/components/Shared/Rating/RatingSystem";
import {
  IUnnamedPerformer,
  cloneUnnamedPerformer,
} from "src/models/list-filter/criteria/unnamed-performer";
import {
  PerformerRatingCriteriaCriterionOption,
  RatingCriteriaCriterion,
} from "src/models/list-filter/criteria/rating-criteria_custom";
import { RatingCriteriaFilter } from "./RatingCriteriaFilter_custom";

// Country option with flag
const CountryOption: React.FC<
  OptionProps<{ label: string; value: string }, true>
> = (props) => {
  const { data } = props;
  return (
    <selectComponents.Option {...props}>
      <CountryFlag country={data.value} className="me-2" />
      {data.label}
    </selectComponents.Option>
  );
};

// Country multi-value with flag
const CountryMultiValue: React.FC<
  MultiValueProps<{ label: string; value: string }, true>
> = (props) => {
  const { data } = props;
  return (
    <selectComponents.MultiValue {...props}>
      <CountryFlag country={data.value} className="me-1" />
      {data.label}
    </selectComponents.MultiValue>
  );
};

interface IUnnamedPerformerEditorProps {
  performer: IUnnamedPerformer;
  onSave: (performer: IUnnamedPerformer) => void;
  onCancel: () => void;
  isNew?: boolean;
  inModal?: boolean; // CUSTOM: keep existing selectors above the marker editor modal
}

/**
 * Modal/inline editor for creating or editing an unnamed performer's criteria
 */
export const UnnamedPerformerEditor: React.FC<IUnnamedPerformerEditorProps> = ({
  performer,
  onSave,
  onCancel,
  isNew = false,
  inModal = false, // CUSTOM
}) => {
  const intl = useIntl();
  // CUSTOM: isolate nested rating criteria until the vato is saved.
  const [editedPerformer, setEditedPerformer] = useState<IUnnamedPerformer>(
    () => cloneUnnamedPerformer(performer)
  );

  // Fetch ethnicity options
  const { data: ethnicityData } = usePerformerEthnicitiesQuery();
  const ethnicityOptions = React.useMemo(() => {
    const ethnicities = ethnicityData?.performerEthnicities ?? [];
    return ethnicities.map((e) => ({ label: e, value: e }));
  }, [ethnicityData]);

  // Country options
  const countryOptions = React.useMemo(() => {
    return getCountries().map((c) => ({ label: c.label, value: c.value }));
  }, []);

  const onEthnicitiesChange = (values: readonly { value: string }[]) => {
    setEditedPerformer({
      ...editedPerformer,
      ethnicities: values.map((v) => v.value),
    });
  };

  const onCountriesChange = (values: readonly { value: string }[]) => {
    setEditedPerformer({
      ...editedPerformer,
      countries: values.map((v) => v.value),
    });
  };

  const { rating } = editedPerformer;
  const ratingCriteriaCriterion = React.useMemo(() => {
    const criterion = new RatingCriteriaCriterion(
      PerformerRatingCriteriaCriterionOption
    );
    criterion.value = editedPerformer.rating_criteria ?? {
      criteria: {},
      bonusValues: {},
      bonuses: {},
      penalties: {},
    };
    return criterion;
  }, [editedPerformer.rating_criteria]);

  const onRatingModifierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.target;
    const newModifier = value as CriterionModifier;
    setEditedPerformer({
      ...editedPerformer,
      rating: {
        modifier: newModifier,
        value: rating?.value ?? 0,
      },
    });
  };

  const onRatingValueChange = (v: number) => {
    // Preserve the current modifier, default to EQUALS
    setEditedPerformer({
      ...editedPerformer,
      rating: {
        modifier: rating?.modifier ?? CriterionModifier.Equals,
        value: v,
      },
    });
  };

  const onClearRating = () => {
    setEditedPerformer({
      ...editedPerformer,
      rating: null,
    });
  };

  const onRatingCriteriaChange = (criterion: RatingCriteriaCriterion) => {
    setEditedPerformer({
      ...editedPerformer,
      rating_criteria: criterion.isValid() ? criterion.value : null,
    });
  };

  const handleSave = () => {
    onSave(editedPerformer);
  };

  return (
    <Card className="unnamed-performer-editor mb-3">
      <Card.Header className="d-flex align-items-center">
        <Icon icon={faUser} className="me-2" />
        <strong>{editedPerformer.label}</strong>
      </Card.Header>
      <Card.Body>
        {/* Ethnicity */}
        <Form.Group className="mb-3">
          <Form.Label>
            <FormattedMessage
              id="performer_ethnicity"
              defaultMessage="Ethnicity"
            />
          </Form.Label>
          <Select
            classNamePrefix="react-select"
            isMulti
            isClearable
            options={ethnicityOptions}
            value={ethnicityOptions.filter((o) =>
              editedPerformer.ethnicities.includes(o.value)
            )}
            placeholder={intl.formatMessage({
              id: "any_ethnicity",
              defaultMessage: "Any ethnicity",
            })}
            onChange={onEthnicitiesChange}
            components={{ IndicatorSeparator: null }}
            menuPortalTarget={document.body}
            styles={
              inModal
                ? { menuPortal: (base) => ({ ...base, zIndex: 9999 }) }
                : undefined
            } // CUSTOM
          />
        </Form.Group>

        {/* Country */}
        <Form.Group className="mb-3">
          <Form.Label>
            <FormattedMessage id="performer_country" defaultMessage="Country" />
          </Form.Label>
          <Select
            classNamePrefix="react-select"
            isMulti
            isClearable
            options={countryOptions}
            value={countryOptions.filter((o) =>
              editedPerformer.countries.includes(o.value)
            )}
            placeholder={intl.formatMessage({
              id: "any_country",
              defaultMessage: "Any country",
            })}
            onChange={onCountriesChange}
            menuPortalTarget={document.body}
            styles={
              inModal
                ? { menuPortal: (base) => ({ ...base, zIndex: 9999 }) }
                : undefined
            } // CUSTOM
            components={{
              IndicatorSeparator: null,
              Option: CountryOption,
              MultiValue: CountryMultiValue,
            }}
          />
        </Form.Group>

        {/* Rating */}
        <Form.Group className="mb-3">
          <Form.Label className="d-flex align-items-center">
            <FormattedMessage id="performer_rating" defaultMessage="Rating" />
            {rating && (
              <Button
                variant="link"
                size="sm"
                className="ms-2 p-0"
                onClick={onClearRating}
              >
                <FormattedMessage id="actions.clear" defaultMessage="Clear" />
              </Button>
            )}
          </Form.Label>
          <Row className="g-2 align-items-center">
            <Col xs="auto">
              <Form.Control
                as="select"
                size="sm"
                value={rating?.modifier ?? CriterionModifier.Equals}
                onChange={onRatingModifierChange}
                style={{ width: "auto" }}
              >
                <option value={CriterionModifier.Equals}>=</option>
                <option value={CriterionModifier.GreaterThan}>{">"}</option>
                <option value={CriterionModifier.GreaterThanEquals}>≥</option>
                <option value={CriterionModifier.LessThan}>{"<"}</option>
                <option value={CriterionModifier.LessThanEquals}>≤</option>
              </Form.Control>
            </Col>
            <Col>
              <RatingSystem
                value={rating?.value ?? 0}
                onSetRating={(value) => onRatingValueChange(value ?? 0)}
                clickToRate
              />
            </Col>
          </Row>
        </Form.Group>

        <Form.Group className="mb-3">
          <Form.Label>
            <FormattedMessage
              id="rating_criteria"
              defaultMessage="Vato Rating Criteria"
            />
          </Form.Label>
          <RatingCriteriaFilter
            criterion={ratingCriteriaCriterion}
            setCriterion={onRatingCriteriaChange}
          />
        </Form.Group>
      </Card.Body>
      <Card.Footer className="d-flex justify-content-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>
          <FormattedMessage id="actions.cancel" defaultMessage="Cancel" />
        </Button>
        <Button variant="primary" size="sm" onClick={handleSave}>
          {isNew ? (
            <FormattedMessage id="actions.add" defaultMessage="Add" />
          ) : (
            <FormattedMessage id="actions.save" defaultMessage="Save" />
          )}
        </Button>
      </Card.Footer>
    </Card>
  );
};
