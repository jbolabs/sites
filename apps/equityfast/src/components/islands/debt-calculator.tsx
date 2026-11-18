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
        <span id={id} className="text-ink text-sm font-medium sm:text-base">
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

/** Today's payments as several blocks, the consolidated one as a single bar. */
const TODAY_PIECES = 3;

/** One side of the comparison: a label, its monthly payment, and a bar. */
const Bar = ({
  label,
  monthly,
  pieces,
  share,
  strings,
  tone,
}: {
  readonly label: string;
  readonly monthly: number;
  readonly pieces: number;
  readonly share: number;
  readonly strings: Strings;
  readonly tone: string;
}) => (
  <div>
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-white/60">{label}</span>
      <span className="font-medium text-white tabular-nums">
        {strings.perMonth.replace("{amount}", usd(monthly))}
      </span>
    </div>
    <div
      className="mt-2.5 h-3 overflow-hidden rounded-full bg-white/10"
      aria-hidden="true"
    >
      <div
        className="flex h-full origin-left scale-x-(--share) gap-1 transition-transform duration-300"
        style={{ "--share": share }}
      >
        {Array.from({ length: pieces }, (_, index) => (
          <span
            key={index}
            className={cn("h-full flex-1 rounded-full", tone)}
          />
        ))}
      </div>
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
        className="has-data-checked:text-ink has-focus-visible:ring-sky/50 flex h-10 cursor-pointer items-center justify-center rounded-full text-xs font-medium whitespace-nowrap text-white/70 tabular-nums hover:text-white has-focus-visible:ring-3 has-data-checked:bg-white sm:text-sm"
      >
        <RadioGroupItem value={years} className="sr-only" />
        {years}
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
    <div>
      <div className="border-line grid overflow-hidden rounded-4xl border bg-white lg:grid-cols-[1fr_minmax(0,28rem)]">
        <div className="flex min-w-0 flex-col justify-center gap-9 p-5 sm:p-10">
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
            <div className="mt-4 grid grid-cols-4 gap-2 sm:flex">
              {QUICK_DEBTS.map((quick) => (
                <Button
                  key={quick}
                  type="button"
                  variant="outline-ink"
                  size="chip"
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
              <PercentBox
                label={strings.rate}
                value={rate}
                onChange={setRate}
              />
            }
          />
        </div>

        <div className="bg-ink glow-sky min-w-0 p-6 text-white sm:p-10">
          <p className="text-sm text-white/60">
            {strings.lead.replace("{years}", String(years))}
          </p>
          <p className="mt-3 flex items-baseline gap-2" aria-hidden="true">
            <span className="text-sky tracking-figure text-6xl leading-none font-medium tabular-nums sm:text-7xl">
              {usd(saved)}
            </span>
            <span className="text-base text-white/60">{strings.less}</span>
          </p>
          <output aria-live="polite" className="sr-only">
            {`${usd(result.savedPerMonth)} ${strings.less}`}
          </output>

          <div className="mt-8">
            <TermPicker strings={strings} value={years} onChange={setYears} />
          </div>

          <div className="mt-8 space-y-5">
            <Bar
              label={strings.today}
              monthly={paymentsNow}
              pieces={TODAY_PIECES}
              share={paymentsNow / largest}
              strings={strings}
              tone="bg-white/45"
            />
            <Bar
              label={strings.onePayment}
              monthly={result.payment}
              pieces={1}
              share={result.payment / largest}
              strings={strings}
              tone="bg-sky"
            />
          </div>

          <p className="mt-8 border-t border-white/10 pt-6 text-sm leading-relaxed text-white/60">
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
              buttonVariants({ size: "hero", variant: "inverse" }),
              "mt-6 w-full"
            )}
          >
            {strings.cta}
          </a>
        </div>
      </div>

      {disclaimer !== undefined && (
        <p className="text-graphite mt-6 max-w-4xl text-xs leading-relaxed whitespace-pre-line">
          {disclaimer}
        </p>
      )}
    </div>
  );
};

export default DebtCalculator;
