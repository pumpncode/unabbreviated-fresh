import { runMiddlewares } from "./mod.ts";
import { expect } from "@std/expect";
import { serveMiddleware } from "../test_utils.ts";
import type { MiddlewareFn } from "./mod.ts";
import type { Lazy, MaybeLazy } from "../types.ts";

Deno.test("runMiddleware", async () => {
  const middlewares: MiddlewareFn<{ text: string }>[] = [
    (context) => {
      context.state.text = "A";
      return context.next();
    },
    (context) => {
      context.state.text += "B";
      return context.next();
    },
    async (context) => {
      const res = await context.next();
      context.state.text += "C"; // This should not show up
      return res;
    },
    (context) => {
      return new Response(context.state.text);
    },
  ];

  const server = serveMiddleware<{ text: string }>((context) =>
    runMiddlewares(middlewares, context)
  );

  const res = await server.get("/");
  expect(await res.text()).toEqual("AB");
});

Deno.test("runMiddleware - middlewares should only be called once", async () => {
  const A: MiddlewareFn<{ count: number }> = (context) => {
    if (context.state.count === undefined) {
      context.state.count = 0;
    } else {
      context.state.count++;
    }
    return context.next();
  };

  const server = serveMiddleware<{ count: number }>((context) =>
    runMiddlewares(
      [A, (context) => new Response(String(context.state.count))],
      context,
    )
  );

  const res = await server.get("/");
  expect(await res.text()).toEqual("0");
});

Deno.test("runMiddleware - runs multiple stacks", async () => {
  type State = { text: string };
  const A: MiddlewareFn<State> = (context) => {
    context.state.text += "A";
    return context.next();
  };
  const B: MiddlewareFn<State> = (context) => {
    context.state.text += "B";
    return context.next();
  };
  const C: MiddlewareFn<State> = (context) => {
    context.state.text += "C";
    return context.next();
  };
  const D: MiddlewareFn<State> = (context) => {
    context.state.text += "D";
    return context.next();
  };

  const server = serveMiddleware<State>((context) => {
    context.state.text = "";
    return runMiddlewares(
      [
        A,
        B,
        C,
        D,
        (context) => new Response(String(context.state.text)),
      ],
      context,
    );
  });

  const res = await server.get("/");
  expect(await res.text()).toEqual("ABCD");
});

Deno.test("runMiddleware - throws errors", async () => {
  let thrownA: unknown = null;
  let thrownB: unknown = null;
  let thrownC: unknown = null;

  const middlewares: MiddlewareFn<{ text: string }>[] = [
    async (context) => {
      try {
        return await context.next();
      } catch (err) {
        thrownA = err;
        throw err;
      }
    },
    async (context) => {
      try {
        return await context.next();
      } catch (err) {
        thrownB = err;
        throw err;
      }
    },
    async (context) => {
      try {
        return await context.next();
      } catch (err) {
        thrownC = err;
        throw err;
      }
    },
    () => {
      throw new Error("fail");
    },
  ];

  const server = serveMiddleware<{ text: string }>((context) =>
    runMiddlewares(middlewares, context)
  );

  try {
    await server.get("/");
  } catch {
    // ignore
  }
  expect(thrownA).toBeInstanceOf(Error);
  expect(thrownB).toBeInstanceOf(Error);
  expect(thrownC).toBeInstanceOf(Error);
});

Deno.test("runMiddleware - lazy middlewares", async () => {
  type State = { text: string };

  let called = 0;
  // deno-lint-ignore require-await
  const lazy: Lazy<MiddlewareFn<State>> = async () => {
    called++;
    return (context) => {
      context.state.text += "_lazy";
      return context.next();
    };
  };

  const middlewares: MaybeLazy<MiddlewareFn<State>>[] = [
    async (context) => {
      context.state.text = "A";
      return await context.next();
    },
    lazy,
    (context) => {
      context.state.text += "_B";
      return new Response(context.state.text);
    },
  ];

  const server = serveMiddleware<{ text: string }>((context) =>
    runMiddlewares(middlewares, context)
  );

  let res = await server.get("/");
  expect(await res.text()).toEqual("A_lazy_B");
  expect(called).toEqual(1);

  // Lazy middlewares should only be initialized ones
  res = await server.get("/");
  expect(await res.text()).toEqual("A_lazy_B");
  expect(called).toEqual(1);
});
