import * as GQL from "src/core/generated-graphql";
import { PerformersCriterion } from "src/models/list-filter/criteria/performers";
import { CountryCriterion } from "src/models/list-filter/criteria/country";
import {
  StudiosCriterion,
  ParentStudiosCriterion,
} from "src/models/list-filter/criteria/studios";
import {
  ChildTagsCriterionOption,
  ParentTagsCriterionOption,
  TagsCriterion,
  TagsCriterionOption,
} from "src/models/list-filter/criteria/tags";
import { ListFilterModel } from "src/models/list-filter/filter";
import {
  ContainingGroupsCriterionOption,
  GroupsCriterion,
  GroupsCriterionOption,
  SubGroupsCriterionOption,
} from "src/models/list-filter/criteria/groups";
import {
  ModifierCriterion,
  ModifierCriterionOption,
  CriterionValue,
  StringCriterion,
  createStringCriterionOption,
  Criterion,
} from "src/models/list-filter/criteria/criterion";
import {
  RatingCriterion,
  RatingCriterionOption,
} from "src/models/list-filter/criteria/rating";
import { RatingSystemType, RatingStarPrecision } from "src/utils/rating";
import { GalleriesCriterion } from "src/models/list-filter/criteria/galleries";
import { PhashCriterion } from "src/models/list-filter/criteria/phash";
import {
  ILabeledId,
  IHierarchicalLabelValue,
} from "src/models/list-filter/types";
import { IntlShape } from "react-intl";
import { galleryTitle } from "src/core/galleries";
import { MarkersScenesCriterion } from "src/models/list-filter/criteria/scenes";
import { objectTitle } from "src/core/files";
import {
  MarkerTagsCriterion,
  MarkerTagsCriterionOption,
} from "src/models/list-filter/criteria/marker-tags";
import {
  MarkerPerformersCriterion,
  MarkerPerformersCriterionOption,
} from "src/models/list-filter/criteria/marker-performers";

function addExtraCriteria(dest: Criterion[], src?: Criterion[]) {
  if (src && src.length > 0) {
    dest.push(...src);
  }
}

const makePerformerScenesUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  extraPerformer?: ILabeledId,
  extraCriteria?: ModifierCriterion<CriterionValue>[]
) => {
  if (!performer.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);
  const criterion = new PerformersCriterion();
  criterion.value.items = [
    { id: performer.id, label: performer.name || `Performer ${performer.id}` },
  ];

  if (extraPerformer) {
    criterion.value.items.push(extraPerformer);
  }

  filter.criteria.push(criterion);
  addExtraCriteria(filter.criteria, extraCriteria);
  return `/scenes?${filter.makeQueryParameters()}`;
};

const makePerformerImagesUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  extraPerformer?: ILabeledId,
  extraCriteria?: ModifierCriterion<CriterionValue>[]
) => {
  if (!performer.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Images, undefined);
  const criterion = new PerformersCriterion();
  criterion.value.items = [
    { id: performer.id, label: performer.name || `Performer ${performer.id}` },
  ];

  if (extraPerformer) {
    criterion.value.items.push(extraPerformer);
  }

  filter.criteria.push(criterion);
  addExtraCriteria(filter.criteria, extraCriteria);
  return `/images?${filter.makeQueryParameters()}`;
};

export interface INamedObject {
  id: string;
  name?: string;
  sort_name?: string | null;
}

const makePerformerGalleriesUrl = (
  performer: INamedObject,
  extraPerformer?: ILabeledId,
  extraCriteria?: ModifierCriterion<CriterionValue>[]
) => {
  if (!performer.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Galleries, undefined);
  const criterion = new PerformersCriterion();
  criterion.value.items = [
    { id: performer.id, label: performer.name || `Performer ${performer.id}` },
  ];

  if (extraPerformer) {
    criterion.value.items.push(extraPerformer);
  }

  filter.criteria.push(criterion);
  addExtraCriteria(filter.criteria, extraCriteria);
  return `/galleries?${filter.makeQueryParameters()}`;
};

const makePerformerGroupsUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  extraPerformer?: ILabeledId,
  extraCriteria?: ModifierCriterion<CriterionValue>[]
) => {
  if (!performer.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Groups, undefined);
  const criterion = new PerformersCriterion();
  criterion.value.items = [
    { id: performer.id, label: performer.name || `Performer ${performer.id}` },
  ];

  if (extraPerformer) {
    criterion.value.items.push(extraPerformer);
  }

  filter.criteria.push(criterion);
  addExtraCriteria(filter.criteria, extraCriteria);
  return `/groups?${filter.makeQueryParameters()}`;
};

const makePerformerSceneMarkersUrl = (
  performer: Partial<GQL.PerformerDataFragment>
) => {
  if (!performer.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.SceneMarkers, undefined);
  const criterion = new PerformersCriterion();
  criterion.value.items = [
    { id: performer.id, label: performer.name || `Performer ${performer.id}` },
  ];

  filter.criteria.push(criterion);
  return `/scenes/markers?${filter.makeQueryParameters()}`;
};

const makePerformersCountryUrl = (
  performer: Partial<GQL.PerformerDataFragment>
) => {
  if (!performer.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Performers, undefined);
  const criterion = new CountryCriterion();
  criterion.value = `${performer.country}`;
  filter.criteria.push(criterion);
  return `/performers?${filter.makeQueryParameters()}`;
};

const makePerformersEthnicityUrl = (ethnicity: string) => {
  const filter = new ListFilterModel(GQL.FilterMode.Performers, undefined);
  const criterion = new StringCriterion(
    createStringCriterionOption("ethnicity")
  );
  criterion.modifier = GQL.CriterionModifier.Equals;
  criterion.value = ethnicity;
  filter.criteria.push(criterion);
  const randomId = Math.floor(Math.random() * 100000000);
  return `/performers?${filter.makeQueryParameters()}&sortby=random_${randomId}`;
};

const makePerformersEthnicityRatingUrl = (
  ethnicity: string,
  rating: number
) => {
  const filter = new ListFilterModel(GQL.FilterMode.Performers, undefined);

  const ethnicityCriterion = new StringCriterion(
    createStringCriterionOption("ethnicity")
  );
  ethnicityCriterion.modifier = GQL.CriterionModifier.Equals;
  ethnicityCriterion.value = ethnicity;
  filter.criteria.push(ethnicityCriterion);

  const ratingCriterion = new RatingCriterion(
    { type: RatingSystemType.Stars, starPrecision: RatingStarPrecision.Full },
    RatingCriterionOption
  );
  ratingCriterion.modifier = GQL.CriterionModifier.Equals;
  ratingCriterion.value = { value: rating, value2: undefined };
  filter.criteria.push(ratingCriterion);

  const randomId = Math.floor(Math.random() * 100000000);
  return `/performers?${filter.makeQueryParameters()}&sortby=random_${randomId}`;
};

const makeStudioScenesUrl = (studio: Partial<GQL.StudioDataFragment>) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);
  const criterion = new StudiosCriterion();
  criterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(criterion);
  return `/scenes?${filter.makeQueryParameters()}`;
};

const makePerformerStudioScenesUrl = (
  performerId: string,
  studio: Partial<GQL.StudioDataFragment>
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add performer criterion
  const performerCriterion = new PerformersCriterion();
  performerCriterion.value.items = [
    { id: performerId, label: `Performer ${performerId}` },
  ];
  filter.criteria.push(performerCriterion);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makeStudioSexScenesUrl = (
  studio: Partial<GQL.StudioDataFragment>,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  // Add performer scene tags criterion (must include top OR bottom)
  const tagsCriterion = new TagsCriterion(TagsCriterionOption);
  tagsCriterion.modifier = GQL.CriterionModifier.Includes;
  tagsCriterion.value = {
    items: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
    ],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(tagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makeStudioOralScenesUrl = (
  studio: Partial<GQL.StudioDataFragment>,
  oralTopTagId: string,
  oralTopTagLabel: string,
  oralBottomTagId: string,
  oralBottomTagLabel: string,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  // Add oral tags criterion (must include oral tags, exclude top/bottom)
  const oralTagsCriterion = new TagsCriterion(TagsCriterionOption);
  oralTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  oralTagsCriterion.value = {
    items: [
      { id: oralTopTagId, label: oralTopTagLabel },
      { id: oralBottomTagId, label: oralBottomTagLabel },
    ],
    excluded: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
    ],
    depth: 0,
  };
  filter.criteria.push(oralTagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makeStudioSoloScenesUrl = (
  studio: Partial<GQL.StudioDataFragment>,
  soloTagId: string,
  soloTagLabel: string,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string,
  oralTopTagId: string,
  oralTopTagLabel: string,
  oralBottomTagId: string,
  oralBottomTagLabel: string
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  // Add solo tag criterion (must include solo, exclude top/bottom/oral tags)
  const soloTagsCriterion = new TagsCriterion(TagsCriterionOption);
  soloTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  soloTagsCriterion.value = {
    items: [{ id: soloTagId, label: soloTagLabel }],
    excluded: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
      { id: oralTopTagId, label: oralTopTagLabel },
      { id: oralBottomTagId, label: oralBottomTagLabel },
    ],
    depth: 0,
  };
  filter.criteria.push(soloTagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makeStudioFacialScenesUrl = (
  studio: Partial<GQL.StudioDataFragment>,
  facialGivenTagId: string,
  facialGivenTagLabel: string,
  facialReceivedTagId: string,
  facialReceivedTagLabel: string,
  selffacialTagId?: string,
  selffacialTagLabel?: string
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  // Include facialgiven or facialreceived tags
  const facialTagsCriterion = new TagsCriterion(TagsCriterionOption);
  facialTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  const items = [
    { id: facialGivenTagId, label: facialGivenTagLabel },
    { id: facialReceivedTagId, label: facialReceivedTagLabel },
  ] as { id: string; label: string }[];
  if (selffacialTagId && selffacialTagLabel) {
    items.push({ id: selffacialTagId, label: selffacialTagLabel });
  }
  facialTagsCriterion.value = {
    items,
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(facialTagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

// Studio detail page versions - stay on studio page with filter
const makeStudioDetailSexScenesUrl = (
  studio: Partial<GQL.StudioDataFragment>,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add performer scene tags criterion (must include top OR bottom)
  const tagsCriterion = new TagsCriterion(TagsCriterionOption);
  tagsCriterion.modifier = GQL.CriterionModifier.Includes;
  tagsCriterion.value = {
    items: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
    ],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(tagsCriterion);

  return `/studios/${studio.id}/scenes?${filter.makeQueryParameters()}`;
};

const makeStudioDetailOralScenesUrl = (
  studio: Partial<GQL.StudioDataFragment>,
  oralTopTagId: string,
  oralTopTagLabel: string,
  oralBottomTagId: string,
  oralBottomTagLabel: string,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add oral tags criterion (must include oral tags, exclude top/bottom)
  const oralTagsCriterion = new TagsCriterion(TagsCriterionOption);
  oralTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  oralTagsCriterion.value = {
    items: [
      { id: oralTopTagId, label: oralTopTagLabel },
      { id: oralBottomTagId, label: oralBottomTagLabel },
    ],
    excluded: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
    ],
    depth: 0,
  };
  filter.criteria.push(oralTagsCriterion);

  return `/studios/${studio.id}/scenes?${filter.makeQueryParameters()}`;
};

const makeStudioDetailSoloScenesUrl = (
  studio: Partial<GQL.StudioDataFragment>,
  soloTagId: string,
  soloTagLabel: string,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string,
  oralTopTagId: string,
  oralTopTagLabel: string,
  oralBottomTagId: string,
  oralBottomTagLabel: string
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add solo tag criterion (must include solo, exclude top/bottom/oral tags)
  const soloTagsCriterion = new TagsCriterion(TagsCriterionOption);
  soloTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  soloTagsCriterion.value = {
    items: [{ id: soloTagId, label: soloTagLabel }],
    excluded: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
      { id: oralTopTagId, label: oralTopTagLabel },
      { id: oralBottomTagId, label: oralBottomTagLabel },
    ],
    depth: 0,
  };
  filter.criteria.push(soloTagsCriterion);

  return `/studios/${studio.id}/scenes?${filter.makeQueryParameters()}`;
};

const makeStudioDetailFacialScenesUrl = (
  studio: Partial<GQL.StudioDataFragment>,
  facialGivenTagId: string,
  facialGivenTagLabel: string,
  facialReceivedTagId: string,
  facialReceivedTagLabel: string,
  selffacialTagId?: string,
  selffacialTagLabel?: string
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Include facialgiven or facialreceived tags
  const facialTagsCriterion = new TagsCriterion(TagsCriterionOption);
  facialTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  const items = [
    { id: facialGivenTagId, label: facialGivenTagLabel },
    { id: facialReceivedTagId, label: facialReceivedTagLabel },
  ] as { id: string; label: string }[];
  if (selffacialTagId && selffacialTagLabel) {
    items.push({ id: selffacialTagId, label: selffacialTagLabel });
  }
  facialTagsCriterion.value = {
    items,
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(facialTagsCriterion);

  return `/studios/${studio.id}/scenes?${filter.makeQueryParameters()}`;
};

const makeGlobalSexScenesUrl = (
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string
) => {
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  const tagsCriterion = new TagsCriterion(TagsCriterionOption);
  tagsCriterion.modifier = GQL.CriterionModifier.Includes;
  tagsCriterion.value = {
    items: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
    ],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(tagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makeGlobalOralScenesUrl = (
  oralTopTagId: string,
  oralTopTagLabel: string,
  oralBottomTagId: string,
  oralBottomTagLabel: string,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string
) => {
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  const oralTagsCriterion = new TagsCriterion(TagsCriterionOption);
  oralTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  oralTagsCriterion.value = {
    items: [
      { id: oralTopTagId, label: oralTopTagLabel },
      { id: oralBottomTagId, label: oralBottomTagLabel },
    ],
    excluded: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
    ],
    depth: 0,
  };
  filter.criteria.push(oralTagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makeGlobalSoloScenesUrl = (
  soloTagId: string,
  soloTagLabel: string,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string,
  oralTopTagId: string,
  oralTopTagLabel: string,
  oralBottomTagId: string,
  oralBottomTagLabel: string
) => {
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  const soloTagsCriterion = new TagsCriterion(TagsCriterionOption);
  soloTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  soloTagsCriterion.value = {
    items: [{ id: soloTagId, label: soloTagLabel }],
    excluded: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
      { id: oralTopTagId, label: oralTopTagLabel },
      { id: oralBottomTagId, label: oralBottomTagLabel },
    ],
    depth: 0,
  };
  filter.criteria.push(soloTagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makeGlobalFacialScenesUrl = (
  facialGivenTagId: string,
  facialGivenTagLabel: string,
  facialReceivedTagId: string,
  facialReceivedTagLabel: string,
  selffacialTagId?: string,
  selffacialTagLabel?: string
) => {
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  const facialTagsCriterion = new TagsCriterion(TagsCriterionOption);
  facialTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  const items = [
    { id: facialGivenTagId, label: facialGivenTagLabel },
    { id: facialReceivedTagId, label: facialReceivedTagLabel },
  ] as { id: string; label: string }[];
  if (selffacialTagId && selffacialTagLabel) {
    items.push({ id: selffacialTagId, label: selffacialTagLabel });
  }
  facialTagsCriterion.value = {
    items,
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(facialTagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

// Performer-studio scene URLs (for viewing from performer's Studios tab)
const makePerformerStudioSexScenesUrl = (
  performerId: string,
  studio: Partial<GQL.StudioDataFragment>,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add performer criterion
  const performerCriterion = new PerformersCriterion();
  performerCriterion.value.items = [
    { id: performerId, label: `Performer ${performerId}` },
  ];
  filter.criteria.push(performerCriterion);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  // Add performer scene tags criterion (must include top OR bottom)
  const tagsCriterion = new TagsCriterion(TagsCriterionOption);
  tagsCriterion.modifier = GQL.CriterionModifier.Includes;
  tagsCriterion.value = {
    items: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
    ],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(tagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makePerformerStudioOralScenesUrl = (
  performerId: string,
  studio: Partial<GQL.StudioDataFragment>,
  oralTopTagId: string,
  oralTopTagLabel: string,
  oralBottomTagId: string,
  oralBottomTagLabel: string,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add performer criterion
  const performerCriterion = new PerformersCriterion();
  performerCriterion.value.items = [
    { id: performerId, label: `Performer ${performerId}` },
  ];
  filter.criteria.push(performerCriterion);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  // Add oral tags criterion (must include oral tags, exclude top/bottom)
  const oralTagsCriterion = new TagsCriterion(TagsCriterionOption);
  oralTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  oralTagsCriterion.value = {
    items: [
      { id: oralTopTagId, label: oralTopTagLabel },
      { id: oralBottomTagId, label: oralBottomTagLabel },
    ],
    excluded: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
    ],
    depth: 0,
  };
  filter.criteria.push(oralTagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makePerformerStudioSoloScenesUrl = (
  performerId: string,
  studio: Partial<GQL.StudioDataFragment>,
  soloTagId: string,
  soloTagLabel: string,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string,
  oralTopTagId: string,
  oralTopTagLabel: string,
  oralBottomTagId: string,
  oralBottomTagLabel: string
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add performer criterion
  const performerCriterion = new PerformersCriterion();
  performerCriterion.value.items = [
    { id: performerId, label: `Performer ${performerId}` },
  ];
  filter.criteria.push(performerCriterion);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  // Add solo tag criterion (must include solo, exclude top/bottom/oral tags)
  const soloTagsCriterion = new TagsCriterion(TagsCriterionOption);
  soloTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  soloTagsCriterion.value = {
    items: [{ id: soloTagId, label: soloTagLabel }],
    excluded: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
      { id: oralTopTagId, label: oralTopTagLabel },
      { id: oralBottomTagId, label: oralBottomTagLabel },
    ],
    depth: 0,
  };
  filter.criteria.push(soloTagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makePerformerStudioFacialScenesUrl = (
  performerId: string,
  studio: Partial<GQL.StudioDataFragment>,
  facialGivenTagId: string,
  facialGivenTagLabel: string,
  facialReceivedTagId: string,
  facialReceivedTagLabel: string,
  selffacialTagId?: string,
  selffacialTagLabel?: string
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add performer criterion
  const performerCriterion = new PerformersCriterion();
  performerCriterion.value.items = [
    { id: performerId, label: `Performer ${performerId}` },
  ];
  filter.criteria.push(performerCriterion);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  // Include facialgiven or facialreceived tags
  const facialTagsCriterion = new TagsCriterion(TagsCriterionOption);
  facialTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  const items = [
    { id: facialGivenTagId, label: facialGivenTagLabel },
    { id: facialReceivedTagId, label: facialReceivedTagLabel },
  ] as { id: string; label: string }[];
  if (selffacialTagId && selffacialTagLabel) {
    items.push({ id: selffacialTagId, label: selffacialTagLabel });
  }
  facialTagsCriterion.value = {
    items,
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(facialTagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makeStudioImagesUrl = (studio: Partial<GQL.StudioDataFragment>) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Images, undefined);
  const criterion = new StudiosCriterion();
  criterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(criterion);
  return `/images?${filter.makeQueryParameters()}`;
};

const makeStudioGalleriesUrl = (studio: Partial<GQL.StudioDataFragment>) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Galleries, undefined);
  const criterion = new StudiosCriterion();
  criterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(criterion);
  return `/galleries?${filter.makeQueryParameters()}`;
};

const makeStudioGroupsUrl = (studio: Partial<GQL.StudioDataFragment>) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Groups, undefined);
  const criterion = new StudiosCriterion();
  criterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(criterion);
  return `/groups?${filter.makeQueryParameters()}`;
};

const makePerformerStudioGroupsUrl = (
  performerId: string,
  studio: Partial<GQL.StudioDataFragment>
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Groups, undefined);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  // Add performer criterion
  const performerCriterion = new PerformersCriterion();
  performerCriterion.modifier = GQL.CriterionModifier.IncludesAll;
  performerCriterion.value = {
    items: [{ id: performerId, label: `Performer ${performerId}` }],
    excluded: [],
  };
  filter.criteria.push(performerCriterion);

  filter.sortBy = "name";

  return `/groups?${filter.makeQueryParameters()}`;
};

const makePerformerStudioImagesUrl = (
  performerId: string,
  studio: Partial<GQL.StudioDataFragment>
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Images, undefined);

  // Add performer criterion
  const performerCriterion = new PerformersCriterion();
  performerCriterion.value.items = [
    { id: performerId, label: `Performer ${performerId}` },
  ];
  filter.criteria.push(performerCriterion);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  return `/images?${filter.makeQueryParameters()}`;
};

const makePerformerStudioGalleriesUrl = (
  performerId: string,
  studio: Partial<GQL.StudioDataFragment>
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Galleries, undefined);

  // Add performer criterion
  const performerCriterion = new PerformersCriterion();
  performerCriterion.value.items = [
    { id: performerId, label: `Performer ${performerId}` },
  ];
  filter.criteria.push(performerCriterion);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  return `/galleries?${filter.makeQueryParameters()}`;
};

const makeStudioPerformersUrl = (studio: Partial<GQL.StudioDataFragment>) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Performers, undefined);
  const criterion = new StudiosCriterion();
  criterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(criterion);
  return `/performers?${filter.makeQueryParameters()}`;
};

const makeStudioUniquePerformersUrl = (
  studio: Partial<GQL.StudioDataFragment>
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Performers, undefined);

  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  const sceneCountCriterion = filter.makeCriterion("scene_count");
  if (sceneCountCriterion) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sceneCountCriterion as any).modifier = GQL.CriterionModifier.Equals;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sceneCountCriterion as any).value = 1;
    filter.criteria.push(sceneCountCriterion);
  }

  return `/performers?${filter.makeQueryParameters()}`;
};

const makeStudioDetailUniquePerformersUrl = (
  studio: Partial<GQL.StudioDataFragment>
) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Performers, undefined);

  const sceneCountCriterion = filter.makeCriterion("scene_count");
  if (sceneCountCriterion) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sceneCountCriterion as any).modifier = GQL.CriterionModifier.Equals;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sceneCountCriterion as any).value = 1;
    filter.criteria.push(sceneCountCriterion);
  }

  return `/studios/${studio.id}/performers?${filter.makeQueryParameters()}`;
};

// Performer detail page versions - navigate to scenes list with performer + tag filters
const makePerformerDetailSexScenesUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string
) => {
  if (!performer.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add performer criterion
  const performerCriterion = new PerformersCriterion();
  performerCriterion.value.items = [
    { id: performer.id, label: performer.name || `Performer ${performer.id}` },
  ];
  filter.criteria.push(performerCriterion);

  // Add performer scene tags criterion (must include top OR bottom)
  const tagsCriterion = new TagsCriterion(TagsCriterionOption);
  tagsCriterion.modifier = GQL.CriterionModifier.Includes;
  tagsCriterion.value = {
    items: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
    ],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(tagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makePerformerDetailOralScenesUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  oralTopTagId: string,
  oralTopTagLabel: string,
  oralBottomTagId: string,
  oralBottomTagLabel: string,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string
) => {
  if (!performer.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add performer criterion
  const performerCriterion = new PerformersCriterion();
  performerCriterion.value.items = [
    { id: performer.id, label: performer.name || `Performer ${performer.id}` },
  ];
  filter.criteria.push(performerCriterion);

  // Add oral tags criterion (must include oral tags, exclude top/bottom)
  const oralTagsCriterion = new TagsCriterion(TagsCriterionOption);
  oralTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  oralTagsCriterion.value = {
    items: [
      { id: oralTopTagId, label: oralTopTagLabel },
      { id: oralBottomTagId, label: oralBottomTagLabel },
    ],
    excluded: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
    ],
    depth: 0,
  };
  filter.criteria.push(oralTagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makePerformerDetailSoloScenesUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  soloTagId: string,
  soloTagLabel: string,
  topTagId: string,
  topTagLabel: string,
  bottomTagId: string,
  bottomTagLabel: string,
  oralTopTagId: string,
  oralTopTagLabel: string,
  oralBottomTagId: string,
  oralBottomTagLabel: string
) => {
  if (!performer.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add performer criterion
  const performerCriterion = new PerformersCriterion();
  performerCriterion.value.items = [
    { id: performer.id, label: performer.name || `Performer ${performer.id}` },
  ];
  filter.criteria.push(performerCriterion);

  // Add solo tag criterion (must include solo, exclude top/bottom/oral tags)
  const soloTagsCriterion = new TagsCriterion(TagsCriterionOption);
  soloTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  soloTagsCriterion.value = {
    items: [{ id: soloTagId, label: soloTagLabel }],
    excluded: [
      { id: topTagId, label: topTagLabel },
      { id: bottomTagId, label: bottomTagLabel },
      { id: oralTopTagId, label: oralTopTagLabel },
      { id: oralBottomTagId, label: oralBottomTagLabel },
    ],
    depth: 0,
  };
  filter.criteria.push(soloTagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

const makePerformerDetailFacialScenesUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  facialGivenTagId: string,
  facialGivenTagLabel: string,
  facialReceivedTagId: string,
  facialReceivedTagLabel: string,
  selffacialTagId?: string,
  selffacialTagLabel?: string
) => {
  if (!performer.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add performer criterion
  const performerCriterion = new PerformersCriterion();
  performerCriterion.value.items = [
    { id: performer.id, label: performer.name || `Performer ${performer.id}` },
  ];
  filter.criteria.push(performerCriterion);

  // Include facialgiven or facialreceived tags
  const facialTagsCriterion = new TagsCriterion(TagsCriterionOption);
  facialTagsCriterion.modifier = GQL.CriterionModifier.Includes;
  const items = [
    { id: facialGivenTagId, label: facialGivenTagLabel },
    { id: facialReceivedTagId, label: facialReceivedTagLabel },
  ] as { id: string; label: string }[];
  if (selffacialTagId && selffacialTagLabel) {
    items.push({ id: selffacialTagId, label: selffacialTagLabel });
  }
  facialTagsCriterion.value = {
    items,
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(facialTagsCriterion);

  return `/scenes?${filter.makeQueryParameters()}`;
};

// New marker-based performer scenes URL - filters scenes by marker tag
const makePerformerMarkerScenesUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  tagId: string,
  roleType: string
) => {
  if (!performer.id) return "#";

  const performerLabel = performer.name || `Performer ${performer.id}`;
  const performerRef = { id: performer.id, label: performerLabel };

  // For any role (top OR bottom), put the performer in both arrays
  return `/scenes?c=${encodeURIComponent(
    JSON.stringify({
      type: "scene_markers",
      modifier: "INCLUDES",
      groups: [
        {
          groupId: "A",
          tag_ids: [{ id: tagId, label: roleType }],
          depth: 0,
          top_performer_ids: [performerRef],
          top_ethnicities: [],
          top_countries: [],
          top_rating: null,
          bottom_performer_ids: [performerRef],
          bottom_ethnicities: [],
          bottom_countries: [],
          bottom_rating: null,
        },
      ],
    })
  )}&sortby=date`;
};

// Marker-based performer scenes URL with top/bottom role filter
// role: "top" | "bottom" | undefined (any)
// excludeTags: optional array of tag IDs to exclude from the filter
// markerDepth: depth for subtag matching (0 = exact, -1 = all subtags)
const makePerformerMarkerScenesWithRoleUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  tagId: string,
  tagLabel: string,
  role?: "top" | "bottom",
  excludeTags?: Array<{ id: string; label: string }>,
  markerDepth: number = 0
) => {
  if (!performer.id) return "#";

  const performerLabel = performer.name || `Performer ${performer.id}`;
  const performerRef = { id: performer.id, label: performerLabel };

  // Build the include group
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const includeGroup: any = {
    groupId: "A",
    tag_ids: [{ id: tagId, label: tagLabel }],
    depth: markerDepth,
    top_performer_ids: [],
    top_ethnicities: [],
    top_countries: [],
    top_rating: null,
    bottom_performer_ids: [],
    bottom_ethnicities: [],
    bottom_countries: [],
    bottom_rating: null,
  };

  // Add role-specific performer
  if (role === "top") {
    includeGroup.top_performer_ids = [performerRef];
  } else if (role === "bottom") {
    includeGroup.bottom_performer_ids = [performerRef];
  } else {
    // Any role - put performer in both
    includeGroup.top_performer_ids = [performerRef];
    includeGroup.bottom_performer_ids = [performerRef];
  }

  let url = `/scenes?c=${encodeURIComponent(
    JSON.stringify({
      type: "scene_markers",
      modifier: "INCLUDES",
      groups: [includeGroup],
    })
  )}`;

  // Add exclude criteria if needed
  if (excludeTags && excludeTags.length > 0) {
    const excludeGroups = excludeTags.map((tag, index) => ({
      groupId: String.fromCharCode(66 + index), // B, C, D...
      tag_ids: [tag],
      depth: 0,
      top_performer_ids: [],
      top_ethnicities: [],
      top_countries: [],
      top_rating: null,
      bottom_performer_ids: [],
      bottom_ethnicities: [],
      bottom_countries: [],
      bottom_rating: null,
    }));

    url += `&c=${encodeURIComponent(
      JSON.stringify({
        type: "scene_markers_exclude",
        modifier: "INCLUDES",
        groups: excludeGroups,
      })
    )}`;
  }

  return `${url}&sortby=date`;
};

const makeStudioMarkerScenesUrl = (
  studio: Partial<GQL.StudioDataFragment>,
  tagId: string,
  roleType: string,
  excludeTags?: Array<{ id: string; label: string }>,
  markerDepth: number = 0
) => {
  if (!studio.id) return "#";

  // Navigate to scenes filtered by studio and scene markers with this tag
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  let url = `/scenes?${filter.makeQueryParameters()}`;

  // Add marker filter as separate criterion in URL
  url += `&c=${encodeURIComponent(
    JSON.stringify({
      type: "scene_markers",
      modifier: "INCLUDES",
      groups: [
        {
          groupId: "A",
          tag_ids: [{ id: tagId, label: roleType }],
          depth: markerDepth,
          top_performer_ids: [],
          top_ethnicities: [],
          top_countries: [],
          top_rating: null,
          bottom_performer_ids: [],
          bottom_ethnicities: [],
          bottom_countries: [],
          bottom_rating: null,
        },
      ],
    })
  )}`;

  // Add exclude criteria if needed
  if (excludeTags && excludeTags.length > 0) {
    const excludeGroups = excludeTags.map((tag, index) => ({
      groupId: String.fromCharCode(66 + index), // B, C, D...
      tag_ids: [tag],
      depth: 0,
      top_performer_ids: [],
      top_ethnicities: [],
      top_countries: [],
      top_rating: null,
      bottom_performer_ids: [],
      bottom_ethnicities: [],
      bottom_countries: [],
      bottom_rating: null,
    }));

    url += `&c=${encodeURIComponent(
      JSON.stringify({
        type: "scene_markers_exclude",
        modifier: "INCLUDES_ALL",
        groups: excludeGroups,
      })
    )}`;
  }

  return `${url}&sortby=date`;
};

const makePerformerStudioMarkerScenesUrl = (
  performerId: string,
  studio: Partial<GQL.StudioDataFragment>,
  tagId: string,
  roleType: string,
  excludeTags?: Array<{ id: string; label: string }>,
  markerDepth: number = 0
) => {
  if (!studio.id) return "#";

  // Navigate to scenes filtered by performer, studio, and scene markers with this tag
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);

  // Add studio criterion
  const studioCriterion = new StudiosCriterion();
  studioCriterion.value = {
    items: [{ id: studio.id, label: studio.name || `Studio ${studio.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(studioCriterion);

  let url = `/scenes?${filter.makeQueryParameters()}`;

  const performerRef = { id: performerId, label: `Performer ${performerId}` };

  // Add marker filter with performer in both roles (top OR bottom)
  url += `&c=${encodeURIComponent(
    JSON.stringify({
      type: "scene_markers",
      modifier: "INCLUDES",
      groups: [
        {
          groupId: "A",
          tag_ids: [{ id: tagId, label: roleType }],
          depth: markerDepth,
          top_performer_ids: [performerRef],
          top_ethnicities: [],
          top_countries: [],
          top_rating: null,
          bottom_performer_ids: [performerRef],
          bottom_ethnicities: [],
          bottom_countries: [],
          bottom_rating: null,
        },
      ],
    })
  )}`;

  // Add exclude criteria if needed
  if (excludeTags && excludeTags.length > 0) {
    const excludeGroups = excludeTags.map((tag, index) => ({
      groupId: String.fromCharCode(66 + index), // B, C, D...
      tag_ids: [tag],
      depth: 0,
      top_performer_ids: [],
      top_ethnicities: [],
      top_countries: [],
      top_rating: null,
      bottom_performer_ids: [],
      bottom_ethnicities: [],
      bottom_countries: [],
      bottom_rating: null,
    }));

    url += `&c=${encodeURIComponent(
      JSON.stringify({
        type: "scene_markers_exclude",
        modifier: "INCLUDES_ALL",
        groups: excludeGroups,
      })
    )}`;
  }

  return `${url}&sortby=date`;
};

const makeChildStudiosUrl = (studio: Partial<GQL.StudioDataFragment>) => {
  if (!studio.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Studios, undefined);
  const criterion = new ParentStudiosCriterion();
  criterion.value = [
    { id: studio.id, label: studio.name || `Studio ${studio.id}` },
  ];
  filter.criteria.push(criterion);
  return `/studios?${filter.makeQueryParameters()}`;
};

const makeGroupScenesUrl = (group: Partial<GQL.GroupDataFragment>) => {
  if (!group.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);
  const criterion = new GroupsCriterion(GroupsCriterionOption);
  criterion.value = {
    items: [{ id: group.id, label: group.name || `Group ${group.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(criterion);
  return `/scenes?${filter.makeQueryParameters()}`;
};

const makeTagUrl = (id: string) => {
  return `/tags/${id}`;
};

const makeParentTagsUrl = (tag: Partial<GQL.TagDataFragment>) => {
  if (!tag.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Tags, undefined);
  const criterion = new TagsCriterion(ChildTagsCriterionOption);
  criterion.value = {
    items: [
      {
        id: tag.id,
        label: tag.name || `Tag ${tag.id}`,
      },
    ],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(criterion);
  return `/tags?${filter.makeQueryParameters()}`;
};

const makeChildTagsUrl = (tag: Partial<GQL.TagDataFragment>) => {
  if (!tag.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Tags, undefined);
  const criterion = new TagsCriterion(ParentTagsCriterionOption);
  criterion.value = {
    items: [
      {
        id: tag.id,
        label: tag.name || `Tag ${tag.id}`,
      },
    ],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(criterion);
  return `/tags?${filter.makeQueryParameters()}`;
};

function makeTagFilter(mode: GQL.FilterMode, tag: INamedObject) {
  const filter = new ListFilterModel(mode, undefined);
  const criterion = new TagsCriterion(TagsCriterionOption);
  criterion.value = {
    items: [{ id: tag.id, label: tag.name || `Tag ${tag.id}` }],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(criterion);
  return filter.makeQueryParameters();
}

const makeTagScenesUrl = (tag: INamedObject, performer?: INamedObject) => {
  if (!tag.id) return "#";

  // If a performer is provided, build a Scene Marker filter
  // that links the performer and tag through scene_marker_performers
  if (performer && performer.id) {
    const filter = new ListFilterModel(GQL.FilterMode.SceneMarkers, undefined);

    // Use TagsCriterion with SceneMarkerTagsCriterionOption to filter by the tag
    const tagCriterion = new TagsCriterion(TagsCriterionOption);
    tagCriterion.modifier = GQL.CriterionModifier.IncludesAll;
    tagCriterion.value = {
      items: [{ id: tag.id, label: tag.name || `Tag ${tag.id}` }],
      excluded: [],
      depth: 0,
    };
    filter.criteria.push(tagCriterion);

    // Add performers criterion
    const performersCriterion = new PerformersCriterion();
    performersCriterion.modifier = GQL.CriterionModifier.IncludesAll;
    performersCriterion.value = {
      items: [
        {
          id: performer.id,
          label: performer.name || `Performer ${performer.id}`,
        },
      ],
      excluded: [],
    };
    filter.criteria.push(performersCriterion);

    const params = filter.makeQueryParameters();
    return `/scenes/markers?${params}`;
  }

  return `/scenes?${makeTagFilter(GQL.FilterMode.Scenes, tag)}`;
};

const makeTagPerformersUrl = (tag: INamedObject) => {
  return `/performers?${makeTagFilter(GQL.FilterMode.Performers, tag)}`;
};

// Build a Scene Markers URL filtered by scene marker tags (linked through scene_marker_performers)
// This links performers to tags via scene markers they're associated with
const makeTagPerformersBySceneTagsUrl = (tag: INamedObject) => {
  if (!tag.id) return "#";
  // Since performer_scene_tags is deprecated, redirect to scene markers filtered by tag
  // where the user can see performers associated with that tag through scene markers
  const filter = new ListFilterModel(GQL.FilterMode.SceneMarkers, undefined);
  const criterion = new TagsCriterion(TagsCriterionOption);
  criterion.modifier = GQL.CriterionModifier.IncludesAll;
  const value: IHierarchicalLabelValue = {
    items: [{ id: tag.id, label: tag.name || `Tag ${tag.id}` }],
    excluded: [],
    depth: 0,
  };
  criterion.value = value;
  filter.criteria.push(criterion);
  return `/scenes/markers?${filter.makeQueryParameters()}`;
};

const makeTagStudiosUrl = (tag: INamedObject) => {
  return `/studios?${makeTagFilter(GQL.FilterMode.Studios, tag)}`;
};

const makeTagSceneMarkersUrl = (tag: INamedObject) => {
  return `/scenes/markers?${makeTagFilter(GQL.FilterMode.SceneMarkers, tag)}`;
};

const makeTagGalleriesUrl = (tag: INamedObject) => {
  return `/galleries?${makeTagFilter(GQL.FilterMode.Galleries, tag)}`;
};

const makeTagImagesUrl = (tag: INamedObject) => {
  return `/images?${makeTagFilter(GQL.FilterMode.Images, tag)}`;
};

const makeTagGroupsUrl = (tag: INamedObject) => {
  return `/groups?${makeTagFilter(GQL.FilterMode.Groups, tag)}`;
};

type SceneMarkerDataFragment = Pick<GQL.SceneMarker, "id" | "seconds"> & {
  scene: Pick<GQL.Scene, "id">;
};

const makeSceneMarkerUrl = (sceneMarker: SceneMarkerDataFragment) => {
  if (!sceneMarker.id || !sceneMarker.scene) return "#";
  return `/scenes/${sceneMarker.scene.id}?t=${sceneMarker.seconds}`;
};

const makeScenesPHashMatchUrl = (phash: GQL.Maybe<string> | undefined) => {
  if (!phash) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);
  const criterion = new PhashCriterion();
  criterion.value = { value: phash };
  filter.criteria.push(criterion);
  return `/scenes?${filter.makeQueryParameters()}`;
};

const makeGalleryImagesUrl = (
  gallery: Partial<GQL.GalleryDataFragment | GQL.SlimGalleryDataFragment>,
  extraCriteria?: ModifierCriterion<CriterionValue>[]
) => {
  if (!gallery.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Images, undefined);
  const criterion = new GalleriesCriterion();
  criterion.value = [{ id: gallery.id, label: galleryTitle(gallery) }];
  filter.criteria.push(criterion);
  addExtraCriteria(filter.criteria, extraCriteria);
  return `/images?${filter.makeQueryParameters()}`;
};

function stringEqualsCriterion(option: ModifierCriterionOption, value: string) {
  const criterion = new StringCriterion(option);
  criterion.modifier = GQL.CriterionModifier.Equals;
  criterion.value = value;
  return criterion;
}

const makeDirectorScenesUrl = (director: string) => {
  if (director.length == 0) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Scenes, undefined);
  filter.criteria.push(
    stringEqualsCriterion(createStringCriterionOption("director"), director)
  );
  return `/scenes?${filter.makeQueryParameters()}`;
};

const makeDirectorGroupsUrl = (director: string) => {
  if (director.length == 0) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Groups, undefined);
  filter.criteria.push(
    stringEqualsCriterion(createStringCriterionOption("director"), director)
  );
  return `/groups?${filter.makeQueryParameters()}`;
};

const makePhotographerGalleriesUrl = (photographer: string) => {
  if (photographer.length == 0) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Galleries, undefined);
  filter.criteria.push(
    stringEqualsCriterion(
      createStringCriterionOption("photographer"),
      photographer
    )
  );
  return `/galleries?${filter.makeQueryParameters()}`;
};

const makePhotographerImagesUrl = (photographer: string) => {
  if (photographer.length == 0) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Images, undefined);
  filter.criteria.push(
    stringEqualsCriterion(
      createStringCriterionOption("photographer"),
      photographer
    )
  );
  return `/images?${filter.makeQueryParameters()}`;
};

const makeGroupUrl = (id: string) => {
  return `/groups/${id}`;
};

const makeContainingGroupsUrl = (group: Partial<GQL.SlimGroupDataFragment>) => {
  if (!group.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Groups, undefined);
  const criterion = new GroupsCriterion(SubGroupsCriterionOption);
  criterion.value = {
    items: [
      {
        id: group.id,
        label: group.name || `Group ${group.id}`,
      },
    ],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(criterion);
  return `/groups?${filter.makeQueryParameters()}`;
};

const makeSubGroupsUrl = (group: INamedObject) => {
  if (!group.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.Groups, undefined);
  const criterion = new GroupsCriterion(ContainingGroupsCriterionOption);
  criterion.value = {
    items: [
      {
        id: group.id,
        label: group.name || `Group ${group.id}`,
      },
    ],
    excluded: [],
    depth: 0,
  };
  filter.criteria.push(criterion);
  return `/groups?${filter.makeQueryParameters()}`;
};

const makeSceneMarkersSceneUrl = (scene: GQL.SceneMarkerSceneDataFragment) => {
  if (!scene.id) return "#";
  const filter = new ListFilterModel(GQL.FilterMode.SceneMarkers, undefined);
  const criterion = new MarkersScenesCriterion();
  criterion.value = [{ id: scene.id, label: objectTitle(scene) }];
  filter.criteria.push(criterion);
  return `/scenes/markers?${filter.makeQueryParameters()}`;
};

// URL to list scene markers filtered by a specific tag (primary or secondary)
const makeSceneMarkersUrl = (tagId: string, tagName: string) => {
  const filter = new ListFilterModel(GQL.FilterMode.SceneMarkers, undefined);
  const criterion = new MarkerTagsCriterion(MarkerTagsCriterionOption);
  // Add a single group with the tag
  const groupId = criterion.addGroup();
  criterion.updateGroup(groupId, {
    tags: [{ id: tagId, label: tagName }],
  });
  filter.criteria.push(criterion);
  return `/scenes/markers?${filter.makeQueryParameters()}`;
};

// URL to list SCENES filtered by having markers with a specific tag
// Use this for scene counts (e.g., sex_scene_count) - goes to /scenes, not /scenes/markers
// markerDepth: 0 for exact match, -1 for all subtags
const makeScenesWithMarkerTagUrl = (tagId: string, tagName: string, markerDepth: number = 0) => {
  return `/scenes?c=${encodeURIComponent(
    JSON.stringify({
      type: "scene_markers",
      modifier: "INCLUDES",
      groups: [
        {
          groupId: "A",
          tag_ids: [{ id: tagId, label: tagName }],
          depth: markerDepth,
          top_performer_ids: [],
          top_ethnicities: [],
          top_countries: [],
          top_rating: null,
          bottom_performer_ids: [],
          bottom_ethnicities: [],
          bottom_countries: [],
          bottom_rating: null,
        },
      ],
    })
  )}&sortby=date`;
};

// URL to list SCENES with exclusive marker tag filtering (includes tag, excludes other tags)
// Used for hierarchical category counts: oral excludes sex, solo excludes sex+oral
// markerDepth: 0 for exact match, -1 for all subtags
const makeScenesWithExclusiveMarkerTagUrl = (
  includeTagId: string,
  includeTagName: string,
  excludeTagIds: Array<{ id: string; label: string }>,
  markerDepth: number = 0
) => {
  // Build include criterion
  let url = `/scenes?c=${encodeURIComponent(
    JSON.stringify({
      type: "scene_markers",
      modifier: "INCLUDES",
      groups: [
        {
          groupId: "A",
          tag_ids: [{ id: includeTagId, label: includeTagName }],
          depth: markerDepth,
          top_performer_ids: [],
          top_ethnicities: [],
          top_countries: [],
          top_rating: null,
          bottom_performer_ids: [],
          bottom_ethnicities: [],
          bottom_countries: [],
          bottom_rating: null,
        },
      ],
    })
  )}`;

  // Add exclude criteria if needed
  if (excludeTagIds && excludeTagIds.length > 0) {
    const excludeGroups = excludeTagIds.map((tag, index) => ({
      groupId: String.fromCharCode(66 + index), // B, C, D...
      tag_ids: [tag],
      depth: 0,
      top_performer_ids: [],
      top_ethnicities: [],
      top_countries: [],
      top_rating: null,
      bottom_performer_ids: [],
      bottom_ethnicities: [],
      bottom_countries: [],
      bottom_rating: null,
    }));

    url += `&c=${encodeURIComponent(
      JSON.stringify({
        type: "scene_markers_exclude",
        modifier: "INCLUDES",
        groups: excludeGroups,
      })
    )}`;
  }

  return `${url}&sortby=date`;
};

export function handleUnsavedChanges(
  intl: IntlShape,
  basepath: string,
  id?: string
) {
  return function (location: { pathname: string }) {
    // #2291 - don't prompt if we're navigating within the gallery being edited
    if (id !== undefined && location.pathname === `/${basepath}/${id}`) {
      return true;
    }

    return intl.formatMessage({ id: "dialogs.unsaved_changes" });
  };
}

// Navigate to scene markers where performer is "top" for a given tag (e.g., orgasm markers)
const makePerformerOrgasmMarkersUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  tagId: string,
  tagLabel: string
) => {
  if (!performer.id || !tagId) return "#";

  const filter = new ListFilterModel(GQL.FilterMode.SceneMarkers, undefined);

  // Add marker performers criterion with the performer as top and the tag filter
  const criterion = new MarkerPerformersCriterion(MarkerPerformersCriterionOption);
  criterion.modifier = GQL.CriterionModifier.IncludesAll;
  criterion.value = {
    tag_ids: [{ id: tagId, label: tagLabel }],
    include_subtags: true,
    top_performer_ids: [{ id: performer.id, label: performer.name || `Performer ${performer.id}` }],
    top_any_count: 0,
    top_ethnicities: [],
    top_countries: [],
    top_rating: null,
    bottom_performer_ids: [],
    bottom_any_count: 0,
    bottom_ethnicities: [],
    bottom_countries: [],
    bottom_rating: null,
    unnamed_performers: [],
  };
  filter.criteria.push(criterion);
  filter.sortBy = "title";

  return `/scenes/markers?${filter.makeQueryParameters()}`;
};

// Navigate to scenes with feet markers where performer is "top"
const makePerformerFeetMarkersUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  tagId: string,
  tagLabel: string
) => {
  if (!performer.id || !tagId) return "#";

  return `/scenes?c=${encodeURIComponent(
    JSON.stringify({
      type: "scene_markers",
      modifier: "INCLUDES_ALL",
      groups: [
        {
          groupId: "A",
          tag_ids: [{ id: tagId, label: tagLabel }],
          depth: -1, // Include subtags
          top_performer_ids: [{ id: performer.id, label: performer.name || `Performer ${performer.id}` }],
          top_ethnicities: [],
          top_countries: [],
          top_rating: null,
          bottom_performer_ids: [],
          bottom_ethnicities: [],
          bottom_countries: [],
          bottom_rating: null,
        },
      ],
    })
  )}&sortby=date`;
};

// Navigate to scene markers for facial/oral with role filter (goes to /scenes/markers, not /scenes)
// Similar to orgasm markers URL but with configurable role and depth
const makePerformerFacialMarkersWithRoleUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  tagId: string,
  tagLabel: string,
  role?: "top" | "bottom"
) => {
  if (!performer.id || !tagId) return "#";

  const filter = new ListFilterModel(GQL.FilterMode.SceneMarkers, undefined);

  // Add marker performers criterion with role filter
  const criterion = new MarkerPerformersCriterion(MarkerPerformersCriterionOption);
  criterion.modifier = GQL.CriterionModifier.Includes;
  
  const performerRef = { id: performer.id, label: performer.name || `Performer ${performer.id}` };
  
  criterion.value = {
    tag_ids: [{ id: tagId, label: tagLabel }],
    include_subtags: true,
    top_performer_ids: role === "top" || !role ? [performerRef] : [],
    top_any_count: 0,
    top_ethnicities: [],
    top_countries: [],
    top_rating: null,
    bottom_performer_ids: role === "bottom" || !role ? [performerRef] : [],
    bottom_any_count: 0,
    bottom_ethnicities: [],
    bottom_countries: [],
    bottom_rating: null,
    unnamed_performers: [],
  };
  filter.criteria.push(criterion);
  filter.sortBy = "title";

  return `/scenes/markers?${filter.makeQueryParameters()}`;
};

// Generate URL to filter performers by partner markers (e.g., "who has performer X been a top/bottom with")
// category: "sex" | "oral" | "facial"
// partnerRole: "top" | "bottom" - the role of the partners we're looking for
const makePerformerPartnerPerformersUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  tagId: string,
  tagLabel: string,
  category: "sex" | "oral" | "facial",
  partnerRole: "top" | "bottom"
) => {
  if (!performer.id) return "#";

  const performerLabel = performer.name || `Performer ${performer.id}`;
  const performerRef = { id: performer.id, label: performerLabel };

  // Use depth -1 for oral and facial to include subtags
  const markerDepth = category === "oral" || category === "facial" ? -1 : 0;

  const criterionData = {
    type: "performer_markers",
    modifier: "INCLUDES_ALL",
    group: {
      tag_ids: [{ id: tagId, label: tagLabel }],
      depth: markerDepth,
      performer_ids: [],
      performer_ethnicities: [],
      performer_countries: [],
      performer_rating: null,
      performer_role: "any",
      partner_ids: [performerRef],
      partner_ethnicities: [],
      partner_countries: [],
      partner_rating: null,
      partner_role: partnerRole,
    },
  };

  return `/performers?c=${encodeURIComponent(
    JSON.stringify(criterionData)
  )}&sortby=name`;
};

// Generate URL to filter all performers who have been partners with this performer in a category
// (regardless of role - both tops and bottoms)
const makePerformerAllPartnersUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  tagId: string,
  tagLabel: string,
  category: "sex" | "oral" | "facial"
) => {
  if (!performer.id) return "#";

  const performerLabel = performer.name || `Performer ${performer.id}`;
  const performerRef = { id: performer.id, label: performerLabel };

  // Use depth -1 for oral and facial to include subtags
  const markerDepth = category === "oral" || category === "facial" ? -1 : 0;

  const criterionData = {
    type: "performer_markers",
    modifier: "INCLUDES_ALL",
    group: {
      tag_ids: [{ id: tagId, label: tagLabel }],
      depth: markerDepth,
      performer_ids: [],
      performer_ethnicities: [],
      performer_countries: [],
      performer_rating: null,
      performer_role: "any",
      partner_ids: [performerRef],
      partner_ethnicities: [],
      partner_countries: [],
      partner_rating: null,
      partner_role: "any", // Any role - get all partners
    },
  };

  return `/performers?c=${encodeURIComponent(
    JSON.stringify(criterionData)
  )}&sortby=name`;
};

const NavUtils = {
  makePerformerScenesUrl,
  makePerformerImagesUrl,
  makePerformerGalleriesUrl,
  makePerformerGroupsUrl,
  makePerformerSceneMarkersUrl,
  makePerformersCountryUrl,
  makePerformersEthnicityUrl,
  makePerformersEthnicityRatingUrl,
  makeStudioScenesUrl,
  makePerformerStudioScenesUrl,
  makeStudioSexScenesUrl,
  makeStudioOralScenesUrl,
  makeStudioSoloScenesUrl,
  makeStudioFacialScenesUrl,
  makeStudioDetailSexScenesUrl,
  makeStudioDetailOralScenesUrl,
  makeStudioDetailSoloScenesUrl,
  makeStudioDetailFacialScenesUrl,
  makePerformerDetailSexScenesUrl,
  makePerformerDetailOralScenesUrl,
  makePerformerDetailSoloScenesUrl,
  makePerformerDetailFacialScenesUrl,
  makePerformerMarkerScenesUrl,
  makePerformerMarkerScenesWithRoleUrl,
  makePerformerPartnerPerformersUrl,
  makePerformerAllPartnersUrl,
  makePerformerOrgasmMarkersUrl,
  makePerformerFeetMarkersUrl,
  makePerformerFacialMarkersWithRoleUrl,
  makeStudioMarkerScenesUrl,
  makePerformerStudioMarkerScenesUrl,
  makeGlobalSexScenesUrl,
  makeGlobalOralScenesUrl,
  makeGlobalSoloScenesUrl,
  makeGlobalFacialScenesUrl,
  makePerformerStudioSexScenesUrl,
  makePerformerStudioOralScenesUrl,
  makePerformerStudioSoloScenesUrl,
  makePerformerStudioFacialScenesUrl,
  makeStudioImagesUrl,
  makeStudioGalleriesUrl,
  makeStudioGroupsUrl: makeStudioGroupsUrl,
  makePerformerStudioGroupsUrl,
  makePerformerStudioImagesUrl,
  makePerformerStudioGalleriesUrl,
  makeStudioPerformersUrl,
  makeStudioUniquePerformersUrl,
  makeStudioDetailUniquePerformersUrl,
  makeTagUrl,
  makeGroupUrl,
  makeParentTagsUrl,
  makeChildTagsUrl,
  makeTagSceneMarkersUrl,
  makeTagScenesUrl,
  makeTagPerformersUrl,
  makeTagPerformersBySceneTagsUrl,
  makeTagStudiosUrl,
  makeTagGalleriesUrl,
  makeTagImagesUrl,
  makeTagGroupsUrl,
  makeScenesPHashMatchUrl,
  makeSceneMarkerUrl,
  makeGroupScenesUrl,
  makeChildStudiosUrl,
  makeGalleryImagesUrl,
  makeDirectorScenesUrl,
  makePhotographerGalleriesUrl,
  makePhotographerImagesUrl,
  makeDirectorGroupsUrl,
  makeContainingGroupsUrl,
  makeSubGroupsUrl,
  makeSceneMarkersSceneUrl,
  makeSceneMarkersUrl,
  makeScenesWithMarkerTagUrl,
  makeScenesWithExclusiveMarkerTagUrl,
};

export default NavUtils;
