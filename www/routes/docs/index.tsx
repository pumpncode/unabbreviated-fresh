import type { Handlers } from "fresh/compat";

export const handler: Handlers<void> = {
  GET(context) {
    const slug = context.params.slug;

    if (slug === "concepts/architechture") {
      return new Response("", {
        status: 307,
        headers: { location: "/docs/concepts/architecture" },
      });
    }

    return new Response("", {
      status: 307,
      headers: { location: "/docs/introduction" },
    });
  },
};
