import React from "react";
import { Form } from "react-bootstrap";
import { RatingFilter } from "./RatingFilter";
import { PerformerRatingCriterion } from "src/models/list-filter/criteria/rating";
import { INumberValue } from "src/models/list-filter/types";

export const PerformerRatingFilter: React.FC<{
  criterion: PerformerRatingCriterion;
  onValueChanged: (value: INumberValue) => void;
  onMatchAllChanged: (value: boolean) => void;
}> = ({ criterion, onValueChanged, onMatchAllChanged }) => {
  return (
    <div className="performer-rating-filter">
      <RatingFilter criterion={criterion} onValueChanged={onValueChanged} />
      <Form.Check
        type="checkbox"
        id="performer-rating-match-all"
        className="mt-2"
        label="All performers must match"
        checked={criterion.matchAll}
        onChange={(e) => onMatchAllChanged(e.currentTarget.checked)}
      />
    </div>
  );
};
