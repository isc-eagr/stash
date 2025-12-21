import React, { useCallback, useMemo } from "react";
import { Button, Col, Form, Row } from "react-bootstrap";
import Select, { components as selectComponents, OptionProps, MultiValueProps } from "react-select";
import { defineMessages, useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import { SceneMarkerTagsCriterion, SceneMarkerTagGroupUI } from "src/models/list-filter/criteria/tags";
import { Tag, TagIDSelect } from "src/components/Tags/TagSelect";
import { PerformerIDSelect, Performer } from "src/components/Performers/PerformerSelect";
import { getCountries } from "src/utils/country";
import { CountryFlag } from "src/components/Shared/CountryFlag";
import { usePerformerEthnicitiesQuery } from "src/core/generated-graphql";
import { RatingSystem } from "src/components/Shared/Rating/RatingSystem";

const messages = defineMessages({
  add_group: { id: "actions.add_marker", defaultMessage: "Add marker" },
  marker_label: { id: "filters.marker", defaultMessage: "Marker" },
  tags: { id: "tags", defaultMessage: "Tags" },
  performers: { id: "performers", defaultMessage: "Performers" },
  country: { id: "performer_country", defaultMessage: "Country" },
  ethnicity: { id: "performer_ethnicity", defaultMessage: "Ethnicity" },
  rating: { id: "performer_rating", defaultMessage: "Rating" },
});

const ratingModifiers: { value: CriterionModifier; label: string; title: string }[] = [
  { value: CriterionModifier.Equals, label: "=", title: "Equals" },
  { value: CriterionModifier.NotEquals, label: "≠", title: "Not equals" },
  { value: CriterionModifier.GreaterThan, label: ">", title: "Greater than" },
  { value: CriterionModifier.LessThan, label: "<", title: "Less than" },
  { value: CriterionModifier.Between, label: "↔", title: "Between" },
  { value: CriterionModifier.NotBetween, label: "↮", title: "Not between" },
];

const makeEmptyGroup = (): SceneMarkerTagGroupUI => ({
  tags: [],
  performer_ids: [],
  performer_countries: [],
  performer_ethnicities: [],
  performer_rating: null,
});

export const SceneMarkerTagsFilter: React.FC<{
  criterion: SceneMarkerTagsCriterion;
  setCriterion: (c: SceneMarkerTagsCriterion) => void;
}> = ({ criterion, setCriterion }) => {
  const intl = useIntl();

  const addGroup = () => {
    const c = criterion.clone() as SceneMarkerTagsCriterion;
    const newGroup = makeEmptyGroup();
    c.extendedGroups = [...c.extendedGroups, newGroup];
    c.groups = [...c.groups, []];
    setCriterion(c);
  };
  const removeGroup = (idx: number) => {
    const c = criterion.clone() as SceneMarkerTagsCriterion;
    c.extendedGroups = c.extendedGroups.filter((_, i) => i !== idx);
    c.groups = c.groups.filter((_, i) => i !== idx);
    setCriterion(c);
  };

  const onTagsChange = useCallback(
    (idx: number, tags: Tag[]) => {
      const c = criterion.clone() as SceneMarkerTagsCriterion;
      const mapped = tags.map((t) => ({ id: t.id, label: t.name ?? t.id }));
      // Update both extendedGroups and groups for consistency
      if (!c.extendedGroups[idx]) c.extendedGroups[idx] = makeEmptyGroup();
      c.extendedGroups[idx] = { ...c.extendedGroups[idx], tags: mapped };
      c.groups[idx] = mapped;
      setCriterion(c);
    },
    [criterion, setCriterion]
  );

  const onPerformersChange = useCallback(
    (idx: number, performers: Performer[]) => {
      const c = criterion.clone() as SceneMarkerTagsCriterion;
      const mapped = performers.map((p) => ({ id: p.id, label: p.name ?? p.id }));
      if (!c.extendedGroups[idx]) c.extendedGroups[idx] = makeEmptyGroup();
      c.extendedGroups[idx] = { ...c.extendedGroups[idx], performer_ids: mapped };
      setCriterion(c);
    },
    [criterion, setCriterion]
  );

  // Country options
  const { locale } = useIntl();
  const countryOptions = useMemo(() => getCountries(locale) as { label: string; value: string }[], [locale]);

  // Custom option component with flag
  const CountryOption: React.FC<OptionProps<{ label: string; value: string }, true>> = (optionProps) => {
    const { data } = optionProps;
    return (
      <selectComponents.Option {...optionProps}>
        <div className="d-flex align-items-center">
          <CountryFlag country={data.value} />
          <span style={{ marginLeft: '0.5rem' }}>{data.label}</span>
        </div>
      </selectComponents.Option>
    );
  };

  const CountryMultiValue: React.FC<MultiValueProps<{ label: string; value: string }, true>> = (props) => {
    const { data } = props;
    return (
      <selectComponents.MultiValue {...props}>
        <div className="d-flex align-items-center">
          <CountryFlag country={data.value} />
          <span style={{ marginLeft: '0.25rem' }}>{data.label}</span>
        </div>
      </selectComponents.MultiValue>
    );
  };

  const onCountriesSelect = (idx: number, values: readonly { label: string; value: string }[]) => {
    const c = criterion.clone() as SceneMarkerTagsCriterion;
    if (!c.extendedGroups[idx]) c.extendedGroups[idx] = makeEmptyGroup();
    c.extendedGroups[idx] = { ...c.extendedGroups[idx], performer_countries: values.map(v => v.value) };
    setCriterion(c);
  };

  // Ethnicity options
  const { data: ethnicityData } = usePerformerEthnicitiesQuery();
  const ethnicityOptions = useMemo(() => {
    const list = ethnicityData?.performerEthnicities ?? [];
    return (list as string[]).map((v) => ({ label: v, value: v }));
  }, [ethnicityData]);

  const onEthnicitiesSelect = (idx: number, values: readonly { label: string; value: string }[]) => {
    const c = criterion.clone() as SceneMarkerTagsCriterion;
    if (!c.extendedGroups[idx]) c.extendedGroups[idx] = makeEmptyGroup();
    c.extendedGroups[idx] = { ...c.extendedGroups[idx], performer_ethnicities: values.map(v => v.value) };
    setCriterion(c);
  };

  const setRating = (
    idx: number,
    r: SceneMarkerTagGroupUI["performer_rating"]
  ) => {
    const c = criterion.clone() as SceneMarkerTagsCriterion;
    if (!c.extendedGroups[idx]) c.extendedGroups[idx] = makeEmptyGroup();
    c.extendedGroups[idx] = { ...c.extendedGroups[idx], performer_rating: r };
    setCriterion(c);
  };

  const onRatingModifierChange = (idx: number, m: CriterionModifier) => {
    const current = criterion.extendedGroups[idx]?.performer_rating;
    setRating(idx, {
      modifier: m,
      value: current?.value ?? 0,
      value2: current?.value2,
    });
  };
  const onRatingValueChange = (idx: number, v: number) => {
    const current = criterion.extendedGroups[idx]?.performer_rating;
    if (!current) return setRating(idx, { modifier: CriterionModifier.Equals, value: v });
    setRating(idx, { ...current, value: v });
  };
  const onRatingValue2Change = (idx: number, v: number) => {
    const current = criterion.extendedGroups[idx]?.performer_rating;
    if (!current) return setRating(idx, { modifier: CriterionModifier.Between, value: 0, value2: v });
    setRating(idx, { ...current, value2: v });
  };

  const onFlatChange = useCallback(
    (tags: Tag[]) => {
      const c = criterion.clone() as SceneMarkerTagsCriterion;
      c.items = tags.map((t) => ({ id: t.id, label: t.name ?? t.id }));
      setCriterion(c);
    },
    [criterion, setCriterion]
  );

  if (
    criterion.modifier === CriterionModifier.IsNull ||
    criterion.modifier === CriterionModifier.NotNull
  ) {
    return null;
  }

  const isGrouped =
    criterion.modifier === CriterionModifier.Equals ||
    criterion.modifier === CriterionModifier.NotEquals;

  return (
    <div className="scene-marker-tags-filter">
      {isGrouped ? (
        <div className="grouped-tags">
          {criterion.extendedGroups.map((group, idx) => {
            const currentModifier = group.performer_rating?.modifier ?? CriterionModifier.Equals;
            const currentModDef = ratingModifiers.find((m) => m.value === currentModifier);
            return (
              <div key={idx} className="mb-3 p-2 border rounded">
                <div className="d-flex align-items-center mb-2">
                  <strong className="me-2">
                    {intl.formatMessage(messages.marker_label)} {idx + 1}
                  </strong>
                  <Button
                    className="minimal"
                    size="sm"
                    variant="danger"
                    onClick={() => removeGroup(idx)}
                  >
                    ×
                  </Button>
                </div>

                {/* Row 1: Tags + Performers */}
                <Row className="g-2">
                  <Col md={6}>
                    <Form.Label className="mb-1">{intl.formatMessage(messages.tags)}</Form.Label>
                    <TagIDSelect
                      isMulti
                      ids={(group.tags ?? []).map((t) => t.id)}
                      onSelect={(tags) => onTagsChange(idx, tags)}
                      menuPortalTarget={document.body}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Label className="mb-1">{intl.formatMessage(messages.performers)}</Form.Label>
                    <PerformerIDSelect
                      isMulti
                      ids={(group.performer_ids ?? []).map((p) => p.id)}
                      onSelect={(performers) => onPerformersChange(idx, performers)}
                      menuPortalTarget={document.body}
                    />
                  </Col>
                </Row>

                {/* Row 2: Rating */}
                <Row className="g-2 mt-2">
                  <Col md={12}>
                    <Form.Label className="mb-1">{intl.formatMessage(messages.rating)}</Form.Label>
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <Form.Control
                        as="select"
                        value={group.performer_rating?.modifier ?? CriterionModifier.Equals}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onRatingModifierChange(idx, e.target.value as unknown as CriterionModifier)}
                        size="sm"
                        className="w-auto"
                        title={currentModDef?.title}
                        aria-label={currentModDef?.title}
                      >
                        {ratingModifiers.map((m) => (
                          <option key={m.value} value={m.value} title={m.title} aria-label={m.title}>
                            {m.label}
                          </option>
                        ))}
                      </Form.Control>
                      <div>
                        <RatingSystem
                          value={group.performer_rating?.value}
                          onSetRating={(value) => onRatingValueChange(idx, value ?? 0)}
                          valueRequired
                        />
                      </div>
                      {(group.performer_rating?.modifier === CriterionModifier.Between || group.performer_rating?.modifier === CriterionModifier.NotBetween) && (
                        <div>
                          <RatingSystem
                            value={group.performer_rating?.value2}
                            onSetRating={(value) => onRatingValue2Change(idx, value ?? 0)}
                            valueRequired
                          />
                        </div>
                      )}
                    </div>
                  </Col>
                </Row>

                {/* Row 3: Country + Ethnicity */}
                <Row className="g-2 mt-2">
                  <Col md={6}>
                    <Form.Label className="mb-1">{intl.formatMessage(messages.ethnicity)}</Form.Label>
                    <Select
                      classNamePrefix="react-select"
                      isMulti
                      isClearable
                      options={ethnicityOptions}
                      value={ethnicityOptions.filter((o) => (group.performer_ethnicities ?? []).includes(o.value))}
                      placeholder="Ethnicities (any)"
                      onChange={(val) => onEthnicitiesSelect(idx, val)}
                      components={{ IndicatorSeparator: null }}
                      menuPortalTarget={document.body}
                    />
                    <div style={{ marginTop: 4 }}>
                      <small className="text-muted">
                        Note: Afrolatino counts as Black and Latino; Mixed counts as Black and White.
                      </small>
                    </div>
                  </Col>
                  <Col md={6}>
                    <Form.Label className="mb-1">{intl.formatMessage(messages.country)}</Form.Label>
                    <Select
                      classNamePrefix="react-select"
                      isMulti
                      isClearable
                      options={countryOptions}
                      value={countryOptions.filter((o) => (group.performer_countries ?? []).includes(o.value))}
                      placeholder="Countries (any)"
                      onChange={(val) => onCountriesSelect(idx, val)}
                      menuPortalTarget={document.body}
                      components={{ IndicatorSeparator: null, Option: CountryOption, MultiValue: CountryMultiValue }}
                    />
                  </Col>
                </Row>
              </div>
            );
          })}
          <Button className="minimal" onClick={addGroup}>
            {intl.formatMessage(messages.add_group)}
          </Button>
        </div>
      ) : (
        <div className="flat-tags">
          <TagIDSelect
            isMulti
            ids={criterion.items.map((t) => t.id)}
            onSelect={(tags) => onFlatChange(tags)}
            menuPortalTarget={document.body}
          />
        </div>
      )}
    </div>
  );
};

export default SceneMarkerTagsFilter;
