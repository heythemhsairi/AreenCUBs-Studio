import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * The portal's error boundary, asserted as a property of the source.
 *
 * Rendering it would prove less than it looks: the failure mode is not "this
 * component renders wrongly", it is "this file does not exist, so /portal
 * falls through to src/app/error.tsx" — which prints error.message and
 * error.digest verbatim to whoever is looking. The audience there is an
 * external client contact.
 *
 * So the test asserts the two things that actually matter: the boundary
 * exists, and it does not render the raw detail.
 */

const portalError = join(process.cwd(), "src/app/portal/error.tsx");

describe("portal error boundary", () => {
  it("exists, so a portal failure never reaches the internal error page", () => {
    expect(existsSync(portalError)).toBe(true);
  });

  it("renders neither the error message nor the digest", () => {
    const src = readFileSync(portalError, "utf8");

    // Strip the explanatory comment block before scanning: it necessarily
    // NAMES the things the component must not render.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

    expect(code).not.toMatch(/\{\s*error\.message/);
    expect(code).not.toMatch(/\{\s*error\.digest/);
    expect(code).not.toMatch(/JSON\.stringify\(\s*error/);
  });

  it("still reports the failure to the server console for the team", () => {
    const src = readFileSync(portalError, "utf8");
    expect(src).toMatch(/console\.error/);
  });
});
