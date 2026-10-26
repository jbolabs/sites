/**
 * The email E Mortgage Capital's loan team gets for each application. It
 * carries everything their own Flow lead notice does (name, phone, email,
 * date of birth, address, amount, occupancy, ownership, primary residence,
 * income, income source, listing status, consent), grouped the way a loan
 * officer reads it: who to call, the property and loan, then income.
 *
 * Email clients ignore stylesheets and modern layout, so this is the
 * long-standing email-safe subset: nested tables, inline styles, system
 * fonts, and the site's palette as hex (from `global.css`). The plain-text
 * part stays `leadNotificationText`, the same summary the CMS entry holds.
 */
import { leadNotificationText } from "@jakebodea/cloudflare-kit/server";
import type {
  LeadMailRoutes,
  LeadNotification,
  Lead,
} from "@jakebodea/cloudflare-kit/server";

import { QUESTION } from "./application.ts";

const COLOR = {
  canvas: "#f7f9fc",
  graphite: "#5d6370",
  ink: "#0f1624",
  line: "#e3e6eb",
  sky: "#5fafd9",
  skyInk: "#026faa",
  skyWash: "#e1f4ff",
} as const;

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const ESCAPES = new Map([
  ['"', "&quot;"],
  ["&", "&amp;"],
  ["'", "&#39;"],
  ["<", "&lt;"],
  [">", "&gt;"],
]);
const UNSAFE = /["&'<>]/gu;

/** Every visitor-typed value passes through here before it reaches the HTML. */
export const escapeHtml = (value: string): string =>
  value.replaceAll(UNSAFE, (char) => ESCAPES.get(char) ?? char);

const NON_DIGITS = /\D+/gu;

/** The sections, in reading order; any answer not listed lands in the last one. */
const SECTIONS: readonly {
  readonly title: string;
  readonly questions: readonly string[];
}[] = [
  {
    questions: [
      QUESTION.amount,
      QUESTION.propertyAddress,
      QUESTION.occupancy,
      QUESTION.ownership,
      QUESTION.primaryAddress,
      QUESTION.forSale,
    ],
    title: "Property and loan",
  },
  {
    questions: [QUESTION.income, QUESTION.otherIncome, QUESTION.incomeSource],
    title: "Income",
  },
  {
    questions: [QUESTION.consent, QUESTION.language],
    title: "Consent and source",
  },
];

interface Row {
  readonly label: string;
  /** Already escaped (it may hold a link). */
  readonly html: string;
}

const rowsHtml = (rows: readonly Row[]) =>
  rows
    .map(
      ({ html, label }, index) => `
<tr>
  <td style="padding:12px 0;${index === 0 ? "" : `border-top:1px solid ${COLOR.line};`}width:42%;padding-right:16px;vertical-align:top;font-size:14px;line-height:20px;color:${COLOR.graphite};">${escapeHtml(label)}</td>
  <td style="padding:12px 0;${index === 0 ? "" : `border-top:1px solid ${COLOR.line};`}vertical-align:top;font-size:15px;line-height:22px;color:${COLOR.ink};font-weight:600;">${html}</td>
</tr>`
    )
    .join("");

const sectionHtml = (title: string, rows: readonly Row[]) =>
  rows.length === 0
    ? ""
    : `
<tr><td style="padding:28px 32px 0;">
  <p style="margin:0 0 4px;font-size:16px;line-height:24px;font-weight:700;color:${COLOR.ink};">${escapeHtml(title)}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rowsHtml(rows)}</table>
</td></tr>`;

const button = (href: string, label: string, primary: boolean) =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;border-radius:999px;font-size:15px;line-height:20px;font-weight:600;text-decoration:none;${
    primary
      ? `background:${COLOR.ink};color:#ffffff;`
      : `background:#ffffff;color:${COLOR.ink};border:1px solid ${COLOR.line};`
  }">${escapeHtml(label)}</a>`;

/** The lead notice for one application: subject, designed HTML, and the plain-text fallback. */
export const renderLeadEmail = (
  lead: Lead,
  mail: LeadMailRoutes
): LeadNotification => {
  const answers = new Map(
    (lead.answers ?? []).map(({ answer, question }) => [question, answer])
  );
  const amount = answers.get(QUESTION.amount);
  const phoneDigits = (lead.phone ?? "").replaceAll(NON_DIGITS, "");
  const contact: Row[] = [
    { html: escapeHtml(lead.name), label: "Name" },
    ...(lead.phone === undefined
      ? []
      : [
          {
            html: `<a href="tel:+1${phoneDigits.slice(-10)}" style="color:${COLOR.skyInk};text-decoration:none;">${escapeHtml(lead.phone)}</a>`,
            label: "Phone",
          },
        ]),
    {
      html: `<a href="mailto:${escapeHtml(lead.email)}" style="color:${COLOR.skyInk};text-decoration:none;">${escapeHtml(lead.email)}</a>`,
      label: "Email",
    },
    ...(answers.has(QUESTION.birthDate)
      ? [
          {
            html: escapeHtml(answers.get(QUESTION.birthDate) ?? ""),
            label: QUESTION.birthDate,
          },
        ]
      : []),
  ];
  const listed = new Set<string>([
    QUESTION.birthDate,
    ...SECTIONS.flatMap(({ questions }) => questions),
  ]);
  const rowsFor = (questions: readonly string[]): Row[] =>
    questions.flatMap((question) => {
      const answer = answers.get(question);
      return answer === undefined
        ? []
        : [{ html: escapeHtml(answer), label: question }];
    });
  const unlisted = [...answers.keys()].filter(
    (question) => !listed.has(question)
  );
  const sections = SECTIONS.map(({ questions, title }, index) =>
    sectionHtml(
      title,
      index === SECTIONS.length - 1
        ? [
            ...rowsFor([...questions, ...unlisted]),
            {
              html: escapeHtml(`${mail.siteOrigin}${lead.sourcePath}`),
              label: "Submitted from",
            },
          ]
        : rowsFor(questions)
    )
  ).join("");
  const firstName = lead.name.split(" ")[0] ?? lead.name;
  const amountNote = amount === undefined ? "" : ` (${amount})`;
  const subject = `New EquityFast application: ${lead.name}${amountNote}`;
  const preview =
    amount === undefined
      ? `${lead.name}. Reply to reach them directly.`
      : `${lead.name} is asking for ${amount}. Reply to reach them directly.`;
  const amountPill =
    amount === undefined
      ? ""
      : `<p style="margin:14px 0 0;"><span style="display:inline-block;padding:6px 14px;border-radius:999px;background:${COLOR.skyWash};color:${COLOR.skyInk};font-size:15px;line-height:20px;font-weight:700;">${escapeHtml(amount)} requested</span></p>`;
  const telHref = `tel:+1${phoneDigits.slice(-10)}`;
  const callLabel = `Call ${firstName}`;
  const callButton =
    lead.phone === undefined
      ? ""
      : `${button(telHref, callLabel, true)}&nbsp;&nbsp;`;
  const emailButton = button(
    `mailto:${lead.email}`,
    "Email",
    lead.phone === undefined
  );

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.canvas};">
<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLOR.canvas};font-family:${FONT};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid ${COLOR.line};border-radius:20px;">
  <tr><td style="padding:28px 32px 0;font-size:20px;line-height:24px;font-weight:800;letter-spacing:-0.02em;color:${COLOR.ink};">Equity<span style="color:${COLOR.sky};">FAST</span></td></tr>
  <tr><td style="padding:24px 32px 0;">
    <p style="margin:0;font-size:14px;line-height:20px;color:${COLOR.graphite};">New HELOC application</p>
    <h1 style="margin:6px 0 0;font-size:28px;line-height:34px;font-weight:700;letter-spacing:-0.02em;color:${COLOR.ink};">${escapeHtml(lead.name)}</h1>
    ${amountPill}
  </td></tr>
  <tr><td style="padding:24px 32px 0;">
    ${callButton}${emailButton}
  </td></tr>
  ${sectionHtml("Contact", contact)}
  ${sections}
  <tr><td style="padding:28px 32px 32px;">
    <p style="margin:0;padding-top:20px;border-top:1px solid ${COLOR.line};font-size:13px;line-height:20px;color:${COLOR.graphite};">Reply to this email to reach ${escapeHtml(firstName)} directly. The application is also saved in the ${escapeHtml(mail.name)} admin under Applications.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { html, subject, text: leadNotificationText(lead) };
};
