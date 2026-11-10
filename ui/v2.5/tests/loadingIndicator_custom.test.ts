import assert from "node:assert/strict";

import { shouldUseLoadingOverlay } from "../src/components/Shared/loadingIndicator_custom.ts";

assert.equal(
  shouldUseLoadingOverlay({
    card: false,
    inline: false,
    messageVisible: true,
    small: false,
  }),
  true,
  "ordinary Loading messages use the viewport overlay"
);
assert.equal(
  shouldUseLoadingOverlay({
    card: false,
    inline: true,
    messageVisible: true,
    small: false,
  }),
  false,
  "inline button and field spinners stay compact"
);
assert.equal(
  shouldUseLoadingOverlay({
    card: false,
    inline: false,
    messageVisible: true,
    small: true,
  }),
  false,
  "small spinners stay local to their control"
);
assert.equal(
  shouldUseLoadingOverlay({
    card: true,
    inline: false,
    messageVisible: true,
    small: false,
  }),
  false,
  "card and popover loaders remain inside their card"
);
assert.equal(
  shouldUseLoadingOverlay({
    card: false,
    inline: false,
    messageVisible: false,
    small: false,
  }),
  false,
  "spinner-only loaders remain local to their container"
);
