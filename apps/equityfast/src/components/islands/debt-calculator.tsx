import { ArrowRightIcon } from "lucide-react";
import { useId, useState } from "react";
import type { ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { RadioGroup, RadioGroupSegment } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import type { UiStrings } from "@/i18n/ui";
import { prefillAmount } from "@/lib/application-rules";
import { consolidate, TERMS_YEARS } from "@/lib/debt";
import type { TermYears } from "@/lib/debt";

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
const percent = (value: number) =>
  `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;

/** A label over a slider, with the current value at the right. */
const Field = ({
  children,
  format,
  label,
  onChange,
  range,
  shown,
  value,
}: {
  readonly children?: ReactNode;
  readonly format: Intl.NumberFormatOptions;
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly range: Range;
  readonly shown: string;
  readonly value: number;
}) => {
  const id = useId();
  return (
    <div className="min-w-0">
      <div className="flex min-h-10 items-center justify-between gap-3 text-sm">
        <span id={id} className="text-ink font-medium">
          {label}
        </span>
        <span className="text-ink font-medium tabular-nums">{shown}</span>
      </div>
      <Slider
        variant="brand"
        aria-labelledby={id}
        format={format}
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onValueChange={(next: number | readonly number[]) => {
          onChange([next].flat()[0] ?? range.min);
        }}
        className="mt-3"
      />
      {children}
    </div>
  );
};

/**
 * Today's monthly payments against one consolidated payment, after
 * E Mortgage Capital's own calculator. The result runs across an ink band
 * (the saving, the two payments, the CTA) over a row of four controls:
 * what's owed, what's paid now, an example rate, and a term. Defaults come
 * from the CMS so the first paint already shows a result.
 */
const DebtCalculator = ({
  applyHref,
  debt: startingDebt,
  disclaimer,
  paymentsNow: startingPayments,
  rate: startingRate,
  strings,
}: DebtCalculatorProps) => {
  const termId = useId();
  const [debt, setDebt] = useState(startingDebt);
  const [paymentsNow, setPaymentsNow] = useState(startingPayments);
  const [rate, setRate] = useState(startingRate);
  const [years, setYears] = useState<TermYears>(DEFAULT_TERM);
  const result = consolidate({ debt, paymentsNow, ratePercent: rate, years });
  const saved = useTweenedNumber(result.savedPerMonth);
  const amount = prefillAmount(debt);
  const perMonth = (value: number) =>
    strings.perMonth.replace("{amount}", usd(value));

  return (
    <div>
      <div className="border-line overflow-hidden rounded-4xl border bg-white">
        <div className="bg-ink glow-sky grid items-center gap-8 p-6 text-white sm:p-8 lg:grid-cols-[auto_1fr_auto] lg:gap-12">
          <div>
            <p className="text-sm text-white/60">
              {strings.lead.replace("{years}", String(years))}
            </p>
            <p className="mt-2 flex items-baseline gap-2" aria-hidden="true">
              <span className="text-sky tracking-figure text-6xl leading-none font-medium tabular-nums">
                {usd(saved)}
              </span>
              <span className="text-white/60">{strings.less}</span>
            </p>
            <output aria-live="polite" className="sr-only">
              {`${usd(result.savedPerMonth)} ${strings.less}`}
            </output>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-5">
              <div>
                <p className="text-sm text-white/60">{strings.today}</p>
                <p className="mt-1 text-2xl font-medium text-white/60 tabular-nums line-through decoration-white/30">
                  {perMonth(paymentsNow)}
                </p>
              </div>
              <ArrowRightIcon
                className="size-5 shrink-0 text-white/40"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm text-white/60">{strings.onePayment}</p>
                <p className="mt-1 text-2xl font-medium tabular-nums">
                  {perMonth(result.payment)}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-white/50">
              {strings.totalPaid
                .replace("{years}", String(years))
                .replace("{total}", usd(result.totalPaid))
                .replace("{interest}", usd(result.interest))}
            </p>
          </div>
          <a
            href={`${applyHref}?amount=${encodeURIComponent(amount)}`}
            data-apply=""
            data-amount={amount}
            className={buttonVariants({ size: "hero", variant: "inverse" })}
          >
            {strings.cta}
          </a>
        </div>

        <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-2 xl:grid-cols-4">
          <Field
            label={strings.debt}
            format={USD_FORMAT}
            range={DEBT}
            value={debt}
            shown={usd(debt)}
            onChange={setDebt}
          >
            <div className="mt-3 grid grid-cols-4 gap-2">
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
                  ${quick / 1000}K
                </Button>
              ))}
            </div>
          </Field>
          <Field
            label={strings.payments}
            format={USD_FORMAT}
            range={PAYMENTS}
            value={paymentsNow}
            shown={usd(paymentsNow)}
            onChange={setPaymentsNow}
          />
          <Field
            label={strings.rate}
            format={PERCENT_FORMAT}
            range={RATE}
            value={rate}
            shown={percent(rate)}
            onChange={setRate}
          />
          <div className="min-w-0">
            <div className="flex min-h-10 items-center">
              <span id={termId} className="text-ink text-sm font-medium">
                {strings.term}
              </span>
            </div>
            <RadioGroup
              aria-labelledby={termId}
              variant="segmented"
              value={years}
              onValueChange={(next) => {
                const term = TERMS_YEARS.find((option) => option === next);
                if (term !== undefined) {
                  setYears(term);
                }
              }}
              className="mt-3"
            >
              {TERMS_YEARS.map((option) => (
                <RadioGroupSegment key={option} value={option}>
                  {option}
                </RadioGroupSegment>
              ))}
            </RadioGroup>
          </div>
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
