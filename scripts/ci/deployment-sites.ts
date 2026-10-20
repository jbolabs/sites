/** Main releases always ship staging; production additionally requires a domain. */
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Schema } from "effect";

const DeploymentSite = Schema.Struct({
  domain: Schema.NullOr(Schema.NonEmptyString),
  id: Schema.NonEmptyString,
  stagingBaseDomain: Schema.NonEmptyString,
  workersSubdomain: Schema.NonEmptyString,
});
export type DeploymentSite = Schema.Schema.Type<typeof DeploymentSite>;

export const loadDeploymentSites = async (
  root: string,
  names: readonly string[]
): Promise<readonly DeploymentSite[]> =>
  await Promise.all(
    names.map(async (name) => {
      if (!/^[a-z][a-z0-9-]*$/u.test(name)) {
        throw new Error(`Invalid site name "${name}"`);
      }
      const config: unknown = await import(
        pathToFileURL(path.join(root, "apps", name, "site.config.ts")).href
      );
      const { site } = Schema.decodeUnknownSync(
        Schema.Struct({ site: DeploymentSite })
      )(config);
      if (site.id !== name) {
        throw new Error(`Site directory ${name} does not match id ${site.id}`);
      }
      return site;
    })
  );

export const deploymentSites = (
  sites: readonly DeploymentSite[],
  stage: string,
  destroy = false
): readonly string[] =>
  sites
    // Cleanup must still find old PR stages after a site's domain is removed.
    .filter((site) => destroy || stage !== "prod" || site.domain !== null)
    .map((site) => site.id);
