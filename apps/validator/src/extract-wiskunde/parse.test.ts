import { describe, expect, it } from "vitest";
import { parseFeiten, parseOpgaven } from "./parse.js";

describe("parseOpgaven", () => {
  it("parses a valid JSON array of opgaven", () => {
    const json = JSON.stringify([
      {
        opgavenummer: "12a",
        vraag: "Werk de haakjes weg: $3(x+4)$",
        onderdeel: "8.2a",
        type: "herleiden",
        bijzonderheden: null,
      },
    ]);
    const out = parseOpgaven(json);
    expect(out).toHaveLength(1);
    expect(out[0]?.opgavenummer).toBe("12a");
    expect(out[0]?.type).toBe("herleiden");
  });

  it("unwraps fenced JSON", () => {
    const fenced = "```json\n[{\"opgavenummer\":\"1\",\"vraag\":\"Bereken 2+2\",\"type\":\"berekening\"}]\n```";
    const out = parseOpgaven(fenced);
    expect(out).toHaveLength(1);
    expect(out[0]?.type).toBe("berekening");
  });

  it("falls back to 'anders' for unknown type", () => {
    const out = parseOpgaven('[{"opgavenummer":"1","vraag":"x","type":"phantasie"}]');
    expect(out[0]?.type).toBe("anders");
  });

  it("filters items missing required fields", () => {
    const out = parseOpgaven('[{"opgavenummer":"1"},{"opgavenummer":"2","vraag":"v","type":"berekening"}]');
    expect(out).toHaveLength(1);
    expect(out[0]?.opgavenummer).toBe("2");
  });

  it("returns empty array on malformed input", () => {
    expect(parseOpgaven("not json")).toEqual([]);
    expect(parseOpgaven("{}")).toEqual([]);
  });

  it("treats empty/null onderdeel as null", () => {
    const out = parseOpgaven('[{"opgavenummer":"1","vraag":"v","type":"berekening","onderdeel":""}]');
    expect(out[0]?.onderdeel).toBeNull();
  });
});

describe("parseFeiten", () => {
  it("parses formule/begrip/eigenschap", () => {
    const json = JSON.stringify([
      { type: "formule", vraag: "a(b+c)=?", antwoord: "ab+ac", context: "Th 8.2A" },
      { type: "begrip", vraag: "Wat is grondtal in a^n?", antwoord: "a", context: "Th 8.3A" },
      { type: "eigenschap", vraag: "Hoekensom driehoek?", antwoord: "180°", context: "Th 9.3" },
    ]);
    const out = parseFeiten(json);
    expect(out).toHaveLength(3);
    expect(out.map((f) => f.type)).toEqual(["formule", "begrip", "eigenschap"]);
  });

  it("rejects unknown feit-type", () => {
    const out = parseFeiten('[{"type":"voorbeeld","vraag":"v","antwoord":"a","context":"c"}]');
    expect(out).toHaveLength(0);
  });

  it("requires vraag and antwoord both present", () => {
    const out = parseFeiten('[{"type":"formule","vraag":"v"}, {"type":"begrip","antwoord":"a"}]');
    expect(out).toHaveLength(0);
  });

  it("defaults context to empty string", () => {
    const out = parseFeiten('[{"type":"formule","vraag":"v","antwoord":"a"}]');
    expect(out[0]?.context).toBe("");
  });
});
