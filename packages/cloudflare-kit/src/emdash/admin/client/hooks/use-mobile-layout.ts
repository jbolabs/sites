import { useSyncExternalStore } from "react";

const query = "(max-width: 767px)";
const subscribe = (notify: () => void) => {
  const media = matchMedia(query);
  media.addEventListener("change", notify);
  return () => {
    media.removeEventListener("change", notify);
  };
};

export const useMobileLayout = (): boolean =>
  useSyncExternalStore(subscribe, () => matchMedia(query).matches);
