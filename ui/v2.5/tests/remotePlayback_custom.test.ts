import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  remoteCommandMatchesCustom,
  remoteSnapshotValidCustom,
  remotePairingURLCustom,
  remotePendingCustom,
  remoteCommandIdCustom,
} from "../src/components/RemoteO/remotePlayback_custom";

const snapshot = {
  scene_id: "42",
  scene_title: "Test",
  video_timestamp: 12.875,
  duration: 120,
  playback_rate: 2,
  status: "playing",
};
const command = { session_id: "session-1", expected_scene_id: "42" };
assert.equal(remoteCommandMatchesCustom("session-1", snapshot, command), true);
assert.equal(remoteCommandMatchesCustom("session-2", snapshot, command), false);
assert.equal(
  remoteCommandMatchesCustom(
    "session-1",
    { ...snapshot, scene_id: "43" },
    command
  ),
  false
);
assert.equal(
  remoteCommandMatchesCustom("session-1", undefined, command),
  false
);
assert.equal(
  remoteCommandMatchesCustom(
    "session-1",
    { ...snapshot, status: "buffering" },
    command
  ),
  false
);
assert.equal(
  remoteCommandMatchesCustom(
    "session-1",
    { ...snapshot, status: "paused" },
    command
  ),
  true
);
for (const time of [-1, NaN, Infinity, 121]) {
  assert.equal(
    remoteSnapshotValidCustom({ ...snapshot, video_timestamp: time }),
    false
  );
}
for (const duration of [0, -1, Infinity, NaN]) {
  assert.equal(remoteSnapshotValidCustom({ ...snapshot, duration }), false);
}
assert.equal(
  remoteSnapshotValidCustom({ ...snapshot, video_timestamp: 0 }),
  true
);
assert.equal(
  remoteSnapshotValidCustom({ ...snapshot, playback_rate: 0 }),
  false
);

const token = "a".repeat(48);
assert.equal(
  remoteCommandIdCustom(
    { server_id: "server", updated_at: "2026-09-08T00:00:00Z" },
    "nonce"
  ),
  `server_${Date.parse("2026-09-08T00:00:00Z")}_nonce`
);
assert.equal(
  remotePairingURLCustom("http://192.168.1.20:9999", "/", token),
  `http://192.168.1.20:9999/remote/o#pair=${token}`
);
assert.equal(
  remotePairingURLCustom("https://stash.example", "/stash/", token),
  `https://stash.example/stash/remote/o#pair=${token}`
);
assert.equal(remotePairingURLCustom("javascript:alert(1)", "/", token), "");
assert.equal(
  remotePairingURLCustom("http://user:password@example.com", "/", token),
  ""
);
assert.equal(remotePairingURLCustom("http://example.com", "/", ""), "");
const pending = {
  command_id: "server_tap",
  player_id: "player",
  session_id: "session",
  expected_scene_id: "42",
};
assert.deepEqual(
  remotePendingCustom(JSON.stringify(pending), "player"),
  pending
);
assert.equal(
  remotePendingCustom(JSON.stringify(pending), "different-player"),
  undefined
);
assert.equal(remotePendingCustom("bad JSON", "player"), undefined);
assert.equal(
  remotePendingCustom('{"player_id":"player"}', "player"),
  undefined
);

// Execute the actual login handler: an inherited QR fragment must survive login,
// while remaining absent from the credentials POST and unrelated redirects.
const html = readFileSync(
  new URL("../../login/login.html", import.meta.url),
  "utf8"
);
const loginScript = html.match(
  /<script>\s*(function login\(\)[\s\S]*?)<\/script>/
)?.[1];
assert.ok(loginScript);
for (const [returnURL, hash, expected] of [
  ["/remote/o", `#pair=${token}`, `/remote/o#pair=${token}`],
  [
    "/stash/remote/o?x=1",
    `#pair=${token}`,
    `/stash/remote/o?x=1#pair=${token}`,
  ],
  ["/scenes/42", `#pair=${token}`, "/scenes/42"],
  ["/remote/o", "#unrelated", "/remote/o"],
]) {
  let destination = "";
  let sent = "";
  class Request {
    readyState = 4;
    status = 200;
    onreadystatechange = () => {};
    open() {}
    setRequestHeader() {}
    send(body: string) {
      sent = body;
      this.onreadystatechange();
    }
  }
  runInNewContext(`${loginScript}\nlogin();`, {
    document: {
      getElementById: (id: string) => ({
        value: id === "returnURL" ? returnURL : "test",
      }),
    },
    window: {
      location: {
        hash,
        replace: (url: string) => {
          destination = url;
        },
      },
    },
    XMLHttpRequest: Request,
  });
  assert.equal(destination, expected);
  assert.equal(sent.includes(token), false);
}
console.log(
  "Remote playback validation, pairing, pending-tap and login tests passed."
);
