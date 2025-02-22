import type { FreshContext, FreshRequestContext } from "../context.ts";
import type { App as _App } from "../app.ts";
import type { Define as _Define } from "../define.ts";

/**
 * A middleware function is the basic building block of Fresh. It allows you
 * to respond to an incoming request in any way you want. You can redirect
 * routes, serve files, create APIs and much more. Middlewares can be chained by
 * calling {@linkcode FreshContext.next|context.next()} inside of the function.
 *
 * Middlewares can be synchronous or asynchronous. If a middleware returns a
 * {@linkcode Response} object, the response will be sent back to the client. If
 * a middleware returns a `Promise<Response>`, Fresh will wait for the promise
 * to resolve before sending the response.
 *
 * A {@linkcode FreshContext} object is passed to the middleware function. This
 * object contains the original request object, as well as any state related to
 * the current request. The context object also contains methods to redirect
 * the client to another URL, or to call the next middleware in the chain.
 *
 * Middlewares can be defined as a single function or an array of functions.
 * When an array of middlewares is passed to
 * {@linkcode _App.prototype.use|app.use}, Fresh will call each middleware in the
 * order they are defined.
 *
 * Middlewares can also be defined using the
 * {@linkcode _Define.middleware|define.middleware} method. This
 * method is optional, but it can be useful for type checking and code
 * completion. It does not register the middleware with the app.
 *
 * ## Examples
 *
 * ### Logging middleware
 *
 * This example shows how to create a simple middleware that logs incoming
 * requests.
 *
 * ```ts
 * // Define a middleware function that logs incoming requests. Using the
 * // `define.middleware` method is optional, but it can be useful for type
 * // checking and code completion. It does not register the middleware with the
 * // app.
 * const loggerMiddleware = define.middleware((context) => {
 *   console.log(`${context.request.method} ${context.request.url}`);
 *   // Call the next middleware
 *   return context.next();
 * });
 *
 * // To register the middleware to the app, use `app.use`.
 * app.use(loggerMiddleware)
 * ```
 *
 * ### Redirect middleware
 *
 * This example shows how to create a middleware that redirects requests from
 * one URL to another.
 *
 * ```ts
 * // Any request to a URL that starts with "/legacy/" will be redirected to
 * // "/modern".
 * const redirectMiddleware = define.middleware((context) => {
 *   if (context.url.pathname.startsWith("/legacy/")) {
 *     return context.redirect("/modern");
 *   }
 *
 *   // Otherwise call the next middleware
 *   return context.next();
 * });
 *
 * // Again, register the middleware with the app.
 * app.use(redirectMiddleware);
 * ```
 */
export type MiddlewareFn<State> = (
  context: FreshContext<State>,
) => Response | Promise<Response>;

/**
 * A single middleware function, or an array of middleware functions. For
 * further information, see {@link MiddlewareFn}.
 */
export type Middleware<State> = MiddlewareFn<State> | MiddlewareFn<State>[];

export function runMiddlewares<State>(
  middlewares: MiddlewareFn<State>[][],
  context: FreshRequestContext<State>,
): Promise<Response> {
  let fn = context.next;
  let i = middlewares.length;
  while (i--) {
    const stack = middlewares[i];
    let j = stack.length;
    while (j--) {
      const local = fn;
      const next = stack[j];
      fn = async () => {
        context.next = local;
        try {
          return await next(context);
        } catch (err) {
          context.error = err;
          throw err;
        }
      };
    }
  }
  return fn();
}
