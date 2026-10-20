import { LoaderCircleIcon } from "lucide-react";
import type { SubmitEvent } from "react";

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

import { nextFieldOnEnter } from "../form-keys";

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

const field = (data: FormData, name: string): string => {
  const value = data.get(name);
  return value === null || value instanceof File ? "" : value;
};

export const DetailsStep = ({
  bookingNote,
  error,
  onSubmit,
  sending,
  turnstileRef,
  verified,
}: DetailsStepProps) => {
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      email: field(data, "email"),
      name: field(data, "name"),
      notes: field(data, "notes"),
      phone: field(data, "phone"),
    });
  };
  return (
    <form onSubmit={submit} className="max-w-2xl">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="book-name">Name</FieldLabel>
          <Input
            id="book-name"
            name="name"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            onKeyDown={nextFieldOnEnter}
            required
            minLength={2}
            maxLength={120}
            className="h-12"
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="book-email">Email</FieldLabel>
            <Input
              id="book-email"
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
              className="h-12"
            />
            <FieldDescription>Your confirmation goes here.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="book-phone">Mobile phone</FieldLabel>
            <Input
              id="book-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              enterKeyHint="next"
              onKeyDown={nextFieldOnEnter}
              required
              minLength={7}
              maxLength={40}
              className="h-12"
            />
            <FieldDescription>In case I need to reach you.</FieldDescription>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="book-notes">
            Anything I should know?{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </FieldLabel>
          <Textarea
            id="book-notes"
            name="notes"
            maxLength={1000}
            rows={4}
            placeholder="Your hair history, a look you love, or a second service you would like."
          />
        </Field>
        <p className="bg-sand/70 text-foreground/80 rounded-xl p-4 text-sm leading-relaxed">
          {bookingNote}
        </p>
        <div ref={turnstileRef} className="min-h-[65px]" />
        {error !== undefined && <FieldError>{error}</FieldError>}
        <Button
          type="submit"
          size="hero"
          disabled={sending || !verified}
          className="w-full sm:w-auto sm:self-start"
        >
          {sending && (
            <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
          )}
          {sending ? "Booking" : "Book appointment"}
        </Button>
      </FieldGroup>
    </form>
  );
};
