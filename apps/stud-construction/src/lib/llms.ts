/**
 * The site as an llms.txt (https://llmstxt.org): a short Markdown summary AI
 * assistants and answer engines read to learn who the business is and which
 * page answers what. Built from the same CMS entries and business facts as
 * the pages, so it never says anything the site doesn't.
 */
export interface LlmsPage {
  readonly title: string;
  readonly path: string;
  readonly summary?: string | null | undefined;
}

export interface LlmsProject extends LlmsPage {
  readonly type: string;
  readonly location?: string | null | undefined;
}

export interface LlmsInput {
  readonly name: string;
  readonly description: string;
  readonly origin: string;
  /** Plain facts, one line each: license, address, phone, email, service area. */
  readonly facts: readonly string[];
  readonly pages: readonly LlmsPage[];
  readonly projects: readonly LlmsProject[];
}

const oneLine = (text: string | null | undefined): string =>
  (text ?? "").replaceAll(/\s+/gu, " ").trim();

const entry = (
  origin: string,
  title: string,
  path: string,
  note: string
): string =>
  note === ""
    ? `- [${title}](${origin}${path})`
    : `- [${title}](${origin}${path}): ${note}`;

export const llmsText = (input: LlmsInput): string => {
  const pages = input.pages.map((page) =>
    entry(input.origin, page.title, page.path, oneLine(page.summary))
  );
  const projects = input.projects.map((project) => {
    const where = oneLine(project.location);
    const kind = where === "" ? project.type : `${project.type} in ${where}`;
    const summary = oneLine(project.summary);
    return entry(
      input.origin,
      project.title,
      project.path,
      summary === "" ? kind : `${kind}. ${summary}`
    );
  });
  return [
    `# ${input.name}`,
    "",
    `> ${oneLine(input.description)}`,
    "",
    ...input.facts.map((fact) => `- ${fact}`),
    "",
    "## Pages",
    "",
    ...pages,
    ...(projects.length === 0 ? [] : ["", "## Projects", "", ...projects]),
    "",
  ].join("\n");
};
