import type { FreshContext } from "fresh";

const REDIRECTS: Record<string, string> = {
  "/docs/getting-started/fetching-data":
    "/docs/getting-started/custom-handlers",
};

export async function handler(
  context: FreshContext,
) {
  // Redirect from old doc URLs to new ones
  const redirect = REDIRECTS[context.url.pathname];
  if (redirect) {
    const url = new URL(redirect, context.url.origin);
    return new Response("", {
      status: 307,
      headers: { location: url.href },
    });
  }

  return await context.next();
}
