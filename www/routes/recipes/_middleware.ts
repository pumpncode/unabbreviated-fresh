import { define } from "../../utils/state.ts";

export const handler = define.middleware((context) => {
  context.state.noIndex = true;
  return context.next();
});
