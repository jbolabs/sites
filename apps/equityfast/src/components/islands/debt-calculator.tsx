import { PlusIcon, XIcon } from "lucide-react";
import { useId, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { UiStrings } from "@/i18n/ui";
import { prefillAmount } from "@/lib/application-rules";
import { balanceCeiling, debtTotals } from "@/lib/debt";
import { cn } from "@/lib/utils";

import { useTweenedNumber } from "./use-tweened-number";

export interface DebtPreset {
  readonly name: string;
  readonly typicalBalance: number;
  readonly aprPercent: number;
}

type Strings = UiStrings["debt"];

interface DebtCalculatorProps {
  readonly presets: readonly DebtPreset[];
  readonly lineRate: number;
  readonly strings: Strings;
  readonly disclaimer: string | undefined;
  readonly applyHref: string;
}

interface Row {
  readonly id: number;
  readonly name: string;
  readonly balance: number;
  readonly aprPercent: number;
  readonly ceiling: number;
}

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
const BALANCE_STEP = 500;
const MAX_APR = 60;
const LINE_RATE = { max: 15, min: 4, step: 0.25 } as const;
/** Two debts are in the list on first paint, so the result is never empty. */
const STARTING_ROWS = 2;
const NON_DIGITS = /\D/gu;
const NOT_DECIMAL = /[^\d.]/gu;

const rowFrom = (preset: DebtPreset, id: number): Row => ({
  aprPercent: preset.aprPercent,
  balance: preset.typicalBalance,
  ceiling: balanceCeiling(preset.typicalBalance),
  id,
  name: preset.name,
});

/** A rate field that keeps what's typed ("24.") until it leaves focus. */
const AprInput = ({
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
      className="w-20"
      value={draft ?? percent(value)}
      onFocus={() => {
        setDraft(String(value));
      }}
      onChange={(event) => {
        const typed = event.currentTarget.value.replaceAll(NOT_DECIMAL, "");
        setDraft(typed);
        const parsed = Number(typed);
        onChange(
          Number.isFinite(parsed) ? Math.min(MAX_APR, Math.max(0, parsed)) : 0
        );
      }}
      onBlur={() => {
        setDraft(undefined);
      }}
    />
  );
};

const DebtRow = ({
  onChange,
  onRemove,
  row,
  strings,
}: {
  readonly onChange: (row: Row) => void;
  readonly onRemove: () => void;
  readonly row: Row;
  readonly strings: Strings;
}) => (
  <li className="border-line animate-in fade-in slide-in-from-top-1 ease-out-strong rounded-2xl border bg-white p-4 duration-200 sm:p-5">
    <div className="flex items-center justify-between gap-3">
      <p className="text-ink text-base font-medium">{row.name}</p>
      <Button
        type="button"
        variant="quiet"
        size="icon"
        aria-label={`${strings.remove} ${row.name}`}
        className="-mr-1.5"
        onClick={onRemove}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </div>
    <div className="mt-3 flex items-center gap-4">
      <Slider
        variant="brand"
        aria-label={`${strings.balanceFor} ${row.name}`}
        format={USD_FORMAT}
        min={0}
        max={Math.max(row.ceiling, row.balance)}
        step={BALANCE_STEP}
        value={row.balance}
        onValueChange={(next: number | readonly number[]) => {
          onChange({ ...row, balance: [next].flat()[0] ?? 0 });
        }}
      />
      <Input
        aria-label={`${strings.balanceFor} ${row.name}`}
        inputMode="numeric"
        variant="compact"
        value={usd(row.balance)}
        onChange={(event) => {
          onChange({
            ...row,
            balance: Number(
              event.currentTarget.value.replaceAll(NON_DIGITS, "")
            ),
          });
        }}
      />
    </div>
    <div className="mt-3 flex items-center justify-between gap-3">
      <label className="text-graphite flex items-center gap-2 text-sm">
        {strings.apr}
        <AprInput
          label={`${strings.aprFor} ${row.name}`}
          value={row.aprPercent}
          onChange={(aprPercent) => {
            onChange({ ...row, aprPercent });
          }}
        />
      </label>
      <p className="text-graphite text-sm tabular-nums">
        {strings.perMonth.replace(
          "{amount}",
          usd((row.balance * row.aprPercent) / 1200)
        )}
      </p>
    </div>
  </li>
);

/** One side of the comparison: a label, its monthly interest, and a bar. */
const Bar = ({
  label,
  detail,
  monthly,
  share,
  strings,
  tone,
}: {
  readonly label: string;
  readonly detail: string;
  readonly monthly: number;
  readonly share: number;
  readonly strings: Strings;
  readonly tone: string;
}) => (
  <div>
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-ink font-medium">{label}</span>
      <span className="text-ink font-mono font-medium tabular-nums">
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
    <p className="text-graphite mt-1.5 text-xs">{detail}</p>
  </div>
);

/**
 * Add the debts you carry, set each balance and rate, and see the interest
 * they cost next to the same total on one home equity line. Debt names and
 * typical figures come from the CMS; two start in the list so the result
 * shows before anyone touches it.
 */
const DebtCalculator = ({
  applyHref,
  disclaimer,
  lineRate: startingRate,
  presets,
  strings,
}: DebtCalculatorProps) => {
  const rateId = useId();
  const [rows, setRows] = useState<readonly Row[]>(() =>
    presets.slice(0, STARTING_ROWS).map(rowFrom)
  );
  const nextId = useRef(STARTING_ROWS);
  const [lineRate, setLineRate] = useState(startingRate);
  const totals = debtTotals(rows, lineRate);
  const saved = useTweenedNumber(totals.savedPerYear);
  const largest = Math.max(1, totals.monthlyToday, totals.monthlyWithLine);
  const amount = prefillAmount(totals.balance);

  const update = (next: Row) => {
    setRows((current) =>
      current.map((row) => (row.id === next.id ? next : row))
    );
  };
  const add = (preset: DebtPreset) => {
    const id = nextId.current;
    nextId.current += 1;
    setRows((current) => [...current, rowFrom(preset, id)]);
  };
  const remove = (id: number) => {
    setRows((current) => current.filter((row) => row.id !== id));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="min-w-0">
        <ul className="grid gap-3">
          {rows.map((row) => (
            <DebtRow
              key={row.id}
              row={row}
              strings={strings}
              onChange={update}
              onRemove={() => {
                remove(row.id);
              }}
            />
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.name}
              type="button"
              variant="outline-ink"
              size="cta"
              onClick={() => {
                add(preset);
              }}
            >
              <PlusIcon aria-hidden="true" />
              {preset.name}
            </Button>
          ))}
        </div>
      </div>

      <aside className="border-line shadow-float min-w-0 rounded-3xl border bg-white p-5 sm:p-7 lg:sticky lg:top-28">
        <p className="text-graphite text-sm">{strings.saved}</p>
        <p
          aria-hidden="true"
          className="text-ink tracking-figure mt-2 text-5xl leading-none font-medium tabular-nums"
        >
          {usd(saved)}
        </p>
        <output aria-live="polite" className="sr-only">
          {usd(totals.savedPerYear)}
        </output>

        <div className="mt-7 space-y-5">
          <Bar
            label={strings.today}
            detail={
              totals.blendedApr === undefined
                ? "-"
                : strings.averageApr.replace(
                    "{rate}",
                    percent(Math.round(totals.blendedApr * 10) / 10)
                  )
            }
            monthly={totals.monthlyToday}
            share={totals.monthlyToday / largest}
            strings={strings}
            tone="bg-ink"
          />
          <Bar
            label={strings.heloc}
            detail={strings.atRate.replace("{rate}", percent(lineRate))}
            monthly={totals.monthlyWithLine}
            share={totals.monthlyWithLine / largest}
            strings={strings}
            tone="bg-sky"
          />
        </div>

        <div className="border-line mt-6 border-t pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <span id={rateId} className="text-graphite text-sm">
              {strings.helocRate}
            </span>
            <span className="font-mono text-sm font-medium tabular-nums">
              {percent(lineRate)}
            </span>
          </div>
          <Slider
            variant="brand"
            aria-labelledby={rateId}
            format={PERCENT_FORMAT}
            min={LINE_RATE.min}
            max={LINE_RATE.max}
            step={LINE_RATE.step}
            value={lineRate}
            onValueChange={(next: number | readonly number[]) => {
              setLineRate([next].flat()[0] ?? startingRate);
            }}
            className="mt-3"
          />
        </div>

        <dl className="border-line mt-6 flex items-center justify-between border-t pt-5">
          <dt className="text-graphite">{strings.total}</dt>
          <dd className="text-ink font-semibold tabular-nums">
            {usd(totals.balance)}
          </dd>
        </dl>

        <a
          href={`${applyHref}?amount=${encodeURIComponent(amount)}`}
          data-apply=""
          data-amount={totals.balance > 0 ? amount : undefined}
          className={cn(
            buttonVariants({ size: "hero", variant: "accent" }),
            "mt-5 w-full"
          )}
        >
          {strings.cta}
        </a>
        {disclaimer !== undefined && (
          <p className="text-graphite mt-4 text-xs leading-relaxed">
            {disclaimer}
          </p>
        )}
      </aside>
    </div>
  );
};

export default DebtCalculator;
