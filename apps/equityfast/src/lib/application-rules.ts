/**
 * What the EquityFast application asks and accepts. Plain functions with no
 * Effect, so the browser island and the server schema (`application.ts`)
 * enforce the same rules. Option values are stored in English whatever the
 * visitor's language; labels are translated in `i18n/ui.ts`.
 *
 * Income and date of birth are asked on the last step because E Mortgage
 * Capital's own lead notice carries them and the loan team needs them to run
 * numbers. SSN digits are still deliberately not collected: leads are stored
 * in the CMS and emailed, which is not appropriate for that data.
 */
export const MIN_AMOUNT = 5000;
export const MAX_AMOUNT = 1_000_000;

export const OCCUPANCY = [
  "Primary residence",
  "Secondary home",
  "Investment property",
] as const;
export const OWNERSHIP = ["Sole owner", "Joint owner", "Trust", "LLC"] as const;
export const FOR_SALE = ["Yes", "No"] as const;
/** E Mortgage Capital's own list (the previous site asked the same). */
export const INCOME_SOURCES = [
  "Employment",
  "Self-employed",
  "Retirement",
  "Investment",
  "Other",
] as const;
/** Annual income above this is a typo, not an applicant. */
export const MAX_INCOME = 99_999_999;
/** Past this a stated mortgage balance is a typo or spam. */
export const MAX_MORTGAGE_BALANCE = 99_999_999;
/** Borrowers must be adults; past this age a date of birth is a typo. */
export const MIN_AGE = 18;
export const MAX_AGE = 120;

export type Occupancy = (typeof OCCUPANCY)[number];
export type Ownership = (typeof OWNERSHIP)[number];
export type ForSale = (typeof FOR_SALE)[number];
export type IncomeSource = (typeof INCOME_SOURCES)[number];

const NON_DIGITS = /\D+/gu;
const CENTS = /\.(?<cents>\d{1,2})\D*$/u;
const US_COUNTRY_CODE = /^1(?=\d{10}$)/u;
const EMAIL = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/iu;
const ZIP = /^\d{5}(?:-\d{4})?$/u;
const DIGIT = /\d/u;
const BIRTH_DATE = /^(?<month>\d{2})\/(?<day>\d{2})\/(?<year>\d{4})$/u;
const LETTER = /\p{L}/u;
// Letters in any script, plus the spaces, apostrophes, hyphens, and periods names and places use.
const NAME = /^[\p{L}\p{M}' .\u2019-]+$/u;

/**
 * Where a property can be: the 50 states and DC as USPS code and name, in
 * name order (the order the select lists them). Names stay in English in
 * both languages; they are proper names.
 */
export const US_STATES: readonly (readonly [code: string, name: string])[] = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
];

const STATE_CODES = new Set(US_STATES.map(([code]) => code));

export const digits = (value: string): string =>
  value.replaceAll(NON_DIGITS, "");

/**
 * Whole dollars typed in any format (`$75,000`, `75000`, `$1,234.56`), or 0.
 * Cents (one or two digits after the last dot) round to the nearest dollar
 * instead of running into the digits; any other dot is a thousands separator
 * (`250.000`, as written in much of Latin America).
 */
export const dollars = (value: string): number => {
  const cents = CENTS.exec(value)?.groups?.cents ?? "";
  const whole = digits(cents === "" ? value : value.replace(CENTS, ""));
  return Math.round(Number(`${whole || "0"}.${cents || "0"}`));
};

/** `75000` -> `$75,000`, `0` -> `$0`; input with no digits stays empty. */
export const formatDollars = (value: string): string =>
  digits(value) === "" ? "" : `$${dollars(value).toLocaleString("en-US")}`;

/** Optional: blank means the visitor didn't say, which is sent on as 0. */
export const isMortgageBalance = (value: string): boolean =>
  dollars(value) <= MAX_MORTGAGE_BALANCE;

/** Whole dollars, required but may be 0 (`Other income: $0`). */
export const isIncome = (value: string): boolean =>
  digits(value) !== "" && dollars(value) <= MAX_INCOME;

/** A date of birth as typed so far, formatted `MM/DD/YYYY`. */
export const formatBirthDate = (value: string): string => {
  const date = digits(value).slice(0, 8);
  if (date.length <= 2) {
    return date;
  }
  if (date.length <= 4) {
    return `${date.slice(0, 2)}/${date.slice(2)}`;
  }
  return `${date.slice(0, 2)}/${date.slice(2, 4)}/${date.slice(4)}`;
};

/**
 * A real `MM/DD/YYYY` calendar date for someone 18 to 120 years old on
 * `today` (passed in so the rule is the same in the browser, on the server,
 * and in tests with a fixed clock).
 */
export const isBirthDate = (value: string, today: Date): boolean => {
  const parts = BIRTH_DATE.exec(value.trim())?.groups;
  if (parts === undefined) {
    return false;
  }
  const [month, day, year] = [parts.month, parts.day, parts.year].map(Number);
  if (month === undefined || day === undefined || year === undefined) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  const birthdayPassed =
    today.getMonth() + 1 > month ||
    (today.getMonth() + 1 === month && today.getDate() >= day);
  const age = today.getFullYear() - year - (birthdayPassed ? 0 : 1);
  return real && age >= MIN_AGE && age <= MAX_AGE;
};

/** US phone as typed so far, formatted `(555) 010-1234`. */
export const formatPhone = (value: string): string => {
  const number = digits(value).replace(US_COUNTRY_CODE, "").slice(0, 10);
  if (number.length <= 3) {
    return number;
  }
  if (number.length <= 6) {
    return `(${number.slice(0, 3)}) ${number.slice(3)}`;
  }
  return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
};

export const isAmount = (value: string): boolean => {
  const amount = dollars(value);
  return amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;
};

/** Ten digits whose area code and exchange don't start with 0 or 1 (NANP). */
export const isPhone = (value: string): boolean => {
  const number = digits(value).replace(US_COUNTRY_CODE, "");
  return (
    number.length === 10 &&
    !["0", "1"].includes(number.charAt(0)) &&
    !["0", "1"].includes(number.charAt(3))
  );
};

export const isEmail = (value: string): boolean => EMAIL.test(value.trim());

/** Five digits or ZIP+4, and not all zeros (no ZIP starts `000`). */
export const isZip = (value: string): boolean => {
  const zip = value.trim();
  return ZIP.test(zip) && !zip.startsWith("000");
};

/** A USPS code for a state or DC, in either case. */
export const isState = (value: string): boolean =>
  STATE_CODES.has(value.trim().toUpperCase());

/** ZIP as typed so far: digits only, a hyphen before the +4. */
export const formatZip = (value: string): string => {
  const zip = digits(value).slice(0, 9);
  return zip.length > 5 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : zip;
};

/** A person's name: at least one letter, no digits or symbols. */
export const isName = (value: string): boolean => {
  const name = value.trim();
  return name.length <= 60 && LETTER.test(name) && NAME.test(name);
};

/** A street line needs a house number and a street name (`123 Main St`). */
export const isStreet = (value: string): boolean => {
  const street = value.trim();
  return (
    street.length >= 4 &&
    street.length <= 160 &&
    DIGIT.test(street) &&
    LETTER.test(street)
  );
};

/** A city name: two or more characters, letters and the usual punctuation only. */
export const isCity = (value: string): boolean => {
  const city = value.trim();
  return city.length >= 2 && city.length <= 80 && isName(city);
};

/** Everything the visitor answers, as the form holds it (strings throughout). */
export interface ApplicationAnswers {
  readonly amount: string;
  readonly firstName: string;
  readonly middleName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly consent: boolean;
  readonly propertyStreet: string;
  readonly propertyCity: string;
  readonly propertyState: string;
  readonly propertyZip: string;
  readonly occupancy: string;
  readonly primaryStreet: string;
  readonly primaryCity: string;
  readonly primaryState: string;
  readonly primaryZip: string;
  readonly ownership: string;
  readonly forSale: string;
  readonly mortgageBalance: string;
  readonly income: string;
  readonly otherIncome: string;
  readonly incomeSource: string;
  readonly birthDate: string;
}

export const EMPTY_ANSWERS: ApplicationAnswers = {
  amount: "",
  birthDate: "",
  consent: false,
  email: "",
  firstName: "",
  forSale: "",
  income: "",
  incomeSource: "",
  lastName: "",
  middleName: "",
  mortgageBalance: "",
  occupancy: "",
  /** Most applicants have none, so it starts at $0 rather than blank. */
  otherIncome: "$0",
  ownership: "",
  phone: "",
  primaryCity: "",
  primaryState: "",
  primaryStreet: "",
  primaryZip: "",
  propertyCity: "",
  propertyState: "",
  propertyStreet: "",
  propertyZip: "",
};

export type StepKey =
  | "amount"
  | "name"
  | "contact"
  | "propertyAddress"
  | "occupancy"
  | "primaryAddress"
  | "ownership"
  | "forSale"
  | "mortgageBalance"
  | "income";

/** Every question, in order (`stepsFor` drops the ones a visitor skips). */
export const STEP_KEYS: readonly StepKey[] = [
  "amount",
  "name",
  "contact",
  "propertyAddress",
  "occupancy",
  "primaryAddress",
  "ownership",
  "forSale",
  "mortgageBalance",
  "income",
];

/** The steps this visitor sees: the primary address is asked only when the property isn't it. */
export const stepsFor = (answers: ApplicationAnswers): readonly StepKey[] =>
  STEP_KEYS.filter(
    (step) =>
      step !== "primaryAddress" || answers.occupancy !== "Primary residence"
  );

/** The step on screen: `key`, or the first step if these answers skip it. */
export const shownStep = (
  key: StepKey,
  answers: ApplicationAnswers
): StepKey => (stepsFor(answers).includes(key) ? key : "amount");

type Field = keyof ApplicationAnswers;

const addressProblems = (
  answers: ApplicationAnswers,
  prefix: "property" | "primary"
): Field[] => {
  const street = `${prefix}Street` as const;
  const city = `${prefix}City` as const;
  const state = `${prefix}State` as const;
  const zip = `${prefix}Zip` as const;
  return [
    ...(isStreet(answers[street]) ? [] : [street]),
    ...(isCity(answers[city]) ? [] : [city]),
    ...(isState(answers[state]) ? [] : [state]),
    ...(isZip(answers[zip]) ? [] : [zip]),
  ];
};

/** First and last name are required; a middle name is checked only when given. */
const nameProblems = (answers: ApplicationAnswers): Field[] => [
  ...(isName(answers.firstName) ? [] : (["firstName"] as const)),
  ...(answers.middleName.trim() === "" || isName(answers.middleName)
    ? []
    : (["middleName"] as const)),
  ...(isName(answers.lastName) ? [] : (["lastName"] as const)),
];

const oneOf = (options: readonly string[], value: string) =>
  options.includes(value);

/** The last step: income and date of birth, all required. */
const incomeProblems = (answers: ApplicationAnswers, today: Date): Field[] => [
  ...(isIncome(answers.income) ? [] : (["income"] as const)),
  ...(isIncome(answers.otherIncome) ? [] : (["otherIncome"] as const)),
  ...(oneOf(INCOME_SOURCES, answers.incomeSource)
    ? []
    : (["incomeSource"] as const)),
  ...(isBirthDate(answers.birthDate, today) ? [] : (["birthDate"] as const)),
];

/** Each check that fails names its field. */
const failing = (checks: readonly (readonly [ok: boolean, field: Field])[]) =>
  checks.flatMap(([ok, field]) => (ok ? [] : [field]));

/** Fields on `step` that are missing or invalid; empty means the step is complete. */
export const stepProblems = (
  step: StepKey,
  answers: ApplicationAnswers,
  today: Date = new Date()
): Field[] => {
  switch (step) {
    case "amount": {
      return failing([[isAmount(answers.amount), "amount"]]);
    }
    case "name": {
      return nameProblems(answers);
    }
    case "contact": {
      return failing([
        [isEmail(answers.email), "email"],
        [isPhone(answers.phone), "phone"],
        [answers.consent, "consent"],
      ]);
    }
    case "propertyAddress": {
      return addressProblems(answers, "property");
    }
    case "occupancy": {
      return failing([[oneOf(OCCUPANCY, answers.occupancy), "occupancy"]]);
    }
    case "primaryAddress": {
      return addressProblems(answers, "primary");
    }
    case "ownership": {
      return failing([[oneOf(OWNERSHIP, answers.ownership), "ownership"]]);
    }
    case "forSale": {
      return failing([[oneOf(FOR_SALE, answers.forSale), "forSale"]]);
    }
    case "mortgageBalance": {
      return failing([
        [isMortgageBalance(answers.mortgageBalance), "mortgageBalance"],
      ]);
    }
    case "income": {
      return incomeProblems(answers, today);
    }
    default: {
      return [];
    }
  }
};

/** `123 Main St, Austin, TX 78701`. */
export const formatAddress = (
  street: string,
  city: string,
  state: string,
  zip: string
): string =>
  `${street.trim()}, ${city.trim()}, ${state.trim().toUpperCase()} ${zip.trim()}`;

/** Share of the home's value a line can reach across all liens (the estimate's assumption). */
export const MAX_COMBINED_LTV = 0.85;

/** Estimated line: 85% of the home's value less what is owed, within $0–$1M. */
export const availableLine = (
  homeValue: number,
  mortgageBalance: number
): number =>
  Math.min(
    MAX_AMOUNT,
    Math.max(0, Math.round(homeValue * MAX_COMBINED_LTV - mortgageBalance))
  );

/**
 * The amount to prefill from an estimate: rounded up to the next $10,000 and
 * kept inside the program range (the previous site did the same).
 */
export const prefillAmount = (estimate: number): string => {
  const rounded = Math.ceil(estimate / 10_000) * 10_000;
  const clamped = Math.min(MAX_AMOUNT, Math.max(MIN_AMOUNT, rounded));
  return formatDollars(String(clamped));
};
