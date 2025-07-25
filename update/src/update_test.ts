import * as path from "@std/path";
import {
  FRESH_VERSION,
  PREACT_SIGNALS_VERSION,
  PREACT_VERSION,
  updateProject,
} from "./update.ts";
import { expect } from "@std/expect";
import { spy, type SpyCall } from "@std/testing/mock";
import { walk } from "@std/fs/walk";
import { withTmpDir, writeFiles } from "../../src/test_utils.ts";

async function readFiles(dir: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};

  for await (
    const entry of walk(dir, { includeDirs: false, includeFiles: true })
  ) {
    const pathname = path.relative(dir, entry.path);
    const content = await Deno.readTextFile(entry.path);
    files[`/${pathname.replaceAll(/[\\]+/g, "/")}`] = content.trim();
  }

  return files;
}

Deno.test("update - remove JSX pragma import", async () => {
  await using _tmp = await withTmpDir();
  const dir = _tmp.dir;
  await writeFiles(dir, {
    "/deno.json": `{}`,
    "/routes/index.tsx": `import { h, Fragment } from "preact";
/** @jsx h */
/** @jsxFrag Fragment */
export default function Foo() {
  return null;
}`,
  });

  await updateProject(dir);
  const files = await readFiles(dir);

  expect(files["/routes/index.tsx"])
    .toEqual(`export default function Foo() {
  return null;
}`);
});

Deno.test("update - 1.x project deno.json", async () => {
  await using _tmp = await withTmpDir();
  const dir = _tmp.dir;
  await writeFiles(dir, {
    "/deno.json": `{}`,
  });

  await updateProject(dir);
  const files = await readFiles(dir);

  expect(JSON.parse(files["/deno.json"]))
    .toEqual({
      imports: {
        "fresh": `jsr:@unabbreviated-fresh/core@^${FRESH_VERSION}`,
        "@preact/signals": `npm:@preact/signals@^${PREACT_SIGNALS_VERSION}`,
        "preact": `npm:preact@^${PREACT_VERSION}`,
      },
    });
});

Deno.test("update - 1.x project deno.json with imports", async () => {
  await using _tmp = await withTmpDir();
  const dir = _tmp.dir;
  await writeFiles(dir, {
    "/deno.json": `{
        "imports": {
          "$fresh/": "foo"
        }
      }`,
  });

  await updateProject(dir);
  const files = await readFiles(dir);

  expect(JSON.parse(files["/deno.json"]))
    .toEqual({
      imports: {
        "fresh": `jsr:@unabbreviated-fresh/core@^${FRESH_VERSION}`,
        "@preact/signals": `npm:@preact/signals@^${PREACT_SIGNALS_VERSION}`,
        "preact": `npm:preact@^${PREACT_VERSION}`,
      },
    });
});

Deno.test("update - 1.x project deno.json tasks + lock", async () => {
  await using tmp = await withTmpDir();
  await writeFiles(tmp.dir, {
    "/deno.json": `{
      "lock": false,
      "tasks": {
        "check": "deno fmt --check && deno lint && deno check **/*.ts && deno check **/*.tsx",
        "cli": "echo \\"import '$fresh/src/dev/cli.ts'\\" | deno run --unstable -A -",
        "manifest": "deno task cli manifest $(pwd)",
        "start": "deno run -A --watch=static/,routes/ dev.ts",
        "build": "deno run -A dev.ts build",
        "preview": "deno run -A main.ts",
        "update": "deno run -A -r https://fresh.deno.dev/update ."
      }
    }`,
  });

  await updateProject(tmp.dir);
  const files = await readFiles(tmp.dir);

  const updated = JSON.parse(files["/deno.json"]);
  expect(updated.lock).toEqual(undefined);
  expect(updated.tasks)
    .toEqual({
      build: "deno run -A dev.ts build",
      check: "deno fmt --check && deno lint && deno check",
      preview: "deno serve -A _fresh/server.js",
      start: "deno run -A --watch=static/,routes/ dev.ts",
      update: "deno run -A -r jsr:@unabbreviated-fresh/update .",
    });
});

Deno.test("update - 1.x project middlewares", async () => {
  await using _tmp = await withTmpDir();
  const dir = _tmp.dir;
  await writeFiles(dir, {
    "/deno.json": "{}",
    "/routes/_middleware.ts": `import { FreshContext } from "$fresh/server.ts";

interface State {
  data: string;
}

export async function handler(
  request: Request,
  context: FreshContext<State>,
) {
  context.state.data = "myData";
  context.state.url = request.url;
  const resp = await context.next();
  resp.headers.set("server", "fresh server");
  return resp;
}`,
  });

  await updateProject(dir);
  const files = await readFiles(dir);

  expect(files["/routes/_middleware.ts"])
    .toEqual(`import { FreshContext } from "fresh";

interface State {
  data: string;
}

export async function handler(
  context: FreshContext<State>,
) {
  const request = context.request;

  context.state.data = "myData";
  context.state.url = request.url;
  const resp = await context.next();
  resp.headers.set("server", "fresh server");
  return resp;
}`);
});

Deno.test("update - 1.x project middlewares one arg", async () => {
  await using _tmp = await withTmpDir();
  const dir = _tmp.dir;
  await writeFiles(dir, {
    "/deno.json": "{}",
    "/routes/_middleware.ts": `export async function handler(request: Request) {
  return new Response("hello world from: " + request.url);
}`,
  });

  await updateProject(dir);
  const files = await readFiles(dir);

  expect(files["/routes/_middleware.ts"])
    .toEqual(`import { FreshContext } from "fresh";

export async function handler(context: FreshContext) {
  const request = context.request;

  return new Response("hello world from: " + request.url);
}`);
});

Deno.test("update - 1.x update '$fresh/*' imports", async () => {
  await using _tmp = await withTmpDir();
  const dir = _tmp.dir;
  await writeFiles(dir, {
    "/deno.json": `{}`,
    "/routes/index.tsx": `import { PageProps } from "$fresh/server.ts";
export default function Foo(props: PageProps) {
  return null;
}`,
    "/routes/foo.tsx": `import { asset, Head } from "$fresh/runtime.ts";`,
  });

  await updateProject(dir);
  const files = await readFiles(dir);

  expect(files["/routes/index.tsx"])
    .toEqual(`import { PageProps } from "fresh";
export default function Foo(props: PageProps) {
  return null;
}`);
  expect(files["/routes/foo.tsx"])
    .toEqual(`import { asset, Head } from "fresh/runtime";`);
});

Deno.test("update - 1.x update handler signature", async () => {
  await using _tmp = await withTmpDir();
  const dir = _tmp.dir;
  await writeFiles(dir, {
    "/deno.json": `{}`,
    "/routes/index.tsx": `import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  async GET(request, context) {},
  async POST(request, context) {},
  async PATCH(request, context) {},
  async PUT(request, context) {},
  async DELETE(request, context) {},
};`,
    "/routes/foo.tsx": `import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  async GET(_request, context) {},
  async POST(_request, context) {},
  async PATCH(_request, context) {},
  async PUT(_request, context) {},
  async DELETE(_request, context) {},
};`,
    "/routes/name.tsx": `import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  async GET(request, context) {},
  async POST(request, context) {},
  async PATCH(request, context) {},
  async PUT(request, context) {},
  async DELETE(request, context) {},
};`,
    "/routes/name-unused.tsx": `import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  async GET(_request, context) {},
  async POST(_request, context) {},
  async PATCH(_request, context) {},
  async PUT(_request, context) {},
  async DELETE(_request, context) {},
};`,
  });

  await updateProject(dir);
  const files = await readFiles(dir);

  expect(files["/routes/index.tsx"])
    .toEqual(`import { Handlers } from "fresh/compat";

export const handler: Handlers = {
  async GET(context) {
    const request = context.request;
  },
  async POST(context) {
    const request = context.request;
  },
  async PATCH(context) {
    const request = context.request;
  },
  async PUT(context) {
    const request = context.request;
  },
  async DELETE(context) {
    const request = context.request;
  },
};`);
  expect(files["/routes/foo.tsx"])
    .toEqual(`import { Handlers } from "fresh/compat";

export const handler: Handlers = {
  async GET(context) {},
  async POST(context) {},
  async PATCH(context) {},
  async PUT(context) {},
  async DELETE(context) {},
};`);

  expect(files["/routes/name.tsx"])
    .toEqual(`import { Handlers } from "fresh/compat";

export const handler: Handlers = {
  async GET(context) {
    const request = context.request;
  },
  async POST(context) {
    const request = context.request;
  },
  async PATCH(context) {
    const request = context.request;
  },
  async PUT(context) {
    const request = context.request;
  },
  async DELETE(context) {
    const request = context.request;
  },
};`);
  expect(files["/routes/name-unused.tsx"])
    .toEqual(`import { Handlers } from "fresh/compat";

export const handler: Handlers = {
  async GET(context) {},
  async POST(context) {},
  async PATCH(context) {},
  async PUT(context) {},
  async DELETE(context) {},
};`);
});

Deno.test(
  "update - 1.x update handler signature method one arg",
  async () => {
    await using _tmp = await withTmpDir();
    const dir = _tmp.dir;
    await writeFiles(dir, {
      "/deno.json": `{}`,
      "/routes/index.tsx": `export const handler: Handlers = {
  GET(request) {
    return Response.redirect(request.url);
  },
};`,
    });
    await updateProject(dir);
    const files = await readFiles(dir);
    expect(files["/routes/index.tsx"])
      .toEqual(`export const handler: Handlers = {
  GET(context) {
    const request = context.request;

    return Response.redirect(request.url);
  },
};`);
  },
);

Deno.test.ignore(
  "update - 1.x update handler signature variable",
  async () => {
    await using _tmp = await withTmpDir();
    const dir = _tmp.dir;
    await writeFiles(dir, {
      "/deno.json": `{}`,
      "/routes/index.tsx": `export const handler: Handlers = {
  GET: (request) => Response.redirect(request.url)
};`,
      "/routes/foo.tsx": `export const handler: Handlers = {
  GET: (request, context) => Response.redirect(request.url),
};`,
    });
    await updateProject(dir);
    const files = await readFiles(dir);
    expect(files["/routes/index.tsx"])
      .toEqual(`export const handler: Handlers = {
  GET: (context) => {
    const request = context.request;

    return Response.redirect(request.url);
  },
};`);
    expect(files["/routes/foo.tsx"])
      .toEqual(`export const handler: Handlers = {
  GET: (context) => {
    const request = context.request;

    return Response.redirect(request.url);
  },
};`);
  },
);

Deno.test(
  "update - 1.x update handler signature non-inferred",
  async () => {
    await using _tmp = await withTmpDir();
    const dir = _tmp.dir;
    await writeFiles(dir, {
      "/deno.json": `{}`,
      "/routes/index.tsx": `export const handler = {
  GET(request: Request){
    return Response.redirect(request.url);
  }
};`,
    });
    await updateProject(dir);
    const files = await readFiles(dir);
    expect(files["/routes/index.tsx"])
      .toEqual(`import { FreshContext } from "fresh";

export const handler = {
  GET(context: FreshContext) {
    const request = context.request;

    return Response.redirect(request.url);
  },
};`);
  },
);

Deno.test(
  "update - 1.x update handler signature with destructure",
  async () => {
    await using _tmp = await withTmpDir();
    const dir = _tmp.dir;
    await writeFiles(dir, {
      "/deno.json": `{}`,
      "/routes/index.tsx": `import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  async GET(request, { params, render, remoteAddr }) {},
  async POST(request, { params, render, remoteAddr }) {},
  async PATCH(request, { params, render, remoteAddr }) {},
  async PUT(request, { params, render, remoteAddr }) {},
  async DELETE(request, { params, render, remoteAddr }) {},
};`,
    });
    await updateProject(dir);
    const files = await readFiles(dir);
    expect(files["/routes/index.tsx"])
      .toEqual(`import { Handlers } from "fresh/compat";

export const handler: Handlers = {
  async GET({ params, render, info, request }) {
    const remoteAddr = info.remoteAddr;
  },
  async POST({ params, render, info, request }) {
    const remoteAddr = info.remoteAddr;
  },
  async PATCH({ params, render, info, request }) {
    const remoteAddr = info.remoteAddr;
  },
  async PUT({ params, render, info, request }) {
    const remoteAddr = info.remoteAddr;
  },
  async DELETE({ params, render, info, request }) {
    const remoteAddr = info.remoteAddr;
  },
};`);
  },
);

Deno.test("update - 1.x update define* handler signatures", async () => {
  await using _tmp = await withTmpDir();
  const dir = _tmp.dir;
  await writeFiles(dir, {
    "/deno.json": `{}`,
    "/routes/_app.tsx": `import { defineApp } from "$fresh/server.ts";
export default defineApp(async (request, context) => {
  return null;
});`,
    "/routes/_layout.tsx": `import { defineLayout } from "$fresh/server.ts";
export default defineLayout(async (request, context) => {
  return null;
});`,
    "/routes/foo.tsx": `import { defineRoute } from "$fresh/server.ts";
export default defineRoute(async (request, context) => {
  return null;
});`,
  });

  await updateProject(dir);
  const files = await readFiles(dir);

  expect(files["/routes/_app.tsx"])
    .toEqual(`import { defineApp } from "fresh/compat";

export default defineApp(async (context) => {
  const request = context.request;

  return null;
});`);
  expect(files["/routes/_layout.tsx"])
    .toEqual(`import { defineLayout } from "fresh/compat";

export default defineLayout(async (context) => {
  const request = context.request;

  return null;
});`);
  expect(files["/routes/foo.tsx"])
    .toEqual(`import { defineRoute } from "fresh/compat";

export default defineRoute(async (context) => {
  const request = context.request;

  return null;
});`);
});

Deno.test(
  "update - 1.x update component signature async",
  async () => {
    await using _tmp = await withTmpDir();
    const dir = _tmp.dir;
    await writeFiles(dir, {
      "/deno.json": `{}`,
      "/routes/index.tsx":
        `export default async function Index(request: Request, context: RouteContext) {
  if (true) {
    return context.renderNotFound();
  }
  if ("foo" === "foo" as any) {
    context.renderNotFound();
    return context.renderNotFound();
  }
  return new Response(request.url);
}`,
    });
    await updateProject(dir);
    const files = await readFiles(dir);
    expect(files["/routes/index.tsx"])
      .toEqual(`import { FreshContext } from "fresh";
import { HttpError } from "fresh";

export default async function Index(context: FreshContext) {
  const request = context.request;

  if (true) {
    throw new HttpError(404);
  }
  if ("foo" === "foo" as any) {
    throw new HttpError(404);
    throw new HttpError(404);
  }
  return new Response(request.url);
}`);
  },
);

Deno.test.ignore(
  "update - 1.x context.renderNotFound() -> throw new HttpError(404)",
  async () => {
    await using _tmp = await withTmpDir();
    const dir = _tmp.dir;
    await writeFiles(dir, {
      "/deno.json": `{}`,
      "/routes/index.tsx": `import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  async GET(_request, context) {
    return context.renderNotFound();
  },
};`,
      "/routes/foo.tsx": `export const handler = (context) => {
  return context.renderNotFound();
}`,
    });

    await updateProject(dir);
    const files = await readFiles(dir);

    expect(files["/routes/index.tsx"])
      .toEqual(`import { Handlers } from "fresh";

export const handler: Handlers = {
  async GET(context) {
    throw HttpError(404);
  },
};`);

    expect(files["/routes/foo.tsx"])
      .toEqual(`export const handler = (context) => {
  throw HttpError(404);
};`);
  },
);

Deno.test.ignore(
  "update - 1.x context.remoteAddr -> context.info.remoteAddr",
  async () => {
    await using _tmp = await withTmpDir();
    const dir = _tmp.dir;
    await writeFiles(dir, {
      "/deno.json": `{}`,
      "/routes/index.tsx": `import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  async GET(_request, context) {
    let msg = context.remoteAddr.transport === "tcp" ? "ok" : "not ok";
    msg += typeof context.renderNotFound === "function";
    return new Response(msg);
  },
};`,
    });

    await updateProject(dir);
    const files = await readFiles(dir);

    expect(files["/routes/index.tsx"])
      .toEqual(`import { Handlers } from "fresh";

export const handler: Handlers = {
  async GET(context) {
    let msg = context.info.remoteAddr.transport === "tcp" ? "ok" : "not ok";
    msg += typeof context.throw === "function";
    return new Response(msg);
  },
};`);
  },
);

Deno.test.ignore("update - 1.x destructured context members", async () => {
  await using _tmp = await withTmpDir();
  const dir = _tmp.dir;
  await writeFiles(dir, {
    "/deno.json": `{}`,
    "/routes/index.tsx": `import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  async GET(_request, { url, renderNotFound, remoteAddr }) {
    if (true) {
      return new Response(!!remoteAddr ? "ok" : "not ok");
    } else {
      console.log(url.href);
      return renderNotFound();
    }
  },
};`,
  });

  await updateProject(dir);
  const files = await readFiles(dir);

  expect(files["/routes/index.tsx"])
    .toEqual(`import { Handlers } from "fresh";

export const handler: Handlers = {
  async GET({ url, throw, info }) {
    const renderNotFound = () => throw(404);
    const remoteAddr = info.remoteAddr;

    if (true) {
      return new Response(!!remoteAddr ? "ok" : "not ok");
    } else {
      console.log(url.href);
      return renderNotFound();
    }
  },
};`);
});

Deno.test("update - 1.x remove reference comments", async () => {
  await using _tmp = await withTmpDir();
  const dir = _tmp.dir;
  await writeFiles(dir, {
    "/deno.json": `{}`,
    "/routes/main.ts": `/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="dom.iterable" />
/// <reference lib="dom.asynciterable" />
/// <reference lib="deno.ns" />
`,
  });

  await updateProject(dir);
  const files = await readFiles(dir);

  expect(files["/routes/main.ts"]).toEqual("");
});

Deno.test("update - island files", async () => {
  await using _tmp = await withTmpDir();
  const dir = _tmp.dir;
  await writeFiles(dir, {
    "/deno.json": `{}`,
    "/islands/foo.tsx": `import { IS_BROWSER } from "$fresh/runtime.ts";`,
  });

  await updateProject(dir);
  const files = await readFiles(dir);

  expect(files["/islands/foo.tsx"]).toEqual(
    `import { IS_BROWSER } from "fresh/runtime";`,
  );
});

Deno.test("update - ignores node_modules and vendor in logs", async () => {
  await using _tmp = await withTmpDir();
  const dir = _tmp.dir;
  await writeFiles(dir, {
    "/deno.json": `{}`,
    "/routes/index.tsx": `import { PageProps } from "$fresh/server.ts";
export default function Foo(props: PageProps) {
  return null;
}`,
    "/node_modules/foo/bar.ts":
      `import { IS_BROWSER } from "$fresh/runtime.ts";`,
    "/vendor/foo/bar.ts": `import { IS_BROWSER } from "$fresh/runtime.ts";`,
  });

  const consoleLogSpy = spy(console, "log");

  try {
    await updateProject(dir);
  } finally {
    consoleLogSpy.restore();
  }

  const files = await readFiles(dir);

  expect(files["/node_modules/foo/bar.ts"]).toEqual(
    `import { IS_BROWSER } from "fresh/runtime";`,
  );
  expect(files["/vendor/foo/bar.ts"]).toEqual(
    `import { IS_BROWSER } from "fresh/runtime";`,
  );
  expect(files["/routes/index.tsx"]).toEqual(
    `import { PageProps } from "fresh";
export default function Foo(props: PageProps) {
  return null;
}`,
  );

  const fullLog = consoleLogSpy.calls.map((call: SpyCall) =>
    call.args.join(" ")
  ).join(
    "\n",
  );

  expect(fullLog).toMatch(/Total files processed: 1/);
  expect(fullLog).toMatch(/Successfully modified: 1/);
  expect(fullLog).toMatch(/Unmodified \(no changes needed\): 0/);
  expect(fullLog).not.toMatch(/node_modules/);
  expect(fullLog).not.toMatch(/vendor/);
  expect(fullLog).toMatch(/✓ routes\/index.tsx/);
});
