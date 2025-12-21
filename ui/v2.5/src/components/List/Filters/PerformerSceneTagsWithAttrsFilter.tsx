import React, { useCallback, useMemo } from "react";
import { Button, Col, Form, Row } from "react-bootstrap";
import Select, { components as selectComponents, OptionProps, MultiValueProps } from "react-select";
import { defineMessages, useIntl } from "react-intl";
import { CriterionModifier } from "src/core/generated-graphql";
import * as GQL from "src/core/generated-graphql";
import { TagSelect, Tag } from "src/components/Tags/TagSelect";
import { PerformerSceneTagsWithAttrsCriterion, PerformerSceneTagGroupUI } from "src/models/list-filter/criteria/performer-scene-tags-with-attrs";
import { getCountries } from "src/utils/country";
import { CountryFlag } from "src/components/Shared/CountryFlag";
import { usePerformerEthnicitiesQuery } from "src/core/generated-graphql";
import { RatingSystem } from "src/components/Shared/Rating/RatingSystem";

const messages = defineMessages({
  add_group: { id: "actions.add_group", defaultMessage: "Add group" },
  group_label: { id: "filters.group", defaultMessage: "Group" },
  tag: { id: "tags", defaultMessage: "Tags" },
  country: { id: "performer_country", defaultMessage: "Country" },
  ethnicity: { id: "performer_ethnicity", defaultMessage: "Ethnicity" },
  rating: { id: "performer_rating", defaultMessage: "Rating" },
  clear: { id: "actions.clear", defaultMessage: "Clear" },
  match_any: { id: "filters.match_any", defaultMessage: "Match any group" },
});

const ratingModifiers: { value: CriterionModifier; label: string; title: string }[] = [
  { value: CriterionModifier.Equals, label: "=", title: "Equals" },
  { value: CriterionModifier.NotEquals, label: "≠", title: "Not equals" },
  { value: CriterionModifier.GreaterThan, label: ">", title: "Greater than" },
  { value: CriterionModifier.LessThan, label: "<", title: "Less than" },
  { value: CriterionModifier.Between, label: "↔", title: "Between" },
  { value: CriterionModifier.NotBetween, label: "↮", title: "Not between" },
];

const makeEmptyGroup = (): PerformerSceneTagGroupUI => ({
  tag: undefined,
  performer_country: "",
  performer_ethnicity: "",
  performer_rating: null,
});

const PerformerSceneTagsWithAttrsFilter: React.FC<{
  criterion: PerformerSceneTagsWithAttrsCriterion;
  setCriterion: (c: PerformerSceneTagsWithAttrsCriterion) => void;
}> = ({ criterion, setCriterion }) => {
  const intl = useIntl();

  const addGroup = () => {
    const c = criterion.clone() as PerformerSceneTagsWithAttrsCriterion;
    c.groups = [...c.groups, makeEmptyGroup()];
    setCriterion(c);
  };

  const removeGroup = (idx: number) => {
    const c = criterion.clone() as PerformerSceneTagsWithAttrsCriterion;
    c.groups = c.groups.filter((_, i) => i !== idx);
    setCriterion(c);
  };

  const onTagsChange = useCallback(
    (idx: number, tags: Tag[]) => {
      const c = criterion.clone() as PerformerSceneTagsWithAttrsCriterion;
      const mapped = (tags ?? []).map((t) => ({ id: t.id, label: t.name ?? t.id }));
      c.groups[idx] = {
        ...c.groups[idx],
        tags: mapped,
      };
      setCriterion(c);
    },
    [criterion, setCriterion]
  );

  // Country options (same source as PerformerCountryFilter)
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
    const c = criterion.clone() as PerformerSceneTagsWithAttrsCriterion;
    c.groups[idx] = { ...c.groups[idx], performer_countries: values.map(v => v.value), performer_country: undefined };
    setCriterion(c);
  };

  // Ethnicity options (same query as PerformerEthnicityFilter)
  const { data: ethnicityData } = usePerformerEthnicitiesQuery();
  const ethnicityOptions = useMemo(() => {
    const list = ethnicityData?.performerEthnicities ?? [];
    return (list as string[]).map((v) => ({ label: v, value: v }));
  }, [ethnicityData]);

  const onEthnicitiesSelect = (idx: number, values: readonly { label: string; value: string }[]) => {
    const c = criterion.clone() as PerformerSceneTagsWithAttrsCriterion;
    c.groups[idx] = { ...c.groups[idx], performer_ethnicities: values.map(v => v.value), performer_ethnicity: undefined };
    setCriterion(c);
  };

  const setRating = (
    idx: number,
    r: PerformerSceneTagGroupUI["performer_rating"]
  ) => {
    const c = criterion.clone() as PerformerSceneTagsWithAttrsCriterion;
    c.groups[idx] = { ...c.groups[idx], performer_rating: r };
    setCriterion(c);
  };

  const onRatingModifierChange = (idx: number, m: CriterionModifier) => {
    const current = criterion.groups[idx].performer_rating;
    setRating(idx, {
      modifier: m,
      value: current?.value ?? 0,
      value2: current?.value2,
    });
  };
  const onRatingValueChange = (idx: number, v: number) => {
    const current = criterion.groups[idx].performer_rating;
    if (!current) return setRating(idx, { modifier: CriterionModifier.Equals, value: v });
    setRating(idx, { ...current, value: v });
  };
  const onRatingValue2Change = (idx: number, v: number) => {
    const current = criterion.groups[idx].performer_rating;
    if (!current) return setRating(idx, { modifier: CriterionModifier.Between, value: 0, value2: v });
    setRating(idx, { ...current, value2: v });
  };

  const hasGroups = criterion.groups.length > 0;

  return (
    <div className="performer-scene-tags-with-attrs-filter">
      <div className="mb-2">
        <Form.Check
          type="switch"
          id="pst-attrs-match-any"
          label={intl.formatMessage(messages.match_any)}
          checked={criterion.matchAny}
          onChange={(e) => {
            const c = criterion.clone() as PerformerSceneTagsWithAttrsCriterion;
            (c as any).matchAny = e.currentTarget.checked;
            setCriterion(c);
          }}
        />
      </div>
      {!hasGroups && (
        <div className="text-muted mb-2">
          {/* Simple hint so the filter doesn't look empty */}
          {intl.formatMessage({ id: "performer_scene_tags_with_attrs", defaultMessage: "Performer Scene Tags + Attributes" })}
        </div>
      )}
      {criterion.groups.map((g, idx) => {
        const currentModifier = g.performer_rating?.modifier ?? CriterionModifier.Equals;
        const currentModDef = ratingModifiers.find((m) => m.value === currentModifier);
        return (
        <div key={idx} className="mb-3 p-2 border rounded">
          <div className="d-flex align-items-center mb-2">
            <strong className="me-2">
              {intl.formatMessage(messages.group_label)} {idx + 1}
            </strong>
            <Button className="minimal" size="sm" variant="danger" onClick={() => removeGroup(idx)}>
              ×
            </Button>
          </div>
          {/* Row 1: Tags + Rating */}
          <Row className="g-2">
            <Col md={6}>
              <Form.Label className="mb-1">Performer Scene Tags</Form.Label>
              <TagSelect
                values={(g.tags ?? []).map((t) => ({ id: t.id, name: t.label, aliases: [] })) as Tag[]}
                isMulti
                onSelect={(tags) => onTagsChange(idx, tags as Tag[])}
                menuPortalTarget={document.body}
                // Show only tags that appear in performer_scene_tags to mirror filter intent
                tagFilter={{ has_performer_scene_tags: true } as Partial<GQL.TagFilterType>}
              />
            </Col>
            <Col md={6}>
              <Form.Label className="mb-1">Rating</Form.Label>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <Form.Control
                  as="select"
                  value={g.performer_rating?.modifier ?? CriterionModifier.Equals}
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
                    value={g.performer_rating?.value}
                    onSetRating={(value) => onRatingValueChange(idx, value ?? 0)}
                    valueRequired
                  />
                </div>
                {(g.performer_rating?.modifier === CriterionModifier.Between || g.performer_rating?.modifier === CriterionModifier.NotBetween) && (
                  <div>
                    <RatingSystem
                      value={g.performer_rating?.value2}
                      onSetRating={(value) => onRatingValue2Change(idx, value ?? 0)}
                      valueRequired
                    />
                  </div>
                )}
                {/* Clear button removed per request */}
              </div>
            </Col>
          </Row>

          {/* Row 2: Country + Ethnicity (multi-select) */}
          <Row className="g-2 mt-2">
            <Col md={6}>
              <Form.Label className="mb-1">Ethnicities</Form.Label>
              <Select
                classNamePrefix="react-select"
                isMulti
                isClearable
                options={ethnicityOptions}
                value={ethnicityOptions.filter((o) => (g.performer_ethnicities ?? (g.performer_ethnicity ? [g.performer_ethnicity] : [])).includes(o.value))}
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
              <Form.Label className="mb-1">Countries</Form.Label>
              <Select
                classNamePrefix="react-select"
                isMulti
                isClearable
                options={countryOptions}
                value={countryOptions.filter((o) => (g.performer_countries ?? (g.performer_country ? [g.performer_country] : [])).includes(o.value))}
                placeholder="Countries (any)"
                onChange={(val) => onCountriesSelect(idx, val)}
                menuPortalTarget={document.body}
                components={{ IndicatorSeparator: null, Option: CountryOption, MultiValue: CountryMultiValue }}
              />
            </Col>
          </Row>
        </div>
      )})}
      <Button variant="primary" onClick={addGroup}>
        {intl.formatMessage(messages.add_group)}
      </Button>
    </div>
  );
};

export default PerformerSceneTagsWithAttrsFilter;
