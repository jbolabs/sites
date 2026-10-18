import { actions, isInputError } from "astro:actions";
import { CheckCircle2Icon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { UiStrings } from "@/i18n/ui";

import { loadTurnstile } from "./turnstile";

type ContactMethod = "Email" | "Cell phone";

interface ContactFormProps {
  /** `contact` keeps the old Google Form's fields; `prayer` the old prayer page's. */
  readonly kind: "contact" | "prayer";
  readonly locale: "en" | "ro";
  readonly strings: UiStrings["form"];
  /** Public Turnstile site key (Cloudflare's always-pass test key outside prod). */
  readonly turnstileSiteKey: string;
}

type Status =
  | { readonly state: "idle" }
  | { readonly state: "sending" }
  | { readonly state: "sent" }
  | { readonly state: "error"; readonly message: string };

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return value === null || value instanceof File ? "" : value;
};

const optional = (value: string) => (value.trim() === "" ? undefined : value);

const ContactForm = ({
  kind,
  locale,
  strings,
  turnstileSiteKey,
}: ContactFormProps) => {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [token, setToken] = useState("");
  const [contactBy, setContactBy] = useState<readonly ContactMethod[]>([]);
  const widget = useRef<HTMLDivElement>(null);
  const prayer = kind === "prayer";

  useEffect(() => {
    const element = widget.current;
    let widgetId: string | undefined;
    let cancelled = false;
    const mount = async (target: HTMLDivElement) => {
      try {
        const turnstile = await loadTurnstile();
        if (cancelled) {
          return;
        }
        widgetId = turnstile.render(target, {
          callback: setToken,
          "error-callback": () => {
            setToken("");
          },
          "expired-callback": () => {
            setToken("");
          },
          language: locale,
          sitekey: turnstileSiteKey,
          size: "flexible",
          theme: "light",
        });
      } catch {
        setStatus({ message: strings.turnstileFailed, state: "error" });
      }
    };
    if (element !== null) {
      void mount(element);
    }
    return () => {
      cancelled = true;
      if (widgetId !== undefined) {
        window.turnstile?.remove(widgetId);
      }
    };
  }, [locale, strings.turnstileFailed, turnstileSiteKey]);

  const toggle = (method: ContactMethod, checked: boolean) => {
    setContactBy((current) =>
      checked
        ? [...current.filter((item) => item !== method), method]
        : current.filter((item) => item !== method)
    );
  };

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus({ state: "sending" });
    const shared = {
      email: field(data, "email"),
      locale,
      message: field(data, "message"),
      name: field(data, "name"),
      turnstileToken: token,
    };
    const { error } = await actions.contact(
      prayer
        ? { ...shared, kind: "prayer" }
        : {
            ...shared,
            address: optional(field(data, "address")),
            city: field(data, "city"),
            contactBy,
            kind: "contact",
            phone: optional(field(data, "phone")),
          }
    );
    if (error === undefined) {
      setStatus({ state: "sent" });
      return;
    }
    setStatus({
      message: isInputError(error) ? strings.errorInvalid : error.message,
      state: "error",
    });
  };

  if (status.state === "sent") {
    return (
      <output className="border-border bg-card flex flex-col items-start gap-3 rounded-2xl border p-8">
        <CheckCircle2Icon className="text-clay size-8" aria-hidden="true" />
        <h2 className="text-2xl">{strings.sentTitle}</h2>
        <p className="text-muted-foreground">
          {prayer ? strings.sentPrayerBody : strings.sentBody}
        </p>
      </output>
    );
  }

  const sending = status.state === "sending";
  const submitLabel = prayer ? strings.sendPrayer : strings.sendMessage;
  const optionalLabel = (
    <span className="text-muted-foreground font-normal">
      ({strings.optional})
    </span>
  );
  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="border-border bg-card rounded-2xl border p-6 shadow-xs sm:p-8"
    >
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${kind}-name`}>{strings.name}</FieldLabel>
            <Input
              id={`${kind}-name`}
              name="name"
              autoComplete="name"
              required
              minLength={2}
              maxLength={120}
              className="h-11"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${kind}-email`}>{strings.email}</FieldLabel>
            <Input
              id={`${kind}-email`}
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              className="h-11"
            />
          </Field>
          {!prayer && (
            <>
              <Field>
                <FieldLabel htmlFor="contact-address">
                  {strings.address} {optionalLabel}
                </FieldLabel>
                <Input
                  id="contact-address"
                  name="address"
                  autoComplete="street-address"
                  maxLength={160}
                  className="h-11"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-city">{strings.city}</FieldLabel>
                <Input
                  id="contact-city"
                  name="city"
                  autoComplete="address-level2"
                  required
                  maxLength={80}
                  className="h-11"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="contact-phone">
                  {strings.phone} {optionalLabel}
                </FieldLabel>
                <Input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  className="h-11"
                />
              </Field>
              <fieldset className="flex flex-col gap-2.5">
                <legend className="mb-2.5 text-sm font-medium">
                  {strings.contactBy} {optionalLabel}
                </legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {(
                    [
                      ["Email", strings.contactByEmail],
                      ["Cell phone", strings.contactByPhone],
                    ] as const
                  ).map(([method, label]) => (
                    <label
                      key={method}
                      className="flex cursor-pointer items-center gap-2.5 text-sm"
                    >
                      <Checkbox
                        size="large"
                        checked={contactBy.includes(method)}
                        onCheckedChange={(checked) => {
                          toggle(method, checked);
                        }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
        </div>
        <Field>
          <FieldLabel htmlFor={`${kind}-message`}>
            {prayer ? strings.prayerRequest : strings.message}
          </FieldLabel>
          <Textarea
            id={`${kind}-message`}
            name="message"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            className="min-h-36"
          />
        </Field>
        <div ref={widget} className="min-h-[65px]" />
        {status.state === "error" && <FieldError>{status.message}</FieldError>}
        <Button
          type="submit"
          variant="accent"
          size="hero"
          disabled={sending || token === ""}
          className="w-full sm:w-auto sm:self-start"
        >
          {sending && (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          )}
          {sending ? strings.sending : submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
};

export default ContactForm;
