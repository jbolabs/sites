/**
 * Sends one sample application to Flow AG's accept-lead endpoint in dry-run
 * mode (`?test=true`): Flow AG authenticates and parses it, but saves nothing
 * and sends no SMS or email. Prints what Flow AG read from each field, so a
 * `0`, empty, or missing value shows a field it did not pick up.
 *
 * The key comes from the environment and is never printed. On the operator's
 * Mac, with the key in Infisical `sites-prod` (env `prod`):
 *
 *   infisical run --projectId cb46a5eb-7afc-4e8a-93b7-40a065c6d6c9 --env prod -- bun apps/equityfast/scripts/flow-ag-dry-run.ts
 */
import { Schema } from "effect";

import { ApplicationForm } from "../src/lib/application.ts";
import { FLOW_AG_ACCEPT_LEAD_URL, toFlowAgLead } from "../src/lib/flow-ag.ts";

const key = process.env.FLOW_AG_API_KEY ?? "";
if (key === "") {
  console.error("FLOW_AG_API_KEY is not set.");
  process.exit(1);
}

const sample = Schema.decodeUnknownSync(ApplicationForm)({
  amount: "$75,000",
  birthDate: "04/12/1981",
  consent: true,
  email: "dry-run@jbolabs.com",
  firstName: "Dry",
  forSale: "No",
  income: "$140,000",
  incomeSource: "Self-employed",
  lastName: "Run",
  locale: "en",
  mortgageBalance: "$250,000",
  occupancy: "Primary residence",
  otherIncome: "0",
  ownership: "Sole owner",
  phone: "(714) 555-0123",
  propertyAddress: {
    city: "Santa Ana",
    state: "CA",
    street: "3750 S Susan Street",
    zip: "92704",
  },
  turnstileToken: "dry-run",
});

const lead = toFlowAgLead(sample, "dry-run", "/apply");
const response = await fetch(`${FLOW_AG_ACCEPT_LEAD_URL}?test=true`, {
  body: JSON.stringify(lead),
  headers: { "Content-Type": "application/json", "X-Api-Key": key },
  method: "POST",
});

console.log(`Flow AG answered ${response.status}`);
console.log(await response.text());
process.exit(response.ok ? 0 : 1);
