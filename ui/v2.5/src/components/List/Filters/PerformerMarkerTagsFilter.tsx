import React, { useMemo } from "react";
import {
  CriterionModifier,
  TagDataFragment,
  TagFilterType,
  useFindTagsForSelectQuery,
} from "src/core/generated-graphql";
import { sortByRelevance } from "src/utils/query";
import { ListFilterModel } from "src/models/list-filter/filter";
import {
  IUseQueryHookProps,
  makeQueryVariables,
  setObjectFilter,
} from "./LabeledIdFilter";
import { PerformerMarkerTagsCriterion } from "src/models/list-filter/criteria/performer-marker-tags";
import { ModifierSelectorButtons } from "../ModifierSelect";
import { ModifierCriterionOption } from "src/models/list-filter/criteria/criterion";
import { Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import { TagSelect } from "src/components/Tags/TagSelect";
import { ILabeledId } from "src/models/list-filter/types";

interface IPerformerMarkerTagsFilter {
  criterion: PerformerMarkerTagsCriterion;
  setCriterion: (c: PerformerMarkerTagsCriterion) => void;
}

const PerformerMarkerTagsFilter: React.FC<IPerformerMarkerTagsFilter> = ({
  criterion,
  setCriterion,
}) => {
  const intl = useIntl();

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newC = criterion.clone() as PerformerMarkerTagsCriterion;
    newC.value.role = e.target.value as "top" | "bottom" | "any";
    setCriterion(newC);
  };

  const handleTagsChange = (tags: { id: string; name: string }[]) => {
    const newC = criterion.clone() as PerformerMarkerTagsCriterion;
    newC.value.tag_ids = tags.map((t) => ({ id: t.id, label: t.name }));
    setCriterion(newC);
  };

  const currentTags = criterion.value.tag_ids.map((t) => ({
    id: t.id,
    name: t.label,
  })) as any[];

  return (
    <div>
      <ModifierSelectorButtons
        options={
          (criterion.criterionOption as ModifierCriterionOption).modifierOptions
        }
        value={criterion.modifier}
        onChanged={(m) => {
          const newC = criterion.clone() as PerformerMarkerTagsCriterion;
          newC.modifier = m;
          setCriterion(newC);
        }}
      />

      {criterion.modifier !== CriterionModifier.IsNull &&
        criterion.modifier !== CriterionModifier.NotNull && (
          <>
            <div className="mb-2">
              <Form.Group>
                <Form.Label>{intl.formatMessage({ id: "role" })}</Form.Label>
                <Form.Control
                  as="select"
                  value={criterion.value.role}
                  onChange={handleRoleChange}
                  className="input-control"
                >
                  <option value="any">
                    {intl.formatMessage({ id: "any" })}
                  </option>
                  <option value="top">
                    {intl.formatMessage({ id: "top" })}
                  </option>
                  <option value="bottom">
                    {intl.formatMessage({ id: "bottom" })}
                  </option>
                </Form.Control>
              </Form.Group>
            </div>

            <div className="mb-2">
              <Form.Label>{intl.formatMessage({ id: "tags" })}</Form.Label>
              <TagSelect
                isMulti
                values={currentTags}
                onSelect={handleTagsChange}
                menuPortalTarget={document.body}
              />
            </div>
          </>
        )}
    </div>
  );
};

export default PerformerMarkerTagsFilter;
