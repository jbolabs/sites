/**
 * The contact form's limits and email check as plain functions, so a site's
 * island (plain React, no Effect) checks exactly what the server's
 * `ContactForm` schema enforces.
 */

const WHITESPACE = /\s/u;

/** One `@`, a non-empty local part, and a dotted domain. Deliverability is the reply's job. */
export const isEmailAddress = (value: string): boolean => {
  const at = value.indexOf("@");
  const domain = value.slice(at + 1);
  const hasSingleAt = at > 0 && !domain.includes("@");
  const dottedDomain =
    domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
  return hasSingleAt && dottedDomain && !WHITESPACE.test(value);
};

/** Trimmed length limits; they double as spam guards. */
export const CONTACT_LIMITS = {
  company: { max: 120, min: 0 },
  email: { max: 254, min: 3 },
  message: { max: 5000, min: 10 },
  name: { max: 120, min: 2 },
  phone: { max: 40, min: 0 },
  referrer: { max: 120, min: 0 },
} as const;

/** Whether `value`, trimmed, fits `field`'s limits. */
export const fitsContactLimit = (
  field: keyof typeof CONTACT_LIMITS,
  value: string
): boolean => {
  const { max, min } = CONTACT_LIMITS[field];
  const { length } = value.trim();
  return length >= min && length <= max;
};
