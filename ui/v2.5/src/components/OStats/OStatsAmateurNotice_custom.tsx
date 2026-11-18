// CUSTOM: warns when O Stats should include the amateur instance but cannot.
import React from "react";
import { Alert } from "react-bootstrap";
import type { IAmateurOStats } from "./useAmateurOStats_custom";

export const OStatsAmateurNotice: React.FC<{
  amateur: IAmateurOStats;
  failed?: boolean;
}> = ({ amateur, failed = false }) => {
  if (!amateur.enabled || amateur.loading) return null;
  const problem = amateur.problem ?? (failed ? "offline" : undefined);
  if (!problem) return null;
  return (
    <Alert variant="warning">
      {problem === "rejected"
        ? "The amateur instance rejected the API key. Showing main O's only."
        : "The amateur instance is off. Showing main O's only."}
    </Alert>
  );
};
