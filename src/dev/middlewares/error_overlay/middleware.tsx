import { DEV_ERROR_OVERLAY_URL } from "../../../constants.ts";
import { HttpError } from "../../../error.ts";
import type { Middleware } from "../../../middlewares/mod.ts";
import { FreshScripts } from "../../../runtime/server/preact_hooks.tsx";
import { ErrorOverlay } from "./overlay.tsx";

export function devErrorOverlay<T>(): Middleware<T> {
  return async (context) => {
    const { config, url } = context;
    if (url.pathname === config.basePath + DEV_ERROR_OVERLAY_URL) {
      return context.render(<ErrorOverlay url={url} />);
    }

    try {
      return await context.next();
    } catch (err) {
      if (context.request.headers.get("accept")?.includes("text/html")) {
        let init: ResponseInit | undefined;
        if (err instanceof HttpError) {
          if (err.status < 500) throw err;
          init = { status: err.status };
        }

        // At this point we're pretty sure to have a server error
        // deno-lint-ignore no-console
        console.error(err);

        return context.render(<FreshScripts />, init);
      }
      throw err;
    }
  };
}
