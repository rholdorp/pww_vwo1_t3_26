import { describe, expect, it } from "vitest";
import { schoonWiskunde, wiskundeGelijk } from "./mathClean.js";
import { gradeAnswer } from "./normalize.js";

describe("schoonWiskunde — cosmetische opschoning", () => {
  it("zet superscript om naar ^", () => {
    expect(schoonWiskunde("36a²")).toBe("36a^2");
    expect(schoonWiskunde("x³")).toBe("x^3");
    expect(schoonWiskunde("10⁴")).toBe("10^4");
  });
  it("normaliseert decimaalkomma, min-teken en maal-tekens", () => {
    expect(schoonWiskunde("3,5")).toBe("3.5");
    expect(schoonWiskunde("−2")).toBe("-2");
    expect(schoonWiskunde("3·10")).toBe("3*10");
    expect(schoonWiskunde("3 × 10")).toBe("3*10");
  });
  it("verwijdert whitespace en hoofdletters", () => {
    expect(schoonWiskunde("  2 A B ")).toBe("2ab");
  });
});

describe("wiskundeGelijk — cosmetisch goed", () => {
  it("rekent cosmetische varianten goed", () => {
    expect(wiskundeGelijk("36a^2", "36a²")).toBe(true);
    expect(wiskundeGelijk("3,5·10^4", "3.5*10^4")).toBe(true);
    expect(wiskundeGelijk("  8A ", "8a")).toBe(true);
  });
  it("rekent gelijke getalwaardes goed (0.5 = 1/2, 2/4 = 1/2)", () => {
    expect(wiskundeGelijk("0,5", "1/2")).toBe(true);
    expect(wiskundeGelijk("2/4", "1/2")).toBe(true);
  });
  it("accepteert expliciete acceptedForms (termvolgorde)", () => {
    expect(wiskundeGelijk("b+a", "a+b", ["b+a"])).toBe(true);
  });
  it("negeert het graden-teken (meetkunde-hoeken)", () => {
    expect(wiskundeGelijk("70°", "70")).toBe(true);
    expect(wiskundeGelijk("70", "70°")).toBe(true);
    expect(wiskundeGelijk("70°", "70°")).toBe(true);
  });
});

describe("wiskundeGelijk — niet-vereenvoudigd / anders is fout", () => {
  it("rekent een niet-vereenvoudigde vorm fout", () => {
    expect(wiskundeGelijk("8(a+b)", "8a+8b")).toBe(false);
    expect(wiskundeGelijk("3a+5a", "8a")).toBe(false);
    expect(wiskundeGelijk("2·2·a·a", "4a²")).toBe(false);
  });
  it("rekent een andere termvolgorde fout zonder acceptedForms", () => {
    expect(wiskundeGelijk("b+a", "a+b")).toBe(false);
  });
  it("leeg antwoord is fout", () => {
    expect(wiskundeGelijk("", "8a")).toBe(false);
    expect(wiskundeGelijk("   ", "8a")).toBe(false);
  });
});

describe("wiskundeGelijk — §8.5 machten en letters (k.n., breuk-vragen, termvolgorde)", () => {
  it("accepteert k.n. in alle gangbare schrijfwijzen via acceptedForms", () => {
    const accepted = ["kan niet", "kn"];
    expect(wiskundeGelijk("k.n.", "k.n.", accepted)).toBe(true);
    expect(wiskundeGelijk("K.N.", "k.n.", accepted)).toBe(true);
    expect(wiskundeGelijk("kan niet", "k.n.", accepted)).toBe(true);
    expect(wiskundeGelijk("Kan Niet", "k.n.", accepted)).toBe(true);
    expect(wiskundeGelijk("kn", "k.n.", accepted)).toBe(true);
    expect(wiskundeGelijk("5x^3", "k.n.", accepted)).toBe(false);
  });
  it("kaal grondtal: 'a' goed, 'a^1' alleen via acceptedForms", () => {
    expect(wiskundeGelijk("a", "a", ["a^1"])).toBe(true);
    expect(wiskundeGelijk("a^1", "a", ["a^1"])).toBe(true);
    expect(wiskundeGelijk("a¹", "a", ["a^1"])).toBe(true);
  });
  it("meerterm-antwoord met spaties en superscript matcht cosmetisch", () => {
    expect(wiskundeGelijk("3a⁶+6a³", "3a^6 + 6a^3")).toBe(true);
    expect(wiskundeGelijk("8y² - x²", "-x^2 + 8y^2", ["8y^2 - x^2"])).toBe(true);
    expect(wiskundeGelijk("-x²+8y²", "-x^2 + 8y^2", ["8y^2 - x^2"])).toBe(true);
  });
});

describe("wiskundeGelijk — exacteVorm (wetenschappelijke notatie)", () => {
  it("accepteert de gevraagde vorm en cosmetische varianten", () => {
    expect(wiskundeGelijk("4,8·10^5", "4,8*10^5", [], true)).toBe(true);
    expect(wiskundeGelijk("4.8*10^5", "4,8*10^5", [], true)).toBe(true);
  });
  it("rekent de kale waarde fout (vorm telt)", () => {
    expect(wiskundeGelijk("480000", "4,8*10^5", [], true)).toBe(false);
  });
  it("zonder exacteVorm zou de waarde wél matchen (contrast)", () => {
    expect(wiskundeGelijk("480000", "4,8*10^5", [], false)).toBe(true);
  });
});

describe("gradeAnswer profiel 'wiskunde' — goed/fout, geen bijna", () => {
  it("goed bij cosmetische match", () => {
    expect(gradeAnswer("36a^2", ["36a²"], "wiskunde")).toBe("goed");
  });
  it("fout bij niet-vereenvoudigde vorm (geen bijna)", () => {
    expect(gradeAnswer("8(a+b)", ["8a+8b"], "wiskunde")).toBe("fout");
  });
  it("respecteert acceptedForms als extra geaccepteerde antwoorden", () => {
    expect(gradeAnswer("b+a", ["a+b", "b+a"], "wiskunde")).toBe("goed");
  });
});
