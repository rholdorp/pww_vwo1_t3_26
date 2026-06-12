import { describe, expect, it } from "vitest";
import { planPeriode, type DagSlot, type VakInput, type DagType } from "./index.js";

// Helper: bouw een reeks dagen. wo(3)+za(6) = gereduceerd; weekend buffer/leer per type-map.
function dag(datum: string, type: DagType, toetsVakken: string[] = []): DagSlot {
  return { datum, type, toetsVakken };
}

// Mini-rooster: ma 09 t/m zo 22 juni 2026. 8 juni = maandag.
// leer: ma/di/do/vr/zo · gereduceerd: wo/za · (geen buffer in deze fixture, los getest)
function leerWeek(maandagDdMm: string[]): DagSlot[] {
  // maandagDdMm = lijst ISO-datums ma..zo
  const types: DagType[] = ["leer", "leer", "gereduceerd", "leer", "leer", "gereduceerd", "leer"];
  return maandagDdMm.map((d, i) => dag(d, types[i]!));
}

function vakBlok(vak: string, n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `${vak}#${i}`, vak, trainerBlokIds: [`${vak}-b${i}`] }));
}

const WEEK1 = leerWeek([
  "2026-06-08", "2026-06-09", "2026-06-10", "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14",
]);

function basisVakken(): VakInput[] {
  return [
    { vak: "frans", pwwDatum: "2026-07-03", moeilijkheid: 3, gereduceerdOk: false, isBoek: false, pending: vakBlok("frans", 3), alleBlokIds: ["f"] },
    { vak: "biologie", pwwDatum: "2026-06-30", moeilijkheid: 1, gereduceerdOk: true, isBoek: false, pending: vakBlok("biologie", 3), alleBlokIds: ["b"] },
    { vak: "aardrijkskunde", pwwDatum: "2026-07-02", moeilijkheid: 1, gereduceerdOk: true, isBoek: false, pending: vakBlok("aardrijkskunde", 2), alleBlokIds: ["a"] },
    { vak: "nederlands", pwwDatum: "2026-07-01", moeilijkheid: 3, gereduceerdOk: false, isBoek: false, maxSessies: 3, pending: vakBlok("nederlands", 1), alleBlokIds: ["n"] },
    { vak: "wiskunde", pwwDatum: "2026-07-02", moeilijkheid: 3, gereduceerdOk: false, isBoek: true, pending: [], alleBlokIds: [] },
    { vak: "engels", pwwDatum: "2026-06-29", moeilijkheid: 2, gereduceerdOk: false, isBoek: true, pending: [], alleBlokIds: [] },
  ];
}

describe("planPeriode — harde regels", () => {
  const res = planPeriode(basisVakken(), WEEK1, "2026-06-08");

  it("plant geen dag vóór vandaag", () => {
    expect(res.dagen.every((d) => d.datum >= "2026-06-08")).toBe(true);
  });

  it("max 3 vakken per dag", () => {
    for (const d of res.dagen) expect(new Set(d.blokken.map((b) => b.vak)).size).toBeLessThanOrEqual(3);
  });

  it("max 1 leerblok per vak per dag", () => {
    for (const d of res.dagen) {
      const perVak = d.blokken.map((b) => b.vak);
      expect(perVak.length).toBe(new Set(perVak).size);
    }
  });

  it("respecteert de dagcapaciteit (gereduceerd = 1, leer = 3)", () => {
    for (const d of res.dagen) {
      const max = d.type === "gereduceerd" ? 1 : d.type === "leer" ? 3 : 0;
      expect(d.blokken.length).toBeLessThanOrEqual(max);
    }
  });

  it("gereduceerde dagen: geen boek-vakken; nieuwe content alleen Bio/AK (review mag breder)", () => {
    const easy = new Set(["biologie", "aardrijkskunde"]);
    for (const d of res.dagen.filter((d) => d.type === "gereduceerd")) {
      for (const b of d.blokken) {
        expect(["wiskunde", "engels"]).not.toContain(b.vak); // geen boek-vak op een rustdag
        if (b.soort === "trainer") expect(easy.has(b.vak)).toBe(true); // nieuwe content: alleen makkelijk
      }
    }
  });

  it("gereduceerde dag is niet leeg als er review mogelijk is (rustdag ≠ niks)", () => {
    const gereduceerd = res.dagen.filter((d) => d.type === "gereduceerd");
    for (const d of gereduceerd) expect(d.blokken.length).toBeGreaterThan(0);
  });

  it("nederlands komt niet vaker dan maxSessies (3) voor", () => {
    const n = res.dagen.flatMap((d) => d.blokken).filter((b) => b.vak === "nederlands").length;
    expect(n).toBeLessThanOrEqual(3);
  });

  it("plaatst alle content-blokken (geen overflow-flag) bij genoeg capaciteit", () => {
    const trainer = res.dagen.flatMap((d) => d.blokken).filter((b) => b.soort === "trainer");
    // frans 3 + bio 3 + ak 2 + ndl 1 = 9
    expect(trainer.length).toBe(9);
    expect(res.flags).toHaveLength(0);
  });

  it("geeft wiskunde meerdere boek-dagen (maar niet op gereduceerde dagen)", () => {
    const wis = res.dagen.filter((d) => d.blokken.some((b) => b.vak === "wiskunde"));
    expect(wis.length).toBeGreaterThanOrEqual(3);
    expect(wis.every((d) => d.type !== "gereduceerd")).toBe(true);
  });
});

describe("planPeriode — herplannen & overflow", () => {
  it("afgevinkte content (uit pending verwijderd) verschijnt niet meer", () => {
    const vakken = basisVakken();
    vakken[0]!.pending = vakBlok("frans", 1); // 2 frans-blokken 'afgevinkt'
    const res = planPeriode(vakken, WEEK1, "2026-06-08");
    const fransTrainer = res.dagen.flatMap((d) => d.blokken).filter((b) => b.vak === "frans" && b.soort === "trainer");
    expect(fransTrainer.length).toBe(1);
  });

  it("een rustdag-review verbruikt geen maxSessies-/spreiding-budget van een leerblok", () => {
    // Reproductie van de bug bij Stijns latere start: nederlands (maxSessies 3,
    // interval 4) kreeg op een gereduceerde dag een review die de 3e échte
    // schrijfsessie wegdrukte. Met de fix passen alle 3 de leerblokken.
    const buffer: DagSlot[] = [dag("2026-06-15", "leer"), dag("2026-06-16", "gereduceerd"), dag("2026-06-17", "leer")];
    const vakken = basisVakken();
    const ndl = vakken.find((v) => v.vak === "nederlands")!;
    ndl.pending = vakBlok("nederlands", 3);
    ndl.minIntervalDagen = 2;
    const res = planPeriode(vakken, [...WEEK1, ...buffer], "2026-06-08");
    const ndlTrainer = res.dagen.flatMap((d) => d.blokken).filter((b) => b.vak === "nederlands" && b.soort === "trainer");
    expect(ndlTrainer.length).toBe(3);
    expect(res.flags.some((f) => f.includes("nederlands"))).toBe(false);
  });

  it("te veel content voor de beschikbare dagen → overflow-flag", () => {
    const vakken = basisVakken();
    vakken[0]!.pending = vakBlok("frans", 20); // past niet in één week
    const res = planPeriode(vakken, WEEK1, "2026-06-08");
    expect(res.flags.some((f) => f.includes("frans"))).toBe(true);
  });

  it("herhaalweek (buffer) bevat alleen review/boek, geen nieuwe trainer-content bij volledige dekking", () => {
    const buffer: DagSlot[] = [dag("2026-06-22", "buffer"), dag("2026-06-23", "buffer")];
    const res = planPeriode(basisVakken(), [...WEEK1, ...buffer], "2026-06-08");
    const bufferBlokken = res.dagen.filter((d) => d.type === "buffer").flatMap((d) => d.blokken);
    expect(bufferBlokken.length).toBeGreaterThan(0);
    expect(bufferBlokken.every((b) => b.soort === "review" || b.soort === "boek")).toBe(true);
  });
});

describe("planPeriode — latere start + intensieve dagcap (Stijn 2026-06-11)", () => {
  it("plant niets vóór startDatum, ook al ligt vandaag eerder", () => {
    const res = planPeriode(basisVakken(), WEEK1, "2026-06-08", { startDatum: "2026-06-11" });
    expect(res.dagen.every((d) => d.datum >= "2026-06-11")).toBe(true);
    expect(res.dagen.some((d) => d.datum === "2026-06-08")).toBe(false);
  });

  it("dagCap 4 laat een vierde vak + vierde blok op een leerdag toe", () => {
    const vakken = basisVakken();
    // Vier content-vakken met genoeg voorraad zodat een leerdag echt vol kan.
    vakken[0]!.pending = vakBlok("frans", 8);
    vakken[1]!.pending = vakBlok("biologie", 8);
    vakken[2]!.pending = vakBlok("aardrijkskunde", 8);
    delete vakken[3]!.maxSessies;
    vakken[3]!.pending = vakBlok("nederlands", 8);
    const res = planPeriode(vakken, WEEK1, "2026-06-08", { dagCap: 4 });
    const leer = res.dagen.filter((d) => d.type === "leer");
    expect(leer.some((d) => d.blokken.length === 4)).toBe(true);
    for (const d of res.dagen) expect(d.blokken.length).toBeLessThanOrEqual(d.type === "gereduceerd" ? 1 : 4);
  });

  it("default (geen opties) blijft cap 3 / max 3 vakken", () => {
    const vakken = basisVakken();
    vakken[0]!.pending = vakBlok("frans", 8);
    vakken[1]!.pending = vakBlok("biologie", 8);
    vakken[2]!.pending = vakBlok("aardrijkskunde", 8);
    delete vakken[3]!.maxSessies;
    vakken[3]!.pending = vakBlok("nederlands", 8);
    const res = planPeriode(vakken, WEEK1, "2026-06-08");
    for (const d of res.dagen) {
      expect(new Set(d.blokken.map((b) => b.vak)).size).toBeLessThanOrEqual(3);
      expect(d.blokken.length).toBeLessThanOrEqual(d.type === "gereduceerd" ? 1 : 3);
    }
  });
});

describe("planPeriode — slot-cap override (verjaardagsfeest 13/6)", () => {
  it("beperkt één dag tot de slot-cap terwijl andere leerdagen vol blijven", () => {
    const slots = WEEK1.map((s) =>
      s.datum === "2026-06-13" ? { ...s, type: "leer" as DagType, cap: 2 } : s,
    );
    const vakken = basisVakken();
    vakken[0]!.pending = vakBlok("frans", 8);
    vakken[1]!.pending = vakBlok("biologie", 8);
    vakken[2]!.pending = vakBlok("aardrijkskunde", 8);
    const res = planPeriode(vakken, slots, "2026-06-08");
    const feest = res.dagen.find((d) => d.datum === "2026-06-13")!;
    expect(feest.blokken.length).toBeLessThanOrEqual(2);
    expect(feest.blokken.length).toBeGreaterThan(0); // wél wat doen, geen lege dag
    const andereLeer = res.dagen.filter((d) => d.type === "leer" && d.datum !== "2026-06-13");
    expect(andereLeer.some((d) => d.blokken.length === 3)).toBe(true);
  });
});

describe("planPeriode — uitloop tot 3 dagen vóór de toets (afspraak 2026-06-12)", () => {
  it("leftover content schuift zonder flag de herhaalweek in (vangnet)", () => {
    const buffer: DagSlot[] = [
      dag("2026-06-22", "buffer"), dag("2026-06-23", "buffer"), dag("2026-06-24", "buffer"),
      dag("2026-06-25", "buffer"), dag("2026-06-26", "buffer"),
    ];
    const vakken = basisVakken();
    vakken[0]!.pending = vakBlok("frans", 8); // past niet vóór de herhaalweek (toets 3/7)
    const res = planPeriode(vakken, [...WEEK1, ...buffer], "2026-06-08");
    const fransTrainer = res.dagen.flatMap((d) => d.blokken).filter((b) => b.vak === "frans" && b.soort === "trainer");
    expect(fransTrainer.length).toBe(8); // alles geplaatst …
    expect(res.flags).toHaveLength(0); // … dus geen harde flag
    const inBuffer = res.dagen
      .filter((d) => d.type === "buffer")
      .flatMap((d) => d.blokken)
      .filter((b) => b.vak === "frans" && b.soort === "trainer");
    expect(inBuffer.length).toBeGreaterThan(0); // de uitloop landt in de herhaalweek
  });

  it("plaatst geen nieuwe stof in de laatste 3 dagen vóór de toets; rest → flag", () => {
    const slots: DagSlot[] = [
      dag("2026-06-20", "leer"), dag("2026-06-21", "leer"),
      dag("2026-06-22", "buffer"), dag("2026-06-23", "buffer"), dag("2026-06-24", "buffer"),
    ];
    const vakken: VakInput[] = [
      // Toets 25/6 → laatste leerdag is 21/6 (22–24 = laatste 3 dagen, review-only).
      { vak: "engels", pwwDatum: "2026-06-25", moeilijkheid: 2, gereduceerdOk: false, isBoek: false, pending: vakBlok("engels", 5), alleBlokIds: ["e"] },
    ];
    const res = planPeriode(vakken, slots, "2026-06-20");
    const perDag = new Map(res.dagen.map((d) => [d.datum, d.blokken.filter((b) => b.soort === "trainer").length]));
    expect(perDag.get("2026-06-22")).toBe(0);
    expect(perDag.get("2026-06-23")).toBe(0);
    expect(perDag.get("2026-06-24")).toBe(0);
    expect(res.flags.some((f) => f.includes("engels"))).toBe(true); // 3 blokken passen nergens
  });

  it("dagelijks vak krijgt in de laatste 3 dagen een review-slot i.p.v. nieuwe stof", () => {
    const slots: DagSlot[] = [dag("2026-06-09", "leer"), dag("2026-06-10", "leer"), dag("2026-06-11", "leer")];
    const vakken: VakInput[] = [
      // Toets 12/6 → alle drie de dagen vallen in de laatste-3-dagen-zone.
      { vak: "wiskunde", pwwDatum: "2026-06-12", moeilijkheid: 3, gereduceerdOk: false, isBoek: true, dagelijks: true, pending: [], alleBlokIds: ["w"] },
    ];
    const res = planPeriode(vakken, slots, "2026-06-09");
    for (const d of res.dagen) {
      expect(d.blokken.some((b) => b.vak === "wiskunde" && b.soort === "review")).toBe(true);
      expect(d.blokken.some((b) => b.soort === "boek" || b.soort === "trainer")).toBe(false);
    }
  });
});

describe("planPeriode — dagelijks (wiskunde-afspraak)", () => {
  function metDagelijksWiskunde(): VakInput[] {
    const v = basisVakken();
    const wis = v.find((x) => x.vak === "wiskunde")!;
    wis.dagelijks = true;
    return v;
  }

  it("plaatst wiskunde op elke niet-gereduceerde leer-dag", () => {
    const res = planPeriode(metDagelijksWiskunde(), WEEK1, "2026-06-08");
    const leerDagen = res.dagen.filter((d) => d.type === "leer");
    for (const d of leerDagen) {
      expect(d.blokken.some((b) => b.vak === "wiskunde")).toBe(true);
    }
  });

  it("plaatst wiskunde NOOIT op een gereduceerde dag (wo/za)", () => {
    const res = planPeriode(metDagelijksWiskunde(), WEEK1, "2026-06-08");
    const gered = res.dagen.filter((d) => d.type === "gereduceerd");
    for (const d of gered) {
      expect(d.blokken.some((b) => b.vak === "wiskunde")).toBe(false);
    }
  });

  it("dagelijks vak mét trainer-content vult slots met échte blokken en leegt de wachtrij", () => {
    const v = basisVakken();
    const wis = v.find((x) => x.vak === "wiskunde")!;
    wis.dagelijks = true;
    wis.isBoek = false;
    wis.pending = vakBlok("wiskunde", 2); // 2 echte opgaven-blokken
    const res = planPeriode(v, WEEK1, "2026-06-08");
    const wisBlokken = res.dagen.flatMap((d) => d.blokken).filter((b) => b.vak === "wiskunde");
    const trainer = wisBlokken.filter((b) => b.soort === "trainer");
    // Beide content-blokken geplaatst, met niet-lege trainerBlokIds (geen lege kaart).
    expect(trainer.length).toBe(2);
    expect(trainer.every((b) => b.trainerBlokIds.length > 0)).toBe(true);
    // Geen overflow-flag: de dagelijkse plaatsing heeft de wachtrij geleegd.
    expect(res.flags.some((f) => f.includes("wiskunde"))).toBe(false);
    // Daarna komt wiskunde nog terug als review (elke niet-gereduceerde dag).
    expect(wisBlokken.some((b) => b.soort === "review")).toBe(true);
  });

  it("plaatst wiskunde op elke buffer-dag (herhaalweek = ma–vr, geen gereduceerd)", () => {
    const buffer: DagSlot[] = [
      dag("2026-06-22", "buffer"), dag("2026-06-23", "buffer"),
      dag("2026-06-24", "buffer"), dag("2026-06-25", "buffer"),
      dag("2026-06-26", "buffer"),
    ];
    const res = planPeriode(metDagelijksWiskunde(), [...WEEK1, ...buffer], "2026-06-08");
    const bufferDagen = res.dagen.filter((d) => d.type === "buffer");
    expect(bufferDagen.length).toBe(5);
    for (const d of bufferDagen) {
      expect(d.blokken.some((b) => b.vak === "wiskunde")).toBe(true);
    }
  });
});
