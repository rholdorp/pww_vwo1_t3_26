import { describe, expect, it } from "vitest";
import {
  currentItem,
  isComplete,
  needsHint,
  startSession,
  submit,
} from "./session.js";

describe("session-ordening", () => {
  it("loopt items in volgorde af bij goed antwoord", () => {
    let s = startSession(["a", "b", "c"]);
    expect(currentItem(s)).toBe("a");
    s = submit(s, "goed");
    expect(currentItem(s)).toBe("b");
    s = submit(s, "goed");
    expect(currentItem(s)).toBe("c");
    s = submit(s, "goed");
    expect(isComplete(s)).toBe(true);
    expect(s.cleared).toEqual(["a", "b", "c"]);
  });

  it("plant een fout item opnieuw na 3 andere items", () => {
    let s = startSession(["a", "b", "c", "d", "e"]);
    s = submit(s, "fout"); // a fout
    // a verschijnt na b, c, d → positie 3
    expect(s.remaining).toEqual(["b", "c", "d", "a", "e"]);
  });

  it("plant achteraan in als er minder dan 3 resteren", () => {
    let s = startSession(["a", "b"]);
    s = submit(s, "fout"); // a fout, alleen b rest
    expect(s.remaining).toEqual(["b", "a"]);
  });

  it("een item verlaat de sessie pas na een goed antwoord (eindronde)", () => {
    let s = startSession(["a"]);
    s = submit(s, "fout");
    expect(currentItem(s)).toBe("a"); // komt direct terug, geen ander item
    expect(isComplete(s)).toBe(false);
    s = submit(s, "goed");
    expect(isComplete(s)).toBe(true);
  });

  it("schakelt naar hint-modus vanaf 2 fouten", () => {
    let s = startSession(["a", "b"]);
    expect(needsHint(s, "a")).toBe(false);
    s = submit(s, "fout"); // a 1e fout → ["b","a"]
    s = submit(s, "goed"); // b goed → ["a"]
    expect(needsHint(s, "a")).toBe(false);
    s = submit(s, "fout"); // a 2e fout
    expect(needsHint(s, "a")).toBe(true);
  });

  it("bijna telt ook als fout voor requeue", () => {
    let s = startSession(["a", "b", "c", "d"]);
    s = submit(s, "bijna");
    expect(s.remaining).toEqual(["b", "c", "d", "a"]);
  });
});
