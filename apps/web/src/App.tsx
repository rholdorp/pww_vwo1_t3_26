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
  type Card,
} from "./content";
import {
  blokMastery,
  huidigeNaam,
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
} from "./progress";
import { planVandaag, blokStatus, PWW_DATUM, dagenTot, kalenderSchema, roosterSlots, type BlokStatusKind } from "./planner";
import { logResultaat, mijlpaalStand, streakDagen, MIJLPALEN, focusPunten, activiteit7dagen, alGevierd, zetGevierd } from "./gamification";
import type { GeplandBlok } from "@pww/planner-engine";
import { startSync, stopSync, flushPush } from "./firestoreSync";

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

  if (!naam) {
    return <NaamPoort onKlaar={(n) => { zetNaam(n); setNaam(n); }} />;
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
      {tab === "voortgang" && <Voortgang naam={naam} />}

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
        {g.hoofdstukken.map((h) => (
          <div key={h.hoofdstuk} className="hfd-groep">
            <h3 className="hfd">
              {h.hoofdstuk === "uitleg"
                ? "Uitleg & verbanden"
                : h.hoofdstuk === "schrijven"
                  ? "Schrijven"
                  : `Hoofdstuk ${h.hoofdstuk}`}
            </h3>
            {h.blokken.map((blok) => (
              <BlokKaart key={blok.id} naam={naam} blok={blok} kleur={kleur} onStart={onStart} onLeer={onLeer} />
            ))}
          </div>
        ))}
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

function BlokKaart({
  naam,
  blok,
  kleur,
  onStart,
  onLeer,
}: {
  naam: string;
  blok: Blok;
  kleur: string;
  onStart: (blok: Blok, richting?: Richting) => void;
  onLeer?: (blok: Blok) => void;
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
        {beheerst && <span className="badge">✓ beheerst</span>}
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
    const stand = mijlpaalStand(naam);
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
            <p className="muted klein">Nog {stand.restant} pt tot {stand.volgende.naam}.</p>
          )}
          <div className="knoppen">
            <button
              className="knop primair"
              style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }}
              onClick={() => {
                startRef.current = Date.now();
                setElapsedSec(0);
                setState(startSession(maakOrder()));
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
          <HotspotKaart key={card.id + card.richting} card={card} kleur={kleur} onResultaat={volgende} />
        ) : card.kind === "flip" ? (
          <FlipKaart card={card} kleur={kleur} onthuld={onthuld} onToon={() => setOnthuld(true)} onBeoordeel={volgende} />
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
    const stand = mijlpaalStand(naam);
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
  // tonen we alleen streak + punten + volgende mijlpaal (geen vandaag-teller).
  const stand = useMemo(() => mijlpaalStand(naam), [naam, klaar]);
  const streak = useMemo(() => streakDagen(naam), [naam, klaar]);
  const toonDagdoel = typeof klaar === "number" && typeof totaal === "number";
  const dagDoel = toonDagdoel && totaal! > 0 && klaar === totaal;
  return (
    <div className="card widget">
      <div className="widget-rij">
        <span className="widget-streak" title="dagen-streak">🔥 {streak}</span>
        <span className="widget-punten">{stand.punten} pt</span>
        {toonDagdoel && (
          <span className="muted klein">Vandaag {klaar}/{totaal} {dagDoel ? "🎉" : "✓"}</span>
        )}
      </div>
      {stand.volgende ? (
        <>
          <div className="balk dun">
            <div className="balk-vuller" style={{ width: `${Math.round(stand.fractie * 100)}%` }} />
          </div>
          <div className="muted klein">
            Volgende mijlpaal: <b>{stand.volgende.naam}</b> — nog {stand.restant} pt
          </div>
        </>
      ) : (
        <div className="muted klein">🏆 Hoogste mijlpaal ({stand.huidige?.naam}) bereikt!</div>
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
  const [planIds] = useState<string[]>(() => {
    let dag = laadDagschema(naam, datum);
    if (!dag) {
      dag = kalenderSchema(naam, datum).dagen.find((d) => d.datum === datum)?.blokken ?? [];
      bewaarDagschema(naam, datum, dag);
    }
    return dag.flatMap((b) => b.trainerBlokIds);
  });
  const items = planIds.map((id) => blokById.get(id)).filter((b): b is Blok => !!b);
  const statussen = items.map((b) => ({ blok: b, st: blokStatus(naam, b) }));
  const klaar = statussen.filter((s) => s.st.status === "afgevinkt").length;

  const komende = [...new Set(items.map((b) => b.vak))]
    .map((v) => ({ vak: v, dagen: dagenTot(datum, PWW_DATUM[v] ?? "2026-07-03") }))
    .sort((a, b) => a.dagen - b.dagen)[0];
  const datumLabel = new Date(`${datum}T00:00:00`).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const dagDoel = items.length > 0 && klaar === items.length;
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
      <ProgressWidget naam={naam} klaar={klaar} totaal={items.length} />
      <div className="card vandaag-kop">
        <div className="vandaag-datum">{datumLabel}</div>
        <div className="vandaag-tel">{klaar}/{items.length} ✓</div>
        {komende && komende.dagen >= 0 && (
          <div className="muted klein">
            Volgende toets: {vakLabel(komende.vak)}{" "}
            {komende.dagen === 0 ? "vandaag" : `over ${komende.dagen} dag${komende.dagen === 1 ? "" : "en"}`}
          </div>
        )}
      </div>

      <p className="muted klein banner">⚠️ Content nog niet gevalideerd — controleer bij twijfel met je boek.</p>

      {items.length === 0 ? (
        <div className="card narrow">
          <p>Niks meer ingepland voor vandaag 🎉</p>
          <button className="knop primair" onClick={onNaarOefenen}>Vrij oefenen</button>
        </div>
      ) : (
        statussen.map(({ blok, st }) => {
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
        })
      )}
      <p className="muted klein voetnoot">
        Ingepland op basis van je voortgang + toetsdatums. Niet af? Het blok komt een volgende keer terug.
      </p>
    </main>
  );
}

function Voortgang({ naam }: { naam: string }) {
  const groepen = useMemo(() => vakGroepen(), []);
  const datum = vandaagISO();
  const stand = mijlpaalStand(naam);
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
        <div className="card-titel">Mijlpalen · {stand.punten} pt</div>
        <div className="mijlpalen">
          {MIJLPALEN.map((m) => {
            const behaald = stand.punten >= m.drempel;
            return (
              <div key={m.naam} className={`mijlpaal-rij ${behaald ? "behaald" : ""}`}>
                <span className="mijlpaal-naam">{behaald ? "🏅" : "🔒"} {m.naam} <span className="muted klein">{m.drempel} pt</span></span>
                <span className="muted klein">{m.beloning}</span>
              </div>
            );
          })}
        </div>
        <p className="muted klein">🔥 {streakDagen(naam)} dagen-streak. Beloningen instellen kan later (ouder).</p>
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
                <div className="muted klein">{gem}% klaar{dagen >= 0 ? ` · toets over ${dagen} dagen` : ""}</div>
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
    </main>
  );
}

const VAK_AFK: Record<string, string> = {
  frans: "Fr", engels: "En", nederlands: "Ne", wiskunde: "Wi",
  biologie: "Bio", aardrijkskunde: "Ak", geschiedenis: "Ge",
};
const WEEKDAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

function Kalender({ naam, onStart, onLeer }: { naam: string; onStart: (blok: Blok, richting?: Richting) => void; onLeer: (blok: Blok) => void }) {
  const vandaag = vandaagISO();
  const blokById = useMemo(() => new Map(BLOKKEN.map((b) => [b.id, b])), []);
  const schema = useMemo(() => kalenderSchema(naam, vandaag), [naam, vandaag]);
  const toekomst = useMemo(() => new Map(schema.dagen.map((d) => [d.datum, d])), [schema]);
  const rooster = useMemo(() => new Map(roosterSlots().map((s) => [s.datum, s])), []);
  const [sel, setSel] = useState<string | null>(vandaag);

  // Bevries het schema van vandaag, zodat de terugblik later stabiel is.
  useEffect(() => {
    const t = toekomst.get(vandaag);
    if (t) bewaarDagschema(naam, vandaag, t.blokken);
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
    return toekomst.get(datum)?.blokken ?? [];
  }
  function chipStatus(b: GeplandBlok, datum: string): "afgevinkt" | "deels" | "open" | "boek" | "review" | null {
    if (b.soort === "boek") return "boek";
    if (b.soort === "review") return "review";
    if (datum > vandaag) return null; // toekomst: nog geen status
    const sts = b.trainerBlokIds.map((id) => blokById.get(id)).filter((x): x is Blok => !!x).map((blk) => blokStatus(naam, blk).status);
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
                  {blokken.map((b, i) => {
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
            const trainers = b.trainerBlokIds.map((id) => blokById.get(id)).filter((x): x is Blok => !!x);
            const kleur = vakKleur(b.vak);
            if (b.soort === "boek") {
              return (
                <div key={i} className="card blok" style={{ borderLeft: `4px solid ${kleur}` }}>
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
              );
            }
            if (b.soort === "review") {
              return (
                <div key={i} className="card blok" style={{ borderLeft: `4px solid ${kleur}` }}>
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
              );
            }
            // Echte trainer-blokken: render elk als volwaardige BlokKaart, altijd klikbaar.
            return trainers.map((t) => (
              <BlokKaart key={`${i}-${t.id}`} naam={naam} blok={t} kleur={kleur} onStart={onStart} onLeer={onLeer} />
            ));
          })}
        </>
      )}
    </div>
  );
}
