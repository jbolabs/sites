import type { Lead } from "@jakebodea/cloudflare-kit/server";

/**
 * The church office's email for a contact form message. The form's topic
 * travels in the lead's `company` field, so the email names it "Topic" and
 * puts it in the subject ("Prayer request from Ana").
 */
export const renderLeadNotice = (lead: Lead) => ({
  subject:
    lead.company === undefined
      ? `New message from ${lead.name}`
      : `${lead.company} from ${lead.name}`,
  text: [
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone ?? "-"}`,
    `Topic: ${lead.company ?? "-"}`,
    `Page: ${lead.sourcePath}`,
    "",
    lead.message,
  ].join("\n"),
});
