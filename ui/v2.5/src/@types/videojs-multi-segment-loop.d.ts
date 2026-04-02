/* eslint-disable @typescript-eslint/naming-convention */

import type MultiSegmentLoopPlugin from "../components/ScenePlayer/multi-segment-loop";

declare module "video.js" {
  interface VideoJsPlayer {
    multiSegmentLoop(): MultiSegmentLoopPlugin;
  }
}
