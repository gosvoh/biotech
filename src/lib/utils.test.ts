import { describe, expect, it } from "vitest";
import { cn, removeHangingPrepositionsAndConjunctions } from "@/lib/utils";

describe("cn", () => {
  it("joins multiple class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("filters out falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });

  it("supports conditional object syntax", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });

  it("merges conflicting tailwind utilities, last one wins", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });
});

describe("removeHangingPrepositionsAndConjunctions", () => {
  it("replaces the space after a short word with a non-breaking space", () => {
    expect(removeHangingPrepositionsAndConjunctions("это и тот дом")).toBe(
      "это и тот дом",
    );
  });

  it("handles a string-array (template) input", () => {
    expect(
      removeHangingPrepositionsAndConjunctions(["я в ", "доме"] as unknown as TemplateStringsArray),
    ).toBe("я в доме");
  });
});
