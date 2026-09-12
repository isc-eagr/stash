import { useEffect, useState } from "react";
import { gql, useApolloClient } from "@apollo/client";
import {
  loadTierVatos,
  vatoTierRequest,
  VATO_TIERS_QUERY,
  type IVatoTierPage,
  type IVatoTierPerformer,
} from "./vatoTiersData_custom";

const query = gql(VATO_TIERS_QUERY);
export interface IVatoTiersState {
  performers: IVatoTierPerformer[];
  loading: boolean;
  loaded: number;
  tier?: string;
  error?: string;
}

export function useVatoTiers() {
  const client = useApolloClient();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<IVatoTiersState>({
    performers: [],
    loading: true,
    loaded: 0,
  });
  useEffect(() => {
    const controller = new AbortController();
    setState({ performers: [], loading: true, loaded: 0 });
    void loadTierVatos(
      async (page, tier) => {
        const { values, modifier, rating } = vatoTierRequest(tier);
        const result = await client.query<IVatoTierPage>({
          query,
          variables: { page, tier: values, modifier, rating },
          fetchPolicy: "no-cache",
          context: {
            queryDeduplication: false,
            fetchOptions: { signal: controller.signal },
          },
        });
        return result.data;
      },
      controller.signal,
      (loaded, tier) =>
        setState({ performers: [], loading: true, loaded, tier })
    )
      .then((performers) => {
        if (!controller.signal.aborted)
          setState({ performers, loading: false, loaded: performers.length });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            performers: [],
            loading: false,
            loaded: 0,
            error: error instanceof Error ? error.message : String(error),
          });
      });
    return () => controller.abort();
  }, [client, revision]);
  return { state, reload: () => setRevision((previous) => previous + 1) };
}
