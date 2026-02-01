import React from "react";
import { Form } from "react-bootstrap";
import { useIntl } from "react-intl";
import { HasRolesCriterion } from "src/models/list-filter/criteria/has-roles";

interface IHasRolesFilter {
  criterion: HasRolesCriterion;
  setCriterion: (c: HasRolesCriterion) => void;
}

export const HasRolesFilter: React.FC<IHasRolesFilter> = ({
  criterion,
  setCriterion,
}) => {
  const intl = useIntl();

  const handleHasTopsChange = (checked: boolean) => {
    const c = criterion.clone() as HasRolesCriterion;
    c.value.hasTops = checked;
    setCriterion(c);
  };

  const handleHasBottomsChange = (checked: boolean) => {
    const c = criterion.clone() as HasRolesCriterion;
    c.value.hasBottoms = checked;
    setCriterion(c);
  };

  return (
    <div className="has-roles-filter">
      <Form.Check
        id="has-roles-has-tops"
        type="checkbox"
        label={intl.formatMessage({ id: "has_tops" })}
        checked={criterion.value.hasTops}
        onChange={(e) => handleHasTopsChange(e.target.checked)}
      />
      <Form.Check
        id="has-roles-has-bottoms"
        type="checkbox"
        label={intl.formatMessage({ id: "has_bottoms" })}
        checked={criterion.value.hasBottoms}
        onChange={(e) => handleHasBottomsChange(e.target.checked)}
      />
    </div>
  );
};

