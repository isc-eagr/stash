import assert from "node:assert/strict";

import { statsCountryName } from "../src/utils/statsCountry_custom.ts";

assert.equal(statsCountryName("US"), "United States");
assert.equal(statsCountryName("mx"), "Mexico");
assert.equal(statsCountryName("GB"), "United Kingdom");
assert.equal(statsCountryName("Mexico"), "Mexico");
assert.equal(statsCountryName("Unknown"), "Unknown");
assert.equal(statsCountryName(""), "Unknown");
