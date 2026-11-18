// CUSTOM: runs O Stats queries against the amateur Stash instance, through
// this instance's read-only /amateur bridge, when Settings > Custom includes
// amateur O's. Each merged query falls back to this instance's data alone
// when the amateur instance cannot be reached.
import {
  ApolloClient,
  HttpLink,
  InMemoryCache,
  gql,
  useQuery,
  type DocumentNode,
  type NormalizedCacheObject,
  type OperationVariables,
  type ServerError,
} from "@apollo/client";
import { useMemo } from "react";
import type { IUIConfig } from "src/core/config";
import { getPlatformURL } from "src/core/createClient";
import { useConfigurationContext } from "src/hooks/Config";
import { amateurAppUrlCustom } from "./oStatsAmateur_custom";

let amateurClient: ApolloClient<NormalizedCacheObject> | undefined;

// Its own cache keeps amateur scenes apart from this instance's same IDs.
function getAmateurClientCustom() {
  amateurClient ??= new ApolloClient({
    link: new HttpLink({ uri: getPlatformURL("amateur/graphql").toString() }),
    cache: new InMemoryCache(),
  });
  return amateurClient;
}

const AMATEUR_STATUS = gql`
  query AmateurOStatsStatus {
    configuration {
      ui
    }
  }
`;

export interface IAmateurOStats {
  // The setting is on and this page can include the amateur instance.
  enabled: boolean;
  // The amateur instance answered; merged queries include it.
  active: boolean;
  loading: boolean;
  // Why amateur O's are missing while enabled, for the page warning.
  problem?: "offline" | "rejected";
  client?: ApolloClient<NormalizedCacheObject>;
  // The amateur instance's own UI config (role tags, metallic tiers).
  ui?: IUIConfig;
  appUrl: (path: string) => string;
}

function amateurProblemCustom(error: unknown): IAmateurOStats["problem"] {
  const status = (error as { networkError?: ServerError } | undefined)
    ?.networkError?.statusCode;
  return status === 401 || status === 403 ? "rejected" : "offline";
}

export function useAmateurOStatsCustom(allowed = true): IAmateurOStats {
  const { configuration } = useConfigurationContext();
  const settings = (configuration?.ui as IUIConfig | undefined)
    ?.amateurInstance;
  const url = settings?.url?.trim() ?? "";
  const enabled = allowed && !!settings?.includeInOStats && url !== "";
  const client = enabled ? getAmateurClientCustom() : undefined;
  const status = useQuery<{ configuration: { ui: IUIConfig } }>(
    AMATEUR_STATUS,
    { client, skip: !enabled }
  );
  return useMemo(
    () => ({
      enabled,
      active: enabled && !!status.data,
      loading: enabled && status.loading,
      problem:
        enabled && status.error
          ? amateurProblemCustom(status.error)
          : undefined,
      client,
      ui: status.data?.configuration.ui,
      appUrl: (path: string) =>
        amateurAppUrlCustom(url, path, window.location.hostname),
    }),
    [client, enabled, status.data, status.error, status.loading, url]
  );
}

type QueryOptions<V> = { variables?: V; skip?: boolean };

// One query on both instances. main and amateur options can differ (amateur
// IDs, or skipping one side); merge runs only when both sides have data.
export function useBothOStatsQueriesCustom<
  T,
  V extends OperationVariables = OperationVariables,
>(
  amateur: IAmateurOStats,
  query: DocumentNode,
  main: QueryOptions<V>,
  amateurOptions: QueryOptions<V>,
  merge: (main: T, amateur: T) => T
) {
  const mainResult = useQuery<T, V>(query, main);
  const amateurSkip = !amateur.active || !!amateurOptions.skip;
  const amateurResult = useQuery<T, V>(query, {
    ...amateurOptions,
    client: amateur.client,
    skip: amateurSkip,
  });
  const mainData = main.skip ? undefined : mainResult.data;
  const amateurData =
    amateurSkip || amateurResult.error ? undefined : amateurResult.data;
  const loading =
    amateur.loading ||
    (!main.skip && mainResult.loading) ||
    (!amateurSkip && amateurResult.loading);
  const data = useMemo(() => {
    if (loading) return undefined;
    if (mainData && amateurData) return merge(mainData, amateurData);
    return mainData ?? amateurData;
  }, [amateurData, loading, mainData, merge]);
  return {
    data,
    loading,
    error: mainResult.error,
    amateurFailed: !amateurSkip && !!amateurResult.error,
  };
}
