import { globToRegExp, isGlob } from "@std/path";
import type { FsAdapter } from "../fs.ts";
import { BUILD_ID } from "../runtime/build_id.ts";
import { assetInternal } from "../runtime/shared_internal.tsx";

export type TransformMode = "development" | "production";

export interface OnTransformOptions {
  pluginName: string;
  filter: RegExp;
  exclude?: Array<string | RegExp>;
}

export interface OnTransformResult {
  content: string | Uint8Array;
  path?: string;
  map?: string | Uint8Array;
}

export interface OnTransformArgs {
  path: string;
  target: string | string[];
  text: string;
  content: Uint8Array;
  mode: TransformMode;
  root: string;
}
export type TransformFn = (
  args: OnTransformArgs,
) =>
  | void
  | OnTransformResult
  | Array<{ path: string } & Omit<OnTransformResult, "path">>
  | Promise<
    | void
    | OnTransformResult
    | Array<{ path: string } & Omit<OnTransformResult, "path">>
  >;

export interface Transformer {
  options: OnTransformOptions;
  fn: TransformFn;
}

export interface ProcessedFile {
  path: string;
  content: Uint8Array;
  map: Uint8Array | null;
  inputFiles: string[];
}

interface TransformRequest {
  newFile: boolean;
  filePath: string;
  content: Uint8Array;
  map: null | Uint8Array;
  inputFiles: string[];
}

export class FileTransformer {
  #transformers: Transformer[] = [];
  #fs: FsAdapter;
  #root: string;

  constructor(fs: FsAdapter, root: string) {
    this.#fs = fs;
    this.#root = root;
  }

  onTransform(options: OnTransformOptions, callback: TransformFn): void {
    this.#transformers.push({ options, fn: callback });
  }

  async process(
    filePath: string,
    mode: TransformMode,
    target: string | string[],
  ): Promise<ProcessedFile[] | null> {
    // Pre-check if we have any transformer for this file at all
    let hasTransformer = false;
    for (let i = 0; i < this.#transformers.length; i++) {
      if (this.#transformers[i].options.filter.test(filePath)) {
        hasTransformer = true;
        break;
      }
    }

    if (!hasTransformer) {
      return null;
    }

    let content: Uint8Array;
    try {
      content = await this.#fs.readFile(filePath);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        return null;
      }

      throw err;
    }

    const queue: TransformRequest[] = [{
      newFile: false,
      content,
      filePath,
      map: null,
      inputFiles: [filePath],
    }];
    const outFiles: ProcessedFile[] = [];

    const seen = new Set<string>();

    let request: TransformRequest | undefined = undefined;
    while ((request = queue.pop()) !== undefined) {
      if (seen.has(request.filePath)) continue;
      seen.add(request.filePath);

      let transformed = false;
      outer: for (let i = 0; i < this.#transformers.length; i++) {
        const transformer = this.#transformers[i];

        const { options, fn } = transformer;
        options.filter.lastIndex = 0;
        if (!options.filter.test(request.filePath)) {
          continue;
        }

        // Check if file is excluded
        if (options.exclude !== undefined) {
          for (let j = 0; j < options.exclude.length; j++) {
            const exclude = options.exclude[j];
            if (exclude instanceof RegExp) {
              if (exclude.test(filePath)) {
                continue outer;
              }
            } else if (isGlob(exclude)) {
              const regex = globToRegExp(exclude);
              if (regex.test(filePath)) {
                continue outer;
              }
            } else if (filePath.includes(exclude)) {
              continue outer;
            }
          }
        }

        const result = await fn({
          path: request.filePath,
          mode,
          target,
          content: request!.content,
          root: this.#root,
          get text() {
            return new TextDecoder().decode(request!.content);
          },
        });

        if (result !== undefined) {
          if (Array.isArray(result)) {
            for (let i = 0; i < result.length; i++) {
              const item = result[i];
              if (item.path === undefined) {
                throw new Error(
                  `The ".path" property must be set when returning multiple files in a transformer. [${transformer.options.pluginName}]`,
                );
              }

              const outContent = typeof item.content === "string"
                ? new TextEncoder().encode(item.content)
                : item.content;

              const outMap = item.map !== undefined
                ? typeof item.map === "string"
                  ? new TextEncoder().encode(item.map)
                  : item.map
                : null;

              if (request.filePath === item.path) {
                if (request.content === outContent && request.map === outMap) {
                  continue;
                }

                transformed = true;
                request.content = outContent;
                request.map = outMap;
              } else {
                let found = false;
                for (let i = 0; i < queue.length; i++) {
                  const request = queue[i];
                  if (request.filePath === item.path) {
                    found = true;
                    transformed = true;
                    request.content = outContent;
                    request.map = outMap;
                  }
                }

                if (!found) {
                  queue.push({
                    newFile: true,
                    filePath: item.path,
                    content: outContent,
                    map: outMap,
                    inputFiles: request.inputFiles.slice(),
                  });
                }
              }
            }
          } else {
            const outContent = typeof result.content === "string"
              ? new TextEncoder().encode(result.content)
              : result.content;

            const outMap = result.map !== undefined
              ? typeof result.map === "string"
                ? new TextEncoder().encode(result.map)
                : result.map
              : null;

            if (request.content === outContent && request.map === outMap) {
              continue;
            }

            transformed = true;
            request.content = outContent;
            request.map = outMap;
            request.filePath = result.path ?? request.filePath;
          }
        }
      }

      // TODO: Keep transforming until no one processes anymore
      if (transformed || request.newFile) {
        outFiles.push({
          content: request.content,
          map: request.map,
          path: request.filePath,
          inputFiles: request.inputFiles,
        });
      }
    }

    return outFiles.length > 0 ? outFiles : null;
  }
}

const CSS_URL_REGEX = /url\(("[^"]+"|'[^']+'|[^)]+)\)/g;

export function cssAssetHash(transformer: FileTransformer) {
  transformer.onTransform({
    pluginName: "fresh-css",
    filter: /\.css$/,
  }, (args) => {
    const replaced = args.text.replaceAll(CSS_URL_REGEX, (_, str) => {
      let rawUrl = str;
      if (str[0] === "'" || str[0] === '"') {
        rawUrl = str.slice(1, -1);
      }

      if (rawUrl.length === 0) {
        return str;
      }

      return `url(${JSON.stringify(assetInternal(rawUrl, BUILD_ID))})`;
    });

    return {
      content: replaced,
    };
  });
}
