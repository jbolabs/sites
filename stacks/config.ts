/**
 * Repository-level facts the control-plane stacks share. Not secrets:
 * account and repository identifiers are visible to anyone with access.
 */
export const repository = {
  /** Cloudflare account that hosts every site in this repo. */
  accountId: "984b82870acd18daf8bda97bad966b38",
  owner: "jbolabs",
  repository: "sites",
} as const;

/**
 * Infisical, one project per trust tier (docs/stack.md "Secrets"). Not secrets:
 * ids only. `stageSecrets()` in cloudflare-kit maps each stage to a project.
 */
export const infisical = {
  /** GitHub OIDC audience the `ci-prod` identity trusts. */
  ciOidcAudience: "https://github.com/jbolabs",
  /** `ci-prod`: reads `*-prod` projects from GitHub Actions on `main` (OIDC). */
  ciProdIdentityId: "23fa16cc-a7a1-4e35-8011-2f24b0e037ba",
  projects: {
    /** `sites-dev`, env `dev`: agents (`agent-dev`) and local stages. */
    dev: "49d82a92-1821-44d4-bb5f-4252b411eadb",
    /** `sites-prod`, envs `preview` and `prod`: CI on `main` and the operator only. */
    prod: "cb46a5eb-7afc-4e8a-93b7-40a065c6d6c9",
  },
} as const;

/**
 * Deploy tokens are minted per generation. Bump `generation` to rotate: the
 * next `ci` deploy mints fresh tokens, writes them to GitHub, and deletes the
 * previous generation. Rotate before `expiresOn`.
 */
export const deployTokens = {
  expiresOn: "2027-10-05T23:59:59Z",
  generation: 1,
} as const;

/**
 * The studio domain (bought 2026-10-06, managed by `stacks/studio.ts` in the
 * jbolabs repo, which also runs the Mailflare inbox at inbox.jbolabs.com). Every
 * site sends lead notifications and alerts from `sender`, and alerts go to
 * `alertInbox`, which lands in that Mailflare inbox.
 */
export const studio = {
  alertInbox: "alerts@jbolabs.com",
  cmsOwnerEmail: "jakebodea@gmail.com",
  domain: "jbolabs.com",
  sender: "sites@mail.jbolabs.com",
  sendingSubdomain: "mail.jbolabs.com",
} as const;
