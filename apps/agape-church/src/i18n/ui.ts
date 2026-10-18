/**
 * Interface strings that belong to code rather than content: site chrome,
 * the contact and prayer forms, and labels around CMS sections. Page copy
 * lives in the CMS, one entry per locale.
 */
import type { Locale } from "./locales.ts";

const en = {
  addToCalendar: "Add to Google Calendar",
  address: "Address",
  allMinistries: "All ministries",
  close: "Close",
  contactMinistry: "Email this ministry",
  directions: "Get directions",
  donatePaypal: "Donate with PayPal",
  downloadPdf: "Download PDF",
  footerNav: "Footer",
  form: {
    address: "Home address",
    city: "City",
    contactBy: "Prefer to be contacted by",
    contactByEmail: "Email",
    contactByPhone: "Cell phone",
    email: "Email",
    errorGeneric:
      "We could not send your message. Please try again in a few minutes.",
    errorInvalid: "Please check your details and try again.",
    message: "Your question or message",
    name: "First and last name",
    optional: "optional",
    phone: "Cell phone",
    prayerRequest: "Your prayer request",
    sendMessage: "Send message",
    sendPrayer: "Send your request",
    sending: "Sending",
    sentBody: "Thank you. Someone from Agape Church will reply soon.",
    sentPrayerBody:
      "Thank you. Your request has been shared with our prayer group, and we are praying with you.",
    sentTitle: "Message received",
    turnstileFailed: "The spam check could not load. Please refresh the page.",
  },
  gallery: {
    next: "Next photo",
    of: "of",
    open: "View full size",
    previous: "Previous photo",
  },
  give: "Give",
  home: "Home",
  howItWorks: "How it works",
  live: "Live",
  mainNav: "Main",
  menu: "Menu",
  ministries: "Ministries",
  moreAlbums: "More albums",
  otherMinistries: "Other ministries",
  pagesHeading: "Pages",
  phone: "Phone",
  playVideo: "Play video",
  resourcesNav: "Resources",
  rights: "All rights reserved.",
  serviceTimes: "Service times",
  skipToContent: "Skip to content",
  social: {
    facebook: "Agape Church on Facebook",
    x: "Agape Church on X",
    youtube: "Agape Church on YouTube",
  },
  subscribe: "Subscribe on YouTube",
  switchTo: "Română",
  visit: "Plan a visit",
  watchLive: "Watch live",
};

export type UiStrings = typeof en;

const ro: UiStrings = {
  addToCalendar: "Adaugă în Google Calendar",
  address: "Adresa",
  allMinistries: "Toate lucrările",
  close: "Închide",
  contactMinistry: "Scrie acestei lucrări",
  directions: "Indicații de drum",
  donatePaypal: "Donează cu PayPal",
  downloadPdf: "Descarcă PDF",
  footerNav: "Subsol",
  form: {
    address: "Adresa de domiciliu",
    city: "Orașul",
    contactBy: "Preferați să fiți contactat prin",
    contactByEmail: "Email",
    contactByPhone: "Telefon mobil",
    email: "Email",
    errorGeneric:
      "Nu am putut trimite mesajul. Vă rugăm să încercați din nou peste câteva minute.",
    errorInvalid: "Vă rugăm să verificați datele și să încercați din nou.",
    message: "Întrebarea sau mesajul dumneavoastră",
    name: "Nume și prenume",
    optional: "opțional",
    phone: "Telefon mobil",
    prayerRequest: "Cererea dumneavoastră de rugăciune",
    sendMessage: "Trimite mesajul",
    sendPrayer: "Trimite cererea",
    sending: "Se trimite",
    sentBody:
      "Vă mulțumim. Cineva de la Biserica Agape vă va răspunde în curând.",
    sentPrayerBody:
      "Vă mulțumim. Cererea a fost trimisă grupului de rugăciune și ne rugăm împreună cu dumneavoastră.",
    sentTitle: "Mesaj primit",
    turnstileFailed:
      "Verificarea anti-spam nu s-a putut încărca. Vă rugăm să reîncărcați pagina.",
  },
  gallery: {
    next: "Fotografia următoare",
    of: "din",
    open: "Vezi mărit",
    previous: "Fotografia anterioară",
  },
  give: "Donează",
  home: "Acasă",
  howItWorks: "Cum funcționează",
  live: "Live",
  mainNav: "Principal",
  menu: "Meniu",
  ministries: "Lucrări",
  moreAlbums: "Mai multe albume",
  otherMinistries: "Alte lucrări",
  pagesHeading: "Pagini",
  phone: "Telefon",
  playVideo: "Pornește video",
  resourcesNav: "Resurse",
  rights: "Toate drepturile rezervate.",
  serviceTimes: "Programul bisericii",
  skipToContent: "Sari la conținut",
  social: {
    facebook: "Biserica Agape pe Facebook",
    x: "Biserica Agape pe X",
    youtube: "Biserica Agape pe YouTube",
  },
  subscribe: "Abonează-te pe YouTube",
  switchTo: "English",
  visit: "Vino în vizită",
  watchLive: "Urmărește live",
};

const strings: Record<Locale, UiStrings> = { en, ro };

export const ui = (locale: Locale): UiStrings => strings[locale];
