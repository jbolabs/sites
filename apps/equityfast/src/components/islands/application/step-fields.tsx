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

type TextField = Exclude<keyof ApplicationAnswers, "consent">;

export interface StepFieldsProps {
  readonly step: StepKey;
  readonly title: string;
  readonly answers: ApplicationAnswers;
  readonly problems: readonly string[];
  readonly strings: UiStrings;
  readonly onText: (field: TextField, value: string) => void;
  readonly onConsent: (value: boolean) => void;
}

type Errors = UiStrings["form"]["errors"];

/** Fields with a message of their own; the rest share one by kind (name, street, ...). */
const OWN_MESSAGE: Partial<Record<TextField, keyof Errors>> = {
  amount: "amount",
  birthDate: "birthDate",
  email: "email",
  income: "income",
  incomeSource: "incomeSource",
  otherIncome: "otherIncome",
  phone: "phone",
};

/** The message under an invalid field; blank required fields say so plainly. */
const errorFor = (field: TextField, value: string, errors: Errors): string => {
  const own = OWN_MESSAGE[field];
  if (own !== undefined) {
    return errors[own];
  }
  if (value.trim() === "" && field !== "middleName") {
    return field.endsWith("State") ? errors.state : errors.required;
  }
  if (field.endsWith("Name")) {
    return errors.name;
  }
  if (field.endsWith("Street")) {
    return errors.street;
  }
  if (field.endsWith("City")) {
    return errors.city;
  }
  if (field.endsWith("State")) {
    return errors.state;
  }
  if (field.endsWith("Zip")) {
    return errors.zip;
  }
  return errors.choice;
};

/** Ids for a field's input and its error, so the error is read with the field. */
const ids = (field: string) => ({
  error: `apply-${field}-error`,
  input: `apply-${field}`,
});

const InlineError = ({ id, message }: { id: string; message: string }) => (
  <div className="animate-in fade-in slide-in-from-top-1 ease-out-strong duration-200">
    <FieldError id={id}>{message}</FieldError>
  </div>
);

const NO_EXTRA: Partial<ComponentProps<"input">> = {};

interface FieldProps {
  readonly answers: ApplicationAnswers;
  readonly errors: Errors;
  readonly onText: StepFieldsProps["onText"];
  readonly problems: readonly string[];
}

const TextInput = ({
  answers,
  errors,
  extra = NO_EXTRA,
  field,
  format,
  help,
  label,
  onText,
  problems,
}: FieldProps & {
  readonly extra?: Partial<ComponentProps<"input">>;
  readonly field: TextField;
  readonly format?: (value: string) => string;
  /** A short hint under the label (`Enter 0 if none`). */
  readonly help?: string;
  readonly label: ReactNode;
}) => {
  const invalid = problems.includes(field);
  const id = ids(field);
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id.input} size="large">
        {label}
      </FieldLabel>
      {help !== undefined && (
        <p className="text-graphite -mt-1 text-sm">{help}</p>
      )}
      <Input
        id={id.input}
        variant="large"
        value={answers[field]}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? id.error : undefined}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          onText(field, format === undefined ? raw : format(raw));
        }}
        {...extra}
      />
      {invalid && (
        <InlineError
          id={id.error}
          message={errorFor(field, answers[field], errors)}
        />
      )}
    </Field>
  );
};

/** One answer from a fixed list, as a native select (states, income source). */
const SelectField = ({
  answers,
  autoComplete,
  errors,
  field,
  label,
  onText,
  options,
  placeholder,
  problems,
}: FieldProps & {
  readonly autoComplete?: string;
  readonly field: "propertyState" | "primaryState" | "incomeSource";
  readonly label: string;
  /** `[value, label]` pairs, in display order. */
  readonly options: readonly (readonly [string, string])[];
  readonly placeholder: string;
}) => {
  const invalid = problems.includes(field);
  const id = ids(field);
  // Drafts saved before the state select held free text; an unknown value shows the placeholder.
  const current =
    field === "incomeSource"
      ? answers[field]
      : answers[field].trim().toUpperCase();
  const known = options.some(([value]) => value === current);
  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id.input} size="large">
        {label}
      </FieldLabel>
      <NativeSelect
        id={id.input}
        variant="large"
        className="w-full"
        required
        autoComplete={autoComplete}
        value={known ? current : ""}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? id.error : undefined}
        onChange={(event) => {
          onText(field, event.currentTarget.value);
        }}
      >
        <NativeSelectOption value="" disabled>
          {placeholder}
        </NativeSelectOption>
        {options.map(([value, name]) => (
          <NativeSelectOption key={value} value={value}>
            {name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {invalid && (
        <InlineError
          id={id.error}
          message={errorFor(field, answers[field], errors)}
        />
      )}
    </Field>
  );
};

const AddressFields = ({
  prefix,
  ...props
}: Omit<StepFieldsProps, "step" | "title" | "onConsent"> & {
  readonly prefix: "property" | "primary";
}) => {
  const t = props.strings.form;
  // A separate autofill section, so the browser doesn't reuse the property address.
  const section = prefix === "primary" ? "section-primary " : "";
  const shared = {
    answers: props.answers,
    errors: t.errors,
    onText: props.onText,
    problems: props.problems,
  };
  return (
    <div className="grid gap-5">
      <TextInput
        {...shared}
        field={`${prefix}Street`}
        label={t.street}
        extra={{
          autoComplete: `${section}street-address`,
          placeholder: "123 Main St",
        }}
      />
      <TextInput
        {...shared}
        field={`${prefix}City`}
        label={t.city}
        extra={{
          autoComplete: `${section}address-level2`,
          placeholder: "Santa Ana",
        }}
      />
      <div className="grid grid-cols-2 items-start gap-4">
        <SelectField
          {...shared}
          field={`${prefix}State`}
          label={t.state}
          options={US_STATES}
          placeholder={t.statePlaceholder}
          autoComplete={`${section}address-level1`}
        />
        <TextInput
          {...shared}
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

/** The inputs for one step of the application. */
const StepFields = (props: StepFieldsProps) => {
  const { answers, onConsent, onText, problems, step, strings, title } = props;
  const t = strings.form;
  const shared = { answers, errors: t.errors, onText, problems };
  const choice = (
    field: "occupancy" | "ownership" | "forSale",
    options: readonly string[],
    labels: Readonly<Record<string, string>>
  ) => {
    const invalid = problems.includes(field);
    return (
      <div className="grid gap-3">
        <ChoiceGroup
          title={title}
          options={options}
          labels={labels}
          value={answers[field]}
          invalid={invalid}
          errorId={invalid ? ids(field).error : undefined}
          onChange={(value) => {
            onText(field, value);
          }}
        />
        {invalid && (
          <InlineError id={ids(field).error} message={t.errors.choice} />
        )}
      </div>
    );
  };
  switch (step) {
    case "amount": {
      return (
        <div>
          <TextInput
            {...shared}
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
            {...shared}
            field="firstName"
            label={t.firstName}
            extra={{ autoComplete: "given-name", placeholder: "Jordan" }}
          />
          <TextInput
            {...shared}
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
            {...shared}
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
            {...shared}
            field="email"
            label={strings.emailLabel}
            extra={{
              autoComplete: "email",
              placeholder: "you@email.com",
              type: "email",
            }}
          />
          <TextInput
            {...shared}
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
          <div className="grid gap-1.5">
            <label
              className={cn(
                "bg-canvas text-ink flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-base leading-relaxed",
                problems.includes("consent")
                  ? "border-destructive"
                  : "border-border"
              )}
            >
              <Checkbox
                id={ids("consent").input}
                size="large"
                checked={answers.consent}
                aria-invalid={problems.includes("consent") || undefined}
                aria-describedby={
                  problems.includes("consent")
                    ? ids("consent").error
                    : undefined
                }
                onCheckedChange={(checked) => {
                  onConsent(checked);
                }}
                className="mt-1"
              />
              <span>{t.consent}</span>
            </label>
            {problems.includes("consent") && (
              <InlineError
                id={ids("consent").error}
                message={t.errors.consent}
              />
            )}
          </div>
        </div>
      );
    }
    case "propertyAddress": {
      return <AddressFields {...props} prefix="property" />;
    }
    case "primaryAddress": {
      return <AddressFields {...props} prefix="primary" />;
    }
    case "occupancy": {
      return choice("occupancy", OCCUPANCY, strings.options.occupancy);
    }
    case "ownership": {
      return choice("ownership", OWNERSHIP, strings.options.ownership);
    }
    case "forSale": {
      return choice("forSale", FOR_SALE, strings.options.forSale);
    }
    case "income": {
      return (
        <div className="grid gap-5">
          <TextInput
            {...shared}
            field="income"
            label={t.income}
            format={formatDollars}
            extra={{ inputMode: "numeric", placeholder: "$140,000" }}
          />
          <TextInput
            {...shared}
            field="otherIncome"
            label={t.otherIncome}
            help={t.otherIncomeHelp}
            format={formatDollars}
            extra={{ inputMode: "numeric", placeholder: "$12,000" }}
          />
          <SelectField
            {...shared}
            field="incomeSource"
            label={t.incomeSource}
            options={INCOME_SOURCES.map((source) => [
              source,
              strings.options.incomeSource[source],
            ])}
            placeholder={t.incomeSourcePlaceholder}
          />
          <TextInput
            {...shared}
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
