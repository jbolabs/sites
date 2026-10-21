import { actions, isInputError } from "astro:actions";
import { CheckCircle2Icon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { nextFieldOnEnter } from "./form-keys";
import { loadTurnstile } from "./turnstile";

interface ContactFormProps {
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

const ContactForm = ({ turnstileSiteKey }: ContactFormProps) => {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [token, setToken] = useState("");
  const widget = useRef<HTMLDivElement>(null);

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
          sitekey: turnstileSiteKey,
          size: "flexible",
          theme: "light",
        });
      } catch {
        setStatus({
          message: "The spam check could not load. Please refresh the page.",
          state: "error",
        });
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
  }, [turnstileSiteKey]);

  const onSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setStatus({ state: "sending" });
    const { error } = await actions.contact({
      email: field(data, "email"),
      message: field(data, "message"),
      name: field(data, "name"),
      phone: optional(field(data, "phone")),
      turnstileToken: token,
    });
    if (error === undefined) {
      setStatus({ state: "sent" });
      return;
    }
    setStatus({
      message: isInputError(error)
        ? "Please check your details and try again."
        : error.message,
      state: "error",
    });
  };

  if (status.state === "sent") {
    return (
      <output className="border-border bg-card flex flex-col items-start gap-3 rounded-xl border p-8">
        <CheckCircle2Icon className="text-clay size-8" aria-hidden="true" />
        <h2 className="text-2xl">Thank you, I have your message.</h2>
        <p className="text-muted-foreground">
          I will reply within a day or two.
        </p>
      </output>
    );
  }

  const sending = status.state === "sending";
  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}

      className="border-border bg-card rounded-xl border p-6 shadow-xs sm:p-8"
      noValidate={false}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="contact-name">Name</FieldLabel>
          <Input
            id="contact-name"
            name="name"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            onKeyDown={nextFieldOnEnter}
            required
            minLength={2}
            maxLength={120}
            className="h-11"
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="contact-email">Email</FieldLabel>
            <Input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              onKeyDown={nextFieldOnEnter}
              required
              maxLength={254}
              className="h-11"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="contact-phone">
              Phone{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </FieldLabel>
            <Input
              id="contact-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              enterKeyHint="next"
              onKeyDown={nextFieldOnEnter}
              maxLength={40}
              className="h-11"
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="contact-message">Message</FieldLabel>
          <Textarea
            id="contact-message"
            name="message"
            required
            minLength={10}
            maxLength={5000}
            rows={6}
            className="min-h-36"
            placeholder="Your question, or a little about your hair and what you would like to change."
          />
        </Field>
        <div ref={widget} className="min-h-[65px]" />
        {status.state === "error" && <FieldError>{status.message}</FieldError>}
        <Button
          type="submit"
          size="hero"
          disabled={sending || token === ""}
          className="w-full sm:w-auto sm:self-start"
        >
          {sending && (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          )}
          {sending ? "Sending" : "Send message"}
        </Button>
      </FieldGroup>
    </form>
  );
};

export default ContactForm;
