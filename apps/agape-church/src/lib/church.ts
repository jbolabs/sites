/** The church's contact facts formatted for display and links, from site.config.ts. */
import { site } from "../../site.config.ts";

const { address, telephone } = site.business;

/** "4572 Rose Drive, Yorba Linda, CA 92886" */
export const fullAddress = `${address.street}, ${address.city}, ${address.region} ${address.postalCode}`;

/** Google Maps search for the church (directions on phones). */
export const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`;

/** Embeddable map of the church, in the page's language. */
export const mapsEmbedUrl = (locale: string): string =>
  `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&hl=${locale}&z=14&output=embed`;

/** "+1-714-386-7210" shown the way Americans write it: "(714) 386-7210". */
export const formatPhone = (international: string): string => {
  const digits = international.replaceAll(/\D/gu, "").slice(-10);
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

export const phoneLabel = formatPhone(telephone);
export const phoneHref = `tel:${telephone}`;
