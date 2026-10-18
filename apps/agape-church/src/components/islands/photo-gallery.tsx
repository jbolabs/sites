import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useCallback, useState } from "react";
import type { KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface GalleryImage {
  readonly src: string;
  readonly srcSet: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

interface PhotoGalleryProps {
  readonly title: string;
  readonly images: readonly GalleryImage[];
  readonly labels: {
    readonly open: string;
    readonly of: string;
    readonly previous: string;
    readonly next: string;
  };
}

/**
 * A grid of photos; any photo opens a full-screen viewer with keyboard and
 * button navigation. The grid is server-rendered with the island, so the
 * photos show before (and without) hydration.
 */
const PhotoGallery = ({ images, labels, title }: PhotoGalleryProps) => {
  const [selected, setSelected] = useState<number | undefined>();
  const count = images.length;
  const current = selected === undefined ? undefined : images[selected];
  const step = useCallback(
    (delta: number) => {
      setSelected((index) =>
        index === undefined ? index : (index + delta + count) % count
      );
    },
    [count]
  );
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      step(1);
    } else if (event.key === "ArrowLeft") {
      step(-1);
    }
  };
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {images.map((image, index) => (
          <li key={image.src}>
            <Button
              variant="media"
              size="media"
              className="group block"
              aria-label={`${labels.open}: ${image.alt}`}
              onClick={() => {
                setSelected(index);
              }}
            >
              <img
                src={image.src}
                srcSet={image.srcSet}
                sizes="(min-width: 768px) 33vw, 50vw"
                width={image.width}
                height={image.height}
                alt={image.alt}
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none"
              />
            </Button>
          </li>
        ))}
      </ul>
      <Dialog
        open={current !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setSelected(undefined);
          }
        }}
      >
        <DialogContent
          variant="lightbox"
          className="max-w-[calc(100%-1rem)] sm:max-w-5xl"
          onKeyDown={onKeyDown}
        >
          <DialogTitle variant="lightbox">
            {title}
            {selected !== undefined && count > 1 && (
              <span className="ml-2 font-sans text-sm font-normal text-white/70">
                {selected + 1} {labels.of} {count}
              </span>
            )}
          </DialogTitle>
          {current && (
            <img
              src={current.src}
              srcSet={current.srcSet}
              sizes="100vw"
              width={current.width}
              height={current.height}
              alt={current.alt}
              className="max-h-[78svh] w-full rounded-md object-contain"
            />
          )}
          {count > 1 && (
            <div className="flex justify-between">
              <Button
                variant="outline-inverse"
                size="icon-lg"
                onClick={() => {
                  step(-1);
                }}
                aria-label={labels.previous}
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
              <Button
                variant="outline-inverse"
                size="icon-lg"
                onClick={() => {
                  step(1);
                }}
                aria-label={labels.next}
              >
                <ChevronRightIcon aria-hidden="true" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PhotoGallery;
