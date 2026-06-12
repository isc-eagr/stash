// CUSTOM: All custom navigation utility functions for the Stash fork
import * as GQL from "src/core/generated-graphql";
import { PerformersCriterion } from "src/models/list-filter/criteria/performers";
import { StudiosCriterion } from "src/models/list-filter/criteria/studios";
import {
  TagsCriterion,
  TagsCriterionOption,
} from "src/models/list-filter/criteria/tags";
import { ListFilterModel } from "src/models/list-filter/filter";
import {
  StringCriterion,
  createStringCriterionOption,
} from "src/models/list-filter/criteria/criterion";
import {
  RatingCriterion,
  RatingCriterionOption,
} from "src/models/list-filter/criteria/rating";
import { RatingSystemType, RatingStarPrecision } from "src/utils/rating";
import { IHierarchicalLabelValue } from "src/models/list-filter/types";
import {
  MarkerTagsCriterion,
  MarkerTagsCriterionOption,
} from "src/models/list-filter/criteria/marker-tags";
import {
  MarkerPerformersCriterion,
  MarkerPerformersCriterionOption,
} from "src/models/list-filter/criteria/marker-performers";
import type { INamedObject } from "./navigation";

export const makePerformersEthnicityUrl = (ethnicity: string) => {
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

export const makePerformersEthnicityRatingUrl = (
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

export const makePerformersEthnicityRatingRangeUrl = (
  ethnicity: string,
  minRating: number,
  maxRatingExclusive?: number
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
  ratingCriterion.modifier = GQL.CriterionModifier.Between;
  ratingCriterion.value = {
    value: minRating,
    value2: maxRatingExclusive === undefined ? 100000 : maxRatingExclusive - 1,
  };
  filter.criteria.push(ratingCriterion);

  const randomId = Math.floor(Math.random() * 100000000);
  return `/performers?${filter.makeQueryParameters()}&sortby=random_${randomId}`;
};

const encodeCustomFilterCriterion = (criterion: Record<string, unknown>) =>
  encodeURI(JSON.stringify(criterion).replace(/^\{/, "(").replace(/\}$/, ")"))
    .replaceAll("?", encodeURIComponent("?"))
    .replaceAll("#", encodeURIComponent("#"))
    .replaceAll("&", encodeURIComponent("&"))
    .replaceAll(";", encodeURIComponent(";"))
    .replaceAll("=", encodeURIComponent("="))
    .replaceAll("+", encodeURIComponent("+"));

export const makePerformersEthnicityMetallicRatingUrl = (
  ethnicity: string,
  tier: "bronze" | "silver" | "gold" | "royal_sapphire"
) => {
  const ethnicityCriterion = encodeCustomFilterCriterion({
    type: "ethnicity",
    modifier: "EQUALS",
    value: ethnicity,
  });
  const metallicRatingCriterion = encodeCustomFilterCriterion({
    type: "metallic_rating",
    modifier: "INCLUDES",
    value: [tier],
  });

  return `/performers?c=${ethnicityCriterion}&c=${metallicRatingCriterion}&sortby=name`;
};

export const makePerformerStudioScenesUrl = (
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

export const makeStudioSexScenesUrl = (
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

export const makeStudioOralScenesUrl = (
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

export const makeStudioSoloScenesUrl = (
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

export const makeStudioFacialScenesUrl = (
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
export const makeStudioDetailSexScenesUrl = (
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

export const makeStudioDetailOralScenesUrl = (
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

export const makeStudioDetailSoloScenesUrl = (
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

export const makeStudioDetailFacialScenesUrl = (
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

export const makeGlobalSexScenesUrl = (
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

export const makeGlobalOralScenesUrl = (
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

export const makeGlobalSoloScenesUrl = (
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

export const makeGlobalFacialScenesUrl = (
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
export const makePerformerStudioSexScenesUrl = (
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

export const makePerformerStudioOralScenesUrl = (
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

export const makePerformerStudioSoloScenesUrl = (
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

export const makePerformerStudioFacialScenesUrl = (
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

export const makePerformerStudioGroupsUrl = (
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

export const makePerformerStudioImagesUrl = (
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

export const makePerformerStudioGalleriesUrl = (
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

export const makeStudioUniquePerformersUrl = (
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

export const makeStudioDetailUniquePerformersUrl = (
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
export const makePerformerDetailSexScenesUrl = (
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

export const makePerformerDetailOralScenesUrl = (
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

export const makePerformerDetailSoloScenesUrl = (
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

export const makePerformerDetailFacialScenesUrl = (
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
export const makePerformerMarkerScenesUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  tagId: string,
  roleType: string
) => {
  if (!performer.id) return "#";

  const performerLabel = performer.name || `Performer ${performer.id}`;
  const performerRef = { id: performer.id, label: performerLabel };

  // For any role (top OR bottom), put the performer in both arrays with OR mode
  return `/scenes?c=${encodeURIComponent(
    JSON.stringify({
      type: "scene_markers",
      modifier: "EQUALS",
      groups: [
        {
          groupId: "A",
          tag_ids: [{ id: tagId, label: roleType }],
          depth: 0,
          performer_mode: "OR",
          top_performer_ids: [performerRef],
          bottom_performer_ids: [performerRef],
        },
      ],
      unnamed_performers: [],
    })
  )}&sortby=date`;
};

// Marker-based performer scenes URL with top/bottom role filter
// role: "top" | "bottom" | undefined (any)
// excludeTags: optional array of tag IDs to exclude from the filter
// markerDepth: depth for subtag matching (0 = exact, -1 = all subtags)
export const makePerformerMarkerScenesWithRoleUrl = (
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
    performer_mode: role ? "AND" : "OR", // OR when any role, AND when specific role
    top_performer_ids: [],
    bottom_performer_ids: [],
  };

  // Add role-specific performer
  if (role === "top") {
    includeGroup.top_performer_ids = [performerRef];
  } else if (role === "bottom") {
    includeGroup.bottom_performer_ids = [performerRef];
  } else {
    // Any role - put performer in both with OR mode
    includeGroup.top_performer_ids = [performerRef];
    includeGroup.bottom_performer_ids = [performerRef];
  }

  let url = `/scenes?c=${encodeURIComponent(
    JSON.stringify({
      type: "scene_markers",
      modifier: "EQUALS",
      groups: [includeGroup],
      unnamed_performers: [],
    })
  )}`;

  // Add exclude criteria if needed
  if (excludeTags && excludeTags.length > 0) {
    const excludeGroups = excludeTags.map((tag, index) => ({
      groupId: String.fromCharCode(66 + index), // B, C, D...
      tag_ids: [tag],
      depth: markerDepth,
      performer_mode: "AND",
      top_performer_ids: [],
      bottom_performer_ids: [],
    }));

    url += `&c=${encodeURIComponent(
      JSON.stringify({
        type: "scene_markers_exclude",
        modifier: "EQUALS",
        groups: excludeGroups,
        unnamed_performers: [],
      })
    )}`;
  }

  return `${url}&sortby=date`;
};

export const makeStudioMarkerScenesUrl = (
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
      modifier: "EQUALS",
      groups: [
        {
          groupId: "A",
          tag_ids: [{ id: tagId, label: roleType }],
          depth: markerDepth,
          performer_mode: "AND",
          top_performer_ids: [],
          bottom_performer_ids: [],
        },
      ],
      unnamed_performers: [],
    })
  )}`;

  // Add exclude criteria if needed
  if (excludeTags && excludeTags.length > 0) {
    const excludeGroups = excludeTags.map((tag, index) => ({
      groupId: String.fromCharCode(66 + index), // B, C, D...
      tag_ids: [tag],
      depth: markerDepth,
      performer_mode: "AND",
      top_performer_ids: [],
      bottom_performer_ids: [],
    }));

    url += `&c=${encodeURIComponent(
      JSON.stringify({
        type: "scene_markers_exclude",
        modifier: "EQUALS",
        groups: excludeGroups,
        unnamed_performers: [],
      })
    )}`;
  }

  return `${url}&sortby=date`;
};

export const makePerformerStudioMarkerScenesUrl = (
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
      modifier: "EQUALS",
      groups: [
        {
          groupId: "A",
          tag_ids: [{ id: tagId, label: roleType }],
          depth: markerDepth,
          performer_mode: "OR",
          top_performer_ids: [performerRef],
          bottom_performer_ids: [performerRef],
        },
      ],
      unnamed_performers: [],
    })
  )}`;

  // Add exclude criteria if needed
  if (excludeTags && excludeTags.length > 0) {
    const excludeGroups = excludeTags.map((tag, index) => ({
      groupId: String.fromCharCode(66 + index), // B, C, D...
      tag_ids: [tag],
      depth: markerDepth,
      performer_mode: "AND",
      top_performer_ids: [],
      bottom_performer_ids: [],
    }));

    url += `&c=${encodeURIComponent(
      JSON.stringify({
        type: "scene_markers_exclude",
        modifier: "EQUALS",
        groups: excludeGroups,
        unnamed_performers: [],
      })
    )}`;
  }

  return `${url}&sortby=date`;
};

// Build a Scene Markers URL filtered by scene marker tags (linked through scene_marker_performers)
// This links performers to tags via scene markers they're associated with
export const makeTagPerformersBySceneTagsUrl = (tag: INamedObject) => {
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

// URL to list scene markers filtered by a specific tag (primary or secondary)
export const makeSceneMarkersUrl = (tagId: string, tagName: string) => {
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
export const makeScenesWithMarkerTagUrl = (
  tagId: string,
  tagName: string,
  markerDepth: number = 0
) => {
  return `/scenes?c=${encodeURIComponent(
    JSON.stringify({
      type: "scene_markers",
      modifier: "EQUALS",
      groups: [
        {
          groupId: "A",
          tag_ids: [{ id: tagId, label: tagName }],
          depth: markerDepth,
          performer_mode: "AND",
          top_performer_ids: [],
          bottom_performer_ids: [],
        },
      ],
      unnamed_performers: [],
    })
  )}&sortby=date`;
};

// URL to list SCENES with exclusive marker tag filtering (includes tag, excludes other tags)
// Used for hierarchical category counts: oral excludes sex, solo excludes sex+oral
// markerDepth: 0 for exact match, -1 for all subtags
export const makeScenesWithExclusiveMarkerTagUrl = (
  includeTagId: string,
  includeTagName: string,
  excludeTagIds: Array<{ id: string; label: string }>,
  markerDepth: number = 0
) => {
  // Build include criterion
  let url = `/scenes?c=${encodeURIComponent(
    JSON.stringify({
      type: "scene_markers",
      modifier: "EQUALS",
      groups: [
        {
          groupId: "A",
          tag_ids: [{ id: includeTagId, label: includeTagName }],
          depth: markerDepth,
          performer_mode: "AND",
          top_performer_ids: [],
          bottom_performer_ids: [],
        },
      ],
      unnamed_performers: [],
    })
  )}`;

  // Add exclude criteria if needed
  if (excludeTagIds && excludeTagIds.length > 0) {
    const excludeGroups = excludeTagIds.map((tag, index) => ({
      groupId: String.fromCharCode(66 + index), // B, C, D...
      tag_ids: [tag],
      depth: markerDepth,
      performer_mode: "AND",
      top_performer_ids: [],
      bottom_performer_ids: [],
    }));

    url += `&c=${encodeURIComponent(
      JSON.stringify({
        type: "scene_markers_exclude",
        modifier: "EQUALS",
        groups: excludeGroups,
        unnamed_performers: [],
      })
    )}`;
  }

  return `${url}&sortby=date`;
};

// Navigate to scene markers where performer is "top" for a given tag (e.g., orgasm markers)
export const makePerformerOrgasmMarkersUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  tagId: string,
  tagLabel: string
) => {
  if (!performer.id || !tagId) return "#";

  const filter = new ListFilterModel(GQL.FilterMode.SceneMarkers, undefined);

  // Add marker performers criterion with the performer as top and the tag filter
  const criterion = new MarkerPerformersCriterion(
    MarkerPerformersCriterionOption
  );
  criterion.modifier = GQL.CriterionModifier.IncludesAll;
  criterion.value = {
    tag_ids: [{ id: tagId, label: tagLabel }],
    include_subtags: true,
    top_performer_ids: [
      {
        id: performer.id,
        label: performer.name || `Performer ${performer.id}`,
      },
    ],
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
    performer_mode: "AND",
  };
  filter.criteria.push(criterion);
  filter.sortBy = "title";

  return `/scenes/markers?${filter.makeQueryParameters()}`;
};

// Navigate to scene markers where performer has feet markers
export const makePerformerFeetMarkersUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  tagId: string,
  tagLabel: string
) => {
  if (!performer.id || !tagId) return "#";

  const filter = new ListFilterModel(GQL.FilterMode.SceneMarkers, undefined);

  // Add marker performers criterion with the performer as top and the tag filter
  const criterion = new MarkerPerformersCriterion(
    MarkerPerformersCriterionOption
  );
  criterion.modifier = GQL.CriterionModifier.IncludesAll;
  criterion.value = {
    tag_ids: [{ id: tagId, label: tagLabel }],
    include_subtags: true,
    top_performer_ids: [
      {
        id: performer.id,
        label: performer.name || `Performer ${performer.id}`,
      },
    ],
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
    performer_mode: "AND",
  };
  filter.criteria.push(criterion);
  filter.sortBy = "title";

  return `/scenes/markers?${filter.makeQueryParameters()}`;
};

// Navigate to scene markers for facial/oral with role filter (goes to /scenes/markers, not /scenes)
// Similar to orgasm markers URL but with configurable role and depth
export const makePerformerFacialMarkersWithRoleUrl = (
  performer: Partial<GQL.PerformerDataFragment>,
  tagId: string,
  tagLabel: string,
  role?: "top" | "bottom"
) => {
  if (!performer.id || !tagId) return "#";

  const performerRef = {
    id: performer.id,
    label: performer.name || `Performer ${performer.id}`,
  };

  // Build the criterion using new format
  // For overall (no role): performer in either top OR bottom (performer_mode: "OR")
  // For specific role: performer in that role only
  const criterionData = {
    type: "marker_performers",
    modifier: "INCLUDES",
    tag_ids: [{ id: tagId, label: tagLabel }],
    include_subtags: true,
    performer_mode: role ? "AND" : "OR", // OR for overall to match either role
    top_performer_ids: role === "top" || !role ? [performerRef] : [],
    bottom_performer_ids: role === "bottom" || !role ? [performerRef] : [],
    unnamed_performers: [],
  };

  return `/scenes/markers?c=${encodeURIComponent(
    JSON.stringify(criterionData)
  )}&sortby=title`;
};

// Generate URL to filter performers by partner markers (e.g., "who has performer X been a top/bottom with")
// category: "sex" | "oral" | "facial"
// partnerRole: "top" | "bottom" - the role of the partners we're looking for
export const makePerformerPartnerPerformersUrl = (
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
export const makePerformerAllPartnersUrl = (
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

/**
 * Prepend a studio `c=` criterion to a `/scenes` or `/scenes/markers` URL so the list
 * stays scoped to the given studio/depth.  The criterion is inserted right after the `?`
 * so any existing `c=` params remain intact.
 *
 * For scene marker URLs (`/scenes/markers`) the criterion type is still `"studios"` —
 * SceneMarkerFilterType has a top-level `studios` field that the filter parser handles.
 */
// CUSTOM: begin
export const withStudioScope = (
  url: string,
  studioId: string,
  studioLabel: string,
  studioDepth: number = 0
): string => {
  if (!studioId || url === "#") return url;

  const studioCriterion = encodeURIComponent(
    JSON.stringify({
      type: "studios",
      modifier: "INCLUDES",
      value: {
        items: [{ id: studioId, label: studioLabel }],
        excluded: [],
        depth: studioDepth,
      },
    })
  );

  const insertAt = url.indexOf("?");
  if (insertAt === -1) {
    return `${url}?c=${studioCriterion}`;
  }
  // Insert studio criterion right after the `?`
  const base = url.slice(0, insertAt + 1);
  const rest = url.slice(insertAt + 1);
  return `${base}c=${studioCriterion}${rest ? `&${rest}` : ""}`;
};
// CUSTOM: end
