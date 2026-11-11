import type * as GQL from "src/core/generated-graphql";

// Fields the scene Edit form can change that a release owns. Ratings,
// organized, and production_date stay on the parent scene, so they are never
// sent.
const releaseOwnedFieldsCustom = [
  "title",
  "code",
  "details",
  "director",
  "urls",
  "date",
  "studio_id",
  "performer_ids",
  "tag_ids",
  "groups",
  "gallery_ids",
  "stash_ids",
  "custom_fields",
  "cover_image",
  "stashdb_matches",
] as const;

// Empty values of these fields clear the release's stored value.
const releaseClearableFieldsCustom = [
  "date",
  "studio_id",
  "cover_image",
] as const;

// Maps the Edit form's changed scene fields to a release update.
export function sceneReleaseEditInputCustom(
  releaseId: string,
  input: GQL.SceneCreateInput
): GQL.SceneReleaseUpdateInput {
  const ret: GQL.SceneReleaseUpdateInput = { id: releaseId };
  const target = ret as Record<string, unknown>;

  for (const field of releaseOwnedFieldsCustom) {
    if (Object.hasOwn(input, field)) {
      target[field] = input[field];
    }
  }

  for (const field of releaseClearableFieldsCustom) {
    if (Object.hasOwn(target, field) && !target[field]) {
      target[field] = null;
    }
  }

  return ret;
}
