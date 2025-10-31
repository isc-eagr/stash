import cloneDeep from "lodash-es/cloneDeep";
import React, { useCallback, useMemo } from "react";
import { CriterionModifier } from "src/core/generated-graphql";
import {
  DurationCriterion,
  CriterionValue,
  ModifierCriterion,
  IHierarchicalLabeledIdCriterion,
  NumberCriterion,
  ILabeledIdCriterion,
  DateCriterion,
  TimestampCriterion,
  BooleanCriterion,
  Criterion,
} from "src/models/list-filter/criteria/criterion";
import {
  criterionIsHierarchicalLabelValue,
  criterionIsNumberValue,
  criterionIsStashIDValue,
  criterionIsDateValue,
  criterionIsTimestampValue,
} from "src/models/list-filter/types";
import { DurationFilter } from "./Filters/DurationFilter";
import { NumberFilter } from "./Filters/NumberFilter";
import { LabeledIdFilter } from "./Filters/LabeledIdFilter";
import { HierarchicalLabelValueFilter } from "./Filters/HierarchicalLabelValueFilter";
import { InputFilter } from "./Filters/InputFilter";
import { DateFilter } from "./Filters/DateFilter";
import { TimestampFilter } from "./Filters/TimestampFilter";
import { CountryCriterion } from "src/models/list-filter/criteria/country";
import { PerformerCountryFilter } from "./Filters/PerformerCountryFilter";
import { StashIDCriterion } from "src/models/list-filter/criteria/stash-ids";
import { StashIDFilter } from "./Filters/StashIDFilter";
import { PerformerRatingCriterion, RatingCriterion } from "../../models/list-filter/criteria/rating";
import { EthnicityCriterion } from "../../models/list-filter/criteria/ethnicity";
import { RatingFilter } from "./Filters/RatingFilter";
import { PerformerRatingFilter } from "./Filters/PerformerRatingFilter";
import { PerformerEthnicityFilter } from "./Filters/PerformerEthnicityFilter";
import { BooleanFilter } from "./Filters/BooleanFilter";
import { OptionFilter, OptionListFilter } from "./Filters/OptionFilter";
import { PathFilter } from "./Filters/PathFilter";
import { PerformersCriterion } from "src/models/list-filter/criteria/performers";
import PerformersFilter from "./Filters/PerformersFilter";
import { StudiosCriterion } from "src/models/list-filter/criteria/studios";
import StudiosFilter from "./Filters/StudiosFilter";
import { TagsCriterion } from "src/models/list-filter/criteria/tags";
import { SceneMarkerTagsCriterion } from "src/models/list-filter/criteria/tags";
import TagsFilter from "./Filters/TagsFilter";
import SceneMarkerTagsFilter from "./Filters/SceneMarkerTagsFilter";
import { PhashCriterion } from "src/models/list-filter/criteria/phash";
import { PhashFilter } from "./Filters/PhashFilter";
import { PathCriterion } from "src/models/list-filter/criteria/path";
import { ModifierSelectorButtons } from "./ModifierSelect";
import { CustomFieldsCriterion } from "src/models/list-filter/criteria/custom-fields";
import { CustomFieldsFilter } from "./Filters/CustomFieldsFilter";

interface IGenericCriterionEditor {
  criterion: ModifierCriterion<CriterionValue>;
  setCriterion: (c: ModifierCriterion<CriterionValue>) => void;
}

const GenericCriterionEditor: React.FC<IGenericCriterionEditor> = ({
  criterion,
  setCriterion,
}) => {
  const { options, modifierOptions } = criterion.modifierCriterionOption();

  const showModifierSelector = useMemo(() => {
    if (
      criterion instanceof PerformersCriterion ||
      criterion instanceof StudiosCriterion ||
      criterion instanceof TagsCriterion
    ) {
      return false;
    }

    return modifierOptions && modifierOptions.length > 1;
  }, [criterion, modifierOptions]);

  const alwaysShowFilter = useMemo(() => {
    return (
      criterion instanceof StashIDCriterion ||
      criterion instanceof PerformersCriterion ||
      criterion instanceof StudiosCriterion ||
      criterion instanceof TagsCriterion
    );
  }, [criterion]);

  const onChangedModifierSelect = useCallback(
    (m: CriterionModifier) => {
      const newCriterion = cloneDeep(criterion);
      newCriterion.modifier = m;
      setCriterion(newCriterion);
    },
    [criterion, setCriterion]
  );

  const modifierSelector = useMemo(() => {
    if (!showModifierSelector) {
      return;
    }

    return (
      <ModifierSelectorButtons
        options={modifierOptions}
        value={criterion.modifier}
        onChanged={onChangedModifierSelect}
      />
    );
  }, [
    showModifierSelector,
    modifierOptions,
    onChangedModifierSelect,
    criterion.modifier,
  ]);

  const valueControl = useMemo(() => {
    function onValueChanged(value: CriterionValue) {
      const newCriterion = cloneDeep(criterion);
      newCriterion.value = value;
      setCriterion(newCriterion);
    }

    // always show stashID filter
    if (criterion instanceof StashIDCriterion) {
      return (
        <StashIDFilter criterion={criterion} onValueChanged={onValueChanged} />
      );
    }

    // Hide the value select if the modifier is "IsNull" or "NotNull"
    if (
      !alwaysShowFilter &&
      (criterion.modifier === CriterionModifier.IsNull ||
        criterion.modifier === CriterionModifier.NotNull)
    ) {
      return;
    }

    if (criterion instanceof PerformersCriterion) {
      return (
        <PerformersFilter
          criterion={criterion}
          setCriterion={(c) => setCriterion(c)}
        />
      );
    }

    if (criterion instanceof StudiosCriterion) {
      return (
        <StudiosFilter
          criterion={criterion}
          setCriterion={(c) => setCriterion(c)}
        />
      );
    }

    if (criterion instanceof TagsCriterion) {
      return (
        <TagsFilter
          criterion={criterion}
          setCriterion={(c) => setCriterion(c)}
        />
      );
    }
    // SceneMarkerTagsCriterion is handled by a specialized editor outside GenericCriterionEditor

    if (criterion instanceof ILabeledIdCriterion) {
      return (
        <LabeledIdFilter
          criterion={criterion}
          onValueChanged={onValueChanged}
        />
      );
    }
    if (criterion instanceof IHierarchicalLabeledIdCriterion) {
      return (
        <HierarchicalLabelValueFilter
          criterion={criterion}
          onValueChanged={onValueChanged}
        />
      );
    }
    if (
      options &&
      !criterionIsHierarchicalLabelValue(criterion.value) &&
      !criterionIsNumberValue(criterion.value) &&
      !criterionIsStashIDValue(criterion.value) &&
      !criterionIsDateValue(criterion.value) &&
      !criterionIsTimestampValue(criterion.value)
    ) {
      if (!Array.isArray(criterion.value)) {
        return (
          <OptionFilter criterion={criterion} setCriterion={setCriterion} />
        );
      } else {
        return (
          <OptionListFilter criterion={criterion} setCriterion={setCriterion} />
        );
      }
    }
    if (criterion instanceof PathCriterion) {
      return (
        <PathFilter criterion={criterion} onValueChanged={onValueChanged} />
      );
    }
    if (criterion instanceof DurationCriterion) {
      return (
        <DurationFilter criterion={criterion} onValueChanged={onValueChanged} />
      );
    }
    if (criterion instanceof DateCriterion) {
      return (
        <DateFilter criterion={criterion} onValueChanged={onValueChanged} />
      );
    }
    if (criterion instanceof TimestampCriterion) {
      return (
        <TimestampFilter
          criterion={criterion}
          onValueChanged={onValueChanged}
        />
      );
    }
    if (criterion instanceof NumberCriterion) {
      return (
        <NumberFilter criterion={criterion} onValueChanged={onValueChanged} />
      );
    }
    if (criterion instanceof EthnicityCriterion) {
      return (
        <PerformerEthnicityFilter
          criterion={criterion}
          onValueChanged={(v) => onValueChanged(v)}
        />
      );
    }
    if (criterion instanceof PerformerRatingCriterion) {
      return (
        <PerformerRatingFilter
          criterion={criterion}
          onValueChanged={(v) => onValueChanged(v)}
          onMatchAllChanged={(v) => {
            const c = cloneDeep(criterion);
            c.matchAll = v;
            setCriterion(c);
          }}
        />
      );
    }
    if (criterion instanceof RatingCriterion) {
      return (
        <RatingFilter criterion={criterion} onValueChanged={onValueChanged} />
      );
    }
    if (criterion instanceof PhashCriterion) {
      return (
        <PhashFilter criterion={criterion} onValueChanged={onValueChanged} />
      );
    }
    if (criterion instanceof CountryCriterion) {
      return (
        <PerformerCountryFilter
          criterion={criterion}
          onValueChanged={(v) => onValueChanged(v)}
        />
      );
    }
    return (
      <InputFilter criterion={criterion} onValueChanged={onValueChanged} />
    );
  }, [criterion, setCriterion, options, alwaysShowFilter]);

  return (
    <div>
      {modifierSelector}
      {valueControl}
    </div>
  );
};

interface ICriterionEditor {
  criterion: Criterion;
  setCriterion: (c: Criterion) => void;
}

export const CriterionEditor: React.FC<ICriterionEditor> = ({
  criterion,
  setCriterion,
}) => {
  const filterControl = useMemo(() => {
    if (criterion instanceof SceneMarkerTagsCriterion) {
      // Custom editor with modifier selector
      const c = criterion;
      return (
        <div>
          <ModifierSelectorButtons
            options={(c.criterionOption as any).modifierOptions}
            value={c.modifier as unknown as CriterionModifier}
            onChanged={(m) => {
              const newC = c.clone() as SceneMarkerTagsCriterion;
              (newC as any).modifier = m;
              setCriterion(newC);
            }}
          />
          <SceneMarkerTagsFilter
            criterion={c as SceneMarkerTagsCriterion}
            setCriterion={(nc) => setCriterion(nc)}
          />
        </div>
      );
    }

    if (criterion instanceof BooleanCriterion) {
      return (
        <BooleanFilter criterion={criterion} setCriterion={setCriterion} />
      );
    }

    if (criterion instanceof CustomFieldsCriterion) {
      return (
        <CustomFieldsFilter criterion={criterion} setCriterion={setCriterion} />
      );
    }

    if (criterion instanceof ModifierCriterion) {
      return (
        <GenericCriterionEditor
          criterion={criterion}
          setCriterion={setCriterion}
        />
      );
    }

    return null;
  }, [criterion, setCriterion]);

  return <div className="criterion-editor">{filterControl}</div>;
};
