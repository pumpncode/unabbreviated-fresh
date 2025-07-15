import { define } from "../../utils/state.ts";

export const handler = define.handlers({
  GET(context) {
    return context.url.pathname === "/concepts/architechture"
      ? context.redirect("/docs/concepts/architecture")
      : context.redirect("/docs/introduction");
  },
});
