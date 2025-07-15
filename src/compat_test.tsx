import type { PageProps } from "./render.ts";
import { assertType, type IsExact } from "@std/testing/types";
import { expect } from "@std/expect";
import { type defineApp, type defineLayout, defineRoute } from "./compat.ts";

Deno.test("compat - defineFn works", () => {
  const context = {} as PageProps<unknown>;
  expect(defineRoute(() => new Response("test"))(context)).toBeInstanceOf(
    Response,
  );
  expect(defineRoute(() => <span>test</span>)(context)).toBeInstanceOf(Object);
  expect(defineRoute(() => null)(context)).toEqual(null);
});

Deno.test("compat - functions equivalent", () => {
  assertType<IsExact<typeof defineApp, typeof defineRoute>>(true);
  assertType<IsExact<typeof defineRoute, typeof defineLayout>>(true);
});
