import React, { useMemo } from "react";
import { Form, Row, Col, Button, ButtonGroup } from "react-bootstrap";
import { FormattedMessage, useIntl } from "react-intl";
import Select, {
  components as selectComponents,
  OptionProps,
  MultiValueProps,
} from "react-select";
import { CriterionModifier , usePerformerEthnicitiesQuery } from "src/core/generated-graphql";
import { getCountries } from "src/utils/country";
import { CountryFlag } from "src/components/Shared/CountryFlag";
import { RatingSystem } from "src/components/Shared/Rating/RatingSystem";
import {
  PerformerMarkerPartnersCriterion,
  IRatingValue,
} from "src/models/list-filter/criteria/performer-marker-partners";
import { ModifierSelectorButtons } from "../ModifierSelect";
import { ModifierCriterionOption } from "src/models/list-filter/criteria/criterion";
import {
  PerformerIDSelect,
  Performer,
} from "src/components/Performers/PerformerSelect";

const ratingModifiers: {
  value: CriterionModifier;
  label: string;
  title: string;
}[] = [
  { value: CriterionModifier.Equals, label: "=", title: "Equals" },
  { value: CriterionModifier.NotEquals, label: "≠", title: "Not equals" },
  { value: CriterionModifier.GreaterThan, label: ">", title: "Greater than" },
  { value: CriterionModifier.LessThan, label: "<", title: "Less than" },
  { value: CriterionModifier.Between, label: "↔", title: "Between" },
  { value: CriterionModifier.NotBetween, label: "↮", title: "Not between" },
];

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

interface IPerformerMarkerPartnersFilterProps {
  criterion: PerformerMarkerPartnersCriterion;
  setCriterion: (c: PerformerMarkerPartnersCriterion) => void;
}

const PerformerMarkerPartnersFilter: React.FC<
  IPerformerMarkerPartnersFilterProps
> = ({ criterion, setCriterion }) => {
  const intl = useIntl();

  // Fetch ethnicity options
  const { data: ethnicityData } = usePerformerEthnicitiesQuery();
  const ethnicityOptions = useMemo(() => {
    const ethnicities = ethnicityData?.performerEthnicities ?? [];
    return ethnicities.map((e) => ({ label: e, value: e }));
  }, [ethnicityData]);

  // Country options
  const countryOptions = useMemo(() => {
    return getCountries().map((c) => ({ label: c.label, value: c.value }));
  }, []);

  const onEthnicitiesChange = (values: readonly { value: string }[]) => {
    const newC = criterion.clone() as PerformerMarkerPartnersCriterion;
    newC.value.partner_ethnicities = values.map((v) => v.value);
    setCriterion(newC);
  };

  const onCountriesChange = (values: readonly { value: string }[]) => {
    const newC = criterion.clone() as PerformerMarkerPartnersCriterion;
    newC.value.partner_countries = values.map((v) => v.value);
    setCriterion(newC);
  };

  const onPerformersChange = (performers: Performer[]) => {
    const newC = criterion.clone() as PerformerMarkerPartnersCriterion;
    newC.value.partner_performer_ids = performers.map((p) => ({
      id: p.id,
      label: p.name ?? p.id,
    }));
    setCriterion(newC);
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newC = criterion.clone() as PerformerMarkerPartnersCriterion;
    newC.value.partner_role = e.target.value as "top" | "bottom" | "any";
    setCriterion(newC);
  };

  const onRatingChange = (rating: IRatingValue | null) => {
    const newC = criterion.clone() as PerformerMarkerPartnersCriterion;
    newC.value.partner_rating = rating;
    setCriterion(newC);
  };

  const currentRating = criterion.value.partner_rating;
  const currentModifier = currentRating?.modifier ?? CriterionModifier.Equals;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _currentModDef = ratingModifiers.find(
    (m) => m.value === currentModifier
  );

  const onRatingModifierChange = (m: CriterionModifier) => {
    onRatingChange({
      modifier: m,
      value: currentRating?.value ?? 0,
      value2: currentRating?.value2,
    });
  };

  const onRatingValueChange = (v: number | null) => {
    if (v === null) return;
    if (!currentRating) {
      onRatingChange({ modifier: CriterionModifier.Equals, value: v });
    } else {
      onRatingChange({ ...currentRating, value: v });
    }
  };

  const onRatingValue2Change = (v: number | null) => {
    if (v === null) return;
    if (!currentRating) {
      onRatingChange({
        modifier: CriterionModifier.Between,
        value: 0,
        value2: v,
      });
    } else {
      onRatingChange({ ...currentRating, value2: v });
    }
  };

  const onClearRating = () => {
    onRatingChange(null);
  };

  return (
    <div>
      <ModifierSelectorButtons
        options={
          (criterion.criterionOption as ModifierCriterionOption).modifierOptions
        }
        value={criterion.modifier}
        onChanged={(m) => {
          const newC = criterion.clone() as PerformerMarkerPartnersCriterion;
          newC.modifier = m;
          setCriterion(newC);
        }}
      />

      {/* Partner Performers */}
      <Form.Group className="mb-3">
        <Form.Label>
          <FormattedMessage
            id="partner_performers"
            defaultMessage="Partner Performers"
          />
        </Form.Label>
        <PerformerIDSelect
          isMulti
          ids={criterion.value.partner_performer_ids.map((p) => p.id)}
          onSelect={onPerformersChange}
          isClearable
        />
      </Form.Group>

      {/* Partner Role */}
      <Form.Group className="mb-3">
        <Form.Label>
          <FormattedMessage id="partner_role" defaultMessage="Partner Role" />
        </Form.Label>
        <Form.Control
          as="select"
          value={criterion.value.partner_role}
          onChange={handleRoleChange}
          className="input-control"
        >
          <option value="any">{intl.formatMessage({ id: "any" })}</option>
          <option value="top">{intl.formatMessage({ id: "top" })}</option>
          <option value="bottom">{intl.formatMessage({ id: "bottom" })}</option>
        </Form.Control>
      </Form.Group>

      {/* Ethnicity + Country */}
      <Row className="g-2 mb-3">
        <Col md={6}>
          <Form.Label>
            <FormattedMessage
              id="partner_ethnicity"
              defaultMessage="Partner Ethnicity"
            />
          </Form.Label>
          <Select
            classNamePrefix="react-select"
            isMulti
            isClearable
            options={ethnicityOptions}
            value={ethnicityOptions.filter((o) =>
              criterion.value.partner_ethnicities.includes(o.value)
            )}
            onChange={(values) => onEthnicitiesChange(values ?? [])}
            placeholder={intl.formatMessage({
              id: "select_ethnicity",
              defaultMessage: "Select ethnicity...",
            })}
            menuPortalTarget={document.body}
            styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
          />
        </Col>
        <Col md={6}>
          <Form.Label>
            <FormattedMessage
              id="partner_country"
              defaultMessage="Partner Country"
            />
          </Form.Label>
          <Select
            classNamePrefix="react-select"
            isMulti
            isClearable
            options={countryOptions}
            value={countryOptions.filter((o) =>
              criterion.value.partner_countries.includes(o.value)
            )}
            onChange={(values) => onCountriesChange(values ?? [])}
            placeholder={intl.formatMessage({
              id: "select_country",
              defaultMessage: "Select country...",
            })}
            components={{
              Option: CountryOption,
              MultiValue: CountryMultiValue,
            }}
            menuPortalTarget={document.body}
            styles={{ menuPortal: (base) => ({ ...base, zIndex: 9999 }) }}
          />
        </Col>
      </Row>

      {/* Rating */}
      <Form.Group className="mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <Form.Label className="mb-0">
            <FormattedMessage
              id="partner_rating"
              defaultMessage="Partner Rating"
            />
          </Form.Label>
          {currentRating && (
            <Button variant="link" size="sm" onClick={onClearRating}>
              <FormattedMessage id="actions.clear" defaultMessage="Clear" />
            </Button>
          )}
        </div>

        {currentRating ? (
          <>
            <ButtonGroup className="mb-2 d-flex flex-wrap">
              {ratingModifiers.map((mod) => (
                <Button
                  key={mod.value}
                  variant={
                    currentModifier === mod.value ? "primary" : "secondary"
                  }
                  size="sm"
                  onClick={() => onRatingModifierChange(mod.value)}
                  title={mod.title}
                >
                  {mod.label}
                </Button>
              ))}
            </ButtonGroup>
            <div className="d-flex align-items-center gap-2">
              <RatingSystem
                value={currentRating.value}
                onSetRating={onRatingValueChange}
              />
              {(currentModifier === CriterionModifier.Between ||
                currentModifier === CriterionModifier.NotBetween) && (
                <>
                  <span>-</span>
                  <RatingSystem
                    value={currentRating.value2 ?? 0}
                    onSetRating={onRatingValue2Change}
                  />
                </>
              )}
            </div>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              onRatingChange({
                modifier: CriterionModifier.Equals,
                value: 0,
              })
            }
          >
            <FormattedMessage
              id="add_rating_filter"
              defaultMessage="Add Rating Filter"
            />
          </Button>
        )}
      </Form.Group>
    </div>
  );
};

export default PerformerMarkerPartnersFilter;
