import {
  fitsContactLimit,
  isEmailAddress,
} from "@jakebodea/cloudflare-kit/contact-rules";
import {
  SUBMITTING,
  fieldState,
  useSiteForm,
  useTurnstile,
} from "@jakebodea/site-ui/form";
import type { FieldMessages } from "@jakebodea/site-ui/form";
import { actions, isInputError } from "astro:actions";
import { CheckCircle2Icon, LoaderCircleIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

interface ContactFormProps {
  /** Public Turnstile site key (Cloudflare's always-pass test key outside prod). */
  readonly turnstileSiteKey: string;
}

type Status =
  | { readonly state: "idle" }
  | { readonly state: "sending" }
  | { readonly state: "sent" }
  | { readonly state: "error"; readonly message: string };

const FORM_ID = "contact-form";
const ID_PREFIX = "contact";

// The old site's "Project details" options, plus whole-home and commercial work.
const PROJECT_TYPES = [
  "Whole-home remodel",
  "Kitchen remodel",
  "Bathroom remodel",
  "Home addition",
  "Fire, water, or mold restoration",
  "Commercial project",
  "Working with an architect or engineer",
  "Need drafting services",
  "Something else",
] as const;

interface ContactValues {
  readonly name: string;
  /** Sent as the lead's `company` field, labeled "Project type" in the CMS. */
  readonly company: string;
  readonly email: string;
  readonly phone: string;
  readonly message: string;
}

const EMPTY: ContactValues = {
  company: "",
  email: "",
  message: "",
  name: "",
  phone: "",
};

/** The server's `ContactForm` rules, in this site's words. */
const validate = (values: ContactValues): FieldMessages<ContactValues> => {
  const messages: { -readonly [Key in keyof ContactValues]?: string } = {};
  if (!fitsContactLimit("name", values.name)) {
    messages.name = "Enter your name.";
  }
  if (!isEmailAddress(values.email.trim())) {
    messages.email = "Enter a valid email address, like you@email.com.";
  }
  if (!fitsContactLimit("phone", values.phone)) {
    messages.phone = "Enter a phone number of 40 characters or fewer.";
  }
  if (!fitsContactLimit("message", values.message)) {
    messages.message =
      values.message.trim().length < 10
        ? "Tell us a little about the project (10 characters or more)."
        : "Keep the details under 5,000 characters.";
  }
  return messages;
};

const optional = (value: string) => (value.trim() === "" ? undefined : value);

const ContactForm = ({ turnstileSiteKey }: ContactFormProps) => {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const {
    failed: turnstileFailed,
    mount: turnstileMount,
    reset: resetTurnstile,
    token,
  } = useTurnstile({ siteKey: turnstileSiteKey });

  const form = useSiteForm({
    defaultValues: EMPTY,
    formId: FORM_ID,
    onSubmit: async (values) => {
      if (token === "") {
        setStatus({
          message: "Finish the security check above, then send again.",
          state: "error",
        });
        return;
      }
      setStatus({ state: "sending" });
      const { error } = await actions.contact({
        company: optional(values.company),
        email: values.email,
        message: values.message,
        name: values.name,
        phone: optional(values.phone),
        turnstileToken: token,
      });
      if (error === undefined) {
        setStatus({ state: "sent" });
        return;
      }
      // Tokens are single use: a retry needs a new one.
      resetTurnstile();
      setStatus({
        message: isInputError(error)
          ? "Please check your details and try again."
          : error.message,
        state: "error",
      });
    },
    validate,
  });

  if (status.state === "sent") {
    return (
      <output className="border-border bg-card flex flex-col items-start gap-4 border p-10">
        <CheckCircle2Icon
          className="text-timber-deep size-8"
          aria-hidden="true"
        />
        <h2 className="text-3xl">Thank you. We have your message.</h2>
        <p className="text-muted-foreground">
          Our office will be in touch within one business day.
        </p>
      </output>
    );
  }

  const sending = status.state === "sending";
  return (
    <form
      id={FORM_ID}
      onSubmit={(event) => {
        event.preventDefault();
        if (!sending) {
          void form.handleSubmit();
        }
      }}
      className="border-border bg-card border-t-ink border border-t-2 p-6 sm:p-10"
      noValidate
    >
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-2">
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
                    className="h-11"
                  />
                  {state.isInvalid && (
                    <FieldError id={state.errorId} errors={state.errors} />
                  )}
                </Field>
              );
            }}
          </form.Field>
          <form.Field name="company">
            {(field) => {
              const state = fieldState(field, ID_PREFIX);
              return (
                <Field>
                  <FieldLabel htmlFor={state.id}>Project type</FieldLabel>
                  <NativeSelect
                    {...state.control}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.currentTarget.value);
                    }}
                    className="w-full"
                    size="lg"
                  >
                    <NativeSelectOption value="">
                      Choose one (optional)
                    </NativeSelectOption>
                    {PROJECT_TYPES.map((type) => (
                      <NativeSelectOption key={type} value={type}>
                        {type}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              );
            }}
          </form.Field>
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
                    className="h-11"
                  />
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
                  <FieldLabel htmlFor={state.id}>
                    Phone{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </FieldLabel>
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
                    className="h-11"
                  />
                  {state.isInvalid && (
                    <FieldError id={state.errorId} errors={state.errors} />
                  )}
                </Field>
              );
            }}
          </form.Field>
        </div>
        <form.Field name="message">
          {(field) => {
            const state = fieldState(field, ID_PREFIX);
            return (
              <Field data-invalid={state.isInvalid || undefined}>
                <FieldLabel htmlFor={state.id}>Project details</FieldLabel>
                <Textarea
                  {...state.control}
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.currentTarget.value);
                  }}
                  rows={6}
                  className="min-h-36"
                  placeholder="Where is the home, what would you like to build or change, and when are you hoping to start?"
                />
                {state.isInvalid && (
                  <FieldError id={state.errorId} errors={state.errors} />
                )}
              </Field>
            );
          }}
        </form.Field>
        <div ref={turnstileMount} className="min-h-[65px]" />
        {turnstileFailed && (
          <FieldError>
            The spam check could not load. Please refresh the page.
          </FieldError>
        )}
        {status.state === "error" && <FieldError>{status.message}</FieldError>}
        <Button
          type="submit"
          size="hero"
          disabled={sending}
          className="w-full sm:w-auto sm:self-start"
        >
          {sending && (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          )}
          {sending ? SUBMITTING : "Send message"}
        </Button>
      </FieldGroup>
    </form>
  );
};

export default ContactForm;
