import React from "react";
import { Badge, Button, Col, Form, Row } from "react-bootstrap";
import Select, {
  components as selectComponents,
  OptionProps,
  MultiValueProps,
} from "react-select";
import { FormattedMessage, useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import { MarkerPerformersCriterion } from "src/models/list-filter/criteria/marker-performers";
import {
  PerformerIDSelect,
  Performer,
} from "src/components/Performers/PerformerSelect";
import { Tag, TagIDSelect } from "src/components/Tags/TagSelect";
import { faArrowUp, faArrowDown } from "@fortawesome/free-solid-svg-icons";
import { Icon } from "src/components/Shared/Icon";
import { RatingCriterion } from "src/models/list-filter/criteria/tags";
import { getCountries } from "src/utils/country";
import { CountryFlag } from "src/components/Shared/CountryFlag";
import { usePerformerEthnicitiesQuery } from "src/core/generated-graphql";
import { RatingSystem } from "src/components/Shared/Rating/RatingSystem";

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

interface IMarkerPerformersFilterProps {
  criterion: MarkerPerformersCriterion;
  setCriterion: (c: MarkerPerformersCriterion) => void;
}

export const MarkerPerformersFilter: React.FC<IMarkerPerformersFilterProps> = ({
  criterion,
  setCriterion,
}) => {
  const intl = useIntl();

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

  // Tags handler
  const onTagsChange = (tags: Tag[]) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.tag_ids = tags.map((t) => ({
      id: t.id,
      label: t.name ?? t.id,
    }));
    setCriterion(c);
  };

  // Top handlers
  const onTopPerformersChange = (performers: Performer[]) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.top_performer_ids = performers.map((p) => ({
      id: p.id,
      label: p.name ?? p.id,
    }));
    setCriterion(c);
  };

  const onTopEthnicitiesChange = (values: readonly { value: string }[]) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.top_ethnicities = values.map((v) => v.value);
    setCriterion(c);
  };

  const onTopCountriesChange = (values: readonly { value: string }[]) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.top_countries = values.map((v) => v.value);
    setCriterion(c);
  };

  const onTopRatingChange = (rating: RatingCriterion) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.top_rating = rating;
    setCriterion(c);
  };

  // Bottom handlers
  const onBottomPerformersChange = (performers: Performer[]) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.bottom_performer_ids = performers.map((p) => ({
      id: p.id,
      label: p.name ?? p.id,
    }));
    setCriterion(c);
  };

  const onBottomEthnicitiesChange = (values: readonly { value: string }[]) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.bottom_ethnicities = values.map((v) => v.value);
    setCriterion(c);
  };

  const onBottomCountriesChange = (values: readonly { value: string }[]) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.bottom_countries = values.map((v) => v.value);
    setCriterion(c);
  };

  const onBottomRatingChange = (rating: RatingCriterion) => {
    const c = criterion.clone() as MarkerPerformersCriterion;
    c.value.bottom_rating = rating;
    setCriterion(c);
  };

  // Don't show inputs for IS_NULL/NOT_NULL modifiers
  if (
    criterion.modifier === CriterionModifier.IsNull ||
    criterion.modifier === CriterionModifier.NotNull
  ) {
    return null;
  }

  // Top rating helpers
  const topRating = criterion.value.top_rating;
  const topModifier = topRating?.modifier ?? CriterionModifier.Equals;
  const topModDef = ratingModifiers.find((m) => m.value === topModifier);

  const onTopRatingModifierChange = (m: CriterionModifier) => {
    onTopRatingChange({
      modifier: m,
      value: topRating?.value ?? 0,
      value2: topRating?.value2,
    });
  };

  const onTopRatingValueChange = (v: number) => {
    if (!topRating) {
      onTopRatingChange({ modifier: CriterionModifier.Equals, value: v });
    } else {
      onTopRatingChange({ ...topRating, value: v });
    }
  };

  const onTopRatingValue2Change = (v: number) => {
    if (!topRating) {
      onTopRatingChange({
        modifier: CriterionModifier.Between,
        value: 0,
        value2: v,
      });
    } else {
      onTopRatingChange({ ...topRating, value2: v });
    }
  };

  // Bottom rating helpers
  const bottomRating = criterion.value.bottom_rating;
  const bottomModifier = bottomRating?.modifier ?? CriterionModifier.Equals;
  const bottomModDef = ratingModifiers.find((m) => m.value === bottomModifier);

  const onBottomRatingModifierChange = (m: CriterionModifier) => {
    onBottomRatingChange({
      modifier: m,
      value: bottomRating?.value ?? 0,
      value2: bottomRating?.value2,
    });
  };

  const onBottomRatingValueChange = (v: number) => {
    if (!bottomRating) {
      onBottomRatingChange({ modifier: CriterionModifier.Equals, value: v });
    } else {
      onBottomRatingChange({ ...bottomRating, value: v });
    }
  };

  const onBottomRatingValue2Change = (v: number) => {
    if (!bottomRating) {
      onBottomRatingChange({
        modifier: CriterionModifier.Between,
        value: 0,
        value2: v,
      });
    } else {
      onBottomRatingChange({ ...bottomRating, value2: v });
    }
  };

  return (
    <div className="marker-performers-filter">
      {/* Tags section at the top */}
      <Form.Group className="mb-3">
        <Form.Label>
          <FormattedMessage id="tags" defaultMessage="Tags" />
        </Form.Label>
        <TagIDSelect
          isMulti
          ids={criterion.value.tag_ids.map((t) => t.id)}
          onSelect={onTagsChange}
          menuPortalTarget={document.body}
        />
        <Form.Check
          type="checkbox"
          className="mt-1"
          label={intl.formatMessage({
            id: "include_sub_tags",
            defaultMessage: "Include sub-tags",
          })}
          checked={criterion.value.include_subtags}
          onChange={(e) => {
            const c = criterion.clone() as MarkerPerformersCriterion;
            c.value.include_subtags = e.currentTarget.checked;
            setCriterion(c);
          }}
        />
      </Form.Group>

      <Row>
        {/* Top Column */}
        <Col md={6}>
          <h6 className="d-flex align-items-center mb-3">
            <Badge
              pill
              variant="success"
              className="me-2"
              style={{ fontSize: 10, padding: "3px 6px" }}
            >
              <Icon icon={faArrowUp} />
            </Badge>
            <FormattedMessage id="top_performers" defaultMessage="Top" />
          </h6>

          {/* Top Performers */}
          <Form.Group className="mb-3">
            <Form.Label>
              <FormattedMessage id="performers" defaultMessage="Performers" />
            </Form.Label>
            <PerformerIDSelect
              isMulti
              ids={criterion.value.top_performer_ids.map((p) => p.id)}
              onSelect={onTopPerformersChange}
              menuPortalTarget={document.body}
            />
          </Form.Group>

          {/* Top Ethnicity */}
          <Form.Group
            className="mb-3"
            style={{
              opacity: criterion.value.top_performer_ids.length > 0 ? 0.5 : 1,
            }}
          >
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
              isDisabled={criterion.value.top_performer_ids.length > 0}
              options={ethnicityOptions}
              value={ethnicityOptions.filter((o) =>
                criterion.value.top_ethnicities.includes(o.value)
              )}
              placeholder={intl.formatMessage({
                id: "any_ethnicity",
                defaultMessage: "Any ethnicity",
              })}
              onChange={onTopEthnicitiesChange}
              components={{ IndicatorSeparator: null }}
              menuPortalTarget={document.body}
            />
          </Form.Group>

          {/* Top Country */}
          <Form.Group
            className="mb-3"
            style={{
              opacity: criterion.value.top_performer_ids.length > 0 ? 0.5 : 1,
            }}
          >
            <Form.Label>
              <FormattedMessage
                id="performer_country"
                defaultMessage="Country"
              />
            </Form.Label>
            <Select
              classNamePrefix="react-select"
              isMulti
              isClearable
              isDisabled={criterion.value.top_performer_ids.length > 0}
              options={countryOptions}
              value={countryOptions.filter((o) =>
                criterion.value.top_countries.includes(o.value)
              )}
              placeholder={intl.formatMessage({
                id: "any_country",
                defaultMessage: "Any country",
              })}
              onChange={onTopCountriesChange}
              menuPortalTarget={document.body}
              components={{
                IndicatorSeparator: null,
                Option: CountryOption,
                MultiValue: CountryMultiValue,
              }}
            />
          </Form.Group>

          {/* Top Rating */}
          <Form.Group
            className="mb-3"
            style={{
              opacity: criterion.value.top_performer_ids.length > 0 ? 0.5 : 1,
            }}
          >
            <Form.Label>
              <FormattedMessage id="performer_rating" defaultMessage="Rating" />
            </Form.Label>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="btn-group" role="group">
                {ratingModifiers.map((m) => (
                  <Button
                    key={m.value}
                    variant={topModifier === m.value ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => onTopRatingModifierChange(m.value)}
                    title={m.title}
                    disabled={criterion.value.top_performer_ids.length > 0}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
              <RatingSystem
                value={topRating?.value}
                onSetRating={(value) => onTopRatingValueChange(value ?? 0)}
                valueRequired
                disabled={criterion.value.top_performer_ids.length > 0}
              />
              {(topRating?.modifier === CriterionModifier.Between ||
                topRating?.modifier === CriterionModifier.NotBetween) && (
                <RatingSystem
                  value={topRating?.value2}
                  onSetRating={(value) => onTopRatingValue2Change(value ?? 0)}
                  valueRequired
                  disabled={criterion.value.top_performer_ids.length > 0}
                />
              )}
              {topRating && (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => onTopRatingChange(null)}
                  disabled={criterion.value.top_performer_ids.length > 0}
                >
                  <FormattedMessage id="actions.clear" defaultMessage="Clear" />
                </Button>
              )}
            </div>
          </Form.Group>
        </Col>

        {/* Bottom Column */}
        <Col md={6}>
          <h6 className="d-flex align-items-center mb-3">
            <Badge
              pill
              variant="info"
              className="me-2"
              style={{ fontSize: 10, padding: "3px 6px" }}
            >
              <Icon icon={faArrowDown} />
            </Badge>
            <FormattedMessage id="bottom_performers" defaultMessage="Bottom" />
          </h6>

          {/* Bottom Performers */}
          <Form.Group className="mb-3">
            <Form.Label>
              <FormattedMessage id="performers" defaultMessage="Performers" />
            </Form.Label>
            <PerformerIDSelect
              isMulti
              ids={criterion.value.bottom_performer_ids.map((p) => p.id)}
              onSelect={onBottomPerformersChange}
              menuPortalTarget={document.body}
            />
          </Form.Group>

          {/* Bottom Ethnicity */}
          <Form.Group
            className="mb-3"
            style={{
              opacity: criterion.value.bottom_performer_ids.length > 0 ? 0.5 : 1,
            }}
          >
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
              isDisabled={criterion.value.bottom_performer_ids.length > 0}
              options={ethnicityOptions}
              value={ethnicityOptions.filter((o) =>
                criterion.value.bottom_ethnicities.includes(o.value)
              )}
              placeholder={intl.formatMessage({
                id: "any_ethnicity",
                defaultMessage: "Any ethnicity",
              })}
              onChange={onBottomEthnicitiesChange}
              components={{ IndicatorSeparator: null }}
              menuPortalTarget={document.body}
            />
          </Form.Group>

          {/* Bottom Country */}
          <Form.Group
            className="mb-3"
            style={{
              opacity: criterion.value.bottom_performer_ids.length > 0 ? 0.5 : 1,
            }}
          >
            <Form.Label>
              <FormattedMessage
                id="performer_country"
                defaultMessage="Country"
              />
            </Form.Label>
            <Select
              classNamePrefix="react-select"
              isMulti
              isClearable
              isDisabled={criterion.value.bottom_performer_ids.length > 0}
              options={countryOptions}
              value={countryOptions.filter((o) =>
                criterion.value.bottom_countries.includes(o.value)
              )}
              placeholder={intl.formatMessage({
                id: "any_country",
                defaultMessage: "Any country",
              })}
              onChange={onBottomCountriesChange}
              menuPortalTarget={document.body}
              components={{
                IndicatorSeparator: null,
                Option: CountryOption,
                MultiValue: CountryMultiValue,
              }}
            />
          </Form.Group>

          {/* Bottom Rating */}
          <Form.Group
            className="mb-3"
            style={{
              opacity: criterion.value.bottom_performer_ids.length > 0 ? 0.5 : 1,
            }}
          >
            <Form.Label>
              <FormattedMessage id="performer_rating" defaultMessage="Rating" />
            </Form.Label>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="btn-group" role="group">
                {ratingModifiers.map((m) => (
                  <Button
                    key={m.value}
                    variant={bottomModifier === m.value ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => onBottomRatingModifierChange(m.value)}
                    title={m.title}
                    disabled={criterion.value.bottom_performer_ids.length > 0}
                  >
                    {m.label}
                  </Button>
                ))}
              </div>
              <RatingSystem
                value={bottomRating?.value}
                onSetRating={(value) => onBottomRatingValueChange(value ?? 0)}
                valueRequired
                disabled={criterion.value.bottom_performer_ids.length > 0}
              />
              {(bottomRating?.modifier === CriterionModifier.Between ||
                bottomRating?.modifier === CriterionModifier.NotBetween) && (
                <RatingSystem
                  value={bottomRating?.value2}
                  onSetRating={(value) =>
                    onBottomRatingValue2Change(value ?? 0)
                  }
                  valueRequired
                  disabled={criterion.value.bottom_performer_ids.length > 0}
                />
              )}
              {bottomRating && (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  disabled={criterion.value.bottom_performer_ids.length > 0}
                  onClick={() => onBottomRatingChange(null)}
                >
                  <FormattedMessage id="actions.clear" defaultMessage="Clear" />
                </Button>
              )}
            </div>
          </Form.Group>
        </Col>
      </Row>
    </div>
  );
};

export default MarkerPerformersFilter;
