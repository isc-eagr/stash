import { useEffect, useState } from "react";
import { gql, useApolloClient } from "@apollo/client";
import {
  loadExplorerVatos,
  VATO_EXPLORER_QUERY,
  type IVatoExplorerPage,
  type IVatoExplorerVato,
} from "./vatoExplorerData_custom";

const query = gql(VATO_EXPLORER_QUERY);

export interface IVatoExplorerState {
  vatos: IVatoExplorerVato[];
  loading: boolean;
  loaded: number;
  total: number;
  error?: string;
}

export function useVatoExplorer() {
  const client = useApolloClient();
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<IVatoExplorerState>({
    vatos: [],
    loading: true,
    loaded: 0,
    total: 0,
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-runs when revision change
  useEffect(() => {
    const controller = new AbortController();
    setState({ vatos: [], loading: true, loaded: 0, total: 0 });
    void loadExplorerVatos(
      async (page) => {
        const result = await client.query<IVatoExplorerPage>({
          query,
          variables: { page },
          fetchPolicy: "no-cache",
          context: {
            queryDeduplication: false,
            fetchOptions: { signal: controller.signal },
          },
        });
        return result.data;
      },
      controller.signal,
      (loaded, total) => setState({ vatos: [], loading: true, loaded, total })
    )
      .then((vatos) => {
        if (!controller.signal.aborted)
          setState({
            vatos,
            loading: false,
            loaded: vatos.length,
            total: vatos.length,
          });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            vatos: [],
            loading: false,
            loaded: 0,
            total: 0,
            error: error instanceof Error ? error.message : String(error),
          });
      });
    return () => controller.abort();
  }, [client, revision]);
  return { state, reload: () => setRevision((previous) => previous + 1) };
}
