import { OptionsRepository, UserRepository } from "emdash";
import { runMigrations } from "emdash/db";
import { createDialect } from "emdash/db/sqlite";
import { Kysely } from "kysely";
import { describe, expect, it } from "vitest";

import type { OwnerConfig } from "./owner-policy.ts";
import { isProvisionedOwner, provisionOwner } from "./owner.ts";

type Tables =
  ConstructorParameters<typeof UserRepository>[0] extends Kysely<infer T>
    ? T
    : never;

const seededDatabase = async () => {
  const db = new Kysely<Tables>({
    dialect: createDialect({ url: ":memory:" }),
  });
  await runMigrations(db);
  await new OptionsRepository(db).set("emdash:setup_state", {
    step: "site_complete",
  });
  return db;
};

const config = (email: string, previous = ""): OwnerConfig => ({
  CMS_BOOTSTRAP_TOKEN: "test-bootstrap-credential-0123456789abcdef",
  CMS_OWNER_EMAIL: email,
  CMS_OWNER_SITE: "example",
  CMS_PREVIOUS_OWNER_EMAILS: previous,
  SITE_ORIGIN: "https://example.test",
  STAGE: "staging",
});

describe(provisionOwner, () => {
  it("moves the owner provisioned under an earlier email to the new one", async () => {
    const db = await seededDatabase();
    await provisionOwner(db, config("old@example.test"));
    const before = await new UserRepository(db).findByEmail("old@example.test");

    await expect(
      provisionOwner(db, config("new@example.test", "old@example.test"))
    ).resolves.toStrictEqual({ ownerReady: true });

    const after = await new UserRepository(db).findById(before?.id ?? "");
    expect(after?.email).toBe("new@example.test");
    await expect(
      isProvisionedOwner(
        db,
        config("new@example.test", "old@example.test"),
        before?.id ?? ""
      )
    ).resolves.toBeTruthy();
  });

  it("refuses to adopt an earlier-email account it did not provision", async () => {
    const db = await seededDatabase();
    await new UserRepository(db).create({
      email: "old@example.test",
      name: "Someone",
      role: 50,
    });
    await new OptionsRepository(db).set("emdash:setup_complete", true);

    await expect(
      provisionOwner(db, config("new@example.test", "old@example.test"))
    ).rejects.toThrow(
      "Existing CMS accounts require a reviewed owner migration."
    );
    const users = await db.selectFrom("users").select("email").execute();
    expect(users.map((row) => ({ ...row }))).toStrictEqual([
      { email: "old@example.test" },
    ]);
  });

  it("provisions a fresh site straight onto the current email", async () => {
    const db = await seededDatabase();

    await provisionOwner(db, config("new@example.test", "old@example.test"));

    const users = await db
      .selectFrom("users")
      .select(["email", "role"])
      .execute();
    expect(users.map((row) => ({ ...row }))).toStrictEqual([
      { email: "new@example.test", role: 50 },
    ]);
  });
});
