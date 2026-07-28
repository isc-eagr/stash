export type SceneStatsPartnerCategory = "sex" | "oral";

export interface ISceneStatsPartnerPerformer {
  id: string;
  name: string;
  imagePath?: string | null;
}

export interface ISceneStatsPartnerInterval {
  start: number;
  end: number;
}

export interface ISceneStatsPartnerMarker {
  category: string;
  interval: ISceneStatsPartnerInterval;
  topPerformers: ISceneStatsPartnerPerformer[];
  bottomPerformers: ISceneStatsPartnerPerformer[];
}

export interface ISceneStatsPartnerSlice {
  performer: ISceneStatsPartnerPerformer;
  intervals: ISceneStatsPartnerInterval[];
  seconds: number;
  percent: number;
}

export interface ISceneStatsPartnerDistribution {
  totalSeconds: number;
  partners: ISceneStatsPartnerSlice[];
}

export type SceneStatsPartnerInteractions = Record<
  string,
  Partial<Record<SceneStatsPartnerCategory, ISceneStatsPartnerDistribution>>
>;

export interface ISceneStatsInteractionPairCategory {
  intervals: ISceneStatsPartnerInterval[];
  performerPercents: Record<string, number>;
  seconds: number;
}

export interface ISceneStatsInteractionPair {
  categories: Partial<
    Record<SceneStatsPartnerCategory, ISceneStatsInteractionPairCategory>
  >;
  key: string;
  performers: [ISceneStatsPartnerPerformer, ISceneStatsPartnerPerformer];
}

export interface ISceneStatsRoleInteractionCategory {
  intervals: ISceneStatsPartnerInterval[];
  seconds: number;
}

export interface ISceneStatsRoleInteraction {
  bottomPerformer: ISceneStatsPartnerPerformer;
  categories: Partial<
    Record<SceneStatsPartnerCategory, ISceneStatsRoleInteractionCategory>
  >;
  key: string;
  topPerformer: ISceneStatsPartnerPerformer;
}

export interface ISceneStatsRoleInteractionView {
  bottomPercent: number;
  intervals: ISceneStatsPartnerInterval[];
  seconds: number;
  topPercent: number;
}

export interface ISceneStatsPartnerRoleBreakdown {
  bottomedFor: {
    percent: number;
    seconds: number;
  };
  topped: {
    percent: number;
    seconds: number;
  };
}

interface IPartnerIntervals {
  performer: ISceneStatsPartnerPerformer;
  intervals: ISceneStatsPartnerInterval[];
}

function uniquePerformers(performers: ISceneStatsPartnerPerformer[]) {
  return [
    ...new Map(
      performers.map((performer) => [performer.id, performer])
    ).values(),
  ];
}

export function mergeSceneStatsInteractionIntervals(
  intervals: ISceneStatsPartnerInterval[]
) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: ISceneStatsPartnerInterval[] = [];

  sorted.forEach((interval) => {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
      return;
    }

    last.end = Math.max(last.end, interval.end);
  });

  return merged;
}

function mergeDuration(intervals: ISceneStatsPartnerInterval[]) {
  return mergeSceneStatsInteractionIntervals(intervals).reduce(
    (total, interval) => total + interval.end - interval.start,
    0
  );
}

function addPartnerIntervals(
  interactionIntervals: Map<
    string,
    Map<SceneStatsPartnerCategory, Map<string, IPartnerIntervals>>
  >,
  performers: ISceneStatsPartnerPerformer[],
  partners: ISceneStatsPartnerPerformer[],
  category: SceneStatsPartnerCategory,
  interval: ISceneStatsPartnerInterval
) {
  uniquePerformers(performers).forEach((performer) => {
    const categories =
      interactionIntervals.get(performer.id) ??
      new Map<SceneStatsPartnerCategory, Map<string, IPartnerIntervals>>();
    const categoryPartners =
      categories.get(category) ?? new Map<string, IPartnerIntervals>();

    uniquePerformers(partners).forEach((partner) => {
      if (partner.id === performer.id) return;

      const partnerIntervals = categoryPartners.get(partner.id) ?? {
        performer: partner,
        intervals: [],
      };
      partnerIntervals.intervals.push(interval);
      categoryPartners.set(partner.id, partnerIntervals);
    });

    if (categoryPartners.size > 0) {
      categories.set(category, categoryPartners);
      interactionIntervals.set(performer.id, categories);
    }
  });
}

export function getSceneStatsPartnerInteractions(
  markers: ISceneStatsPartnerMarker[]
): SceneStatsPartnerInteractions {
  const interactionIntervals = new Map<
    string,
    Map<SceneStatsPartnerCategory, Map<string, IPartnerIntervals>>
  >();

  markers.forEach((marker) => {
    if (marker.category !== "sex" && marker.category !== "oral") return;
    if (marker.interval.end <= marker.interval.start) return;

    addPartnerIntervals(
      interactionIntervals,
      marker.topPerformers,
      marker.bottomPerformers,
      marker.category,
      marker.interval
    );
    addPartnerIntervals(
      interactionIntervals,
      marker.bottomPerformers,
      marker.topPerformers,
      marker.category,
      marker.interval
    );
  });

  return Object.fromEntries(
    [...interactionIntervals.entries()].map(([performerID, categories]) => [
      performerID,
      Object.fromEntries(
        [...categories.entries()].map(([category, partnerIntervals]) => {
          const timedPartners = [...partnerIntervals.values()]
            .map(({ performer, intervals }) => {
              const mergedIntervals =
                mergeSceneStatsInteractionIntervals(intervals);

              return {
                performer,
                intervals: mergedIntervals,
                seconds: mergeDuration(mergedIntervals),
              };
            })
            .filter((partner) => partner.seconds > 0);
          const totalSeconds = timedPartners.reduce(
            (total, partner) => total + partner.seconds,
            0
          );
          const partners = timedPartners
            .map((partner) => ({
              ...partner,
              percent:
                totalSeconds > 0
                  ? Math.round((partner.seconds / totalSeconds) * 100)
                  : 0,
            }))
            .sort(
              (a, b) =>
                b.seconds - a.seconds ||
                a.performer.name.localeCompare(b.performer.name)
            );

          return [category, { totalSeconds, partners }];
        })
      ),
    ])
  );
}

export function getSceneStatsOverallPartnerDistribution(
  interactions: Partial<
    Record<SceneStatsPartnerCategory, ISceneStatsPartnerDistribution>
  >
): ISceneStatsPartnerDistribution | undefined {
  const partnerIntervals = new Map<string, IPartnerIntervals>();

  (["sex", "oral"] as SceneStatsPartnerCategory[]).forEach((category) => {
    interactions[category]?.partners.forEach((partner) => {
      const existing = partnerIntervals.get(partner.performer.id) ?? {
        performer: partner.performer,
        intervals: [],
      };
      existing.intervals.push(...partner.intervals);
      partnerIntervals.set(partner.performer.id, existing);
    });
  });

  const timedPartners = [...partnerIntervals.values()]
    .map(({ performer, intervals }) => {
      const mergedIntervals = mergeSceneStatsInteractionIntervals(intervals);

      return {
        performer,
        intervals: mergedIntervals,
        seconds: mergeDuration(mergedIntervals),
      };
    })
    .filter((partner) => partner.seconds > 0);
  const totalSeconds = timedPartners.reduce(
    (total, partner) => total + partner.seconds,
    0
  );
  if (totalSeconds <= 0) return undefined;

  return {
    totalSeconds,
    partners: timedPartners
      .map((partner) => ({
        ...partner,
        percent: Math.round((partner.seconds / totalSeconds) * 100),
      }))
      .sort(
        (a, b) =>
          b.seconds - a.seconds ||
          a.performer.name.localeCompare(b.performer.name)
      ),
  };
}

export function getSceneStatsPartnerBarPercent(
  partnerSeconds: number,
  distribution: ISceneStatsPartnerDistribution
) {
  const maximumPartnerSeconds = Math.max(
    0,
    ...distribution.partners.map((partner) => partner.seconds)
  );
  if (maximumPartnerSeconds <= 0) return 0;

  return Math.round((partnerSeconds / maximumPartnerSeconds) * 100);
}

export function isSceneStatsLeadingPartner(
  partnerSeconds: number,
  distribution: ISceneStatsPartnerDistribution
) {
  if (partnerSeconds <= 0) return false;

  const maximumPartnerSeconds = Math.max(
    0,
    ...distribution.partners.map((partner) => partner.seconds)
  );

  return partnerSeconds === maximumPartnerSeconds;
}

export function shouldShowSceneStatsInteractionPercent(
  scenePerformerCount: number
) {
  return scenePerformerCount >= 3;
}

export function shouldShowSceneStatsPartnerInteractions(
  scenePerformerCount: number
) {
  return scenePerformerCount >= 3;
}

export function shouldShowSceneStatsDetails(scenePerformerCount: number) {
  return scenePerformerCount >= 2;
}

export function getSceneStatsAvailablePartnerViews(
  interactions: Partial<
    Record<SceneStatsPartnerCategory, ISceneStatsPartnerDistribution>
  >
): Array<SceneStatsPartnerCategory | "both"> {
  const hasCategory = (category: SceneStatsPartnerCategory) => {
    const distribution = interactions[category];

    return (
      (distribution?.totalSeconds ?? 0) > 0 &&
      !!distribution?.partners.some((partner) => partner.seconds > 0)
    );
  };
  const hasSex = hasCategory("sex");
  const hasOral = hasCategory("oral");

  return [
    ...(hasSex && hasOral ? (["both"] as const) : []),
    ...(hasSex ? (["sex"] as const) : []),
    ...(hasOral ? (["oral"] as const) : []),
  ];
}

export function getSceneStatsAvailableInteractionViews(
  interactions: ISceneStatsRoleInteraction[]
): Array<SceneStatsPartnerCategory | "both"> {
  const categoryViews = (["sex", "oral"] as SceneStatsPartnerCategory[]).filter(
    (category) =>
      interactions.some(
        (interaction) => (interaction.categories[category]?.seconds ?? 0) > 0
      )
  );

  return categoryViews.length === 2
    ? [...categoryViews, "both"]
    : categoryViews;
}

export function getSceneStatsInteractionPairKey(
  firstPerformerID: string,
  secondPerformerID: string
) {
  return [firstPerformerID, secondPerformerID].sort().join("::");
}

export function getSceneStatsInteractionPairs(
  performers: ISceneStatsPartnerPerformer[],
  interactions: SceneStatsPartnerInteractions
): ISceneStatsInteractionPair[] {
  const performerByID = new Map(
    performers.map((performer) => [performer.id, performer])
  );
  const pairs = new Map<string, ISceneStatsInteractionPair>();

  Object.entries(interactions).forEach(([performerID, categories]) => {
    const performer = performerByID.get(performerID);
    if (!performer) return;

    (["sex", "oral"] as SceneStatsPartnerCategory[]).forEach((category) => {
      categories[category]?.partners.forEach((partner) => {
        const pairKey = getSceneStatsInteractionPairKey(
          performerID,
          partner.performer.id
        );
        const pair =
          pairs.get(pairKey) ??
          ({
            categories: {},
            key: pairKey,
            performers: [performer, partner.performer],
          } as ISceneStatsInteractionPair);
        const categoryStats = pair.categories[category] ?? {
          intervals: partner.intervals,
          performerPercents: {},
          seconds: partner.seconds,
        };

        categoryStats.intervals = partner.intervals;
        categoryStats.seconds = partner.seconds;
        categoryStats.performerPercents[performerID] = partner.percent;
        pair.categories[category] = categoryStats;
        pairs.set(pairKey, pair);
      });
    });
  });

  return [...pairs.values()].sort((a, b) => {
    const aNames = a.performers
      .map((performer) => performer.name)
      .sort()
      .join("\u0000");
    const bNames = b.performers
      .map((performer) => performer.name)
      .sort()
      .join("\u0000");

    return aNames.localeCompare(bNames);
  });
}

export function getSceneStatsInteractionPairCategories(
  pair: ISceneStatsInteractionPair,
  view: SceneStatsPartnerCategory | "both"
) {
  const requestedCategories: SceneStatsPartnerCategory[] =
    view === "both" ? ["sex", "oral"] : [view];

  return requestedCategories.filter((category) => !!pair.categories[category]);
}

export function getSceneStatsInteractionPairIntervals(
  pair: ISceneStatsInteractionPair,
  view: SceneStatsPartnerCategory | "both"
) {
  return mergeSceneStatsInteractionIntervals(
    getSceneStatsInteractionPairCategories(pair, view).flatMap(
      (category) => pair.categories[category]?.intervals ?? []
    )
  );
}

export function getSceneStatsRoleInteractionKey(
  topPerformerID: string,
  bottomPerformerID: string
) {
  return `${topPerformerID}::${bottomPerformerID}`;
}

export function getSceneStatsRoleInteractionCategories(
  interaction: ISceneStatsRoleInteraction,
  view: SceneStatsPartnerCategory | "both"
) {
  const requestedCategories: SceneStatsPartnerCategory[] =
    view === "both" ? ["sex", "oral"] : [view];

  return requestedCategories.filter(
    (category) => !!interaction.categories[category]
  );
}

export function getSceneStatsRoleInteractions(
  markers: ISceneStatsPartnerMarker[]
): ISceneStatsRoleInteraction[] {
  const roleInteractions = new Map<
    string,
    {
      bottomPerformer: ISceneStatsPartnerPerformer;
      categoryIntervals: Partial<
        Record<SceneStatsPartnerCategory, ISceneStatsPartnerInterval[]>
      >;
      topPerformer: ISceneStatsPartnerPerformer;
    }
  >();

  markers.forEach((marker) => {
    if (marker.category !== "sex" && marker.category !== "oral") return;
    if (marker.interval.end <= marker.interval.start) return;
    const { category } = marker;

    uniquePerformers(marker.topPerformers).forEach((topPerformer) => {
      uniquePerformers(marker.bottomPerformers).forEach((bottomPerformer) => {
        if (topPerformer.id === bottomPerformer.id) return;

        const key = getSceneStatsRoleInteractionKey(
          topPerformer.id,
          bottomPerformer.id
        );
        const interaction = roleInteractions.get(key) ?? {
          bottomPerformer,
          categoryIntervals: {},
          topPerformer,
        };
        interaction.categoryIntervals[category] = [
          ...(interaction.categoryIntervals[category] ?? []),
          marker.interval,
        ];
        roleInteractions.set(key, interaction);
      });
    });
  });

  return [...roleInteractions.entries()]
    .map(([key, interaction]) => ({
      bottomPerformer: interaction.bottomPerformer,
      categories: Object.fromEntries(
        (["sex", "oral"] as SceneStatsPartnerCategory[]).flatMap((category) => {
          const intervals = interaction.categoryIntervals[category];
          if (!intervals) return [];

          const mergedIntervals =
            mergeSceneStatsInteractionIntervals(intervals);
          return [
            [
              category,
              {
                intervals: mergedIntervals,
                seconds: mergeDuration(mergedIntervals),
              },
            ],
          ];
        })
      ),
      key,
      topPerformer: interaction.topPerformer,
    }))
    .sort(
      (a, b) =>
        a.topPerformer.name.localeCompare(b.topPerformer.name) ||
        a.bottomPerformer.name.localeCompare(b.bottomPerformer.name)
    );
}

function getSceneStatsRoleInteractionViewIntervals(
  interaction: ISceneStatsRoleInteraction,
  view: SceneStatsPartnerCategory | "both"
) {
  const categories: SceneStatsPartnerCategory[] =
    view === "both" ? ["sex", "oral"] : [view];

  return mergeSceneStatsInteractionIntervals(
    categories.flatMap(
      (category) => interaction.categories[category]?.intervals ?? []
    )
  );
}

export function getSceneStatsRoleInteractionView(
  interaction: ISceneStatsRoleInteraction,
  view: SceneStatsPartnerCategory | "both",
  interactions: ISceneStatsRoleInteraction[]
): ISceneStatsRoleInteractionView {
  const intervals = getSceneStatsRoleInteractionViewIntervals(
    interaction,
    view
  );
  const seconds = mergeDuration(intervals);
  const topSeconds = interactions
    .filter(
      (candidate) => candidate.topPerformer.id === interaction.topPerformer.id
    )
    .reduce(
      (total, candidate) =>
        total +
        mergeDuration(
          getSceneStatsRoleInteractionViewIntervals(candidate, view)
        ),
      0
    );
  const bottomSeconds = interactions
    .filter(
      (candidate) =>
        candidate.bottomPerformer.id === interaction.bottomPerformer.id
    )
    .reduce(
      (total, candidate) =>
        total +
        mergeDuration(
          getSceneStatsRoleInteractionViewIntervals(candidate, view)
        ),
      0
    );

  return {
    bottomPercent:
      bottomSeconds > 0 ? Math.round((seconds / bottomSeconds) * 100) : 0,
    intervals,
    seconds,
    topPercent: topSeconds > 0 ? Math.round((seconds / topSeconds) * 100) : 0,
  };
}

export function getSceneStatsPartnerRoleBreakdown(
  performerID: string,
  partnerID: string,
  view: SceneStatsPartnerCategory | "both",
  pair: ISceneStatsInteractionPair,
  roleInteractions: ISceneStatsRoleInteraction[]
): ISceneStatsPartnerRoleBreakdown {
  const pairSeconds = mergeDuration(
    getSceneStatsInteractionPairIntervals(pair, view)
  );
  const toppedInteraction = roleInteractions.find(
    (interaction) =>
      interaction.key ===
      getSceneStatsRoleInteractionKey(performerID, partnerID)
  );
  const bottomedForInteraction = roleInteractions.find(
    (interaction) =>
      interaction.key ===
      getSceneStatsRoleInteractionKey(partnerID, performerID)
  );
  const toppedSeconds = toppedInteraction
    ? getSceneStatsRoleInteractionView(
        toppedInteraction,
        view,
        roleInteractions
      ).seconds
    : 0;
  const bottomedForSeconds = bottomedForInteraction
    ? getSceneStatsRoleInteractionView(
        bottomedForInteraction,
        view,
        roleInteractions
      ).seconds
    : 0;

  return {
    bottomedFor: {
      percent:
        pairSeconds > 0
          ? Math.round((bottomedForSeconds / pairSeconds) * 100)
          : 0,
      seconds: bottomedForSeconds,
    },
    topped: {
      percent:
        pairSeconds > 0 ? Math.round((toppedSeconds / pairSeconds) * 100) : 0,
      seconds: toppedSeconds,
    },
  };
}
