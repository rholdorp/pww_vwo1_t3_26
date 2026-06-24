import { useEffect, useMemo, useRef, useState } from "react";
import type { Richting, Uitkomst, Schrijfopdracht } from "@pww/shared";
import {
  currentItem,
  gradeAnswer,
  isComplete,
  needsHint,
  startSession,
  submit,
  type SessionState,
  startCat2,
  huidigeOpgaveId,
  isKlaarCat2,
  beantwoordCat2,
  wiskundeGelijk,
  type Cat2State,
} from "@pww/trainer-engine";
import {
  vakGroepen,
  vakLabel,
  vakKleur,
  richtingLabel,
  kanLeren,
  SOORT_ICON,
  SCHRIJFOPDRACHTEN,
  BLOKKEN,
  type Blok,
  type BlokSoort,
  type Card,
} from "./content";
import {
  blokMastery,
  huidigeNaam,
  wisNaam,
  record,
  zetOnderdeelStatus,
  onderdeelMastery,
  sessieVolgorde,
  zetNaam,
  laatsteScore,
  zetScore,
  laadConcept,
  bewaarConcept,
  vandaagISO,
  laadDagplan,
  bewaarDagplan,
  laadDagschema,
  bewaarDagschema,
  isAfgevinkt,
  zetAfvink,
  slug,
} from "./progress";
import { planVandaag, blokStatus, PWW_DATUM, dagenTot, kalenderSchema, roosterSlots, dagdelen, type BlokStatusKind } from "./planner";
import { logResultaat, beloningAdvies, toontBeloningen, streakDagen, MIJLPALEN, focusPunten, activiteit7dagen, alGevierd, zetGevierd, duurFactoren, geschatteMin, opgaveUnlockKeten, tijdTotaalMin, tijdPerVakMin } from "./gamification";
import type { GeplandBlok } from "@pww/planner-engine";
import { STIJN1 } from "./stijn1-plan";
import { startSync, stopSync, flushPush, isHydrated } from "./firestoreSync";
import { isMonitor, laadAlleStudenten, type StudentSamenvatting } from "./monitor";

type Tab = "vandaag" | "kalender" | "oefenen" | "voortgang";
type Actief =
  | { type: "train"; blok: Blok; richting?: Richting }
  | { type: "leer"; blok: Blok }
  | { type: "schrijf"; opdracht: Schrijfopdracht }
  | null;

/** Seconden → "m:ss". */
function minSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function App() {
  const [naam, setNaam] = useState<string | null>(() => huidigeNaam());
  const [tab, setTab] = useState<Tab>("vandaag");
  const [actief, setActief] = useState<Actief>(null);
  // Bump bij elke binnenkomende Firestore-update zodat React re-render't —
  // localStorage is dan al bijgewerkt door firestoreSync.
  const [, setSyncTick] = useState(0);

  // Firestore-sync activeren zodra de naam bekend is, en weer afsluiten op
  // unmount / naam-wissel. Updates van andere devices triggeren een re-render
  // via het pww-progress-updated event.
  useEffect(() => {
    if (!naam) return;
    startSync(naam);
    const handler = () => setSyncTick((t) => t + 1);
    window.addEventListener("pww-progress-updated", handler);
    const beforeUnload = () => flushPush(naam);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("pww-progress-updated", handler);
      window.removeEventListener("beforeunload", beforeUnload);
      stopSync();
    };
  }, [naam]);

  // Stijn (stijn1) volgt zijn eigen vaste schema. Dat moet het AI-schema van vandaag —
  // dat eerder al kan zijn bevroren — eenmalig vervangen, ongeacht welke tab eerst opent.
  // Force-write ná hydratie (bewaarDagschema schrijft niet als de inhoud al klopt → geen lus);
  // daarna een progress-event zodat Vandaag/Kalender meteen het nieuwe schema oppakken.
  useEffect(() => {
    if (!naam || slug(naam) !== STIJN1) return;
    const datum = vandaagISO();
    const force = (): boolean => {
      if (!isHydrated()) return false;
      const t = kalenderSchema(naam, datum).dagen.find((d) => d.datum === datum);
      if (t) {
        bewaarDagschema(naam, datum, t.blokken, true);
        window.dispatchEvent(new CustomEvent("pww-progress-updated"));
      }
      return true;
    };
    if (force()) return;
    const h = () => { if (force()) window.removeEventListener("pww-hydrated", h); };
    window.addEventListener("pww-hydrated", h);
    return () => window.removeEventListener("pww-hydrated", h);
  }, [naam]);

  if (!naam) {
    return <NaamPoort onKlaar={(n) => { zetNaam(n); setNaam(n); }} />;
  }

  function logout() {
    if (naam) flushPush(naam); // resterende voortgang nog wegschrijven
    wisNaam();
    setActief(null);
    setTab("vandaag");
    setNaam(null); // useEffect-cleanup roept stopSync aan
  }

  // Geheime naam → monitor-dashboard i.p.v. de leerling-app (geen trainers/nav).
  if (isMonitor(naam)) {
    return <MonitorApp onLogout={logout} />;
  }

  function startBlok(blok: Blok, richting?: Richting) {
    if (blok.soort === "schrijven" && blok.opdrachtId) {
      const opdracht = SCHRIJFOPDRACHTEN.get(blok.opdrachtId);
      if (opdracht) return setActief({ type: "schrijf", opdracht });
    }
    setActief({ type: "train", blok, richting });
  }
  function startLeer(blok: Blok) {
    setActief({ type: "leer", blok });
  }

  if (actief) {
    return (
      <div className="app">
        <header className="topbar">
          <button className="link" onClick={() => setActief(null)}>← Terug</button>
          <span className="naam">{naam}</span>
        </header>
        {actief.type === "train" && actief.blok.soort === "opgaven" ? (
          <Cat2Trainer
            key={actief.blok.id}
            naam={naam}
            blok={actief.blok}
            onExit={() => setActief(null)}
          />
        ) : actief.type === "train" ? (
          <Trainer
            key={actief.blok.id + (actief.richting ?? "")}
            naam={naam}
            blok={actief.blok}
            richting={actief.richting}
            onExit={() => setActief(null)}
          />
        ) : actief.type === "leer" ? (
          <LeerWeergave
            key={actief.blok.id}
            naam={naam}
            blok={actief.blok}
            onExit={() => setActief(null)}
            onOefen={() => setActief({ type: "train", blok: actief.blok })}
          />
        ) : (
          <SchrijfTrainer key={actief.opdracht.id} naam={naam} opdracht={actief.opdracht} onExit={() => setActief(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="app heeft-nav">
      <header className="topbar">
        <span className="logo">PWW Trainer</span>
        <span className="naam">{naam}</span>
      </header>

      {tab === "vandaag" && <Vandaag naam={naam} onStart={startBlok} onLeer={startLeer} onNaarOefenen={() => setTab("oefenen")} />}
      {tab === "kalender" && <Kalender naam={naam} onStart={startBlok} onLeer={startLeer} />}
      {tab === "oefenen" && <Home naam={naam} onStart={startBlok} onLeer={startLeer} />}
      {tab === "voortgang" && <Voortgang naam={naam} onLogout={logout} />}

      <nav className="bottomnav">
        {([["vandaag", "📅", "Vandaag"], ["kalender", "🗓️", "Kalender"], ["oefenen", "🎯", "Oefenen"], ["voortgang", "📈", "Voortgang"]] as const).map(
          ([t, icon, label]) => (
            <button key={t} className={`navknop ${tab === t ? "actief" : ""}`} onClick={() => setTab(t)}>
              <span className="nav-icon">{icon}</span>
              <span className="nav-label">{label}</span>
            </button>
          ),
        )}
      </nav>
    </div>
  );
}

// ── Monitor (Ralph): dashboard over alle leerlingen ─────────────────────────────

/** Minuten → "45m" / "1u 23m" / "2u". */
function tijdLabel(min: number): string {
  if (min <= 0) return "0m";
  if (min < 60) return `${min}m`;
  const u = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${u}u ${m}m` : `${u}u`;
}

/** ISO-datum → "3/7" (dag/maand). */
function kortDatum(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

/** Laatste 7 dagen (oud→vandaag) studietijd in minuten, uit een per-dag-map. */
function laatste7(perDag: Record<string, number>): number[] {
  const vandaag = vandaagISO();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.parse(`${vandaag}T00:00:00Z`) - (6 - i) * 86_400_000).toISOString().slice(0, 10);
    return perDag[d] ?? 0;
  });
}

const MONITOR_KLEUR = "#6366f1";

function MonitorApp({ onLogout }: { onLogout: () => void }) {
  const [studenten, setStudenten] = useState<StudentSamenvatting[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [status, setStatus] = useState<"laadt" | "klaar" | "fout">("laadt");
  const [versie, setVersie] = useState(0);

  useEffect(() => {
    let actief = true;
    setStatus("laadt");
    laadAlleStudenten()
      .then((s) => {
        if (!actief) return;
        setStudenten(s);
        setStatus("klaar");
      })
      .catch(() => actief && setStatus("fout"));
    return () => {
      actief = false;
    };
  }, [versie]);

  const gekozen = sel ? studenten?.find((s) => s.slug === sel) ?? null : null;

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">PWW Monitor</span>
        <button className="link" onClick={() => setVersie((v) => v + 1)}>↻ Ververs</button>
      </header>
      <main className="lijst">
        {status === "laadt" && <p className="muted">Laden…</p>}
        {status === "fout" && <p className="muted">Kon de gegevens niet laden. Probeer ↻ Ververs.</p>}
        {status === "klaar" && studenten && !gekozen && <MonitorLijst studenten={studenten} onKies={setSel} />}
        {gekozen && <MonitorDetail s={gekozen} onTerug={() => setSel(null)} />}
        <p className="muted klein voetnoot uitlog-regel">
          Monitor —{" "}
          <button className="uitlog-link" onClick={() => window.confirm("Monitor afsluiten?") && onLogout()}>
            afsluiten
          </button>
        </p>
      </main>
    </div>
  );
}

function MonitorLijst({ studenten, onKies }: { studenten: StudentSamenvatting[]; onKies: (slug: string) => void }) {
  if (!studenten.length) return <p className="muted">Nog geen leerlingen met voortgang.</p>;
  return (
    <>
      <h1>Leerlingen ({studenten.length})</h1>
      {studenten.map((s) => {
        const procent = s.blokkenTotaal ? Math.round((s.klaarTotaal / s.blokkenTotaal) * 100) : 0;
        return (
          <button key={s.slug} className="card" style={{ textAlign: "left", cursor: "pointer", width: "100%" }} onClick={() => onKies(s.slug)}>
            <div className="blok-kop">
              <div className="blok-tekst">
                <div className="card-titel">{s.slug}</div>
                <div className="muted klein">
                  {s.punten} pt{s.mijlpaal ? ` · ${s.mijlpaal}` : ""} · 🔥 {s.streak}d · ⏱️ {tijdLabel(s.tijdTotaalMin)}
                </div>
              </div>
              <Sparkline data={laatste7(s.tijdPerDagMin)} kleur={MONITOR_KLEUR} />
            </div>
            <div className="balk dun">
              <div className="balk-vuller" style={{ width: `${procent}%`, background: MONITOR_KLEUR }} />
            </div>
            <div className="muted klein">
              {procent}% klaar · schema {s.schemaBehaald}/{s.schemaGepland} dagen
              {s.laatstActief ? ` · laatst ${kortDatum(s.laatstActief)}` : ""}
            </div>
          </button>
        );
      })}
    </>
  );
}

function MonitorDetail({ s, onTerug }: { s: StudentSamenvatting; onTerug: () => void }) {
  const vakken = Object.keys(s.voortgangPerVak).sort();
  const dagen = Object.entries(s.tijdPerDagMin).sort(([a], [b]) => a.localeCompare(b));
  const maxDag = Math.max(1, ...dagen.map(([, m]) => m));
  const procent = s.blokkenTotaal ? Math.round((s.klaarTotaal / s.blokkenTotaal) * 100) : 0;
  return (
    <>
      <button className="link" onClick={onTerug}>← Alle leerlingen</button>
      <h1>{s.slug}</h1>

      <div className="card">
        <div className="card-titel">{s.punten} pt · {s.mijlpaal ?? "—"}</div>
        <div className="muted klein">
          🔥 {s.streak} dagen-streak · ⏱️ {tijdLabel(s.tijdTotaalMin)} totaal · {procent}% klaar ·
          schema {s.schemaBehaald}/{s.schemaGepland} dagen gehaald
        </div>
      </div>

      <div className="card">
        <div className="card-titel">Tijd & voortgang per vak</div>
        {vakken.map((vak) => {
          const v = s.voortgangPerVak[vak]!;
          const kleur = vakKleur(vak);
          return (
            <div key={vak} style={{ marginBottom: 8 }}>
              <div className="voortgang-rij">
                <span>
                  <span className="vak-stip" style={{ background: kleur }} /> {vakLabel(vak)}
                </span>
                <span className="muted klein">{v.procent}% · ⏱️ {tijdLabel(s.tijdPerVakMin[vak] ?? 0)}</span>
              </div>
              <div className="balk dun">
                <div className="balk-vuller" style={{ width: `${v.procent}%`, background: kleur }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="card-titel">Tijd per dag</div>
        {dagen.length === 0 && <p className="muted klein">Nog geen gelogde studietijd.</p>}
        {dagen.map(([d, min]) => (
          <div key={d} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
            <span className="muted klein" style={{ width: 36 }}>{kortDatum(d)}</span>
            <span style={{ flex: 1, height: 8, background: "rgba(0,0,0,0.06)", borderRadius: 4 }}>
              <span style={{ display: "block", height: 8, borderRadius: 4, background: MONITOR_KLEUR, width: `${Math.round((min / maxDag) * 100)}%` }} />
            </span>
            <span className="muted klein" style={{ width: 52, textAlign: "right" }}>{tijdLabel(min)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function NaamPoort({ onKlaar }: { onKlaar: (naam: string) => void }) {
  const [waarde, setWaarde] = useState("");
  return (
    <div className="app center">
      <div className="card narrow">
        <h1>PWW Trainer</h1>
        <p className="muted">Vul je naam in. Je voortgang wordt op dit apparaat bewaard.</p>
        <input
          className="tekstveld"
          autoFocus
          placeholder="Je naam"
          value={waarde}
          onChange={(e) => setWaarde(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && waarde.trim() && onKlaar(waarde)}
        />
        <button className="knop primair" disabled={!waarde.trim()} onClick={() => onKlaar(waarde)}>
          Beginnen
        </button>
      </div>
    </div>
  );
}

// Sub-kopjes per soort binnen een hoofdstuk (Oefenen-drilldown). Scheidt o.a. de
// wiskunde-flashcards (begrippen) van de echte opgaven-trainers.
const SUBKOP: Record<BlokSoort, string> = {
  opgaven: "Sommen maken",
  begrippen: "Begrippen & regels (flashcards)",
  woordjes: "Woordjes",
  invullen: "Invuloefeningen",
  vertalen: "Zinnen vertalen",
  diagram: "Op de afbeelding",
  uitlegvragen: "Uitleg & verbanden",
  schrijven: "Schrijven",
  tekenen: "Teken-opgaven (op papier)",
};

function Home({
  naam,
  onStart,
  onLeer,
}: {
  naam: string;
  onStart: (blok: Blok, richting?: Richting) => void;
  onLeer: (blok: Blok) => void;
}) {
  const groepen = useMemo(() => vakGroepen(), []);
  const [gekozenVak, setGekozenVak] = useState<string | null>(null);

  // Drill-down: één vak gekozen → toon alleen die vak's trainers + terug-knop.
  if (gekozenVak) {
    const g = groepen.find((x) => x.vak === gekozenVak);
    if (!g) {
      setGekozenVak(null);
      return null;
    }
    const kleur = vakKleur(g.vak);
    return (
      <main className="lijst">
        <ProgressWidget naam={naam} />
        <button className="link" onClick={() => setGekozenVak(null)}>← Alle vakken</button>
        <h1 style={{ color: kleur }}>
          <span className="vak-stip" style={{ background: kleur, verticalAlign: "middle", marginRight: 8 }} />
          {vakLabel(g.vak)}
        </h1>
        {g.hoofdstukken.map((h) => {
          // Binnen een hoofdstuk de blokken per soort groeperen (volgorde al gesorteerd:
          // opgaven eerst, dan flashcards e.d.) en een sub-kopje tonen zodra er meer dan
          // één soort is — zo zijn de échte sommen visueel gescheiden van de flashcards.
          const secties: { soort: BlokSoort; blokken: Blok[] }[] = [];
          for (const blok of h.blokken) {
            const laatste = secties[secties.length - 1];
            if (laatste && laatste.soort === blok.soort) laatste.blokken.push(blok);
            else secties.push({ soort: blok.soort, blokken: [blok] });
          }
          const toonSub = new Set(secties.map((s) => s.soort)).size > 1;
          return (
            <div key={h.hoofdstuk} className="hfd-groep">
              <h3 className="hfd">
                {h.hoofdstuk === "uitleg"
                  ? "Uitleg & verbanden"
                  : h.hoofdstuk === "schrijven"
                    ? "Schrijven"
                    : h.hoofdstuk === "zinnen"
                      ? "Zinnen maken & vertalen"
                      : `Hoofdstuk ${h.hoofdstuk}`}
              </h3>
              {secties.map((sec, si) => {
                // Opgaven (Cat 2): paragraaf-voor-paragraaf ontgrendelen.
                const slots = sec.soort === "opgaven" ? opgaveUnlockKeten(naam, sec.blokken) : null;
                return (
                  <div key={si} className="soort-sectie">
                    {toonSub && (
                      <div className="subhfd">
                        {SOORT_ICON[sec.soort]} {SUBKOP[sec.soort]}
                      </div>
                    )}
                    {slots
                      ? slots.map((slot) =>
                          slot.ontgrendeld ? (
                            <BlokKaart
                              key={slot.blok.id}
                              naam={naam}
                              blok={slot.blok}
                              kleur={kleur}
                              onStart={onStart}
                              onLeer={onLeer}
                              badge={
                                slot.afgekoeld ? (
                                  <span className="badge badge-warm">🔄 opfrissen</span>
                                ) : slot.beheerst ? (
                                  <span className="badge">✓ beheerst</span>
                                ) : slot.huidig ? (
                                  <span className="badge badge-nu">▶ nu</span>
                                ) : undefined
                              }
                            />
                          ) : (
                            <LockKaart key={slot.blok.id} blok={slot.blok} reden={slot.redenLocked} />
                          ),
                        )
                      : sec.blokken.map((blok) => (
                          <BlokKaart key={blok.id} naam={naam} blok={blok} kleur={kleur} onStart={onStart} onLeer={onLeer} />
                        ))}
                  </div>
                );
              })}
            </div>
          );
        })}
        <p className="muted klein voetnoot">Voortgang lokaal op dit apparaat bewaard.</p>
      </main>
    );
  }

  // Vak-overzicht: tegelgrid met per-vak gemiddelde mastery + aantal blokken.
  return (
    <main className="lijst">
      <ProgressWidget naam={naam} />
      <h1>Wat ga je oefenen?</h1>
      <div className="vak-tegels">
        {groepen.map((g) => {
          const kleur = vakKleur(g.vak);
          const alleBlokken = g.hoofdstukken.flatMap((h) => h.blokken);
          const gem = alleBlokken.length
            ? Math.round((alleBlokken.reduce((s, b) => s + blokStatus(naam, b).mastery, 0) / alleBlokken.length) * 100)
            : 0;
          return (
            <button
              key={g.vak}
              className="vak-tegel"
              style={{ borderColor: kleur, color: kleur }}
              onClick={() => setGekozenVak(g.vak)}
            >
              <div className="vak-tegel-naam">{vakLabel(g.vak)}</div>
              <div className="vak-tegel-meta muted klein">
                {alleBlokken.length} {alleBlokken.length === 1 ? "blok" : "blokken"} · {gem}% beheerst
              </div>
              <div className="balk dun">
                <div className="balk-vuller" style={{ width: `${gem}%`, background: kleur }} />
              </div>
            </button>
          );
        })}
      </div>
      <p className="muted klein voetnoot">Tik op een vak voor de trainers.</p>
    </main>
  );
}

/** Vergrendelde opgaven-paragraaf: zichtbaar maar nog niet te starten. */
function LockKaart({ blok, reden }: { blok: Blok; reden?: string }) {
  return (
    <div className="card blok op-slot">
      <div className="blok-kop">
        <span className="blok-icon">🔒</span>
        <div className="blok-tekst">
          <div className="card-titel">{blok.titel}</div>
          <div className="muted klein">Op slot — {reden ?? "eerst de vorige paragraaf afronden"}</div>
        </div>
      </div>
    </div>
  );
}

function BlokKaart({
  naam,
  blok,
  kleur,
  onStart,
  onLeer,
  badge,
}: {
  naam: string;
  blok: Blok;
  kleur: string;
  onStart: (blok: Blok, richting?: Richting) => void;
  onLeer?: (blok: Blok) => void;
  badge?: React.ReactNode;
}) {
  if (blok.soort === "schrijven") {
    const score = blok.opdrachtId ? laatsteScore(naam, blok.opdrachtId) : undefined;
    return (
      <div className="card blok">
        <div className="blok-kop">
          <span className="blok-icon">{SOORT_ICON.schrijven}</span>
          <div className="blok-tekst">
            <div className="card-titel">{blok.titel}</div>
            <div className="muted klein">
              Schrijfoefening · {score != null ? `laatste score ${score}/10` : "nog niet gedaan"}
            </div>
          </div>
          {score != null && score >= 6 && <span className="badge">✓ {score}/10</span>}
        </div>
        <div className="knoppen">
          <button className="knop primair" style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }} onClick={() => onStart(blok)}>
            {score != null ? "Opnieuw oefenen" : "Begin"}
          </button>
        </div>
      </div>
    );
  }

  const m = Math.round(blokMastery(naam, blok.ids) * 100);
  const beheerst = m >= 80;
  return (
    <div className="card blok">
      <div className="blok-kop">
        <span className="blok-icon">{SOORT_ICON[blok.soort]}</span>
        <div className="blok-tekst">
          <div className="card-titel">{blok.titel}</div>
          <div className="muted klein">{blok.ids.length} kaarten · {m}% beheerst</div>
        </div>
        {badge ?? (beheerst && <span className="badge">✓ beheerst</span>)}
      </div>
      <div className="balk dun">
        <div className="balk-vuller" style={{ width: `${m}%`, background: kleur }} />
      </div>
      <div className="knoppen">
        {kanLeren(blok.soort) && onLeer && (
          <button className="knop" style={{ borderColor: kleur }} onClick={() => onLeer(blok)}>
            📚 Leren
          </button>
        )}
        {blok.soort === "woordjes" && blok.richtingen ? (
          blok.richtingen.map((r) => (
            <button key={r} className="knop" style={{ borderColor: kleur }} onClick={() => onStart(blok, r)}>
              {richtingLabel(blok.vak, r)}
            </button>
          ))
        ) : (
          <button className="knop primair" style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }} onClick={() => onStart(blok)}>
            Oefenen
          </button>
        )}
      </div>
    </div>
  );
}

function Trainer({
  naam,
  blok,
  richting,
  onExit,
}: {
  naam: string;
  blok: Blok;
  richting?: Richting;
  onExit: () => void;
}) {
  const kleur = vakKleur(blok.vak);
  const cards = useMemo(() => blok.bouwCards(richting), [blok, richting]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const maakOrder = () => {
    const o = sessieVolgorde(naam, blok.ids);
    return blok.sessieLimiet ? o.slice(0, blok.sessieLimiet) : o;
  };
  const [order] = useState<string[]>(maakOrder);

  const [state, setState] = useState<SessionState>(() => startSession(order));
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ uitkomst: Uitkomst; answer: string } | null>(null);
  const [onthuld, setOnthuld] = useState(false);
  // Telt elke beurt op. Onderdeel van de kaart-`key`, zodat een kaart die
  // opnieuw wordt ingepland (bv. de láátste kaart na een 2e-poging-"fout")
  // echt opnieuw mount — anders blijft een hotspot-kaart "vastzitten" op zijn
  // oude feedback en lijkt de Volgende-knop dood. Zie session.submit (requeue).
  const [stap, setStap] = useState(0);
  const startRef = useRef<number>(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

  const totaal = order.length;
  const currentId = currentItem(state);
  const sessieKlaar = isComplete(state) || currentId === null;

  // Sessie-timer: telt op zolang de sessie loopt; bevriest bij afronding.
  useEffect(() => {
    if (sessieKlaar) return;
    const id = window.setInterval(() => setElapsedSec(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [sessieKlaar]);

  // Append-only resultaat-log (SPEC §8) + focus-duur wanneer de sessie af is.
  useEffect(() => {
    if (!sessieKlaar) return;
    const st = blokStatus(naam, blok);
    logResultaat(naam, {
      blokId: blok.id,
      vak: blok.vak,
      soort: blok.soort,
      mastery: st.mastery,
      afgevinkt: st.status === "afgevinkt",
      duurSec: Math.floor((Date.now() - startRef.current) / 1000),
    });
  }, [sessieKlaar, naam, blok]);

  if (sessieKlaar) {
    const m = Math.round(blokMastery(naam, blok.ids) * 100);
    const focus = focusPunten(elapsedSec);
    const stand = beloningAdvies(naam);
    const uitmuntend = m >= 90;
    return (
      <main className="lijst center">
        <div className="card narrow afronding">
          <h1>Klaar! {uitmuntend ? "🌟" : "🎉"}</h1>
          <p>Je hebt deze ronde van {totaal} {totaal === 1 ? "kaart" : "kaarten"} afgerond.</p>
          <div className="score-groot" style={{ color: kleur }}>{m}%</div>
          <p className="muted klein">van «{blok.titel}» beheerst</p>
          <div className="afronding-stats">
            <span>⏱️ {minSec(elapsedSec)}</span>
            {focus > 0 && <span>🔥 focus +{focus}</span>}
            <span>{stand.punten} pt totaal</span>
          </div>
          {stand.volgende && (
            <p className="muted klein">
              Nog {stand.restant} pt tot <b>{stand.volgende.naam}</b>
              {toontBeloningen(naam) ? ` (${stand.volgende.beloning})` : ""} — nog
              ±{stand.blokken} blok{stand.blokken === 1 ? "" : "ken"}!
            </p>
          )}
          <div className="knoppen">
            <button
              className="knop primair"
              style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }}
              onClick={() => {
                startRef.current = Date.now();
                setElapsedSec(0);
                setState(startSession(maakOrder()));
                setStap(0);
                setInput("");
                setFeedback(null);
                setOnthuld(false);
              }}
            >
              Nog een ronde
            </button>
            <button className="knop" onClick={onExit}>Terug</button>
          </div>
        </div>
      </main>
    );
  }

  const card = cardById.get(currentId)!;
  const gedaan = state.cleared.length;
  const progressPct = totaal > 0 ? Math.round((gedaan / totaal) * 100) : 0;

  function volgende(uitkomst: Uitkomst) {
    record(naam, currentId!, uitkomst);
    setState((s) => submit(s, uitkomst));
    setStap((n) => n + 1);
    setInput("");
    setFeedback(null);
    setOnthuld(false);
  }
  function nakijken() {
    if (card.kind !== "typed") return;
    const uitkomst = gradeAnswer(input, card.accepted, card.norm);
    record(naam, card.id, uitkomst);
    setFeedback({ uitkomst, answer: card.answer });
  }

  return (
    <main className="trainer">
      <div className="trainer-kop">
        <span className="vak-stip" style={{ background: kleur }} />
        <span className="muted klein">{vakLabel(blok.vak)} · {blok.titel}</span>
      </div>
      <div className="balk">
        <div className="balk-vuller" style={{ width: `${progressPct}%`, background: kleur }} />
      </div>
      <div className="balk-tekst muted klein">
        <span>{gedaan} / {totaal} af · nog {state.remaining.length} te gaan</span>
        <span className={`timer ${elapsedSec >= 1800 ? "t30" : elapsedSec >= 900 ? "t15" : ""}`}>
          ⏱️ {minSec(elapsedSec)}{elapsedSec >= 1800 ? " 🔥+15" : elapsedSec >= 900 ? " 🔥+5" : ""}
        </span>
      </div>

      <div className="card kaart-groot">
        {card.kind === "typed" ? (
          <TypedKaart
            card={card}
            kleur={kleur}
            input={input}
            setInput={setInput}
            feedback={feedback}
            hint={needsHint(state, card.id)}
            onNakijken={nakijken}
            onVolgende={() => feedback && volgende(feedback.uitkomst)}
          />
        ) : card.kind === "hotspot" ? (
          <HotspotKaart key={card.id + card.richting + ":" + stap} card={card} kleur={kleur} onResultaat={volgende} />
        ) : card.kind === "flip" ? (
          <FlipKaart card={card} kleur={kleur} onthuld={onthuld} onToon={() => setOnthuld(true)} onBeoordeel={volgende} />
        ) : card.kind === "teken" ? (
          <TekenKaart card={card} kleur={kleur} onKlaar={() => volgende("goed")} />
        ) : null}
      </div>

      <button className="link" onClick={onExit}>Stoppen</button>
    </main>
  );
}

// ── Cat 2 (wiskunde) — adaptieve opgaven-trainer ─────────────────────────────
function schud<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

type OpgaveCard = Extract<Card, { kind: "opgave" }>;

function Cat2Trainer({ naam, blok, onExit }: { naam: string; blok: Blok; onExit: () => void }) {
  const kleur = vakKleur(blok.vak);
  const cards = useMemo(
    () => blok.bouwCards().filter((c): c is OpgaveCard => c.kind === "opgave"),
    [blok],
  );
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  // Schud de pool per onderdeel één keer; de engine trekt er deterministisch uit.
  const maakEngineOpgaven = () => {
    const per = new Map<string, OpgaveCard[]>();
    for (const c of cards) {
      if (!per.has(c.onderdeel)) per.set(c.onderdeel, []);
      per.get(c.onderdeel)!.push(c);
    }
    const out: { id: string; onderdeel: string; onderdeelTitel: string; isSynthese: boolean }[] = [];
    for (const [, lijst] of per)
      for (const c of schud(lijst))
        out.push({ id: c.id, onderdeel: c.onderdeel, onderdeelTitel: c.onderdeelTitel, isSynthese: c.isSynthese });
    return out;
  };

  const [state, setState] = useState<Cat2State>(() => startCat2(maakEngineOpgaven()));
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ goed: boolean; answer: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<number>(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);

  const klaar = isKlaarCat2(state);

  useEffect(() => {
    if (klaar) return;
    const id = window.setInterval(() => setElapsedSec(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, [klaar]);

  useEffect(() => {
    if (!klaar) return;
    const st = blokStatus(naam, blok);
    logResultaat(naam, {
      blokId: blok.id,
      vak: blok.vak,
      soort: blok.soort,
      mastery: st.mastery,
      afgevinkt: st.status === "afgevinkt",
      duurSec: Math.floor((Date.now() - startRef.current) / 1000),
    });
  }, [klaar, naam, blok]);

  const syntheseVergrendeld = state.voortgang.some((v) => v.isSynthese && v.status === "vergrendeld");

  if (klaar) {
    const m = Math.round(onderdeelMastery(naam, blok.id, blok.onderdelen ?? []) * 100);
    const focus = focusPunten(elapsedSec);
    const klaarN = state.voortgang.filter((v) => v.status === "klaar").length;
    const stand = beloningAdvies(naam);
    return (
      <main className="lijst center">
        <div className="card narrow afronding">
          <h1>Klaar! 🎉</h1>
          <p>{klaarN} van {state.voortgang.length} onderdelen afgerond deze ronde.</p>
          <div className="score-groot" style={{ color: kleur }}>{m}%</div>
          <p className="muted klein">van «{blok.titel}» (onderdelen ✓)</p>
          <div className="afronding-stats">
            <span>⏱️ {minSec(elapsedSec)}</span>
            {focus > 0 && <span>🔥 focus +{focus}</span>}
            <span>{stand.punten} pt totaal</span>
          </div>
          {stand.volgende && (
            <p className="muted klein">
              Nog {stand.restant} pt tot <b>{stand.volgende.naam}</b>
              {toontBeloningen(naam) ? ` (${stand.volgende.beloning})` : ""} — nog
              ±{stand.blokken} blok{stand.blokken === 1 ? "" : "ken"}!
            </p>
          )}
          <div className="knoppen">
            <button
              className="knop primair"
              style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }}
              onClick={() => {
                startRef.current = Date.now();
                setElapsedSec(0);
                setState(startCat2(maakEngineOpgaven()));
                setInput("");
                setFeedback(null);
              }}
            >
              Nog een ronde
            </button>
            <button className="knop" onClick={onExit}>Terug</button>
          </div>
        </div>
      </main>
    );
  }

  const huidigeId = huidigeOpgaveId(state);
  const card = huidigeId ? cardById.get(huidigeId) ?? null : null;
  const actief = state.voortgang.find((v) => v.onderdeel === state.actief);
  if (!card || !actief) return null;

  function insert(ch: string) {
    const el = inputRef.current;
    const s = el?.selectionStart ?? input.length;
    const e = el?.selectionEnd ?? input.length;
    setInput(input.slice(0, s) + ch + input.slice(e));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + ch.length, s + ch.length);
    });
  }
  function nakijken() {
    if (!card || feedback) return;
    const goed = wiskundeGelijk(input, card.answer, card.accepted, card.exacteVorm);
    record(naam, card.id, goed ? "goed" : "fout");
    setFeedback({ goed, answer: card.answer });
  }
  function volgende() {
    if (!feedback) return;
    const ns = beantwoordCat2(state, feedback.goed);
    for (const v of ns.voortgang)
      if (v.status === "klaar" || v.status === "deels") zetOnderdeelStatus(naam, blok.id, v.onderdeel, v.status);
    setState(ns);
    setInput("");
    setFeedback(null);
  }

  const statusIcon = (s: string) => (s === "klaar" ? "✓" : s === "deels" ? "•" : s === "vergrendeld" ? "🔒" : "");

  return (
    <main className="trainer">
      <div className="trainer-kop">
        <span className="vak-stip" style={{ background: kleur }} />
        <span className="muted klein">{vakLabel(blok.vak)} · {blok.titel}</span>
      </div>

      {/* Kralenketting: onderdeel-status (losse eerst, synthese met slot) */}
      <div className="onderdeel-rij">
        {[...state.voortgang].map((v) => (
          <span
            key={v.onderdeel}
            className={`onderdeel-chip ${v.onderdeel === state.actief ? "actief" : ""} st-${v.status}`}
            style={v.onderdeel === state.actief ? { borderColor: kleur, color: kleur } : undefined}
            title={`${v.titel} — ${v.goed}/${v.gevraagd} goed`}
          >
            {(v.titel.match(/§\d+\.\d+/)?.[0] ?? (v.isSynthese ? "Synthese" : "Voork."))} {statusIcon(v.status)}
          </span>
        ))}
      </div>

      <div className="balk-tekst muted klein">
        <span>{actief.titel} · {actief.goed}/{actief.gevraagd} goed{syntheseVergrendeld ? " · 🔒 synthese komt later" : ""}</span>
        <span className={`timer ${elapsedSec >= 1800 ? "t30" : elapsedSec >= 900 ? "t15" : ""}`}>
          ⏱️ {minSec(elapsedSec)}{elapsedSec >= 1800 ? " 🔥+15" : elapsedSec >= 900 ? " 🔥+5" : ""}
        </span>
      </div>

      <div className="card kaart-groot">
        <div className="muted klein kaart-subtitel">✏️ Maak de som op papier, typ dan je eindantwoord — in de simpelste vorm.</div>
        {card.image && <img className="kaart-beeld" src={card.image} alt="figuur bij de opgave" />}
        <div className="prompt wiskunde-prompt">{card.vraag}</div>

        <input
          ref={inputRef}
          className="tekstveld"
          autoFocus
          placeholder="Je eindantwoord"
          value={input}
          readOnly={!!feedback}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (feedback) volgende();
            else nakijken();
          }}
        />

        {!feedback && (
          <div className="accent-rij">
            {["^", "²", "³", "·", "/", "(", ")", "x", "-", "="].map((ch) => (
              <button key={ch} type="button" className="accent-knop" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(ch)}>
                {ch}
              </button>
            ))}
          </div>
        )}

        {feedback ? (
          <>
            <div className={`uitslag ${feedback.goed ? "goed" : "fout"}`}>
              {feedback.goed ? "Goed! ✅" : "Helaas — niet de simpelste vorm of niet juist."}
            </div>
            {!feedback.goed && (
              <div className="juiste">Juiste antwoord: <strong>{feedback.answer}</strong></div>
            )}
            <button className="knop primair" style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }} onClick={volgende}>
              {feedback.goed ? "Volgende →" : "Probeer een vergelijkbare som →"}
            </button>
          </>
        ) : (
          <button className="knop primair" style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }} disabled={!input.trim()} onClick={nakijken}>
            Nakijken
          </button>
        )}
      </div>

      <button className="link" onClick={onExit}>Stoppen</button>
    </main>
  );
}

// ── Leren-modus — stof eerst bekijken, zonder beoordeling ────────────────────
// Twee weergaven voor kaart-blokken: "bladeren" (één kaart tegelijk, term +
// uitleg samen zichtbaar) en "lijst" (alles onder elkaar, als samenvattingsblad).
// Diagram-blokken krijgen een verkenmodus: tik op een onderdeel of naam → het
// licht op in de afbeelding. Leren geeft géén mastery (dat blijft aan Oefenen),
// maar telt vanaf 2 minuten wel mee als sessie (streak + focus-bonus).

type LeerItem = { id: string; term: string; uitleg: string; rubric?: string[]; image?: string };

function LeerWeergave({
  naam,
  blok,
  onExit,
  onOefen,
}: {
  naam: string;
  blok: Blok;
  onExit: () => void;
  onOefen: () => void;
}) {
  const kleur = vakKleur(blok.vak);
  const cards = useMemo(() => blok.bouwCards(), [blok]);
  const hotspots = useMemo(() => {
    const per = new Map<string, Extract<Card, { kind: "hotspot" }>>();
    for (const c of cards) if (c.kind === "hotspot" && !per.has(c.targetId)) per.set(c.targetId, c);
    return [...per.values()];
  }, [cards]);
  const items = useMemo(
    () =>
      cards.flatMap((c): LeerItem[] =>
        c.kind === "typed"
          ? [{ id: c.id, term: c.answer, uitleg: c.prompt, image: c.image }]
          : c.kind === "flip"
            ? [{ id: c.id, term: c.front, uitleg: c.back, rubric: c.rubric, image: c.image }]
            : [],
      ),
    [cards],
  );
  const [weergave, setWeergave] = useState<"bladeren" | "lijst">("bladeren");
  const [index, setIndex] = useState(0);
  const startRef = useRef<number>(Date.now());

  // Log de leersessie bij het verlaten — pas vanaf 2 min, zodat even
  // binnengluren geen streak-dag oplevert. mastery komt uit blokStatus en
  // verandert hier dus niet: punten blijven aan Oefenen voorbehouden.
  useEffect(() => {
    return () => {
      const duurSec = Math.floor((Date.now() - startRef.current) / 1000);
      if (duurSec < 120) return;
      const st = blokStatus(naam, blok);
      logResultaat(naam, {
        blokId: blok.id,
        vak: blok.vak,
        soort: "leren",
        mastery: st.mastery,
        afgevinkt: st.status === "afgevinkt",
        duurSec,
      });
    };
  }, [naam, blok]);

  const huidig = items.length ? items[Math.min(index, items.length - 1)] : null;

  return (
    <main className="trainer">
      <div className="trainer-kop">
        <span className="vak-stip" style={{ background: kleur }} />
        <span className="muted klein">{vakLabel(blok.vak)} · {blok.titel} · leren</span>
      </div>

      {hotspots.length > 0 ? (
        <DiagramLeer hotspots={hotspots} kleur={kleur} />
      ) : (
        <>
          <div className="leer-toggle">
            {([["bladeren", "🃏 Bladeren"], ["lijst", "📖 Lijst"]] as const).map(([w, label]) => (
              <button key={w} className={`knop ${weergave === w ? "aan" : ""}`} onClick={() => setWeergave(w)}>
                {label}
              </button>
            ))}
          </div>

          {weergave === "bladeren" && huidig ? (
            <>
              <div className="balk">
                <div className="balk-vuller" style={{ width: `${Math.round(((index + 1) / items.length) * 100)}%`, background: kleur }} />
              </div>
              <div className="balk-tekst muted klein">
                <span>kaart {index + 1} / {items.length}</span>
                <span>kijken en onthouden — nog geen toets</span>
              </div>
              <div className="card kaart-groot">
                {huidig.image && <img className="kaart-beeld" src={huidig.image} alt="" />}
                <div className="prompt" style={{ color: kleur }}>{huidig.term}</div>
                <div className="leer-uitleg">{huidig.uitleg}</div>
                {huidig.rubric && huidig.rubric.length > 0 && (
                  <ul className="rubric muted klein">
                    {huidig.rubric.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="knoppen">
                <button className="knop" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                  ← Vorige
                </button>
                {index < items.length - 1 ? (
                  <button
                    className="knop primair"
                    style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }}
                    onClick={() => setIndex((i) => Math.min(items.length - 1, i + 1))}
                  >
                    Volgende →
                  </button>
                ) : (
                  <button className="knop primair" style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }} onClick={onOefen}>
                    Nu oefenen →
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="card leer-lijst">
              {items.map((it) => (
                <div key={it.id} className="leer-rij">
                  <div className="leer-term" style={{ color: kleur }}>{it.term}</div>
                  <div className="leer-uitleg klein">{it.uitleg}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="knoppen">
        <button className="knop primair" style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }} onClick={onOefen}>
          Nu oefenen →
        </button>
        <button className="knop" onClick={onExit}>Terug</button>
      </div>
    </main>
  );
}

function DiagramLeer({ hotspots, kleur }: { hotspots: Extract<Card, { kind: "hotspot" }>[]; kleur: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [sel, setSel] = useState<string | null>(hotspots[0]?.targetId ?? null);
  const eerste = hotspots[0];

  // Geselecteerde regio oplichten — zelfde .target-styling als de benoem-trainer.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll(".region.target").forEach((el) => el.classList.remove("target"));
    if (sel) root.querySelector(`.region[data-region="${sel}"]`)?.classList.add("target");
  }, [sel]);

  // Andersom verkennen: tik op een onderdeel in de afbeelding → selecteer het.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const onClick = (e: Event) => {
      const t = (e.target as Element).closest(".region");
      if (t) setSel(t.getAttribute("data-region"));
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  if (!eerste) return null;
  const gekozen = hotspots.find((h) => h.targetId === sel);

  return (
    <div className="hotspot">
      <div className="muted klein">Tik op een onderdeel in de afbeelding, of op een naam eronder — het licht op.</div>
      {eerste.svgInline ? (
        <div className="diagram-svg" ref={ref} dangerouslySetInnerHTML={{ __html: eerste.svgInline }} />
      ) : eerste.image ? (
        <div className="diagram-overlay" ref={ref}>
          <img src={eerste.image} alt="" />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            {(eerste.markers ?? []).map((m) => (
              <circle key={m.id} className="region marker" data-region={m.id} cx={m.x} cy={m.y} r={3.2} />
            ))}
          </svg>
        </div>
      ) : null}
      {gekozen && (
        <div className="leer-gekozen">
          <b style={{ color: kleur }}>{gekozen.naam}</b>
          {gekozen.hint && <span className="muted klein"> — {gekozen.hint}</span>}
        </div>
      )}
      <div className="leer-legenda">
        {hotspots.map((h) => (
          <button
            key={h.targetId}
            className={`leer-chip ${h.targetId === sel ? "actief" : ""}`}
            style={h.targetId === sel ? { borderColor: kleur, color: kleur } : undefined}
            onClick={() => setSel(h.targetId)}
          >
            {h.naam}
          </button>
        ))}
      </div>
    </div>
  );
}

function TypedKaart({
  card,
  kleur,
  input,
  setInput,
  feedback,
  hint,
  onNakijken,
  onVolgende,
}: {
  card: Extract<Card, { kind: "typed" }>;
  kleur: string;
  input: string;
  setInput: (s: string) => void;
  feedback: { uitkomst: Uitkomst; answer: string } | null;
  hint: boolean;
  onNakijken: () => void;
  onVolgende: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isFrans = card.norm === "frans" || card.norm === "zin";
  const voegAccentToe = (ch: string) => {
    const el = inputRef.current;
    const s = el?.selectionStart ?? input.length;
    const e = el?.selectionEnd ?? input.length;
    setInput(input.slice(0, s) + ch + input.slice(e));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(s + ch.length, s + ch.length);
    });
  };
  return (
    <>
      {card.image && <img className="kaart-beeld" src={card.image} alt="" />}
      {card.subtitel && <div className="muted klein kaart-subtitel">{card.subtitel}</div>}
      <div className="prompt">{card.prompt}</div>
      {hint && !feedback && (
        <div className="muted klein hint">hint: begint met “{card.answer.slice(0, 1)}”</div>
      )}
      <input
        ref={inputRef}
        className="tekstveld"
        autoFocus
        placeholder="Typ je antwoord"
        value={input}
        readOnly={!!feedback}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (feedback) onVolgende();
          else onNakijken();
        }}
      />
      {isFrans && !feedback && (
        <div className="accent-rij">
          {["é", "è", "ê", "ë", "à", "â", "ç", "ù", "û", "î", "ï", "ô", "œ"].map((ch) => (
            <button key={ch} type="button" className="accent-knop" onMouseDown={(e) => e.preventDefault()} onClick={() => voegAccentToe(ch)}>
              {ch}
            </button>
          ))}
        </div>
      )}
      {feedback ? (
        <>
          <div className={`uitslag ${feedback.uitkomst}`}>
            {feedback.uitkomst === "goed" && "Goed! ✅"}
            {feedback.uitkomst === "bijna" && "Bijna — let op de spelling"}
            {feedback.uitkomst === "fout" && "Helaas"}
          </div>
          {feedback.uitkomst !== "goed" && (
            <div className="juiste">Juiste antwoord: <strong>{card.answer}</strong></div>
          )}
          <button className="knop primair" style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }} onClick={onVolgende}>
            Volgende
          </button>
        </>
      ) : (
        <button className="knop primair" style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }} disabled={!input.trim()} onClick={onNakijken}>
          Nakijken
        </button>
      )}
    </>
  );
}

// Teken-/doe-opgave (meetkunde): figuur + opdracht, op papier doen, dan afvinken.
// Geen automatisch nakijken/zelfbeoordeling (besluit Ralph 2026-06-15).
function TekenKaart({
  card,
  kleur,
  onKlaar,
}: {
  card: Extract<Card, { kind: "teken" }>;
  kleur: string;
  onKlaar: () => void;
}) {
  return (
    <>
      <div className="muted klein kaart-subtitel">✏️ Doe deze opgave op papier (in je schrift).</div>
      {card.image && <img className="kaart-beeld" src={card.image} alt="figuur bij de opgave" />}
      <div className="prompt">{card.vraag}</div>
      {card.tip && <div className="muted klein hint">💡 {card.tip}</div>}
      <button
        className="knop primair"
        style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }}
        onClick={onKlaar}
      >
        Klaar — gedaan ✓
      </button>
    </>
  );
}

// Afvink-blok (offline werk zonder trainer): zelf-gekozen wiskunde-boekoefeningen of
// handvaardigheid. ouderGoedkeuring → alleen een ouder vinkt af (read-only voor Stijn,
// zodat hij niet zomaar punten pakt); anders mag hij het zelf afvinken.
function AfvinkKaart({ naam, gb, onChange }: { naam: string; gb: GeplandBlok; onChange: () => void }) {
  if (!gb.afvink) return null;
  const kleur = vakKleur(gb.vak);
  const af = isAfgevinkt(naam, gb.afvink.id);
  const ouder = gb.afvink.ouderGoedkeuring;
  return (
    <div className="card blok" style={{ borderLeft: `4px solid ${kleur}` }}>
      <div className="blok-kop">
        <span className="blok-icon">{af ? "✅" : ouder ? "🔒" : "📝"}</span>
        <div className="blok-tekst">
          <div className="card-titel">{vakLabel(gb.vak)} · {gb.afvink.label}</div>
          <div className="muted klein">
            {gb.optioneel ? "optioneel · telt niet mee · " : ""}
            {af
              ? ouder ? "✓ nagekeken door papa/mama" : "✓ gedaan"
              : ouder ? "papa of mama vinkt dit af" : "doe het, vink het dan hier af"}
          </div>
        </div>
      </div>
      {!ouder && (
        <div className="knoppen">
          {af ? (
            <button className="knop" onClick={() => { zetAfvink(naam, gb.afvink!.id, false); onChange(); }}>
              Toch niet
            </button>
          ) : (
            <button
              className="knop primair"
              style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }}
              onClick={() => { zetAfvink(naam, gb.afvink!.id, true); onChange(); }}
            >
              Klaar — gedaan ✓
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FlipKaart({
  card,
  kleur,
  onthuld,
  onToon,
  onBeoordeel,
}: {
  card: Extract<Card, { kind: "flip" }>;
  kleur: string;
  onthuld: boolean;
  onToon: () => void;
  onBeoordeel: (uitkomst: Uitkomst) => void;
}) {
  return (
    <>
      {card.image && <img className="kaart-beeld" src={card.image} alt="" />}
      <div className="prompt">{card.front}</div>
      {!onthuld ? (
        <button className="knop primair" style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }} onClick={onToon}>
          Toon antwoord
        </button>
      ) : (
        <>
          <div className="antwoord">{card.back}</div>
          {card.rubric && card.rubric.length > 0 && (
            <ul className="rubric muted klein">
              {card.rubric.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          <div className="muted klein">Wist je dit?</div>
          <div className="knoppen">
            <button className="knop goed" onClick={() => onBeoordeel("goed")}>Wist ik ✅</button>
            <button className="knop fout" onClick={() => onBeoordeel("fout")}>Nog niet</button>
          </div>
        </>
      )}
    </>
  );
}

function HotspotKaart({
  card,
  kleur,
  onResultaat,
}: {
  card: Extract<Card, { kind: "hotspot" }>;
  kleur: string;
  onResultaat: (uitkomst: Uitkomst) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ uitkomst: Uitkomst; msg: string } | null>(null);
  const klaar = feedback !== null;
  const primair = { background: `${kleur}22`, color: kleur, borderColor: kleur };

  // AANWIJS: klik-beoordeling op de .region-elementen (max 2 pogingen).
  useEffect(() => {
    if (card.richting !== "aanwijs") return;
    const root = ref.current;
    if (!root) return;
    let attempts = 0;
    let done = false;
    const onClick = (e: Event) => {
      if (done) return;
      const t = (e.target as Element).closest(".region") as HTMLElement | null;
      if (!t) return;
      attempts++;
      if (t.getAttribute("data-region") === card.targetId) {
        done = true;
        t.classList.add("correct");
        setFeedback({ uitkomst: attempts === 1 ? "goed" : "fout", msg: `✅ Goed! Dit is ${card.naam}.` });
      } else if (attempts < 2) {
        t.classList.add("wrong");
        window.setTimeout(() => t.classList.remove("wrong"), 800);
      } else {
        done = true;
        root.querySelector(`.region[data-region="${card.targetId}"]`)?.classList.add("hint");
        setFeedback({ uitkomst: "fout", msg: `❌ Het juiste antwoord (blauw) is ${card.naam}.` });
      }
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [card]);

  // BENOEM: het juiste onderdeel oplichten; Stijn typt de naam.
  useEffect(() => {
    if (card.richting !== "benoem") return;
    const target = ref.current?.querySelector(`.region[data-region="${card.targetId}"]`);
    target?.classList.add("target");
    return () => target?.classList.remove("target");
  }, [card]);

  function nakijkenBenoem() {
    setFeedback({ uitkomst: gradeAnswer(input, card.accepted, card.norm), msg: "" });
  }

  const markers =
    card.richting === "benoem" ? (card.markers ?? []).filter((m) => m.id === card.targetId) : (card.markers ?? []);
  const diagram = card.svgInline ? (
    <div className="diagram-svg" ref={ref} dangerouslySetInnerHTML={{ __html: card.svgInline }} />
  ) : card.image ? (
    <div className="diagram-overlay" ref={ref}>
      <img src={card.image} alt="" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {markers.map((m) => (
          <circle key={m.id} className="region marker" data-region={m.id} cx={m.x} cy={m.y} r={3.2} />
        ))}
      </svg>
    </div>
  ) : null;

  if (card.richting === "aanwijs") {
    return (
      <div className="hotspot">
        <div className="prompt hotspot-prompt">Klik op: <b>{card.naam}</b></div>
        {card.hint && !klaar && <div className="muted klein">💡 {card.hint}</div>}
        {diagram}
        {feedback && (
          <>
            <div className={`uitslag ${feedback.uitkomst}`}>{feedback.msg}</div>
            <button className="knop primair" style={primair} onClick={() => onResultaat(feedback.uitkomst)}>
              Volgende →
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="hotspot">
      <div className="prompt hotspot-prompt">{card.benoemVraag}</div>
      {diagram}
      <input
        className="tekstveld"
        autoFocus
        readOnly={klaar}
        value={input}
        placeholder="Typ de naam"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          if (klaar) onResultaat(feedback!.uitkomst);
          else nakijkenBenoem();
        }}
      />
      {klaar && (
        <div className={`uitslag ${feedback!.uitkomst}`}>
          {feedback!.uitkomst === "goed" ? "Goed! ✅" : feedback!.uitkomst === "bijna" ? "Bijna! 🟠" : "Helaas ❌"}
        </div>
      )}
      {klaar && feedback!.uitkomst !== "goed" && <div className="juiste">Het is: <b>{card.naam}</b></div>}
      <button className="knop primair" style={primair} onClick={() => (klaar ? onResultaat(feedback!.uitkomst) : nakijkenBenoem())}>
        {klaar ? "Volgende →" : "Nakijken"}
      </button>
    </div>
  );
}

interface ScoreResultaat {
  score?: number | null;
  samenvatting?: string;
  sterk?: string[];
  verbeterpunten?: string[];
}

function SchrijfTrainer({
  naam,
  opdracht,
  onExit,
}: {
  naam: string;
  opdracht: Schrijfopdracht;
  onExit: () => void;
}) {
  const kleur = vakKleur("nederlands");
  const velden = opdracht.begeleid && opdracht.stappen ? opdracht.stappen.map((s) => s.sleutel) : ["_"];

  const [antwoorden, setAntwoorden] = useState<Record<string, string>>(() => {
    const concept = laadConcept(naam, opdracht.id);
    return Object.fromEntries(velden.map((k) => [k, concept[k] ?? ""]));
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState<ScoreResultaat | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [geenKey, setGeenKey] = useState(false);

  function zet(sleutel: string, waarde: string) {
    setAntwoorden((vorig) => {
      const next = { ...vorig, [sleutel]: waarde };
      bewaarConcept(naam, opdracht.id, next);
      return next;
    });
  }

  function bouwBrief(): string {
    if (opdracht.begeleid && opdracht.stappen) {
      return opdracht.stappen.map((s) => antwoorden[s.sleutel]?.trim()).filter(Boolean).join("\n\n");
    }
    return (antwoorden["_"] ?? "").trim();
  }
  const leeg = bouwBrief().length < 5;

  async function vraag(mode: "feedback" | "score") {
    setBezig(true);
    setFout(null);
    setGeenKey(false);
    try {
      // Dev: Vite-middleware op /api/schrijf-feedback (ANTHROPIC_API_KEY in .env)
      // Prod: Cloud Function (VITE_FUNCTIONS_BASE_URL + /schrijfFeedback)
      const base = import.meta.env.VITE_FUNCTIONS_BASE_URL;
      const endpoint = base
        ? `${base.replace(/\/$/, "")}/schrijfFeedback`
        : "/api/schrijf-feedback";
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode,
          opdracht: opdracht.opdracht,
          tekstfragment: opdracht.tekstfragment,
          brief: bouwBrief(),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (data?.error === "no-key") setGeenKey(true);
        setFout(data?.message ?? "Feedback is nu niet beschikbaar.");
        return;
      }
      if (mode === "feedback") {
        setFeedback(data.feedback ?? "");
      } else {
        setScore(data as ScoreResultaat);
        if (typeof data.score === "number") {
          zetScore(naam, opdracht.id, data.score);
          logResultaat(naam, {
            blokId: `nederlands/schrijven/${opdracht.id}`,
            vak: "nederlands",
            soort: "schrijven",
            mastery: data.score / 10,
            afgevinkt: data.score / 10 >= 0.7,
          });
        }
      }
    } catch {
      setFout("Kon de feedback-server niet bereiken.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <main className="trainer">
      <div className="trainer-kop">
        <span className="vak-stip" style={{ background: kleur }} />
        <span className="muted klein">Nederlands · {opdracht.titel}</span>
      </div>

      <div className="card fragment">
        <div className="muted klein label">Lees eerst</div>
        <p className="fragment-tekst">{opdracht.tekstfragment}</p>
      </div>

      <div className="card opdracht-kaart">
        <div className="muted klein label">Opdracht</div>
        <p>{opdracht.opdracht}</p>
      </div>

      {opdracht.begeleid && opdracht.stappen ? (
        opdracht.stappen.map((s) => (
          <div key={s.sleutel} className="schrijf-veld">
            <label className="veld-label">{s.label}</label>
            <div className="muted klein veld-hint">{s.hint}</div>
            <textarea
              className="tekstgebied"
              rows={3}
              placeholder="Schrijf hier…"
              value={antwoorden[s.sleutel] ?? ""}
              onChange={(e) => zet(s.sleutel, e.target.value)}
            />
          </div>
        ))
      ) : (
        <div className="schrijf-veld">
          <label className="veld-label">Jouw brief</label>
          <textarea
            className="tekstgebied"
            rows={12}
            placeholder="Schrijf hier je hele brief…"
            value={antwoorden["_"] ?? ""}
            onChange={(e) => zet("_", e.target.value)}
          />
        </div>
      )}

      {feedback && (
        <div className="card feedback-kaart">
          <div className="label" style={{ color: kleur }}>💬 Feedback</div>
          <p className="feedback-tekst">{feedback}</p>
          <div className="muted klein">Pas je brief gerust nog aan en vraag daarna de eindbeoordeling.</div>
        </div>
      )}

      {score && (
        <div className="card score-kaart">
          <div className="score-groot" style={{ color: kleur }}>
            {score.score != null ? `${score.score}/10` : "Beoordeeld"}
          </div>
          {score.samenvatting && <p>{score.samenvatting}</p>}
          {score.sterk && score.sterk.length > 0 && (
            <>
              <div className="label">Sterk</div>
              <ul className="rubric klein">{score.sterk.map((s, i) => <li key={i}>✅ {s}</li>)}</ul>
            </>
          )}
          {score.verbeterpunten && score.verbeterpunten.length > 0 && (
            <>
              <div className="label">Verbeterpunten</div>
              <ul className="rubric klein">{score.verbeterpunten.map((s, i) => <li key={i}>→ {s}</li>)}</ul>
            </>
          )}
        </div>
      )}

      {fout && (
        <div className="card foutmelding">
          <p className="muted klein">{fout}</p>
          {geenKey && (
            <>
              <div className="label">Zelf nakijken</div>
              <ul className="rubric klein">{opdracht.checklist.map((c, i) => <li key={i}>☐ {c}</li>)}</ul>
            </>
          )}
        </div>
      )}

      <div className="knoppen">
        {!score && (
          <button
            className="knop primair"
            style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }}
            disabled={leeg || bezig}
            onClick={() => vraag(feedback ? "score" : "feedback")}
          >
            {bezig ? "Even denken…" : feedback ? "Vraag eindbeoordeling" : "Vraag feedback"}
          </button>
        )}
        <button className="knop" onClick={onExit}>Terug</button>
      </div>
    </main>
  );
}

const STATUS_ICON: Record<BlokStatusKind, string> = { open: "○", deels: "◐", afgevinkt: "✓" };

function Confetti() {
  const stukjes = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        left: Math.round(Math.random() * 100),
        delay: Math.round(Math.random() * 600),
        dur: 1800 + Math.round(Math.random() * 1300),
        emoji: ["🎉", "✨", "⭐", "🎊", "🟣", "🟡", "🟢"][i % 7],
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden>
      {stukjes.map((s, i) => (
        <span
          key={i}
          className="confetti-stuk"
          style={{ left: `${s.left}%`, animationDelay: `${s.delay}ms`, animationDuration: `${s.dur}ms` }}
        >
          {s.emoji}
        </span>
      ))}
    </div>
  );
}

/** Mini SVG-sparkline van 7 dag-waarden. */
function Sparkline({ data, kleur }: { data: number[]; kleur: string }) {
  const max = Math.max(1, ...data);
  const w = 84;
  const h = 20;
  const bw = w / data.length;
  return (
    <svg className="sparkline" width={w} height={h} aria-hidden>
      {data.map((v, i) => {
        const bh = Math.round((v / max) * (h - 2));
        return <rect key={i} x={i * bw + 1} y={h - bh} width={bw - 2} height={bh || 1} rx={1} fill={v > 0 ? kleur : "var(--rand)"} />;
      })}
    </svg>
  );
}

function ProgressWidget({ naam, klaar, totaal }: { naam: string; klaar?: number; totaal?: number }) {
  // klaar/totaal optioneel: alleen Vandaag-tab geeft 'm mee. Op Kalender/Oefenen
  // tonen we alleen streak + punten + volgende beloning (geen vandaag-teller).
  const advies = useMemo(() => beloningAdvies(naam), [naam, klaar]);
  const streak = useMemo(() => streakDagen(naam), [naam, klaar]);
  const toonDagdoel = typeof klaar === "number" && typeof totaal === "number";
  const dagDoel = toonDagdoel && totaal! > 0 && klaar === totaal;
  return (
    <div className="card widget">
      <div className="widget-rij">
        <span className="widget-streak" title="dagen-streak">🔥 {streak}</span>
        <span className="widget-punten">{advies.punten} pt</span>
        {toonDagdoel && (
          <span className="muted klein">Vandaag {klaar}/{totaal} {dagDoel ? "🎉" : "✓"}</span>
        )}
      </div>
      {advies.volgende ? (
        <>
          <div className="balk dun">
            <div className="balk-vuller" style={{ width: `${Math.round(advies.fractie * 100)}%` }} />
          </div>
          <div className="muted klein">
            {toontBeloningen(naam) ? (
              <>Volgende beloning: <b>{advies.volgende.naam}</b> — {advies.volgende.beloning}</>
            ) : (
              <>Volgende mijlpaal: <b>{advies.volgende.naam}</b></>
            )}
          </div>
          <div className="muted klein">
            Nog {advies.restant} pt ≈ {advies.blokken} blok{advies.blokken === 1 ? "" : "ken"}
            {advies.dagen <= 1 ? " — kan vandaag al! 💪" : ` (±${advies.dagen} dagen)`}
          </div>
        </>
      ) : (
        <div className="muted klein">🏆 Hoogste mijlpaal ({advies.huidige?.naam}) bereikt!</div>
      )}
    </div>
  );
}

function Vandaag({
  naam,
  onStart,
  onLeer,
  onNaarOefenen,
}: {
  naam: string;
  onStart: (blok: Blok, richting?: Richting) => void;
  onLeer: (blok: Blok) => void;
  onNaarOefenen: () => void;
}) {
  const datum = vandaagISO();
  const blokById = useMemo(() => new Map(BLOKKEN.map((b) => [b.id, b])), []);
  // Vandaag leunt op dezelfde engine + het bevroren dagschema als de Kalender,
  // zodat beide schermen identiek zijn. Boek-blokken (wiskunde/engels) leveren geen
  // trainer-blokjes → die verschijnen op de kalender, niet als startbare items hier.
  // Bevries het dagschema van vandaag, maar pas wanneer Firestore is gehydrateerd
  // (isHydrated) — anders zou een vers geopend apparaat een schema uit pre-hydratie
  // (lege/oude) staat vastleggen, met een verkeerde blokkenset/noemer. Bestaat er al
  // een (lokaal of via de cloud binnengekomen) schema, dan nemen we dat direct over.
  const [dagBlokken, setDagBlokken] = useState<GeplandBlok[] | null>(() => laadDagschema(naam, datum));
  useEffect(() => {
    // Stem het dagschema af op de opslag: neem een bestaand (lokaal of via de cloud
    // binnengekomen) schema over, of bevries er één zodra Firestore gehydrateerd is.
    // Draait ook op sync-events, zodat een nog-niet-gehydrateerd apparaat het canonieke
    // cloud-schema alsnog oppakt — en een eerder gedivergeerd schema in-sessie heelt
    // (writeLocal maakt vandaag/toekomst cloud-leidend). De JSON-vergelijking voorkomt
    // onnodige re-renders / schema-geflikker.
    const sync = () => {
      let next = laadDagschema(naam, datum);
      if (!next && isHydrated()) {
        next = kalenderSchema(naam, datum).dagen.find((d) => d.datum === datum)?.blokken ?? [];
        bewaarDagschema(naam, datum, next);
        next = laadDagschema(naam, datum) ?? next;
      }
      if (!next) return; // nog niet gehydrateerd én niets lokaal → wacht op de cloud
      setDagBlokken((huidig) => (huidig && JSON.stringify(huidig) === JSON.stringify(next) ? huidig : next));
    };
    sync();
    window.addEventListener("pww-hydrated", sync);
    window.addEventListener("pww-progress-updated", sync);
    return () => {
      window.removeEventListener("pww-hydrated", sync);
      window.removeEventListener("pww-progress-updated", sync);
    };
  }, [naam, datum]);
  // Nog niet bevroren (wacht op hydratie) → lege lijst; de useEffect hierboven vult 'm zodra
  // het schema bekend is. `aanHetLaden` onderscheidt "nog niet klaar" van "echt 0 blokken".
  const aanHetLaden = dagBlokken === null;
  const blokkenLijst = dagBlokken ?? [];
  // Afvink-toggles forceren een re-render zodat klaar/dagdoel meteen bijwerken.
  const [, setAfvinkTick] = useState(0);
  const planIds = useMemo(() => blokkenLijst.flatMap((b) => b.trainerBlokIds), [dagBlokken]);
  const items = planIds.map((id) => blokById.get(id)).filter((b): b is Blok => !!b);
  const statussen = items.map((b) => ({ blok: b, st: blokStatus(naam, b) }));
  // Meetellende blokken voor "klaar"/dagdoel: niet-optioneel, mét trainer of afvink.
  // Optionele blokken (bv. "geschiedenis als 't nodig is") en boek-blokken tellen niet.
  const blokAf = (gb: GeplandBlok): boolean =>
    gb.soort === "afvink"
      ? !!gb.afvink && isAfgevinkt(naam, gb.afvink.id)
      : gb.trainerBlokIds.length > 0 &&
        gb.trainerBlokIds.every((id) => {
          const b = blokById.get(id);
          return !!b && blokStatus(naam, b).status === "afgevinkt";
        });
  const telBlokken = blokkenLijst.filter((gb) => !gb.optioneel && (gb.soort === "afvink" || gb.trainerBlokIds.length > 0));
  const klaar = telBlokken.filter(blokAf).length;
  const totaalTel = telBlokken.length;
  const heeftZichtbaar = blokkenLijst.some((gb) => gb.soort === "afvink" || gb.trainerBlokIds.length > 0);
  // Dagdeel-suggestie + minuten-indicatie per gepland blok (zelfcorrigerend op de
  // resultaten-log, afspraak 2026-06-12). Volgorde = planner-prioriteit.
  const factoren = useMemo(() => duurFactoren(naam), [naam, klaar]);
  const momenten = dagdelen(datum, blokkenLijst.length);
  const sectieMin = (gb: GeplandBlok): number => {
    if (gb.soort === "review") return 15;
    const blokken = gb.trainerBlokIds.map((id) => blokById.get(id)).filter((b): b is Blok => !!b);
    return blokken.reduce((s, b) => s + geschatteMin(factoren, b), 0);
  };
  const totaalMin = blokkenLijst.filter((gb) => gb.soort !== "boek").reduce((s, gb) => s + sectieMin(gb), 0);
  // Resterende tijd: alleen de trainer-blokken die nog niet afgevinkt zijn.
  const restMin = statussen
    .filter((x) => x.st.status !== "afgevinkt")
    .reduce((s, x) => s + geschatteMin(factoren, x.blok), 0);

  const komende = [...new Set(items.map((b) => b.vak))]
    .map((v) => ({ vak: v, dagen: dagenTot(datum, PWW_DATUM[v] ?? "2026-07-03") }))
    .sort((a, b) => a.dagen - b.dagen)[0];
  const datumLabel = new Date(`${datum}T00:00:00`).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const dagDoel = totaalTel > 0 && klaar === totaalTel;
  const [confetti, setConfetti] = useState(false);
  useEffect(() => {
    if (dagDoel && !alGevierd(naam, datum)) {
      zetGevierd(naam, datum);
      setConfetti(true);
      const t = window.setTimeout(() => setConfetti(false), 2600);
      return () => window.clearTimeout(t);
    }
  }, [dagDoel, naam, datum]);

  return (
    <main className="lijst">
      {confetti && <Confetti />}
      <ProgressWidget naam={naam} klaar={klaar} totaal={totaalTel} />
      <div className="card vandaag-kop">
        <div className="vandaag-datum">{datumLabel}</div>
        <div className="vandaag-stats">
          <div className="vandaag-tel">{aanHetLaden ? "…" : <>{klaar}/{totaalTel} ✓</>}</div>
          {totaalMin > 0 && (
            <div className="vandaag-tijd" title="geschatte tijd voor de opgaven van vandaag">
              ⏱️ {restMin > 0 ? `nog ±${restMin} min` : "klaar! 🎉"}
            </div>
          )}
        </div>
        {totaalMin > 0 && (
          <div className="muted klein">
            {restMin > 0 && restMin !== totaalMin ? `van ±${totaalMin} min in totaal · ` : ""}
            verdeeld over de dagdelen hieronder
          </div>
        )}
        {komende && komende.dagen >= 0 && (
          <div className="muted klein">
            Volgende toets: {vakLabel(komende.vak)}{" "}
            {komende.dagen === 0 ? "vandaag" : `over ${komende.dagen} dag${komende.dagen === 1 ? "" : "en"}`}
          </div>
        )}
      </div>

      <p className="muted klein banner">⚠️ Content nog niet gevalideerd — controleer bij twijfel met je boek.</p>

      {aanHetLaden ? (
        <div className="card narrow">
          <p className="muted">Je schema voor vandaag laden…</p>
        </div>
      ) : !heeftZichtbaar ? (
        <div className="card narrow">
          <p>Niks meer ingepland voor vandaag 🎉</p>
          <button className="knop primair" onClick={onNaarOefenen}>Vrij oefenen</button>
        </div>
      ) : (
        blokkenLijst.map((gb, gi) => {
          if (gb.soort === "boek") return null; // boek-blokken staan op de Kalender
          if (gb.soort === "afvink") {
            return (
              <div key={`${gb.vakBlokId}-${gi}`} className="moment-sectie">
                <div className="moment-kop muted klein">
                  {momenten[gi]} · {vakLabel(gb.vak)}{gb.optioneel ? " · optioneel" : ""}
                </div>
                <AfvinkKaart naam={naam} gb={gb} onChange={() => setAfvinkTick((t) => t + 1)} />
              </div>
            );
          }
          const sectieBlokken = gb.trainerBlokIds.map((id) => blokById.get(id)).filter((b): b is Blok => !!b);
          if (sectieBlokken.length === 0) return null;
          return (
            <div key={`${gb.vakBlokId}-${gi}`} className="moment-sectie">
              <div className="moment-kop muted klein">
                {momenten[gi]} · {vakLabel(gb.vak)}{gb.optioneel ? " · optioneel" : ""}{gb.soort === "review" ? " herhalen ↻" : ""} · ±{sectieMin(gb)} min
              </div>
              {sectieBlokken.map((blok) => {
                const st = blokStatus(naam, blok);
                const kleur = vakKleur(blok.vak);
                return (
            <div key={blok.id} className="card blok">
              <div className="blok-kop">
                <span className="blok-icon">{SOORT_ICON[blok.soort]}</span>
                <div className="blok-tekst">
                  <div className="card-titel">{vakLabel(blok.vak)} · {blok.titel}</div>
                  <div className="muted klein">{Math.round(st.mastery * 100)}% beheerst</div>
                </div>
                <span className={`status-icoon ${st.status}`}>{STATUS_ICON[st.status]}</span>
              </div>
              <div className="balk dun">
                <div className="balk-vuller" style={{ width: `${Math.round(st.mastery * 100)}%`, background: kleur }} />
              </div>
              <div className="knoppen">
                {kanLeren(blok.soort) && (
                  <button className="knop" style={{ borderColor: kleur }} onClick={() => onLeer(blok)}>
                    📚 Leren
                  </button>
                )}
                {blok.soort === "woordjes" && blok.richtingen ? (
                  blok.richtingen.map((r) => (
                    <button key={r} className="knop" style={{ borderColor: kleur }} onClick={() => onStart(blok, r)}>
                      {richtingLabel(blok.vak, r)}
                    </button>
                  ))
                ) : (
                  <button
                    className="knop primair"
                    style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }}
                    onClick={() => onStart(blok)}
                  >
                    {st.status === "open" ? "Start" : "Verder"}
                  </button>
                )}
              </div>
            </div>
                );
              })}
            </div>
          );
        })
      )}
      <p className="muted klein voetnoot">
        Ingepland op basis van je voortgang + toetsdatums. Niet af? Het blok komt een volgende keer terug.
      </p>
    </main>
  );
}

function Voortgang({ naam, onLogout }: { naam: string; onLogout: () => void }) {
  const groepen = useMemo(() => vakGroepen(), []);
  const datum = vandaagISO();
  const stand = beloningAdvies(naam);
  const metBeloningen = toontBeloningen(naam);
  const tijdVak = tijdPerVakMin(naam);
  const tijdTotaal = tijdTotaalMin(naam);
  const [alleenRood, setAlleenRood] = useState(false);
  return (
    <main className="lijst">
      <div className="voortgang-kop">
        <h1>Voortgang</h1>
        <button className={`knop filter ${alleenRood ? "aan" : ""}`} onClick={() => setAlleenRood((v) => !v)}>
          {alleenRood ? "Toon alles" : "Alleen nog te doen"}
        </button>
      </div>

      <div className="card">
        <div className="card-titel">{metBeloningen ? "Beloningen" : "Mijlpalen"} · {stand.punten} pt</div>
        {stand.volgende && (
          <>
            <div className="balk dun">
              <div className="balk-vuller" style={{ width: `${Math.round(stand.fractie * 100)}%` }} />
            </div>
            <p className="muted klein">
              Volgende: <b>{stand.volgende.naam}</b>
              {metBeloningen ? ` (${stand.volgende.beloning})` : ""} — nog {stand.restant} pt
              ≈ {stand.blokken} blok{stand.blokken === 1 ? "" : "ken"} afronden
              {stand.dagen <= 1 ? ". Dat kan vandaag al! 💪" : ` (±${stand.dagen} dagen).`}
              {" "}Elk blok ✓ = 10–15 pt, alles van vandaag af = +15, een kwartier focus = +5.
            </p>
          </>
        )}
        <div className="mijlpalen">
          {MIJLPALEN.map((m) => {
            const behaald = stand.punten >= m.drempel;
            const volgende = stand.volgende?.naam === m.naam;
            return (
              <div key={m.naam} className={`mijlpaal-rij ${behaald ? "behaald" : ""} ${volgende ? "volgende" : ""}`}>
                <span className="mijlpaal-naam">{behaald ? "🏅" : volgende ? "⭐" : "🔒"} {m.naam} <span className="muted klein">{m.drempel} pt</span></span>
                {metBeloningen && <span className="muted klein">{m.beloning}</span>}
              </div>
            );
          })}
        </div>
        <p className="muted klein">
          🔥 {streakDagen(naam)} dagen-streak (volle week = +50 pt). ⏱️ {tijdLabel(tijdTotaal)} totaal gestudeerd.
          {metBeloningen ? " Beloningen in overleg met papa/mama." : ""}
        </p>
      </div>

      {groepen.map((g) => {
        const kleur = vakKleur(g.vak);
        const blokken = g.hoofdstukken.flatMap((h) => h.blokken);
        const gem = blokken.length
          ? Math.round((blokken.reduce((s, b) => s + blokStatus(naam, b).mastery, 0) / blokken.length) * 100)
          : 0;
        const dagen = dagenTot(datum, PWW_DATUM[g.vak] ?? "2026-07-03");
        const zichtbaar = alleenRood ? blokken.filter((b) => blokStatus(naam, b).status !== "afgevinkt") : blokken;
        if (alleenRood && zichtbaar.length === 0) return null;
        return (
          <div key={g.vak} className="card">
            <div className="blok-kop">
              <span className="vak-stip" style={{ background: kleur }} />
              <div className="blok-tekst">
                <div className="card-titel" style={{ color: kleur }}>{vakLabel(g.vak)}</div>
                <div className="muted klein">{gem}% klaar · ⏱️ {tijdLabel(tijdVak[g.vak] ?? 0)}{dagen >= 0 ? ` · toets over ${dagen} dagen` : ""}</div>
              </div>
              <Sparkline data={activiteit7dagen(naam, g.vak)} kleur={kleur} />
            </div>
            <div className="balk dun">
              <div className="balk-vuller" style={{ width: `${gem}%`, background: kleur }} />
            </div>
            <div className="voortgang-blokken">
              {zichtbaar.map((b) => {
                const st = blokStatus(naam, b);
                return (
                  <div key={b.id} className="voortgang-rij">
                    <span>{STATUS_ICON[st.status]} {b.titel}</span>
                    <span className="muted klein">{Math.round(st.mastery * 100)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="muted klein voetnoot">
        Vakken zonder eigen trainer (Engels, Biologie, Wiskunde) leer je voorlopig uit het boek.
      </p>
      {/* Bewust onopvallend (onderaan Voortgang): voorkomt per ongeluk uitloggen.
          Tik op de naam → bevestigen → terug naar het naam-scherm. Voortgang blijft
          bewaard onder de naam, dus opnieuw inloggen haalt alles terug. */}
      <p className="muted klein voetnoot uitlog-regel">
        Ingelogd als{" "}
        <button
          type="button"
          className="uitlog-link"
          onClick={() => {
            if (window.confirm(`Uitloggen als ${naam}? Je voortgang blijft bewaard onder deze naam.`)) onLogout();
          }}
        >
          {naam}
        </button>
      </p>
    </main>
  );
}

const VAK_AFK: Record<string, string> = {
  frans: "Fr", engels: "En", nederlands: "Ne", wiskunde: "Wi",
  biologie: "Bio", aardrijkskunde: "Ak", geschiedenis: "Ge", handvaardigheid: "Hv",
};
const WEEKDAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

function Kalender({ naam, onStart, onLeer }: { naam: string; onStart: (blok: Blok, richting?: Richting) => void; onLeer: (blok: Blok) => void }) {
  const vandaag = vandaagISO();
  const blokById = useMemo(() => new Map(BLOKKEN.map((b) => [b.id, b])), []);
  const schema = useMemo(() => kalenderSchema(naam, vandaag), [naam, vandaag]);
  const toekomst = useMemo(() => new Map(schema.dagen.map((d) => [d.datum, d])), [schema]);
  const rooster = useMemo(() => new Map(roosterSlots().map((s) => [s.datum, s])), []);
  const [sel, setSel] = useState<string | null>(vandaag);

  // Bevries het schema van vandaag, zodat de terugblik later stabiel is. Pas ná
  // Firestore-hydratie (isHydrated) — anders zou het openen van de Kalender-tab op een
  // vers apparaat een pre-hydratie schema kunnen vastleggen. bewaarDagschema is write-once,
  // dus dit overschrijft een al-bevroren (bv. via Vandaag of de cloud) schema nooit.
  // Uitzondering: Stijns vaste schema (stijn1) mág het AI-schema van vandaag eenmalig
  // vervangen (force) — bewaarDagschema schrijft niet als de inhoud al gelijk is.
  useEffect(() => {
    const isStijn1 = slug(naam) === STIJN1;
    const freeze = () => {
      if (!isHydrated()) return false;
      const t = toekomst.get(vandaag);
      if (t) bewaarDagschema(naam, vandaag, t.blokken, isStijn1);
      return true;
    };
    if (freeze()) return;
    const handler = () => freeze();
    window.addEventListener("pww-hydrated", handler);
    return () => window.removeEventListener("pww-hydrated", handler);
  }, [naam, vandaag, toekomst]);

  // Grid: ma 8 juni t/m zo 5 juli (4 weken).
  const dagen: string[] = [];
  {
    const start = Date.parse("2026-06-08T00:00:00Z");
    for (let i = 0; i < 28; i++) dagen.push(new Date(start + i * 86_400_000).toISOString().slice(0, 10));
  }
  const weken: string[][] = [];
  for (let i = 0; i < dagen.length; i += 7) weken.push(dagen.slice(i, i + 7));

  function dagBlokken(datum: string): GeplandBlok[] {
    if (datum < vandaag) return laadDagschema(naam, datum) ?? [];
    // Vandaag: toon het bevroren schema (identiek aan de Vandaag-tab), val terug op de
    // verse projectie tot het bevroren is. Toekomst: altijd de verse projectie.
    if (datum === vandaag) return laadDagschema(naam, datum) ?? toekomst.get(datum)?.blokken ?? [];
    return toekomst.get(datum)?.blokken ?? [];
  }
  // Deze week verbergt de kalender al-beheerste trainers (focus op wat Stijn nog niet
  // kent); het verleden blijft een volledige terugblik. Per trainer-bundel; afvink/boek/
  // review-blokken blijven altijd staan.
  const zichtbareTrainerIds = (b: GeplandBlok, datum: string): string[] =>
    datum < vandaag
      ? b.trainerBlokIds
      : b.trainerBlokIds.filter((id) => {
          const blk = blokById.get(id);
          return blk && blokStatus(naam, blk).status !== "afgevinkt";
        });
  const toonBlok = (b: GeplandBlok, datum: string): boolean =>
    b.soort !== "trainer" || zichtbareTrainerIds(b, datum).length > 0;
  function chipStatus(b: GeplandBlok, datum: string): "afgevinkt" | "deels" | "open" | "boek" | "review" | null {
    if (b.soort === "boek") return "boek";
    if (b.soort === "review") return "review";
    if (b.soort === "afvink") return b.afvink && isAfgevinkt(naam, b.afvink.id) ? "afgevinkt" : datum > vandaag ? null : "open";
    if (datum > vandaag) return null; // toekomst: nog geen status
    const sts = zichtbareTrainerIds(b, datum).map((id) => blokById.get(id)).filter((x): x is Blok => !!x).map((blk) => blokStatus(naam, blk).status);
    if (!sts.length) return null;
    if (sts.every((s) => s === "afgevinkt")) return "afgevinkt";
    if (sts.some((s) => s !== "open")) return "deels";
    return "open";
  }
  const STAT_ICON: Record<string, string> = { afgevinkt: "✓", deels: "◐", open: "○", boek: "📕", review: "↻" };

  const maandLabel = (datum: string) =>
    new Date(`${datum}T00:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "long", weekday: "long" });

  return (
    <main className="lijst">
      <ProgressWidget naam={naam} />
      <h1>Kalender</h1>
      <p className="muted klein">Je leerschema tot de proefwerkweek. Tik op een dag voor de details.</p>
      {schema.flags.length > 0 && (
        <div className="banner">
          {schema.flags.map((f, i) => (
            <div key={i} className="klein">⚠️ {f}</div>
          ))}
        </div>
      )}

      <div className="kal-grid kal-kop">
        {WEEKDAGEN.map((d) => (
          <div key={d} className="kal-weekdag">{d}</div>
        ))}
      </div>
      {weken.map((week, wi) => (
        <div key={wi} className="kal-grid">
          {week.map((datum) => {
            const info = rooster.get(datum);
            const type = info?.type ?? "vrij";
            const toetsen = info?.toetsVakken ?? [];
            const blokken = dagBlokken(datum);
            const dagNr = Number(datum.slice(8, 10));
            const isVandaag = datum === vandaag;
            const isVerleden = datum < vandaag;
            return (
              <button
                key={datum}
                className={`kal-cel type-${type} ${isVandaag ? "vandaag" : ""} ${isVerleden ? "verleden" : ""} ${sel === datum ? "gekozen" : ""}`}
                onClick={() => setSel(datum)}
              >
                <div className="kal-datum">{dagNr}</div>
                {toetsen.length > 0 && (
                  <div className="kal-toets">🎯 {toetsen.map((v) => VAK_AFK[v] ?? v).join(" ")}</div>
                )}
                <div className="kal-chips">
                  {blokken.filter((b) => toonBlok(b, datum)).map((b, i) => {
                    const st = chipStatus(b, datum);
                    return (
                      <span key={i} className="kal-chip" style={{ background: `${vakKleur(b.vak)}26`, color: vakKleur(b.vak), borderColor: `${vakKleur(b.vak)}80` }}>
                        {VAK_AFK[b.vak] ?? b.vak}{st && st !== "open" ? ` ${STAT_ICON[st]}` : ""}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      ))}

      <div className="kal-legenda muted klein">
        🎯 toets · 📕 uit boek · ✓ gedaan · ◐ deels (komt terug) · ↻ herhalen
      </div>

      {sel && <KalenderDag naam={naam} datum={sel} label={maandLabel(sel)} blokken={dagBlokken(sel)} isVandaag={sel === vandaag} blokById={blokById} onStart={onStart} onLeer={onLeer} />}
    </main>
  );
}

function KalenderDag({
  naam, datum, label, blokken, isVandaag, blokById, onStart, onLeer,
}: {
  naam: string; datum: string; label: string; blokken: GeplandBlok[]; isVandaag: boolean;
  blokById: Map<string, Blok>; onStart: (blok: Blok, richting?: Richting) => void; onLeer: (blok: Blok) => void;
}) {
  const isToekomst = datum > vandaagISO();
  // Dagdeel-suggestie + minuten per gepland blok (zelfde logica als Vandaag).
  const factoren = useMemo(() => duurFactoren(naam), [naam]);
  const momenten = dagdelen(datum, blokken.length);
  const [, setAfvinkTick] = useState(0);
  return (
    <div className="card kal-detail">
      <div className="card-titel" style={{ textTransform: "capitalize" }}>
        {label}{isVandaag ? " · vandaag" : isToekomst ? " · vooruitkijkend" : " · terugblik"}
      </div>
      {blokken.length === 0 ? (
        <p className="muted klein">{isToekomst ? "Wordt op de dag zelf ingepland." : "Geen leerblokken op deze dag."}</p>
      ) : (
        <>
          {isToekomst && (
            <p className="muted klein">Vooruit oefenen kan — items komen later gewoon weer terug in je planning.</p>
          )}
          {blokken.map((b, i) => {
            // Deze week (vandaag + toekomst): verberg al-beheerste trainers → focus op
            // wat nog niet kent. Verleden = volledige terugblik (alles tonen).
            const verbergBeheerst = datum >= vandaagISO();
            const trainers = b.trainerBlokIds
              .map((id) => blokById.get(id))
              .filter((x): x is Blok => !!x)
              .filter((t) => !verbergBeheerst || blokStatus(naam, t).status !== "afgevinkt");
            const kleur = vakKleur(b.vak);
            if (b.soort === "afvink") {
              return (
                <div key={i} className="moment-sectie">
                  <div className="moment-kop muted klein">{momenten[i]}{b.optioneel ? " · optioneel" : ""}</div>
                  <AfvinkKaart naam={naam} gb={b} onChange={() => setAfvinkTick((t) => t + 1)} />
                </div>
              );
            }
            if (b.soort === "boek") {
              return (
                <div key={i} className="moment-sectie">
                  <div className="moment-kop muted klein">{momenten[i]} · ±30 min</div>
                  <div className="card blok" style={{ borderLeft: `4px solid ${kleur}` }}>
                    <div className="blok-kop">
                      <span className="vak-stip" style={{ background: kleur }} />
                      <div className="blok-tekst">
                        <div className="card-titel" style={{ color: kleur }}>
                          {vakLabel(b.vak)} — uit boek
                        </div>
                        <div className="muted klein">Werk ~30 min uit je boek (nog geen trainer).</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            if (b.soort === "review") {
              return (
                <div key={i} className="moment-sectie">
                  <div className="moment-kop muted klein">{momenten[i]} · ±15 min</div>
                  <div className="card blok" style={{ borderLeft: `4px solid ${kleur}` }}>
                    <div className="blok-kop">
                      <span className="vak-stip" style={{ background: kleur }} />
                      <div className="blok-tekst">
                        <div className="card-titel" style={{ color: kleur }}>
                          {vakLabel(b.vak)} — herhalen
                        </div>
                        <div className="muted klein">Snelle review van wat je al hebt geleerd.</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            // Echte trainer-blokken: render elk als volwaardige BlokKaart, altijd klikbaar.
            // Vak helemaal beheerst (deze week) → sectie overslaan.
            if (trainers.length === 0) return null;
            const minuten = trainers.reduce((s, t) => s + geschatteMin(factoren, t), 0);
            return (
              <div key={i} className="moment-sectie">
                <div className="moment-kop muted klein">{momenten[i]}{b.optioneel ? " · optioneel" : ""} · ±{minuten} min</div>
                {trainers.map((t) => (
                  <BlokKaart key={`${i}-${t.id}`} naam={naam} blok={t} kleur={kleur} onStart={onStart} onLeer={onLeer} />
                ))}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
