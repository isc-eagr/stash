import assert from "node:assert/strict";

import { formatORecordedToastCustom } from "../src/components/Scenes/oRecordToast_custom.ts";

assert.equal(formatORecordedToastCustom(), "O recorded");
assert.match(formatORecordedToastCustom(125.875), /^O recorded at /);
