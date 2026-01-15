import React from "react";
import { CriterionModifier } from "src/core/generated-graphql";
import { PerformerMarkerTagsCriterion } from "src/models/list-filter/criteria/performer-marker-tags";
import { ModifierSelectorButtons } from "../ModifierSelect";
import { ModifierCriterionOption } from "src/models/list-filter/criteria/criterion";
import { Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import { TagSelect, Tag } from "src/components/Tags/TagSelect";

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

  const handleTagsChange = (tags: Tag[]) => {
    const newC = criterion.clone() as PerformerMarkerTagsCriterion;
    newC.value.tag_ids = tags.map((t) => ({ id: t.id, label: t.name ?? t.id }));
    setCriterion(newC);
  };

  // Cast to Tag[] - the TagSelect component only really uses id and name
  const currentTags = criterion.value.tag_ids.map((t) => ({
    id: t.id,
    name: t.label,
    aliases: [],
    stash_ids: [],
  })) as Tag[];

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
