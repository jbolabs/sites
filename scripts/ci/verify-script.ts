/** The `verify:ci` script every site package runs (see `verify-ci.ts`). */
export const siteVerifyScript = (site: string): string =>
  `node ../../scripts/ci/local-verify.ts --cached-task --sites '${JSON.stringify([site])}'`;
