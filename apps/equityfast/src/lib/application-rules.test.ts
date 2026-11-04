import { describe, expect, it } from "vitest";

import {
  EMPTY_ANSWERS,
  availableLine,
  US_STATES,
  formatBirthDate,
  formatDollars,
  formatPhone,
  formatZip,
  isAmount,
  isBirthDate,
  isCity,
  isMortgageBalance,
  isName,
  isPhone,
  isState,
  isStreet,
  isZip,
  prefillAmount,
  stepProblems,
  stepsFor,
} from "./application-rules.ts";

describe(availableLine, () => {
  it("lends up to 85% of the home's value less the mortgage", () => {
    // The previous site's own worked example: $650,000 home, $310,000 owed.
    expect(availableLine(650_000, 310_000)).toBe(242_500);
  });

  it("never goes below zero or above the $1M program maximum", () => {
    expect(availableLine(200_000, 400_000)).toBe(0);
    expect(availableLine(3_000_000, 0)).toBe(1_000_000);
  });
});

describe(prefillAmount, () => {
  it("rounds an estimate up to the next $10,000", () => {
    expect(prefillAmount(242_500)).toBe("$250,000");
  });

  it("keeps the prefill inside $5,000-$1,000,000", () => {
    expect(prefillAmount(0)).toBe("$5,000");
    expect(prefillAmount(2_400_000)).toBe("$1,000,000");
  });
});

describe(formatDollars, () => {
  it("formats whatever digits were typed", () => {
    expect(formatDollars("75000")).toBe("$75,000");
    expect(formatDollars("$0075,0x00")).toBe("$75,000");
  });

  it("rounds pasted cents to whole dollars instead of keeping their digits", () => {
    expect(formatDollars("$250,000.60")).toBe("$250,001");
    expect(formatDollars("250000.4")).toBe("$250,000");
  });

  it("reads dots before three digits as thousands separators", () => {
    expect(formatDollars("250.000")).toBe("$250,000");
  });

  it("keeps a typed zero, so other income can be $0", () => {
    expect(formatDollars("0")).toBe("$0");
    expect(formatDollars("$")).toBe("");
  });
});

describe(formatPhone, () => {
  it("formats a US number as it is typed", () => {
    expect(formatPhone("714")).toBe("714");
    expect(formatPhone("7145550")).toBe("(714) 555-0");
    expect(formatPhone("+1 714 555 0123")).toBe("(714) 555-0123");
  });
});

describe(isAmount, () => {
  it("accepts the program range only", () => {
    expect(isAmount("$5,000")).toBeTruthy();
    expect(isAmount("$4,999")).toBeFalsy();
    expect(isAmount("$1,000,001")).toBeFalsy();
  });
});

describe(isPhone, () => {
  it("requires a valid area code and exchange", () => {
    expect(isPhone("(714) 555-0123")).toBeTruthy();
    expect(isPhone("(014) 555-0123")).toBeFalsy();
    expect(isPhone("(714) 155-0123")).toBeFalsy();
  });
});

describe(isState, () => {
  it("accepts the 50 states and DC, in either case", () => {
    expect(isState("CA")).toBeTruthy();
    expect(isState("dc")).toBeTruthy();
    expect(isState("MM")).toBeFalsy();
    expect(isState("California")).toBeFalsy();
    expect(US_STATES).toHaveLength(51);
  });

  it("lists states by name", () => {
    expect(US_STATES.slice(0, 4).map(([code]) => code)).toStrictEqual([
      "AL",
      "AK",
      "AZ",
      "AR",
    ]);
  });
});

describe(isZip, () => {
  it("accepts a 5-digit ZIP or ZIP+4 only", () => {
    expect(isZip("92704")).toBeTruthy();
    expect(isZip("92704-1234")).toBeTruthy();
    expect(isZip("9943400000")).toBeFalsy();
    expect(isZip("9270")).toBeFalsy();
    expect(isZip("00000")).toBeFalsy();
  });
});

describe(formatZip, () => {
  it("keeps digits and adds the ZIP+4 hyphen as it is typed", () => {
    expect(formatZip("92704")).toBe("92704");
    expect(formatZip("927041")).toBe("92704-1");
    expect(formatZip("9943400000")).toBe("99434-0000");
    expect(formatZip("92a70")).toBe("9270");
  });
});

describe(isStreet, () => {
  it("needs a house number and a street name", () => {
    expect(isStreet("3750 S Susan Street")).toBeTruthy();
    expect(isStreet("N1234 County Rd K")).toBeTruthy();
    expect(isStreet("Main Street")).toBeFalsy();
    expect(isStreet("1234")).toBeFalsy();
  });
});

describe(isCity, () => {
  it("accepts real place names and rejects digits or one letter", () => {
    expect(isCity("Coeur d'Alene")).toBeTruthy();
    expect(isCity("St. Louis")).toBeTruthy();
    expect(isCity("Cañon City")).toBeTruthy();
    expect(isCity("M")).toBeFalsy();
    expect(isCity("92704")).toBeFalsy();
  });
});

describe(isName, () => {
  it("accepts names with accents, hyphens, and apostrophes", () => {
    expect(isName("José-María")).toBeTruthy();
    expect(isName("O'Brien")).toBeTruthy();
    expect(isName("O’Brien")).toBeTruthy();
    expect(isName("J0rdan")).toBeFalsy();
    expect(isName("...")).toBeFalsy();
  });
});

// A fixed "today" so the age checks don't drift with the calendar.
const TODAY = new Date(2026, 9, 26);

describe(isBirthDate, () => {
  it("accepts a real date for an adult", () => {
    expect(isBirthDate("05/20/1989", TODAY)).toBeTruthy();
    expect(isBirthDate("10/26/2008", TODAY)).toBeTruthy();
  });

  it("rejects minors, impossible dates, and other formats", () => {
    expect(isBirthDate("10/27/2008", TODAY)).toBeFalsy();
    expect(isBirthDate("02/30/1989", TODAY)).toBeFalsy();
    expect(isBirthDate("1989-05-20", TODAY)).toBeFalsy();
    expect(isBirthDate("05/20/1889", TODAY)).toBeFalsy();
  });
});

describe(formatBirthDate, () => {
  it("adds the slashes as the date is typed", () => {
    expect(formatBirthDate("05")).toBe("05");
    expect(formatBirthDate("0520")).toBe("05/20");
    expect(formatBirthDate("05201989")).toBe("05/20/1989");
  });
});

describe(isMortgageBalance, () => {
  it("accepts blank, $0 and real balances but not absurd ones", () => {
    expect(isMortgageBalance("")).toBeTruthy();
    expect(isMortgageBalance("$0")).toBeTruthy();
    expect(isMortgageBalance("$412,500")).toBeTruthy();
    expect(isMortgageBalance("$100,000,000")).toBeFalsy();
  });
});

describe(stepsFor, () => {
  it("skips the primary-address question when the property is the primary residence", () => {
    expect(
      stepsFor({ ...EMPTY_ANSWERS, occupancy: "Primary residence" })
    ).toStrictEqual([
      "amount",
      "name",
      "contact",
      "propertyAddress",
      "occupancy",
      "ownership",
      "forSale",
      "mortgageBalance",
      "income",
    ]);
  });

  it("asks for the primary address on a second home", () => {
    expect(
      stepsFor({ ...EMPTY_ANSWERS, occupancy: "Secondary home" })
    ).toContain("primaryAddress");
  });
});

describe(stepProblems, () => {
  it("names each missing or invalid contact field", () => {
    expect(
      stepProblems("contact", {
        ...EMPTY_ANSWERS,
        email: "jordan@",
        phone: "(714) 555-0123",
      })
    ).toStrictEqual(["email", "consent"]);
  });

  it("rejects the made-up state and 10-digit ZIP from the bug report", () => {
    expect(
      stepProblems("propertyAddress", {
        ...EMPTY_ANSWERS,
        propertyCity: "Minnie",
        propertyState: "MM",
        propertyStreet: "1234 Carr",
        propertyZip: "9943400000",
      })
    ).toStrictEqual(["propertyState", "propertyZip"]);
  });

  it("checks the name fields, with the middle name optional", () => {
    expect(
      stepProblems("name", {
        ...EMPTY_ANSWERS,
        firstName: "Jordan",
        lastName: "R3yes",
      })
    ).toStrictEqual(["lastName"]);
  });

  it("requires every income answer and the date of birth on the last step", () => {
    expect(
      stepProblems(
        "income",
        {
          ...EMPTY_ANSWERS,
          birthDate: "05/20/2010",
          income: "$140,000",
          otherIncome: "0",
        },
        TODAY
      )
    ).toStrictEqual(["incomeSource", "birthDate"]);
  });

  it("checks the state code and ZIP of an address", () => {
    expect(
      stepProblems("propertyAddress", {
        ...EMPTY_ANSWERS,
        propertyCity: "Santa Ana",
        propertyState: "California",
        propertyStreet: "3750 S Susan Street",
        propertyZip: "9270",
      })
    ).toStrictEqual(["propertyState", "propertyZip"]);
  });
});
