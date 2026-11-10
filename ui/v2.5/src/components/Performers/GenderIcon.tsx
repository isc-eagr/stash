import React from "react";
import { faMars } from "@fortawesome/free-solid-svg-icons";
import * as GQL from "src/core/generated-graphql";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useIntl } from "react-intl";

interface IIconProps {
  gender?: GQL.Maybe<GQL.GenderEnum>;
  className?: string;
}

const GenderIcon: React.FC<IIconProps> = ({ gender, className }) => {
  const intl = useIntl();

  if (gender !== GQL.GenderEnum.Male) {
    return null;
  }

  return (
    <span title={intl.formatMessage({ id: "gender_types.MALE" })}>
      <FontAwesomeIcon
        data-gender={GQL.GenderEnum.Male}
        className={className}
        icon={faMars}
      />
    </span>
  );
};

export default GenderIcon;
