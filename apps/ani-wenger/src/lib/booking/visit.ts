/**
 * A visit is the services a client books together: one or more main services
 * (a cut, a color) plus add-ons (a gloss, a Kérastase ritual). It books as one
 * appointment whose length is the sum of its services, so the calendar only
 * offers times the whole visit fits. Pure, so the booking island shows the
 * same total the server books.
 */
import { formatPrice } from "../labels.ts";
import type { BookableService } from "./services.ts";

/** At most this many services in one visit. */
export const MAX_VISIT_SERVICES = 5;

export interface Visit<S extends BookableService = BookableService> {
  readonly services: readonly S[];
  /** "Women's precision cut + Gloss and tone". */
  readonly title: string;
  readonly durationMinutes: number;
  /** The longest cleanup of its services: color needs it, a trim does not. */
  readonly bufferMinutes: number;
  /** "$165", "$300+", or "Complimentary". */
  readonly priceLabel: string | undefined;
  /** A service in it asks for photos of the client's hair. */
  readonly asksForPhotos: boolean;
}

export type VisitProblem =
  | { readonly reason: "empty" }
  | { readonly reason: "too-many" }
  | { readonly reason: "only-add-ons" };

/** The total price, or nothing when a service has no listed price. */
const totalPrice = (services: readonly BookableService[]) => {
  const prices = services.flatMap((service) =>
    service.price === undefined ? [] : [service.price]
  );
  const total =
    prices.length === services.length
      ? prices.reduce((sum, price) => sum + price, 0)
      : null;
  return formatPrice(
    total,
    services.some((service) => service.priceFrom)
  );
};

/**
 * Combines the chosen services, main services first. Duplicates collapse, and
 * a visit of only add-ons is refused: an add-on needs something to add to.
 */
export const combineVisit = <S extends BookableService>(
  chosen: readonly S[]
): Visit<S> | VisitProblem => {
  const unique = [
    ...new Map(chosen.map((service) => [service.slug, service])).values(),
  ];
  if (unique.length === 0) {
    return { reason: "empty" };
  }
  if (unique.length > MAX_VISIT_SERVICES) {
    return { reason: "too-many" };
  }
  const services = [
    ...unique.filter((service) => !service.addOn),
    ...unique.filter((service) => service.addOn),
  ];
  if (services[0]?.addOn !== false) {
    return { reason: "only-add-ons" };
  }
  return {
    asksForPhotos: services.some((service) => service.asksForPhotos),
    bufferMinutes: Math.max(
      ...services.map((service) => service.bufferMinutes)
    ),
    durationMinutes: services.reduce(
      (sum, service) => sum + service.durationMinutes,
      0
    ),
    priceLabel: totalPrice(services),
    services,
    title: services.map((service) => service.title).join(" + "),
  };
};

export const isVisit = <S extends BookableService>(
  value: Visit<S> | VisitProblem
): value is Visit<S> => !("reason" in value);
