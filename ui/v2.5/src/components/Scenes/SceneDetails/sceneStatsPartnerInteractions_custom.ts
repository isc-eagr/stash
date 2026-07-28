export type SceneStatsPartnerCategory = "sex" | "oral";

export interface ISceneStatsPartnerPerformer {
  id: string;
  name: string;
  imagePath?: string | null;
}

export interface ISceneStatsPartnerMarker {
  category: string;
  interval: {
    start: number;
    end: number;
  };
  topPerformers: ISceneStatsPartnerPerformer[];
  bottomPerformers: ISceneStatsPartnerPerformer[];
}

export interface ISceneStatsPartnerSlice {
  performer: ISceneStatsPartnerPerformer;
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

interface IInterval {
  start: number;
  end: number;
}

interface IPartnerIntervals {
  performer: ISceneStatsPartnerPerformer;
  intervals: IInterval[];
}

function uniquePerformers(performers: ISceneStatsPartnerPerformer[]) {
  return [
    ...new Map(
      performers.map((performer) => [performer.id, performer])
    ).values(),
  ];
}

function mergeDuration(intervals: IInterval[]) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: IInterval[] = [];

  sorted.forEach((interval) => {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end) {
      merged.push({ ...interval });
      return;
    }

    last.end = Math.max(last.end, interval.end);
  });

  return merged.reduce(
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
  interval: IInterval
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
            .map(({ performer, intervals }) => ({
              performer,
              seconds: mergeDuration(intervals),
            }))
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
