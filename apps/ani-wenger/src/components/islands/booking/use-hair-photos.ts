import { useState } from "react";

import { shrinkPhoto } from "./shrink-photo";
import type { HairPhoto } from "./types";

/** The photos a client adds while booking, shrunk in the browser one at a time. */
export const useHairPhotos = () => {
  const [photos, setPhotos] = useState<readonly HairPhoto[]>([]);
  const [adding, setAdding] = useState({ goal: 0, now: 0 });
  const [error, setError] = useState<string | undefined>();

  const add = async (kind: HairPhoto["kind"], files: readonly File[]) => {
    setError(undefined);
    setAdding((counts) => ({ ...counts, [kind]: counts[kind] + files.length }));
    for (const file of files) {
      // oxlint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- one photo at a time keeps a phone's memory low.
      const data = await shrinkPhoto(file).catch(() => null);
      if (data === null) {
        setError(
          "That photo could not be read. Try a screenshot or a JPEG instead."
        );
      } else {
        setPhotos((current) => [
          ...current,
          { data, id: crypto.randomUUID(), kind },
        ]);
      }
      setAdding((counts) => ({ ...counts, [kind]: counts[kind] - 1 }));
    }
  };

  const remove = (id: string) => {
    setPhotos((current) => current.filter((photo) => photo.id !== id));
  };

  return { add, adding, error, photos, remove };
};
