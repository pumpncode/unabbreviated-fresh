import { asset } from "fresh/runtime";
import { page } from "fresh";
import Projects, { type Project } from "../components/Projects.tsx";
import Header from "../components/Header.tsx";
import Footer from "../components/Footer.tsx";
import projects from "../data/showcase.json" with { type: "json" };
import { define } from "../utils/state.ts";

const TITLE = "Showcase | Fresh";
const DESCRIPTION = "Selection of projects that have been built with Fresh.";

export const handler = define.handlers({
  GET(context) {
    context.state.title = TITLE;
    context.state.description = DESCRIPTION;
    context.state.ogImage = new URL(asset("/og-image.webp"), context.url).href;
    return page();
  },
});

export default define.page<typeof handler>(function ShowcasePage() {
  return (
    <>
      <Header title="showcase" active="/showcase" />

      <div class="flex flex-col min-h-screen bg-white text-black">
        <div class="flex-1">
          <Showcase items={projects} />

          <section class="max-w-screen-lg mx-auto my-16 px-4 sm:px-6 md:px-8 space-y-4">
            <h2 class="text-3xl text-gray-600 font-bold">
              Badge
            </h2>

            <p class="text-gray-600">
              You can add these stylish badges to your project’s README to show
              that it was built with Fresh.
            </p>

            <img
              width="197"
              height="37"
              src="https://fresh.deno.dev/fresh-badge.svg"
              alt="Made with Fresh"
            />

            <img
              width="197"
              height="37"
              src="https://fresh.deno.dev/fresh-badge-dark.svg"
              alt="Made with Fresh"
            />

            <p>
              <a
                href="https://github.com/denoland/fresh#badges"
                class="text-blue-600 hover:underline focus:underline"
              >
                Usage instructions
              </a>
            </p>
          </section>

          <img
            src="/illustration/deno-plush.svg"
            alt="a deno plush is holding a lemon"
            class="mx-auto w-48 mt-16"
          />
        </div>

        <Footer />
      </div>
    </>
  );
});

function Showcase({ items }: { items: Project[] }) {
  return (
    <section class="max-w-screen-lg mx-auto my-16 px-4 sm:px-6 md:px-8 space-y-4">
      <h2 class="text-3xl text-foreground-primary font-bold ">
        Showcase
      </h2>
      <p class="text-foreground-secondary">
        Below is a selection of projects that have been built with Fresh.{" "}
        <a
          href="https://github.com/denoland/fresh/blob/main/www/data/showcase.json"
          class="text-blue-600 hover:underline"
        >
          Add yours!
        </a>
      </p>
      <Projects items={items} class="gap-16" />
    </section>
  );
}
