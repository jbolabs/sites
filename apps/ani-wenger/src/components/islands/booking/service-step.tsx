import { Button } from "@/components/ui/button";

import type { ServiceOption } from "./types";

interface ServiceStepProps {
  readonly services: readonly ServiceOption[];
  readonly selected: string | undefined;
  readonly onSelect: (slug: string) => void;
}

/** Services grouped by category, in menu order; choosing one moves on to times. */
export const ServiceStep = ({
  onSelect,
  selected,
  services,
}: ServiceStepProps) => {
  const categories = [...new Set(services.map((service) => service.category))];
  return (
    <div className="space-y-10">
      {categories.map((category) => {
        const group = services.filter(
          (service) => service.category === category
        );
        return (
          <section key={category} aria-labelledby={`category-${category}`}>
            <h3 id={`category-${category}`} className="mb-4 text-2xl">
              {group[0]?.categoryLabel}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {group.map((service) => (
                <li key={service.slug}>
                  <Button
                    variant="choice"
                    size="tile"
                    aria-pressed={selected === service.slug}
                    onClick={() => {
                      onSelect(service.slug);
                    }}
                    className="group/tile"
                  >
                    <span className="flex items-baseline justify-between gap-4">
                      <span className="font-display text-xl leading-snug">
                        {service.title}
                      </span>
                      {service.price !== undefined && (
                        <span className="shrink-0 text-base tabular-nums">
                          {service.price}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground group-aria-pressed/tile:text-ivory/75 line-clamp-2 text-sm leading-relaxed font-normal">
                      {service.summary}
                    </span>
                    <span className="text-foreground/70 group-aria-pressed/tile:text-ivory/85 text-sm font-normal">
                      {service.duration}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};
