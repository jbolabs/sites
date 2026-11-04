import type { LeadMailEnv } from "../env.ts";
import type { StageSettings } from "./stage.ts";

/**
 * Lead notifications go to the client's inbox on prod only, like the alerts,
 * so staging and preview test leads never reach the client.
 */
export const leadMail = (
  stage: StageSettings,
  routes: {
    readonly emailFrom: string | undefined;
    /** Everyone who gets each lead; empty sends none. */
    readonly inbox: readonly string[];
    readonly fromName: string;
    readonly alertInbox: string;
  }
) =>
  ({
    ALERT_EMAIL: stage.production ? routes.alertInbox : "",
    LEAD_NOTIFY_FROM: routes.emailFrom ?? "",
    LEAD_NOTIFY_FROM_NAME: routes.fromName,
    LEAD_NOTIFY_TO: stage.production ? routes.inbox.join(",") : "",
  }) satisfies Record<keyof LeadMailEnv, string>;
