import { CameraIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import type { ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_PHOTOS_PER_KIND } from "@/lib/booking/photo-limits";
import { HAIR_HISTORY, HAIR_HISTORY_ORDER } from "@/lib/labels";
import type { HairHistory } from "@/lib/labels";

import type { HairPhoto, ServiceOption } from "./types";

interface HairStepProps {
  /** Ask what is on the hair now: the visit includes color. */
  readonly askHistory: boolean;
  readonly history: HairHistory | undefined;
  readonly onHistory: (history: HairHistory) => void;
  /** Offered when the answer means old color has to come out first. */
  readonly correction: ServiceOption | undefined;
  readonly onSwitchToCorrection: () => void;
  readonly photos: readonly HairPhoto[];
  /** Photos still being shrunk, per kind. */
  readonly adding: Readonly<Record<HairPhoto["kind"], number>>;
  readonly photoError: string | undefined;
  readonly onAddPhotos: (
    kind: HairPhoto["kind"],
    files: readonly File[]
  ) => void;
  readonly onRemovePhoto: (id: string) => void;
  readonly onContinue: () => void;
}

const PHOTO_GROUPS = [
  {
    hint: "Daylight, from the front and the back, hair down.",
    kind: "now",
    title: "Your hair now",
  },
  {
    hint: "Screenshots are perfect. Show me what you love about it.",
    kind: "goal",
    title: "The look you want",
  },
] as const;

const PhotoGroup = ({
  adding,
  group,
  onAddPhotos,
  onRemovePhoto,
  photos,
}: {
  readonly group: (typeof PHOTO_GROUPS)[number];
  readonly photos: readonly HairPhoto[];
  readonly adding: number;
  readonly onAddPhotos: HairStepProps["onAddPhotos"];
  readonly onRemovePhoto: HairStepProps["onRemovePhoto"];
}) => {
  const room = MAX_PHOTOS_PER_KIND - photos.length - adding;
  const inputId = `hair-photo-${group.kind}`;
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.currentTarget.files ?? [])].slice(0, room);
    // Clear it so choosing the same photo again still fires a change.
    event.currentTarget.value = "";
    if (files.length > 0) {
      onAddPhotos(group.kind, files);
    }
  };
  return (
    <div className="bg-card border-border rounded-2xl border p-4 sm:p-5">
      <h4 className="font-display text-xl">{group.title}</h4>
      <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
        {group.hint}
      </p>
      <ul className="mt-4 flex flex-wrap gap-3">
        {photos.map((photo, index) => (
          <li key={photo.id} className="relative">
            <img
              src={`data:image/jpeg;base64,${photo.data}`}
              alt={`${group.title}, ${index + 1} of ${photos.length}`}
              className="size-24 rounded-xl object-cover"
            />
            <Button
              variant="inverse"
              size="icon-round"
              aria-label={`Remove ${group.title.toLowerCase()} photo ${index + 1}`}
              onClick={() => {
                onRemovePhoto(photo.id);
              }}
              className="absolute -top-3 -right-3"
            >
              <XIcon aria-hidden="true" />
            </Button>
          </li>
        ))}
        {Array.from({ length: adding }, (_, index) => (
          <li
            key={`adding-${index}`}
            className="bg-sand/70 flex size-24 items-center justify-center rounded-xl"
          >
            <LoaderCircleIcon
              className="text-foreground/60 size-5 animate-spin"
              aria-label="Preparing photo"
            />
          </li>
        ))}
        {room > 0 && (
          <li>
            <label
              htmlFor={inputId}
              className="border-border text-foreground/75 hover:bg-muted has-focus-visible:ring-ring/50 flex size-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-xs font-medium transition-transform select-none active:scale-97 has-focus-visible:ring-3"
            >
              <CameraIcon className="size-5" aria-hidden="true" />
              Add photo
              <span className="sr-only">
                <Input
                  id={inputId}
                  type="file"
                  accept="image/*"
                  multiple={room > 1}
                  onChange={choose}
                />
              </span>
            </label>
          </li>
        )}
      </ul>
    </div>
  );
};

/**
 * Show Ani the hair before the appointment. A color booking for hair that
 * has box dye or vivid color on it is really a color correction; asking now
 * (and showing photos) keeps the client from booking the wrong time and price.
 */
export const HairStep = ({
  adding,
  askHistory,
  correction,
  history,
  onAddPhotos,
  onContinue,
  onHistory,
  onRemovePhoto,
  onSwitchToCorrection,
  photoError,
  photos,
}: HairStepProps) => {
  const busy = adding.now + adding.goal > 0;
  return (
    <div className="max-w-3xl space-y-10">
      {askHistory && (
        <fieldset className="min-w-0">
          <legend className="mb-4 text-2xl">What is on your hair now?</legend>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {HAIR_HISTORY_ORDER.map((answer) => (
              <Button
                key={answer}
                variant="choice"
                size="option"
                aria-pressed={history === answer}
                onClick={() => {
                  onHistory(answer);
                }}
              >
                {HAIR_HISTORY[answer].label}
              </Button>
            ))}
          </div>
          <div aria-live="polite">
            {correction !== undefined && (
              <div className="border-clay/40 bg-sand/70 mt-5 rounded-2xl border p-5 leading-relaxed">
                <p className="font-medium">
                  This is usually a color correction.
                </p>
                <p className="text-foreground/80 mt-2 text-sm">
                  Old color has to come out before new color goes on. It takes
                  longer, sometimes two visits, and is priced differently. Let
                  me see your hair first in a complimentary consultation, and we
                  will book the right appointment together.
                </p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3">
                  <Button size="cta" onClick={onSwitchToCorrection}>
                    Book the consultation instead
                  </Button>
                </div>
              </div>
            )}
          </div>
        </fieldset>
      )}

      <section aria-labelledby="hair-photos" className="space-y-4">
        <div>
          <h3 id="hair-photos" className="text-2xl">
            Show me your hair
          </h3>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Optional, and only I see them. Photos help me plan your time and
            give you an honest price before you arrive.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {PHOTO_GROUPS.map((group) => (
            <PhotoGroup
              key={group.kind}
              group={group}
              photos={photos.filter((photo) => photo.kind === group.kind)}
              adding={adding[group.kind]}
              onAddPhotos={onAddPhotos}
              onRemovePhoto={onRemovePhoto}
            />
          ))}
        </div>
        {photoError !== undefined && (
          <p className="text-destructive text-sm" role="alert">
            {photoError}
          </p>
        )}
      </section>

      <Button
        size="cta"
        disabled={busy}
        onClick={onContinue}
        className="w-full sm:w-auto"
      >
        {photos.length === 0 ? "Continue without photos" : "Continue"}
      </Button>
    </div>
  );
};
