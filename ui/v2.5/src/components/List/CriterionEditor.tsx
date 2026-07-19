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
import { PerformerCountryFilter } from "./Filters/PerformerCountryFilter"; // CUSTOM: replaced CountrySelect
import { StashIDCriterion } from "src/models/list-filter/criteria/stash-ids";
import { StashIDFilter } from "./Filters/StashIDFilter";
// CUSTOM: begin - additional rating/ethnicity imports
import {
  PerformerRatingCriterion,
  RatingCriterion,
} from "../../models/list-filter/criteria/rating";
import { EthnicityCriterion } from "../../models/list-filter/criteria/ethnicity";
import { RatingFilter } from "./Filters/RatingFilter";
import { PerformerRatingFilter } from "./Filters/PerformerRatingFilter";
import { PerformerEthnicityFilter } from "./Filters/PerformerEthnicityFilter";
// CUSTOM: end
import { BooleanFilter } from "./Filters/BooleanFilter";
import { OptionFilter, OptionListFilter } from "./Filters/OptionFilter";
import { PathFilter } from "./Filters/PathFilter";
import { PerformersCriterion } from "src/models/list-filter/criteria/performers";
import PerformersFilter from "./Filters/PerformersFilter";
import { StudiosCriterion } from "src/models/list-filter/criteria/studios";
import StudiosFilter from "./Filters/StudiosFilter";
import { TagsCriterion } from "src/models/list-filter/criteria/tags"; // CUSTOM
import TagsFilter from "./Filters/TagsFilter";
import {
  PhashCriterion,
  DuplicatedCriterion,
} from "src/models/list-filter/criteria/phash";
import { PhashFilter } from "./Filters/PhashFilter";
import { DuplicatedFilter } from "./Filters/DuplicateFilter";
import { PathCriterion } from "src/models/list-filter/criteria/path";
import { ModifierSelectorButtons } from "./ModifierSelect";
import { CustomFieldsCriterion } from "src/models/list-filter/criteria/custom-fields";
import { CustomFieldsFilter } from "./Filters/CustomFieldsFilter";
import { FolderFilter } from "./Filters/FolderFilter";
import {
  FolderCriterion,
  ParentFolderCriterion,
} from "src/models/list-filter/criteria/folder";
// CUSTOM: begin - marker/performer/scene-type/custom-filter imports
import { MarkerPerformersCriterion } from "src/models/list-filter/criteria/marker-performers";
import { MarkerPerformersFilter } from "./Filters/MarkerPerformersFilter";
import { PerformerMarkersCriterion } from "src/models/list-filter/criteria/performer-markers";
import { PerformerMarkersFilter } from "./Filters/PerformerMarkersFilter";
import { PerformerMarkersExcludeCriterion } from "src/models/list-filter/criteria/performer-markers-exclude";
import { PerformerMarkersExcludeFilter } from "./Filters/PerformerMarkersExcludeFilter";
import { MarkerTagsCriterion } from "src/models/list-filter/criteria/marker-tags";
import { MarkerTagsFilter } from "./Filters/MarkerTagsFilter";
import { MarkerTopCriterion } from "src/models/list-filter/criteria/marker-top";
import { MarkerTopFilter } from "./Filters/MarkerTopFilter";
import { MarkerBottomCriterion } from "src/models/list-filter/criteria/marker-bottom";
import { MarkerBottomFilter } from "./Filters/MarkerBottomFilter";
import { ExcludeMarkerTagsCriterion } from "src/models/list-filter/criteria/exclude-marker-tags";
import { ExcludeMarkerTagsFilter } from "./Filters/ExcludeMarkerTagsFilter";
import {
  SceneMarkersCriterion,
  sceneMarkersModifierOptions,
} from "src/models/list-filter/criteria/scene-markers";
import { SceneMarkersFilter } from "./Filters/SceneMarkersFilter";
import {
  SceneMarkersExcludeCriterion,
  sceneMarkersExcludeModifierOptions,
} from "src/models/list-filter/criteria/scene-markers-exclude";
import { SceneMarkersExcludeFilter } from "./Filters/SceneMarkersExcludeFilter";
import {
  SceneCustomFiltersCriterion,
  SceneMarkerCustomFiltersCriterion,
} from "src/models/list-filter/criteria/custom-filters";
import { PerformerPartnersCriterion } from "src/models/list-filter/criteria/performer-partners"; // CUSTOM
import {
  SceneSceneTypeCriterion,
  PerformerSceneTypeCriterion,
} from "src/models/list-filter/criteria/scene-type";
import {
  SceneCustomFiltersFilter,
  SceneMarkerCustomFiltersFilter,
} from "./Filters/CustomFiltersFilter";
import { PerformerPartnersFilter } from "./Filters/PerformerPartnersFilter"; // CUSTOM
import {
  SceneSceneTypeFilter,
  PerformerSceneTypeFilter,
} from "./Filters/SceneTypeFilter";
import { HasRolesCriterion } from "src/models/list-filter/criteria/has-roles";
import { HasRolesFilter } from "./Filters/HasRolesFilter";
import { RatingCriteriaCriterion } from "src/models/list-filter/criteria/rating-criteria_custom";
import { RatingCriteriaFilter } from "./Filters/RatingCriteriaFilter_custom";
import { ActivityTypeCriterion } from "src/models/list-filter/criteria/activity-type_custom";
import { ActivityTypeFilter } from "./Filters/ActivityTypeFilter_custom";
import { QualityTypeCriterion } from "src/models/list-filter/criteria/quality-type_custom";
import { QualityTypeFilter } from "./Filters/QualityTypeFilter_custom";
// CUSTOM: end

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
      criterion instanceof TagsCriterion ||
      criterion instanceof FolderCriterion ||
      criterion instanceof ParentFolderCriterion
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
    if (
      criterion instanceof FolderCriterion ||
      criterion instanceof ParentFolderCriterion
    ) {
      return (
        <FolderFilter
          criterion={criterion}
          setCriterion={(c) => setCriterion(c)}
        />
      );
    }

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
    // CUSTOM: begin - EthnicityCriterion handler
    if (criterion instanceof EthnicityCriterion) {
      return (
        <PerformerEthnicityFilter
          criterion={criterion}
          onValueChanged={(v) => onValueChanged(v)}
        />
      );
    }
    // CUSTOM: end
    // CUSTOM: begin - PerformerRatingCriterion handler
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
    // CUSTOM: end
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
    // CUSTOM: begin - replaced CountrySelect with PerformerCountryFilter
    if (criterion instanceof CountryCriterion) {
      return (
        <PerformerCountryFilter
          criterion={criterion}
          onValueChanged={(v) => onValueChanged(v)}
        />
      );
    }
    // CUSTOM: end
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
    // CUSTOM: begin - combined rating criteria filter editor
    if (criterion instanceof RatingCriteriaCriterion) {
      return (
        <RatingCriteriaFilter
          criterion={criterion}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }
    // CUSTOM: end

    if (criterion instanceof BooleanCriterion) {
      return (
        <BooleanFilter criterion={criterion} setCriterion={setCriterion} />
      );
    }

    if (criterion instanceof DuplicatedCriterion) {
      return (
        <DuplicatedFilter criterion={criterion} setCriterion={setCriterion} />
      );
    }

    if (criterion instanceof CustomFieldsCriterion) {
      return (
        <CustomFieldsFilter criterion={criterion} setCriterion={setCriterion} />
      );
    }

    // CUSTOM: begin - marker/performer/scene-type/custom-filter criterion handlers
    if (criterion instanceof MarkerPerformersCriterion) {
      const c = criterion;
      return (
        <div>
          <MarkerPerformersFilter
            criterion={c}
            setCriterion={(nc) => setCriterion(nc)}
          />
        </div>
      );
    }

    if (criterion instanceof PerformerMarkersCriterion) {
      const c = criterion;
      return (
        <PerformerMarkersFilter
          criterion={c}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }

    if (criterion instanceof PerformerMarkersExcludeCriterion) {
      const c = criterion;
      return (
        <PerformerMarkersExcludeFilter
          criterion={c}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }

    if (criterion instanceof MarkerTagsCriterion) {
      return (
        <MarkerTagsFilter
          criterion={criterion}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }

    if (criterion instanceof MarkerTopCriterion) {
      return (
        <MarkerTopFilter
          criterion={criterion}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }

    if (criterion instanceof MarkerBottomCriterion) {
      return (
        <MarkerBottomFilter
          criterion={criterion}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }

    if (criterion instanceof ExcludeMarkerTagsCriterion) {
      return (
        <ExcludeMarkerTagsFilter
          criterion={criterion}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }

    if (criterion instanceof SceneMarkersCriterion) {
      const c = criterion;
      return (
        <div>
          <ModifierSelectorButtons
            options={sceneMarkersModifierOptions}
            value={c.modifier}
            onChanged={(m) => {
              const newC = c.clone() as SceneMarkersCriterion;
              newC.modifier = m;
              setCriterion(newC);
            }}
          />
          <SceneMarkersFilter
            criterion={c}
            setCriterion={(nc) => setCriterion(nc)}
          />
        </div>
      );
    }

    if (criterion instanceof SceneMarkersExcludeCriterion) {
      const c = criterion;
      return (
        <div>
          <ModifierSelectorButtons
            options={sceneMarkersExcludeModifierOptions}
            value={c.modifier}
            onChanged={(m) => {
              const newC = c.clone() as SceneMarkersExcludeCriterion;
              newC.modifier = m;
              setCriterion(newC);
            }}
          />
          <SceneMarkersExcludeFilter
            criterion={c}
            setCriterion={(nc) => setCriterion(nc)}
          />
        </div>
      );
    }

    if (criterion instanceof SceneCustomFiltersCriterion) {
      return (
        <SceneCustomFiltersFilter
          criterion={criterion}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }

    if (criterion instanceof SceneSceneTypeCriterion) {
      return (
        <SceneSceneTypeFilter
          criterion={criterion}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }

    if (criterion instanceof PerformerPartnersCriterion) {
      // CUSTOM
      return (
        <PerformerPartnersFilter
          criterion={criterion}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }

    if (criterion instanceof ActivityTypeCriterion) {
      return (
        <ActivityTypeFilter
          criterion={criterion}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }

    if (criterion instanceof QualityTypeCriterion) {
      return (
        <QualityTypeFilter
          criterion={criterion}
          setCriterion={(newCriterion) => setCriterion(newCriterion)}
        />
      );
    }

    if (criterion instanceof PerformerSceneTypeCriterion) {
      return (
        <PerformerSceneTypeFilter
          criterion={criterion}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }

    if (criterion instanceof SceneMarkerCustomFiltersCriterion) {
      return (
        <SceneMarkerCustomFiltersFilter
          criterion={criterion}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }

    if (criterion instanceof HasRolesCriterion) {
      return (
        <HasRolesFilter
          criterion={criterion}
          setCriterion={(nc) => setCriterion(nc)}
        />
      );
    }
    // CUSTOM: end

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
