import { cn } from "@/lib/utils";

type LogoKind = "horizontal" | "vertical" | "icon";

type Props = {
  className?: string;
  /** Width in pixels. Height follows the official artwork ratio. */
  width?: number;
  kind?: LogoKind;
};

const LOGOS: Record<LogoKind, { src: string; ratio: string }> = {
  horizontal: { src: "/brand/areen-cubs-horizontal.svg", ratio: "8 / 3" },
  vertical: { src: "/brand/areen-cubs-vertical.svg", ratio: "38 / 31" },
  icon: { src: "/brand/areen-cubs-icon.svg", ratio: "6 / 7" },
};

/**
 * Official Areen CUBs artwork supplied by the studio.
 *
 * The SVG is used as a mask so one source asset can render in primary blue on
 * light surfaces and in the high-contrast rail foreground on navy. This keeps
 * the paths identical across the product without shipping duplicate white
 * logo files.
 */
export function BrandLogo({ className, width = 140, kind = "horizontal" }: Props) {
  const logo = LOGOS[kind];

  return (
    <span
      role="img"
      aria-label="Areen CUBs"
      className={cn("inline-block shrink-0 bg-current text-brand-500", className)}
      style={{
        width,
        aspectRatio: logo.ratio,
        WebkitMaskImage: `url(${logo.src})`,
        maskImage: `url(${logo.src})`,
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
      }}
    />
  );
}
