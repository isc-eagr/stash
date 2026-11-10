import assert from "node:assert/strict";
import { runDeletionCustom } from "../src/components/Shared/deletion_custom.ts";
for (const failed of [false, true]) {
  const calls: unknown[] = [];
  const error = new Error("Deletion rejected");
  await runDeletionCustom({
    action: async () => {
      calls.push("mutation");
      if (failed) throw error;
    },
    onSuccess: () => calls.push("success"),
    onError: (value) => calls.push(value),
    setRunning: (value) => calls.push(value),
    onApplied: (value) => calls.push(["applied", value]),
  });
  assert.deepEqual(
    calls,
    failed
      ? [true, "mutation", error, false]
      : [true, "mutation", "success", false, ["applied", true]]
  );
}
