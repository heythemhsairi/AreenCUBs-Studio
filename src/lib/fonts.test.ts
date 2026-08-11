import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Font configuration tests.
 *
 * The test architecture is Vitest in a `node` environment. Importing
 * `src/app/layout.tsx` directly is not viable here: `next/font/google` is a
 * build-time transform that downloads and self-hosts the font, and outside the
 * Next compiler it throws. Rendering the layout would therefore test the
 * harness, not the configuration.
 *
 * These tests assert against the configuration sources instead, which is where
 * the decisions actually live and where a regression would be introduced.
 * `npm run build` remains the real proof that the font resolves and loads.
 */

const ROOT = join(__dirname, "..", "..");
const layout = readFileSync(join(ROOT, "src", "app", "layout.tsx"), "utf8");
const globals = readFileSync(join(ROOT, "src", "app", "globals.css"), "utf8");
const tailwind = readFileSync(join(ROOT, "tailwind.config.ts"), "utf8");

/**
 * Extracts the standalone `body { … }` rule.
 *
 * A naive indexOf("body {") matches the earlier `html, body { height: 100%; }`
 * shorthand, so the selector is anchored to a line start.
 */
function bodyRule(css: string): string {
  const m = /\n\s*body\s*\{/.exec(css);
  if (!m) throw new Error("standalone body rule not found in globals.css");
  const start = m.index;
  return css.slice(start, css.indexOf("}", start));
}

describe("Noto Sans Arabic — loading", () => {
  it("is loaded through next/font/google, not a hand-rolled @font-face", () => {
    expect(layout).toMatch(/import\s*\{[^}]*Noto_Sans_Arabic[^}]*\}\s*from\s*["']next\/font\/google["']/);
    expect(globals).not.toMatch(/@font-face/);
  });

  it("requests the arabic subset", () => {
    expect(layout).toMatch(/subsets:\s*\[\s*["']arabic["']\s*\]/);
  });

  it("uses font-display: swap", () => {
    const call = layout.slice(layout.indexOf("Noto_Sans_Arabic("));
    expect(call).toMatch(/display:\s*["']swap["']/);
  });

  it("uses variable weights — no static weight array is pinned", () => {
    // Noto Sans Arabic is a variable font. Passing `weight` would force
    // next/font to fetch one static file per weight instead of one variable
    // file spanning 100–900.
    const call = layout.slice(
      layout.indexOf("Noto_Sans_Arabic("),
      layout.indexOf("Noto_Sans_Arabic(") + 400,
    );
    expect(call).not.toMatch(/weight:/);
  });

  it("exposes the font through a CSS variable", () => {
    expect(layout).toMatch(/variable:\s*["']--font-noto-arabic["']/);
  });

  it("attaches the variable to the html element alongside the Latin font", () => {
    expect(layout).toMatch(/<html[^>]*className=\{`\$\{manrope\.variable\}\s*\$\{notoArabic\.variable\}`\}/);
  });
});

describe("Latin font is unchanged", () => {
  it("loads Manrope as a variable axis, not a set of static cuts", () => {
    expect(layout).toMatch(/Manrope\(/);
    // No `weight` array: Manrope is variable (200-800), so omitting weights
    // loads one axis instead of shipping six static files.
    const block = layout.slice(layout.indexOf("Manrope("), layout.indexOf("Noto_Sans_Arabic("));
    expect(block).not.toMatch(/weight:/);
    expect(layout).toMatch(/variable:\s*["']--font-manrope["']/);
  });

  it("keeps Manrope first in the body stack", () => {
    const stack = bodyRule(globals);
    expect(stack.indexOf("--font-manrope")).toBeGreaterThan(-1);
    expect(stack.indexOf("--font-manrope")).toBeLessThan(stack.indexOf("--font-noto-arabic"));
  });
});

describe("Arabic is a fallback in the global stack", () => {
  it("appends the Arabic variable to the body font stack", () => {
    expect(bodyRule(globals)).toContain("var(--font-noto-arabic)");
  });

  it("mirrors the same ordering in the Tailwind sans stack", () => {
    const sans = tailwind.slice(tailwind.indexOf("sans: ["), tailwind.indexOf("]", tailwind.indexOf("sans: [")));
    expect(sans).toContain("var(--font-noto-arabic)");
    expect(sans.indexOf("var(--font-manrope)")).toBeLessThan(sans.indexOf("var(--font-noto-arabic)"));
  });

  it("offers an opt-in Arabic-first Tailwind stack", () => {
    const arabic = tailwind.slice(tailwind.indexOf("arabic: ["), tailwind.indexOf("]", tailwind.indexOf("arabic: [")));
    expect(arabic.indexOf("var(--font-noto-arabic)")).toBeLessThan(arabic.indexOf("var(--font-manrope)"));
  });
});

describe('explicit application to lang="ar"', () => {
  it("defines a rule targeting Arabic-marked elements and their descendants", () => {
    expect(globals).toMatch(/\[lang="ar"\]\s*,\s*\[lang="ar"\]\s*\*/);
  });

  it("puts Noto Sans Arabic first inside that rule", () => {
    const rule = globals.slice(globals.indexOf('[lang="ar"]'));
    const decl = rule.slice(rule.indexOf("font-family:"), rule.indexOf("}"));
    expect(decl.indexOf("--font-noto-arabic")).toBeGreaterThan(-1);
    expect(decl.indexOf("--font-noto-arabic")).toBeLessThan(decl.indexOf("--font-manrope"));
  });

  it("does NOT introduce RTL layout — out of scope for this phase", () => {
    const rule = globals.slice(globals.indexOf('[lang="ar"]'));
    const block = rule.slice(0, rule.indexOf("}"));
    expect(block).not.toMatch(/direction\s*:/);
    expect(block).not.toMatch(/text-align\s*:/);
    expect(block).not.toMatch(/\bdir\b\s*:/);
  });

  it("leaves the document language as fr", () => {
    // Arabic translations are not part of this phase.
    expect(layout).toMatch(/<html lang="fr"/);
  });
});

describe("no Ping AR artefacts", () => {
  /**
   * What matters is that Ping AR is never *used* or *shipped* — not that its
   * name is never written down. Prose explaining why it was rejected is
   * deliberately allowed (and present in layout.tsx), because a future reader
   * needs to know the decision was a licensing one rather than an oversight.
   *
   * These tests therefore target font declarations and binaries.
   */
  it("never names Ping AR in a font-family declaration or @font-face", () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(p);
          continue;
        }
        if (!/\.(ts|tsx|css|js|jsx|json|svg|html)$/.test(entry.name)) continue;
        if (p.endsWith("fonts.test.ts")) continue; // this file names it by necessity
        const src = readFileSync(p, "utf8");
        const declarations = src.match(/(?:font-family|@font-face|fontFamily)[^;{}]*[;{]/gi) ?? [];
        if (declarations.some((d) => /ping\s*[+-]?\s*ar/i.test(d))) offenders.push(p);
      }
    };
    for (const d of ["src", "public"]) walk(join(ROOT, d));
    expect(offenders).toEqual([]);
  });

  it("declares Noto Sans Arabic as the only Arabic face", () => {
    expect(layout).toContain("Noto_Sans_Arabic");
    // No Ping AR import from any font package.
    expect(layout).not.toMatch(/import[^;]*Ping[^;]*from/i);
  });

  it("has no font binaries committed anywhere in the project", () => {
    // Neither family may be committed: Ping AR + LT is unlicensed for web use,
    // and Noto Sans Arabic is fetched and self-hosted by next/font at build.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      if (!existsSync(dir)) return;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
        const p = join(dir, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(otf|ttf|woff2?|eot)$/i.test(entry.name)) offenders.push(p);
      }
    };
    walk(ROOT);
    expect(offenders).toEqual([]);
  });
});
