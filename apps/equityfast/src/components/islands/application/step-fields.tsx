import { fieldState } from "@jakebodea/site-ui/form";
import type { ComponentProps, ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import type { UiStrings } from "@/i18n/ui";
import {
  FOR_SALE,
  INCOME_SOURCES,
  OCCUPANCY,
  OWNERSHIP,
  US_STATES,
  formatBirthDate,
  formatDollars,
  formatPhone,
  formatZip,
} from "@/lib/application-rules";
import type { ApplicationAnswers, StepKey } from "@/lib/application-rules";
import { cn } from "@/lib/utils";

import ChoiceGroup from "./choice-group";
import type { ApplicationFormApi } from "./use-application-form";

type TextField = Exclude<keyof ApplicationAnswers, "consent">;
type ChoiceField = "occupancy" | "ownership" | "forSale";

/** Ids are `apply-<field>`; the error under a field is `apply-<field>-error`. */
const ID_PREFIX = "apply";

export interface StepFieldsProps {
  readonly form: ApplicationFormApi;
  readonly step: StepKey;
  readonly title: string;
  readonly strings: UiStrings;
  /** Called after a pick on a single-choice step, which then moves on by itself. */
  readonly onChoice: () => void;
}

const InlineError = ({
  errors,
  id,
}: {
  readonly errors: readonly { message: string }[];
  readonly id: string;
}) => (
  <div className="animate-in fade-in slide-in-from-top-1 ease-out-strong duration-200">
    <FieldError id={id} errors={[...errors]} />
  </div>
);

const NO_EXTRA: Partial<ComponentProps<"input">> = {};

const TextInput = ({
  extra = NO_EXTRA,
  field: name,
  form,
  format,
  help,
  label,
}: {
  readonly extra?: Partial<ComponentProps<"input">>;
  readonly field: TextField;
  readonly form: ApplicationFormApi;
  readonly format?: (value: string) => string;
  /** A short hint under the label (`Leave at $0 if none`). */
  readonly help?: string;
  readonly label: ReactNode;
}) => (
  <form.Field name={name}>
    {(field) => {
      const state = fieldState(field, ID_PREFIX);
      return (
        <Field data-invalid={state.isInvalid || undefined}>
          <FieldLabel htmlFor={state.id} size="large">
            {label}
          </FieldLabel>
          {help !== undefined && (
            <p className="text-graphite -mt-1 text-sm">{help}</p>
          )}
          <Input
            {...state.control}
            name={field.name}
            variant="large"
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => {
              const raw = event.currentTarget.value;
              field.handleChange(format === undefined ? raw : format(raw));
            }}
            {...extra}
          />
          {state.isInvalid && (
            <InlineError id={state.errorId} errors={state.errors} />
          )}
        </Field>
      );
    }}
  </form.Field>
);

/** One answer from a fixed list, as a native select (states, income source). */
const SelectField = ({
  autoComplete,
  field: name,
  form,
  label,
  options,
  placeholder,
}: {
  readonly autoComplete?: string;
  readonly field: "propertyState" | "primaryState" | "incomeSource";
  readonly form: ApplicationFormApi;
  readonly label: string;
  /** `[value, label]` pairs, in display order. */
  readonly options: readonly (readonly [string, string])[];
  readonly placeholder: string;
}) => (
  <form.Field name={name}>
    {(field) => {
      const state = fieldState(field, ID_PREFIX);
      // Drafts saved before the state select held free text; an unknown value shows the placeholder.
      const current =
        name === "incomeSource"
          ? field.state.value
          : field.state.value.trim().toUpperCase();
      const known = options.some(([value]) => value === current);
      return (
        <Field data-invalid={state.isInvalid || undefined}>
          <FieldLabel htmlFor={state.id} size="large">
            {label}
          </FieldLabel>
          <NativeSelect
            {...state.control}
            name={field.name}
            variant="large"
            className="w-full"
            autoComplete={autoComplete}
            value={known ? current : ""}
            onBlur={field.handleBlur}
            onChange={(event) => {
              field.handleChange(event.currentTarget.value);
            }}
          >
            <NativeSelectOption value="" disabled>
              {placeholder}
            </NativeSelectOption>
            {options.map(([value, text]) => (
              <NativeSelectOption key={value} value={value}>
                {text}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {state.isInvalid && (
            <InlineError id={state.errorId} errors={state.errors} />
          )}
        </Field>
      );
    }}
  </form.Field>
);

const AddressFields = ({
  form,
  prefix,
  strings,
}: {
  readonly form: ApplicationFormApi;
  readonly prefix: "property" | "primary";
  readonly strings: UiStrings;
}) => {
  const t = strings.form;
  // A separate autofill section, so the browser doesn't reuse the property address.
  const section = prefix === "primary" ? "section-primary " : "";
  return (
    <div className="grid gap-5">
      <TextInput
        form={form}
        field={`${prefix}Street`}
        label={t.street}
        extra={{
          autoComplete: `${section}street-address`,
          placeholder: "123 Main St",
        }}
      />
      <TextInput
        form={form}
        field={`${prefix}City`}
        label={t.city}
        extra={{
          autoComplete: `${section}address-level2`,
          placeholder: "Santa Ana",
        }}
      />
      <div className="grid grid-cols-2 items-start gap-4">
        <SelectField
          form={form}
          field={`${prefix}State`}
          label={t.state}
          options={US_STATES}
          placeholder={t.statePlaceholder}
          autoComplete={`${section}address-level1`}
        />
        <TextInput
          form={form}
          field={`${prefix}Zip`}
          label={t.zip}
          format={formatZip}
          extra={{
            autoComplete: `${section}postal-code`,
            inputMode: "numeric",
            maxLength: 10,
            placeholder: "92704",
          }}
        />
      </div>
    </div>
  );
};

/** A step that asks one single-choice question; a pick moves on by itself. */
const ChoiceStep = ({
  field: name,
  form,
  labels,
  onChoice,
  options,
  title,
}: {
  readonly field: ChoiceField;
  readonly form: ApplicationFormApi;
  readonly labels: Readonly<Record<string, string>>;
  readonly onChoice: () => void;
  readonly options: readonly string[];
  readonly title: string;
}) => (
  <form.Field name={name}>
    {(field) => {
      const state = fieldState(field, ID_PREFIX);
      return (
        <div className="grid gap-3">
          <ChoiceGroup
            id={state.id}
            title={title}
            options={options}
            labels={labels}
            value={field.state.value}
            invalid={state.isInvalid}
            errorId={state.control["aria-describedby"]}
            onBlur={field.handleBlur}
            onChange={(value) => {
              field.handleChange(value);
              onChoice();
            }}
          />
          {state.isInvalid && (
            <InlineError id={state.errorId} errors={state.errors} />
          )}
        </div>
      );
    }}
  </form.Field>
);

const ConsentField = ({
  form,
  label,
}: {
  readonly form: ApplicationFormApi;
  readonly label: string;
}) => (
  <form.Field name="consent">
    {(field) => {
      const state = fieldState(field, ID_PREFIX);
      return (
        <div className="grid gap-1.5">
          <label
            className={cn(
              "bg-canvas text-ink flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-base leading-relaxed",
              state.isInvalid ? "border-destructive" : "border-border"
            )}
          >
            <Checkbox
              {...state.control}
              name={field.name}
              size="large"
              checked={field.state.value}
              onBlur={field.handleBlur}
              onCheckedChange={(checked) => {
                field.handleChange(checked);
              }}
              className="mt-1"
            />
            <span>{label}</span>
          </label>
          {state.isInvalid && (
            <InlineError id={state.errorId} errors={state.errors} />
          )}
        </div>
      );
    }}
  </form.Field>
);

/** The inputs for one step of the application. */
const StepFields = ({
  form,
  onChoice,
  step,
  strings,
  title,
}: StepFieldsProps) => {
  const t = strings.form;
  switch (step) {
    case "amount": {
      return (
        <div>
          <TextInput
            form={form}
            field="amount"
            label={t.amountLabel}
            format={formatDollars}
            extra={{ inputMode: "numeric", placeholder: "$75,000" }}
          />
          <p className="text-graphite mt-2 text-xs">{t.amountHelp}</p>
        </div>
      );
    }
    case "name": {
      return (
        <div className="grid gap-5">
          <TextInput
            form={form}
            field="firstName"
            label={t.firstName}
            extra={{ autoComplete: "given-name", placeholder: "Jordan" }}
          />
          <TextInput
            form={form}
            field="middleName"
            label={
              <>
                {t.middleName}{" "}
                <span className="text-graphite text-sm font-normal">
                  ({t.optional})
                </span>
              </>
            }
            extra={{ autoComplete: "additional-name", placeholder: "A." }}
          />
          <TextInput
            form={form}
            field="lastName"
            label={t.lastName}
            extra={{ autoComplete: "family-name", placeholder: "Reyes" }}
          />
        </div>
      );
    }
    case "contact": {
      return (
        <div className="grid gap-5">
          <TextInput
            form={form}
            field="email"
            label={strings.emailLabel}
            extra={{
              autoComplete: "email",
              placeholder: "you@email.com",
              type: "email",
            }}
          />
          <TextInput
            form={form}
            field="phone"
            label={t.phoneLabel}
            format={formatPhone}
            extra={{
              autoComplete: "tel",
              inputMode: "tel",
              placeholder: "(555) 010-1234",
              type: "tel",
            }}
          />
          <ConsentField form={form} label={t.consent} />
        </div>
      );
    }
    case "propertyAddress": {
      return <AddressFields form={form} strings={strings} prefix="property" />;
    }
    case "primaryAddress": {
      return <AddressFields form={form} strings={strings} prefix="primary" />;
    }
    case "occupancy": {
      return (
        <ChoiceStep
          form={form}
          field="occupancy"
          title={title}
          options={OCCUPANCY}
          labels={strings.options.occupancy}
          onChoice={onChoice}
        />
      );
    }
    case "ownership": {
      return (
        <ChoiceStep
          form={form}
          field="ownership"
          title={title}
          options={OWNERSHIP}
          labels={strings.options.ownership}
          onChoice={onChoice}
        />
      );
    }
    case "forSale": {
      return (
        <ChoiceStep
          form={form}
          field="forSale"
          title={title}
          options={FOR_SALE}
          labels={strings.options.forSale}
          onChoice={onChoice}
        />
      );
    }
    case "income": {
      return (
        <div className="grid gap-5">
          <TextInput
            form={form}
            field="income"
            label={t.income}
            format={formatDollars}
            extra={{ inputMode: "numeric", placeholder: "$140,000" }}
          />
          <TextInput
            form={form}
            field="otherIncome"
            label={t.otherIncome}
            help={t.otherIncomeHelp}
            format={formatDollars}
            extra={{ inputMode: "numeric", placeholder: "$0" }}
          />
          <SelectField
            form={form}
            field="incomeSource"
            label={t.incomeSource}
            options={INCOME_SOURCES.map((source) => [
              source,
              strings.options.incomeSource[source],
            ])}
            placeholder={t.incomeSourcePlaceholder}
          />
          <TextInput
            form={form}
            field="birthDate"
            label={t.birthDate}
            format={formatBirthDate}
            extra={{
              autoComplete: "bday",
              inputMode: "numeric",
              maxLength: 10,
              placeholder: t.birthDateHelp,
            }}
          />
        </div>
      );
    }
    default: {
      return null;
    }
  }
};

export default StepFields;
