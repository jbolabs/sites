import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/** One answer from a short list, as large tappable cards. */
const ChoiceGroup = ({
  errorId,
  invalid,
  labels,
  onChange,
  options,
  title,
  value,
}: {
  /** The inline error's id while one shows. */
  readonly errorId?: string | undefined;
  readonly invalid: boolean;
  readonly labels: Readonly<Record<string, string>>;
  readonly onChange: (value: string) => void;
  readonly options: readonly string[];
  readonly title: string;
  readonly value: string;
}) => (
  <RadioGroup
    aria-label={title}
    aria-invalid={invalid || undefined}
    aria-describedby={errorId}
    value={value}
    onValueChange={(next) => {
      onChange(String(next));
    }}
  >
    {options.map((option) => (
      <label
        key={option}
        className={cn(
          "has-data-checked:border-ink has-data-checked:bg-canvas text-ink has-focus-visible:ring-sky/40 flex min-h-14 cursor-pointer items-center gap-4 rounded-xl border bg-white px-5 text-lg font-medium has-focus-visible:ring-4",
          invalid && value === "" ? "border-destructive" : "border-border"
        )}
      >
        <RadioGroupItem value={option} />
        {labels[option] ?? option}
      </label>
    ))}
  </RadioGroup>
);

export default ChoiceGroup;
