/** `/llms.txt`: the site summary for AI assistants (see `src/lib/llms.ts`). */
import type { APIRoute } from "astro";
import { getEmDashCollection } from "emdash";

import { getHomePage, getProjects } from "@/lib/content";
import { llmsText } from "@/lib/llms";

import { site } from "../../site.config";

/** CMS pages served from their own routes, at the path the sitemap uses. */
const pagePath = (slug: string): string => `/${slug}`;

const llmsRoute: APIRoute = async (context) => {
  const origin = context.site?.origin ?? context.url.origin;
  const [home, pages, projects] = await Promise.all([
    getHomePage(),
    getEmDashCollection("pages"),
    getProjects(),
  ]);
  const { address, areaServed, email, license } = site.business;
  const body = llmsText({
    description: site.description,
    facts: [
      `Founded ${site.founded}, based in ${address.city}, ${address.region}`,
      `Address: ${address.street}, ${address.city}, ${address.region} ${address.postalCode}`,
      `Phone: ${site.phone}`,
      ...(email === undefined ? [] : [`Email: ${email}`]),
      `Serves: ${areaServed.join("; ")}`,
      license,
      `Start a project: ${origin}/contact`,
    ],
    name: site.name,
    origin,
    pages: [
      ...(home.entry
        ? [
            {
              path: "/",
              summary: home.entry.data.intro,
              title: home.entry.data.title,
            },
          ]
        : []),
      ...pages.entries.map((page) => ({
        path: pagePath(page.id),
        summary: page.data.intro,
        title: page.data.title,
      })),
    ],
    projects: projects.entries.map((project) => ({
      location: project.data.location,
      path: `/projects/${project.id}`,
      summary: project.data.summary,
      title: project.data.title,
      type: project.data.project_type,
    })),
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};

export const GET = llmsRoute;
