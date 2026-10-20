import { CheckIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { combineVisit, isVisit, MAX_VISIT_SERVICES } from "@/lib/booking/visit";
import { formatDuration, formatPrice } from "@/lib/labels";

import type { Audience, ServiceOption } from "./types";

interface VisitStepProps {
  readonly services: readonly ServiceOption[];
  readonly audience: Audience | undefined;
  readonly onAudience: (audience: Audience) => void;
  readonly selected: readonly string[];
  readonly onToggle: (slug: string) => void;
  readonly onContinue: () => void;
}

const AUDIENCES: readonly {
  readonly value: Audience;
  readonly label: string;
}[] = [
  { label: "Women", value: "women" },
  { label: "Men", value: "men" },
];

/** Services for this audience: theirs plus everyone's. */
export const servicesFor = (
  services: readonly ServiceOption[],
  audience: Audience
) =>
  services.filter(
    (service) =>
      service.audience === audience || service.audience === "everyone"
  );

const ServiceTile = ({
  onToggle,
  pressed,
  disabled,
  service,
}: {
  readonly service: ServiceOption;
  readonly pressed: boolean;
  readonly disabled: boolean;
  readonly onToggle: (slug: string) => void;
}) => {
  const price = formatPrice(service.price, service.priceFrom);
  return (
    <Button
      variant="choice"
      size="tile"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() => {
        onToggle(service.slug);
      }}
      className="group/tile"
    >
      <span className="flex items-baseline justify-between gap-4">
        <span className="font-display text-xl leading-snug">
          {service.title}
        </span>
        {price !== undefined && (
          <span className="shrink-0 text-base tabular-nums">
            {service.addOn ? `+${price}` : price}
          </span>
        )}
      </span>
      <span className="text-muted-foreground group-aria-pressed/tile:text-ivory/75 line-clamp-2 text-sm leading-relaxed font-normal">
        {service.summary}
      </span>
      <span className="text-foreground/70 group-aria-pressed/tile:text-ivory/85 flex items-center justify-between text-sm font-normal">
        {service.addOn ? "+" : ""}
        {formatDuration(service.durationMinutes)}
        <span
          className="border-border group-aria-pressed/tile:border-ivory group-aria-pressed/tile:bg-ivory group-aria-pressed/tile:text-espresso flex size-6 items-center justify-center rounded-full border"
          aria-hidden="true"
        >
          {pressed ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <PlusIcon className="size-3.5" />
          )}
        </span>
      </span>
    </Button>
  );
};

/**
 * Build a visit in the order a stylist would ask: who it is for, the main
 * services (they stack, like a cut with color), then extras. The running total
 * stays in view so the time and price never surprise anyone at the chair.
 */
export const VisitStep = ({
  audience,
  onAudience,
  onContinue,
  onToggle,
  selected,
  services,
}: VisitStepProps) => {
  const offered = audience === undefined ? [] : servicesFor(services, audience);
  const mains = offered.filter((service) => !service.addOn);
  const extras = offered.filter((service) => service.addOn);
  const categories = [...new Set(mains.map((service) => service.category))];
  const picked = new Set(selected);
  const chosen = services.filter((service) => picked.has(service.slug));
  const visit = combineVisit(chosen);
  const full = selected.length >= MAX_VISIT_SERVICES;
  const hasMain = chosen.some((service) => !service.addOn);

  return (
    <div className="space-y-10">
      <fieldset className="min-w-0">
        <legend className="mb-4 text-2xl">Who is the appointment for?</legend>
        <div className="bg-sand/60 flex max-w-sm gap-1.5 rounded-full p-1.5">
          {AUDIENCES.map((option) => (
            <Button
              key={option.value}
              variant="choice"
              size="segment"
              aria-pressed={audience === option.value}
              onClick={() => {
                onAudience(option.value);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </fieldset>

      {categories.map((category) => {
        const group = mains.filter((service) => service.category === category);
        return (
          <section key={category} aria-labelledby={`category-${category}`}>
            <h3 id={`category-${category}`} className="mb-4 text-2xl">
              {group[0]?.categoryLabel}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {group.map((service) => {
                const pressed = picked.has(service.slug);
                return (
                  <li key={service.slug}>
                    <ServiceTile
                      service={service}
                      pressed={pressed}
                      disabled={full && !pressed}
                      onToggle={onToggle}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {hasMain && extras.length > 0 && (
        <section aria-labelledby="add-ons">
          <h3 id="add-ons" className="text-2xl">
            Add to your visit
          </h3>
          <p className="text-muted-foreground mt-1 mb-4 text-sm">
            Optional extras, done in the same appointment.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {extras.map((service) => {
              const pressed = picked.has(service.slug);
              return (
                <li key={service.slug}>
                  <ServiceTile
                    service={service}
                    pressed={pressed}
                    disabled={full && !pressed}
                    onToggle={onToggle}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {audience !== undefined && (
        <div className="bg-linen border-border pb-safe sticky bottom-0 z-10 -mx-5 border-t px-5 pt-4 sm:static sm:mx-0 sm:rounded-2xl sm:border sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <p className="text-ui min-w-0" aria-live="polite">
              {isVisit(visit) ? (
                <>
                  <span className="block truncate font-medium">
                    {visit.title}
                  </span>
                  <span className="text-foreground/70 tabular-nums">
                    {[formatDuration(visit.durationMinutes), visit.priceLabel]
                      .filter((part) => part !== undefined)
                      .join(" · ")}
                  </span>
                </>
              ) : (
                <span className="text-foreground/70">
                  {selected.length === 0
                    ? "Choose one or more services."
                    : "Add-ons go with a main service. Choose one above."}
                </span>
              )}
            </p>
            <Button
              size="cta"
              disabled={!isVisit(visit)}
              onClick={onContinue}
              className="w-full sm:w-auto"
            >
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
