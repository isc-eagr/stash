import { readFile } from "node:fs/promises";
import ts from "typescript";

const sourceRoot = new URL("../src/", import.meta.url);

async function resolveTypeScriptCandidate(url, context, nextResolve) {
  for (const suffix of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    try {
      return await nextResolve(`${url.href}${suffix}`, context);
    } catch (error) {
      if (error?.code !== "ERR_MODULE_NOT_FOUND") {
        throw error;
      }
    }
  }

  return undefined;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@apollo/client") {
    return nextResolve(
      new URL("../node_modules/@apollo/client/index.js", import.meta.url).href,
      context
    );
  }

  if (specifier.startsWith("src/")) {
    const resolved = await resolveTypeScriptCandidate(
      new URL(specifier.slice(4), sourceRoot),
      context,
      nextResolve
    );
    if (resolved) return resolved;
  }

  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !/\.[a-z0-9]+$/i.test(specifier)
  ) {
    const resolved = await resolveTypeScriptCandidate(
      new URL(specifier, context.parentURL),
      context,
      nextResolve
    );
    if (resolved) return resolved;
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.endsWith(".ts") || url.endsWith(".tsx")) {
    const source = await readFile(new URL(url), "utf8");
    const result = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: new URL(url).pathname,
    });

    return {
      format: "module",
      shortCircuit: true,
      source: result.outputText,
    };
  }

  return nextLoad(url, context);
}
