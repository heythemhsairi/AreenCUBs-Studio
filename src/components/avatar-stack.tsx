import { Avatar } from "@/components/avatar";
import { cn } from "@/lib/utils";

export type StackItem = {
  src: string | null;
  name: string;
};

type Props = {
  items: StackItem[];
  /** Maximum visible avatars before showing the "+N" overflow chip. */
  max?: number;
  /** Avatar size — small stacks look best with `xs` or `sm`. */
  size?: "xs" | "sm" | "md";
  className?: string;
};

const sizeOffset: Record<NonNullable<Props["size"]>, string> = {
  xs: "-ml-1.5",
  sm: "-ml-2",
  md: "-ml-2.5",
};

const overflowSize: Record<NonNullable<Props["size"]>, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
};

export function AvatarStack({
  items,
  max = 4,
  size = "sm",
  className,
}: Props) {
  if (items.length === 0) {
    return (
      <span className="text-xs text-ink/35">—</span>
    );
  }
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  const offset = sizeOffset[size];

  return (
    <div className={cn("flex items-center", className)}>
      {shown.map((p, i) => (
        <div
          key={i}
          className={cn(
            "rounded-full ring-2 ring-white",
            i > 0 && offset,
          )}
          title={p.name}
        >
          <Avatar src={p.src} name={p.name} size={size} />
        </div>
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-ink/10 font-semibold text-ink/70 ring-2 ring-white",
            overflowSize[size],
            offset,
          )}
          title={`+${extra} de plus`}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
