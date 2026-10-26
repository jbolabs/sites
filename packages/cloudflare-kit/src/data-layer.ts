/**
 * Conversion events for a client's Tag Manager container. Plain browser code
 * (no Effect) so islands can import it. Where no container loads (every stage
 * but prod), the events sit in an array nothing reads.
 */

/** Events a site sends to the agency's tags. Never put form answers in them. */
export type DataLayerEvent = "application_submitted";

/** What we push. Tag Manager pushes its own richer entries alongside. */
export interface DataLayerEntry {
  readonly event: string;
}

/** The page global Google's container snippet creates. */
export interface DataLayerTarget {
  dataLayer?: DataLayerEntry[] | undefined;
}

declare global {
  // oxlint-disable-next-line no-var -- a global augmentation must be `var`
  var dataLayer: DataLayerEntry[] | undefined;
}

/** Pushes `{ event }` onto `dataLayer`, creating it if the container hasn't. */
export const pushDataLayerEvent = (
  event: DataLayerEvent,
  target: DataLayerTarget = globalThis
): void => {
  target.dataLayer ??= [];
  target.dataLayer.push({ event });
};
