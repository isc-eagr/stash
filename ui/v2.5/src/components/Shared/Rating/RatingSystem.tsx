import { useConfigurationContext } from "src/hooks/Config";
import {
  defaultRatingStarPrecision,
  defaultRatingSystemOptions,
  RatingSystemType,
} from "src/utils/rating";
import { RatingNumber } from "./RatingNumber";
import { RatingStars } from "./RatingStars";
import { PatchComponent } from "src/patch";

export interface IRatingSystemProps {
  value: number | null | undefined;
  onSetRating?: (value: number | null) => void;
  disabled?: boolean;
  valueRequired?: boolean;
  max?: number;
  // if true, requires a click first to edit the rating
  clickToRate?: boolean;
  // true if we should indicate that this is a rating
  withoutContext?: boolean;
  orMore?: boolean;
}

export const RatingSystem = PatchComponent(
  "RatingSystem",
  (props: IRatingSystemProps) => {
    const { configuration: config } = useConfigurationContext();
    const ratingSystemOptions =
      config?.ui.ratingSystemOptions ?? defaultRatingSystemOptions;

    if (ratingSystemOptions.type === RatingSystemType.Stars) {
      return (
        <RatingStars
          value={props.value ?? null}
          onSetRating={props.onSetRating}
          disabled={props.disabled}
          precision={
            ratingSystemOptions.starPrecision ?? defaultRatingStarPrecision
          }
          valueRequired={props.valueRequired}
          orMore={props.orMore}
        />
      );
    }

    return (
      <RatingNumber
        value={props.value ?? null}
        onSetRating={props.onSetRating}
        disabled={props.disabled}
        clickToRate={props.clickToRate}
        max={props.max}
        withoutContext={props.withoutContext}
      />
    );
  }
);
