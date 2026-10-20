import { actions } from "astro:actions";
import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";

interface CancelAppointmentProps {
  readonly id: string;
  readonly token: string;
}

type Status =
  | { readonly state: "idle" }
  | { readonly state: "confirming" }
  | { readonly state: "sending" }
  | { readonly state: "cancelled" }
  | { readonly state: "error"; readonly message: string };

/** Cancel with a second, explicit confirmation; the time opens up for others right away. */
const CancelAppointment = ({ id, token }: CancelAppointmentProps) => {
  const [status, setStatus] = useState<Status>({ state: "idle" });

  if (status.state === "cancelled") {
    return (
      <output className="mt-4 block text-lg">
        Your appointment is cancelled. Thank you for letting me know.{" "}
        <a
          href="/book"
          className="text-espresso-deep font-medium underline underline-offset-4"
        >
          Book a new time
        </a>
      </output>
    );
  }

  const cancel = async () => {
    setStatus({ state: "sending" });
    const { error } = await actions.cancelAppointment({ id, token });
    setStatus(
      error === undefined
        ? { state: "cancelled" }
        : { message: error.message, state: "error" }
    );
  };

  return (
    <div className="mt-4 space-y-4">
      <p className="text-foreground/80 text-lg">
        If plans change, cancel here and the time opens up for someone else.
      </p>
      {status.state === "confirming" || status.state === "sending" ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            variant="destructive"
            size="cta"
            disabled={status.state === "sending"}
            onClick={() => {
              void cancel();
            }}
          >
            {status.state === "sending" && (
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            )}
            Yes, cancel my appointment
          </Button>
          <Button
            variant="ghost"
            size="cta"
            onClick={() => {
              setStatus({ state: "idle" });
            }}
          >
            Keep it
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="cta"
          onClick={() => {
            setStatus({ state: "confirming" });
          }}
        >
          Cancel appointment
        </Button>
      )}
      {status.state === "error" && <FieldError>{status.message}</FieldError>}
    </div>
  );
};

export default CancelAppointment;
