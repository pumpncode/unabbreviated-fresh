import type { Middleware } from "./mod.ts";

/**
 * Fresh middleware to force URLs to end with a slash or never end with one.
 *
 * ```ts
 * // Always add trailing slash
 * app.use(trailingSlashes("always"));
 * // Never add trailing slashes to URLs and remove them if present
 * app.use(trailingSlashes("never"));
 * ```
 */
export function trailingSlashes<State>(
  mode: "always" | "never",
): Middleware<State> {
  return function trailingSlashesMiddleware(context) {
    const url = context.url;
    if (url.pathname !== "/") {
      if (mode === "always" && !url.pathname.endsWith("/")) {
        return context.redirect(`${url.pathname}/${url.search}`);
      } else if (
        mode === "never" && url.pathname.endsWith("/")
      ) {
        return context.redirect(`${url.pathname.slice(0, -1)}${url.search}`);
      }
    }
    return context.next();
  };
}
