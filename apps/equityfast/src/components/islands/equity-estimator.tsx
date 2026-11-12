import { useId, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { UiStrings } from "@/i18n/ui";
import {
  availableLine,
  MIN_AMOUNT,
  prefillAmount,
} from "@/lib/application-rules";
import { cn } from "@/lib/utils";

import { useTweenedNumber } from "./use-tweened-number";

interface EquityEstimatorProps {
  readonly strings: UiStrings["estimator"];
  readonly applyHref: string;
}

interface Range {
  readonly max: number;
  readonly min: number;
  readonly start: number;
  readonly step: number;
}

const HOME_VALUE: Range = {
  max: 3_000_000,
  min: 100_000,
  start: 650_000,
  step: 5000,
};
const BALANCE: Range = { max: 2_500_000, min: 0, start: 310_000, step: 5000 };

/** Screen readers hear slider values as dollars. */
const USD_FORMAT: Intl.NumberFormatOptions = {
  currency: "USD",
  maximumFractionDigits: 0,
  style: "currency",
};

const usd = (value: number) => `$${Math.round(value).toLocaleString("en-US")}`;

const DollarSlider = ({
  label,
  onChange,
  range,
  value,
}: {
  readonly label: string;
  readonly onChange: (value: number) => void;
  readonly range: Range;
  readonly value: number;
}) => {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span id={id} className="text-graphite text-base">
          {label}
        </span>
        <span className="text-base font-medium tabular-nums">{usd(value)}</span>
      </div>
      <Slider
        variant="brand"
        aria-labelledby={id}
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        format={USD_FORMAT}
        onValueChange={(next: number | readonly number[]) => {
          onChange([next].flat()[0] ?? range.min);
        }}
        className="mt-3"
      />
    </div>
  );
};

interface Share {
  readonly key: string;
  readonly label: string;
  readonly swatch: string;
  readonly value: number;
}

/**
 * How the home's value splits: what is owed, the estimated line, and the
 * equity left untouched. The bar is decoration; the legend carries the numbers.
 */
const EquitySplit = ({
  shares,
  total,
}: {
  readonly shares: readonly Share[];
  readonly total: number;
}) => (
  <div className="mt-6">
    <div
      className="bg-canvas flex h-2.5 gap-0.5 overflow-hidden rounded-full"
      aria-hidden="true"
    >
      {shares.map((share) => (
        <span
          key={share.key}
          className={cn(
            "transition-grow h-full grow-(--share) basis-0 rounded-full",
            share.swatch
          )}
          style={{
            "--share": total > 0 ? share.value / total : 0,
          }}
        />
      ))}
    </div>
    <dl className="mt-3 grid grid-cols-3 gap-2 text-base">
      {shares.map((share) => (
        <div key={share.key} className="flex min-w-0 flex-col justify-between">
          <dt className="text-graphite flex items-start gap-1.5 leading-tight">
            <span
              className={cn("mt-1 size-2 shrink-0 rounded-full", share.swatch)}
              aria-hidden="true"
            />
            <span>{share.label}</span>
          </dt>
          <dd className="mt-1 font-medium tabular-nums">{usd(share.value)}</dd>
        </div>
      ))}
    </dl>
  </div>
);

/**
 * The hero's quick estimate: two sliders, the line they imply (gliding to
 * each new value), and how the home's value splits. The CTA is a real link
 * to the application carrying the amount, so it works before (or without)
 * hydration; the dialog opens over it once loaded.
 */
const EquityEstimator = ({ applyHref, strings }: EquityEstimatorProps) => {
  const [home, setHome] = useState(HOME_VALUE.start);
  const [balance, setBalance] = useState(BALANCE.start);
  const line = availableLine(home, balance);
  const shown = useTweenedNumber(line);
  const amount = prefillAmount(Math.max(line, MIN_AMOUNT));
  const owed = Math.min(balance, home);
  const shares: readonly Share[] = [
    {
      key: "mortgage",
      label: strings.mortgageShare,
      swatch: "bg-ink",
      value: owed,
    },
    { key: "line", label: strings.lineShare, swatch: "bg-sky", value: line },
    {
      key: "kept",
      label: strings.kept,
      swatch: "bg-line",
      value: Math.max(0, home - owed - line),
    },
  ];
  const inRange = line >= MIN_AMOUNT;

  return (
    <div className="equity-estimator text-ink" data-ui="">
      <p className="text-base">{strings.line}</p>
      <p
        className="text-figure tracking-figure mt-3 font-medium tabular-nums"
        aria-hidden="true"
      >
        {usd(shown)}
      </p>
      <output aria-live="polite" className="sr-only">
        {usd(line)}
      </output>

      <EquitySplit shares={shares} total={home} />

      <div className="mt-8 space-y-6">
        <DollarSlider
          label={strings.homeValue}
          range={HOME_VALUE}
          value={home}
          onChange={setHome}
        />
        <DollarSlider
          label={strings.mortgageBalance}
          range={BALANCE}
          value={balance}
          onChange={setBalance}
        />
      </div>

      <output className="mt-6 block text-base">
        {inRange ? strings.within : strings.below}
      </output>

      <a
        href={`${applyHref}?amount=${encodeURIComponent(amount)}`}
        data-apply=""
        data-amount={amount}
        className={cn(
          buttonVariants({ size: "hero", variant: "accent" }),
          "mt-8 w-full"
        )}
      >
        {strings.cta}
      </a>
      <p className="text-graphite mt-4 text-center text-base leading-relaxed">
        {strings.note}
      </p>
    </div>
  );
};

export default EquityEstimator;
