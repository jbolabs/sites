import { useId, useState } from "react";
import type { ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import type { UiStrings } from "@/i18n/ui";
import { prefillAmount } from "@/lib/application-rules";
import { consolidate, TERMS_YEARS } from "@/lib/debt";
import type { TermYears } from "@/lib/debt";
import { cn } from "@/lib/utils";

import { useTweenedNumber } from "./use-tweened-number";

type Strings = UiStrings["debt"];

interface DebtCalculatorProps {
  readonly debt: number;
  readonly paymentsNow: number;
  readonly rate: number;
  readonly strings: Strings;
  readonly disclaimer: string | undefined;
  readonly applyHref: string;
}

interface Range {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const DEBT: Range = { max: 250_000, min: 5000, step: 1000 };
const PAYMENTS: Range = { max: 6000, min: 100, step: 25 };
const RATE: Range = { max: 20, min: 3, step: 0.25 };
const QUICK_DEBTS = [15_000, 35_000, 75_000, 120_000] as const;
const DEFAULT_TERM: TermYears = 15;

const USD_FORMAT: Intl.NumberFormatOptions = {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency",
};
const PERCENT_FORMAT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 2,
  style: "unit",
  unit: "percent",
};

const usd = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;
const short = (value: number) => `$${value / 1000}K`;
const percent = (value: number) =>
  `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
const NON_DIGITS = /\D/gu;
const NOT_DECIMAL = /[^\d.]/gu;
const clamp = (value: number, range: Range) =>
  Math.min(range.max, Math.max(0, value));

/** A labelled slider with a typed box beside it, for one input. */
const Field = ({
  box,
  children,
  format,
  label,
  onChange,
  range,
  value,
}: {
  readonly box: ReactNode;
  readonly children?: ReactNode;
  readonly format: Intl.NumberFormatOptions;
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly range: Range;
  readonly value: number;
}) => {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span id={id} className="text-ink text-base font-medium">
          {label}
        </span>
        {box}
      </div>
      <Slider
        variant="brand"
        aria-labelledby={id}
        format={format}
        min={range.min}
        max={range.max}
        step={range.step}
        value={Math.max(range.min, value)}
        onValueChange={(next: number | readonly number[]) => {
          onChange([next].flat()[0] ?? range.min);
        }}
        className="mt-4"
      />
      {children}
    </div>
  );
};

const DollarBox = ({
  label,
  onChange,
  range,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly range: Range;
  readonly value: number;
}) => (
  <Input
    aria-label={label}
    inputMode="numeric"
    variant="compact"
    value={usd(value)}
    onChange={(event) => {
      onChange(
        clamp(
          Number(event.currentTarget.value.replaceAll(NON_DIGITS, "")),
          range
        )
      );
    }}
  />
);

/** A rate box that keeps what's typed ("8.") until it leaves focus. */
const PercentBox = ({
  label,
  onChange,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly value: number;
}) => {
  const [draft, setDraft] = useState<string | undefined>();
  return (
    <Input
      aria-label={label}
      inputMode="decimal"
      variant="compact"
      value={draft ?? percent(value)}
      onFocus={() => {
        setDraft(String(value));
      }}
      onChange={(event) => {
        const typed = event.currentTarget.value.replaceAll(NOT_DECIMAL, "");
        setDraft(typed);
        const parsed = Number(typed);
        onChange(Number.isFinite(parsed) ? clamp(parsed, RATE) : 0);
      }}
      onBlur={() => {
        setDraft(undefined);
      }}
    />
  );
};

/** One side of the comparison: a label, its monthly payment, and a bar. */
const Bar = ({
  label,
  monthly,
  share,
  strings,
  tone,
}: {
  readonly label: string;
  readonly monthly: number;
  readonly share: number;
  readonly strings: Strings;
  readonly tone: string;
}) => (
  <div>
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-graphite">{label}</span>
      <span className="text-ink font-medium tabular-nums">
        {strings.perMonth.replace("{amount}", usd(monthly))}
      </span>
    </div>
    <div
      className="bg-canvas mt-2 h-2.5 overflow-hidden rounded-full"
      aria-hidden="true"
    >
      <div
        className={cn(
          "h-full origin-left scale-x-(--share) rounded-full transition-transform duration-300",
          tone
        )}
        style={{ "--share": share }}
      />
    </div>
  </div>
);

const TermPicker = ({
  onChange,
  strings,
  value,
}: {
  readonly onChange: (years: TermYears) => void;
  readonly strings: Strings;
  readonly value: TermYears;
}) => (
  <RadioGroup
    aria-label={strings.term}
    value={value}
    variant="segmented"
    onValueChange={(next) => {
      const term = TERMS_YEARS.find((years) => years === next);
      if (term !== undefined) {
        onChange(term);
      }
    }}
  >
    {TERMS_YEARS.map((years) => (
      <label
        key={years}
        className="has-data-checked:text-ink text-graphite has-focus-visible:ring-sky/40 flex h-10 cursor-pointer items-center justify-center rounded-full text-sm font-medium tabular-nums has-focus-visible:ring-3 has-data-checked:bg-white has-data-checked:shadow-sm"
      >
        <RadioGroupItem value={years} className="sr-only" />
        {strings.years.replace("{years}", String(years))}
      </label>
    ))}
  </RadioGroup>
);

/**
 * Today's monthly payments against one consolidated payment, after
 * E Mortgage Capital's own calculator: what's owed, what's paid now, an
 * example rate, and a term. Defaults come from the CMS so the first paint
 * already shows a result.
 */
const DebtCalculator = ({
  applyHref,
  debt: startingDebt,
  disclaimer,
  paymentsNow: startingPayments,
  rate: startingRate,
  strings,
}: DebtCalculatorProps) => {
  const [debt, setDebt] = useState(startingDebt);
  const [paymentsNow, setPaymentsNow] = useState(startingPayments);
  const [rate, setRate] = useState(startingRate);
  const [years, setYears] = useState<TermYears>(DEFAULT_TERM);
  const result = consolidate({ debt, paymentsNow, ratePercent: rate, years });
  const saved = useTweenedNumber(result.savedPerMonth);
  const largest = Math.max(1, paymentsNow, result.payment);
  const amount = prefillAmount(debt);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_400px] lg:items-start lg:gap-16">
      <div className="min-w-0 space-y-9">
        <Field
          label={strings.debt}
          format={USD_FORMAT}
          range={DEBT}
          value={debt}
          onChange={setDebt}
          box={
            <DollarBox
              label={strings.debt}
              range={DEBT}
              value={debt}
              onChange={setDebt}
            />
          }
        >
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_DEBTS.map((quick) => (
              <Button
                key={quick}
                type="button"
                variant="outline-ink"
                size="cta"
                aria-pressed={debt === quick}
                onClick={() => {
                  setDebt(quick);
                }}
              >
                {short(quick)}
              </Button>
            ))}
          </div>
        </Field>
        <Field
          label={strings.payments}
          format={USD_FORMAT}
          range={PAYMENTS}
          value={paymentsNow}
          onChange={setPaymentsNow}
          box={
            <DollarBox
              label={strings.payments}
              range={PAYMENTS}
              value={paymentsNow}
              onChange={setPaymentsNow}
            />
          }
        />
        <Field
          label={strings.rate}
          format={PERCENT_FORMAT}
          range={RATE}
          value={rate}
          onChange={setRate}
          box={
            <PercentBox label={strings.rate} value={rate} onChange={setRate} />
          }
        />
      </div>

      <aside className="border-line shadow-float min-w-0 rounded-3xl border bg-white p-5 sm:p-7 lg:sticky lg:top-28">
        <p className="text-graphite text-sm">
          {strings.lead.replace("{years}", String(years))}
        </p>
        <p className="mt-2 flex items-baseline gap-2" aria-hidden="true">
          <span className="text-sky-ink tracking-figure text-5xl leading-none font-medium tabular-nums">
            {usd(saved)}
          </span>
          <span className="text-graphite text-base">{strings.less}</span>
        </p>
        <output aria-live="polite" className="sr-only">
          {`${usd(result.savedPerMonth)} ${strings.less}`}
        </output>

        <div className="mt-6">
          <TermPicker strings={strings} value={years} onChange={setYears} />
        </div>

        <div className="mt-6 space-y-4">
          <Bar
            label={strings.today}
            monthly={paymentsNow}
            share={paymentsNow / largest}
            strings={strings}
            tone="bg-ink"
          />
          <Bar
            label={strings.onePayment}
            monthly={result.payment}
            share={result.payment / largest}
            strings={strings}
            tone="bg-sky"
          />
        </div>

        <p className="text-graphite border-line mt-6 border-t pt-5 text-sm leading-relaxed">
          {strings.totalPaid
            .replace("{years}", String(years))
            .replace("{total}", usd(result.totalPaid))
            .replace("{interest}", usd(result.interest))}
        </p>

        <a
          href={`${applyHref}?amount=${encodeURIComponent(amount)}`}
          data-apply=""
          data-amount={amount}
          className={cn(
            buttonVariants({ size: "hero", variant: "accent" }),
            "mt-5 w-full"
          )}
        >
          {strings.cta}
        </a>
      </aside>

      {disclaimer !== undefined && (
        <p className="text-graphite max-w-4xl text-xs leading-relaxed whitespace-pre-line lg:col-span-2">
          {disclaimer}
        </p>
      )}
    </div>
  );
};

export default DebtCalculator;
