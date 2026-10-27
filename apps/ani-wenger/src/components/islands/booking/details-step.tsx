import { isEmailAddress } from "@jakebodea/cloudflare-kit/contact-rules";
import {
  SUBMITTING,
  fieldState,
  nextFieldOnEnter,
  useSiteForm,
} from "@jakebodea/site-ui/form";
import type { FieldMessages } from "@jakebodea/site-ui/form";
import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface Details {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly notes: string;
}

interface DetailsStepProps {
  readonly bookingNote: string;
  readonly sending: boolean;
  readonly error: string | undefined;
  readonly turnstileRef: (element: HTMLDivElement | null) => void;
  readonly verified: boolean;
  readonly onSubmit: (details: Details) => void;
}

const FORM_ID = "book-details";
const ID_PREFIX = "book";

const EMPTY: Details = { email: "", name: "", notes: "", phone: "" };

const within = (value: string, min: number, max: number) => {
  const { length } = value.trim();
  return length >= min && length <= max;
};

/** The booking action's rules (`lib/booking/booking.ts`), in Ani's words. */
const validate = (details: Details): FieldMessages<Details> => {
  const messages: { -readonly [Key in keyof Details]?: string } = {};
  if (!within(details.name, 2, 120)) {
    messages.name = "Enter your name.";
  }
  if (!isEmailAddress(details.email.trim())) {
    messages.email = "Enter a valid email address, like you@email.com.";
  }
  if (!within(details.phone, 7, 40)) {
    messages.phone = "Enter a mobile number I can text or call.";
  }
  if (!within(details.notes, 0, 1000)) {
    messages.notes = "Keep this under 1,000 characters.";
  }
  return messages;
};

export const DetailsStep = ({
  bookingNote,
  error,
  onSubmit,
  sending,
  turnstileRef,
  verified,
}: DetailsStepProps) => {
  const [unverified, setUnverified] = useState(false);
  const form = useSiteForm({
    defaultValues: EMPTY,
    formId: FORM_ID,
    onSubmit: (details) => {
      setUnverified(!verified);
      if (verified) {
        onSubmit(details);
      }
    },
    validate,
  });
  const shownError =
    unverified && !verified
      ? "Finish the security check above, then book."
      : error;
  return (
    <form
      id={FORM_ID}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!sending) {
          void form.handleSubmit();
        }
      }}
      className="max-w-2xl"
    >
      <FieldGroup>
        <form.Field name="name">
          {(field) => {
            const state = fieldState(field, ID_PREFIX);
            return (
              <Field data-invalid={state.isInvalid || undefined}>
                <FieldLabel htmlFor={state.id}>Name</FieldLabel>
                <Input
                  {...state.control}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.currentTarget.value);
                  }}
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  onKeyDown={nextFieldOnEnter}
                  className="h-12"
                />
                {state.isInvalid && (
                  <FieldError id={state.errorId} errors={state.errors} />
                )}
              </Field>
            );
          }}
        </form.Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <form.Field name="email">
            {(field) => {
              const state = fieldState(field, ID_PREFIX);
              return (
                <Field data-invalid={state.isInvalid || undefined}>
                  <FieldLabel htmlFor={state.id}>Email</FieldLabel>
                  <Input
                    {...state.control}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.currentTarget.value);
                    }}
                    type="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="next"
                    onKeyDown={nextFieldOnEnter}
                    className="h-12"
                  />
                  <FieldDescription>
                    Your confirmation goes here.
                  </FieldDescription>
                  {state.isInvalid && (
                    <FieldError id={state.errorId} errors={state.errors} />
                  )}
                </Field>
              );
            }}
          </form.Field>
          <form.Field name="phone">
            {(field) => {
              const state = fieldState(field, ID_PREFIX);
              return (
                <Field data-invalid={state.isInvalid || undefined}>
                  <FieldLabel htmlFor={state.id}>Mobile phone</FieldLabel>
                  <Input
                    {...state.control}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.currentTarget.value);
                    }}
                    type="tel"
                    autoComplete="tel"
                    enterKeyHint="next"
                    onKeyDown={nextFieldOnEnter}
                    className="h-12"
                  />
                  <FieldDescription>
                    In case I need to reach you.
                  </FieldDescription>
                  {state.isInvalid && (
                    <FieldError id={state.errorId} errors={state.errors} />
                  )}
                </Field>
              );
            }}
          </form.Field>
        </div>
        <form.Field name="notes">
          {(field) => {
            const state = fieldState(field, ID_PREFIX);
            return (
              <Field data-invalid={state.isInvalid || undefined}>
                <FieldLabel htmlFor={state.id}>
                  Anything I should know?{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </FieldLabel>
                <Textarea
                  {...state.control}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.currentTarget.value);
                  }}
                  rows={4}
                  placeholder="Anything about your hair, your event, or your schedule."
                />
                {state.isInvalid && (
                  <FieldError id={state.errorId} errors={state.errors} />
                )}
              </Field>
            );
          }}
        </form.Field>
        <p className="bg-sand/70 text-foreground/80 rounded-xl p-4 text-sm leading-relaxed">
          {bookingNote}
        </p>
        <div ref={turnstileRef} className="min-h-[65px]" />
        {shownError !== undefined && <FieldError>{shownError}</FieldError>}
        <Button
          type="submit"
          size="hero"
          disabled={sending}
          className="w-full sm:w-auto sm:self-start"
        >
          {sending && (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          )}
          {sending ? SUBMITTING : "Book appointment"}
        </Button>
      </FieldGroup>
    </form>
  );
};
