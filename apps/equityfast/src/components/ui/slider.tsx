import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

// Site addition: `brand` is the sky slider of the estimator and planner.
const sliderVariants = {
  default: {
    indicator: "bg-primary",
    thumb: "size-3 border border-ring bg-white",
    track: "bg-muted data-horizontal:h-1",
  },
  brand: {
    indicator: "bg-sky",
    // Grows a touch while held: the thumb answers the finger.
    thumb:
      "size-6 border-4 border-white bg-ink transition-[scale,box-shadow] duration-150 ease-out-strong active:scale-115 data-dragging:scale-115",
    track: "bg-line data-horizontal:h-1.5",
  },
} as const;

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  step = 1,
  largeStep,
  variant = "default",
  ...props
}: SliderPrimitive.Root.Props & { variant?: keyof typeof sliderVariants }) {
  const styles = sliderVariants[variant];
  const selected = value ?? defaultValue ?? min;
  const values = Array.isArray(selected) ? selected : [selected];

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      step={step}
      // Site addition: Base UI's default large step is 10 value units, so Page
      // Up on a $5,000-step slider moved $10. Ten steps is what the key means.
      largeStep={largeStep ?? step * 10}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className={cn(
            "relative grow overflow-hidden rounded-full select-none data-horizontal:w-full data-vertical:h-full data-vertical:w-1",
            styles.track
          )}
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className={cn(
              "select-none data-horizontal:h-full data-vertical:w-full",
              styles.indicator
            )}
          />
        </SliderPrimitive.Track>
        {Array.from({ length: values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className={cn(
              "ring-ring/50 relative block shrink-0 rounded-full transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50",
              styles.thumb
            )}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
