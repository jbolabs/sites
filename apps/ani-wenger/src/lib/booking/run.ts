/**
 * Runs booking programs outside actions (pages, routes, the cron, the admin
 * plugin) and turns their exit into plain data for the caller.
 */
import { runRequest } from "@jakebodea/cloudflare-kit/server";
import { Cause, Exit, Option } from "effect";
import type { Effect, Layer } from "effect";

import { scheduleLayer, waitUntil } from "../server.ts";

export type ScheduleServices = Layer.Success<ReturnType<typeof scheduleLayer>>;

export type Outcome<A> =
  | { readonly ok: true; readonly value: A }
  | { readonly ok: false; readonly tag: string };

export const runSchedule = async <A, E extends { readonly _tag: string }>(
  program: Effect.Effect<A, E, ScheduleServices>
): Promise<Outcome<A>> => {
  const exit = await runRequest(program, scheduleLayer(), waitUntil);
  if (Exit.isSuccess(exit)) {
    return { ok: true, value: exit.value };
  }
  const error = Cause.findErrorOption(exit.cause);
  return { ok: false, tag: Option.isSome(error) ? error.value._tag : "Defect" };
};
