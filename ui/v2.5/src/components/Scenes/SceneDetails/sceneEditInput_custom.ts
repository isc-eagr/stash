// eslint-disable-next-line import/extensions -- the custom Node test loader requires the package subpath extension
import isEqual from "lodash-es/isEqual.js";

export function changedSceneEditFieldsCustom<T extends Record<string, unknown>>(
  values: T,
  initialValues: T
): Partial<T> {
  const ret: Partial<T> = {};

  for (const key of Object.keys(values) as Array<keyof T>) {
    if (!isEqual(values[key], initialValues[key])) {
      ret[key] = values[key];
    }
  }

  return ret;
}
