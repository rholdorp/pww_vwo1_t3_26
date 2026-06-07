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
} from "@pww/trainer-engine";
import {
  vakGroepen,
  vakLabel,
  vakKleur,
  richtingLabel,
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
  sessieVolgorde,
  zetNaam,
  laatsteScore,
  zetScore,
  laadConcept,
  bewaarConcept,
  vandaagISO,
  laadDagplan,
  bewaarDagplan,
} from "./progress";
import { planVandaag, blokStatus, PWW_DATUM, dagenTot, type BlokStatusKind } from "./planner";

type Tab = "vandaag" | "oefenen" | "voortgang";
type Actief =
  | { type: "train"; blok: Blok; richting?: Richting }
  | { type: "schrijf"; opdracht: Schrijfopdracht }
  | null;

export default function App() {
  const [naam, setNaam] = useState<string | null>(() => huidigeNaam());
  const [tab, setTab] = useState<Tab>("vandaag");
  const [actief, setActief] = useState<Actief>(null);

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

  if (actief) {
    return (
      <div className="app">
        <header className="topbar">
          <button className="link" onClick={() => setActief(null)}>← Terug</button>
          <span className="naam">{naam}</span>
        </header>
        {actief.type === "train" ? (
          <Trainer
            key={actief.blok.id + (actief.richting ?? "")}
            naam={naam}
            blok={actief.blok}
            richting={actief.richting}
            onExit={() => setActief(null)}
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

      {tab === "vandaag" && <Vandaag naam={naam} onStart={startBlok} onNaarOefenen={() => setTab("oefenen")} />}
      {tab === "oefenen" && <Home naam={naam} onStart={startBlok} />}
      {tab === "voortgang" && <Voortgang naam={naam} />}

      <nav className="bottomnav">
        {([["vandaag", "📅", "Vandaag"], ["oefenen", "🎯", "Oefenen"], ["voortgang", "📈", "Voortgang"]] as const).map(
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
}: {
  naam: string;
  onStart: (blok: Blok, richting?: Richting) => void;
}) {
  const groepen = useMemo(() => vakGroepen(), []);
  return (
    <main className="lijst">
      <h1>Wat ga je oefenen?</h1>
      {groepen.map((g) => {
        const kleur = vakKleur(g.vak);
        return (
          <section key={g.vak} className="vak">
            <h2 className="vaknaam" style={{ color: kleur }}>
              <span className="vak-stip" style={{ background: kleur }} />
              {vakLabel(g.vak)}
            </h2>
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
                  <BlokKaart key={blok.id} naam={naam} blok={blok} kleur={kleur} onStart={onStart} />
                ))}
              </div>
            ))}
          </section>
        );
      })}
      <p className="muted klein voetnoot">Voortgang lokaal op dit apparaat bewaard.</p>
    </main>
  );
}

function BlokKaart({
  naam,
  blok,
  kleur,
  onStart,
}: {
  naam: string;
  blok: Blok;
  kleur: string;
  onStart: (blok: Blok, richting?: Richting) => void;
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

  const totaal = order.length;
  const currentId = currentItem(state);

  if (isComplete(state) || currentId === null) {
    const m = Math.round(blokMastery(naam, blok.ids) * 100);
    return (
      <main className="lijst center">
        <div className="card narrow">
          <h1>Klaar! 🎉</h1>
          <p>Je hebt deze ronde van {totaal} {totaal === 1 ? "kaart" : "kaarten"} afgerond.</p>
          <p className="muted">{m}% van «{blok.titel}» beheerst.</p>
          <div className="knoppen">
            <button
              className="knop primair"
              style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }}
              onClick={() => {
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
      <div className="balk-tekst muted klein">{gedaan} / {totaal} af · nog {state.remaining.length} te gaan</div>

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
        ) : (
          <FlipKaart card={card} kleur={kleur} onthuld={onthuld} onToon={() => setOnthuld(true)} onBeoordeel={volgende} />
        )}
      </div>

      <button className="link" onClick={onExit}>Stoppen</button>
    </main>
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
  return (
    <>
      {card.image && <img className="kaart-beeld" src={card.image} alt="" />}
      {card.subtitel && <div className="muted klein kaart-subtitel">{card.subtitel}</div>}
      <div className="prompt">{card.prompt}</div>
      {hint && !feedback && (
        <div className="muted klein hint">hint: begint met “{card.answer.slice(0, 1)}”</div>
      )}
      <input
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
      const r = await fetch("/api/schrijf-feedback", {
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
        if (typeof data.score === "number") zetScore(naam, opdracht.id, data.score);
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

function Vandaag({
  naam,
  onStart,
  onNaarOefenen,
}: {
  naam: string;
  onStart: (blok: Blok, richting?: Richting) => void;
  onNaarOefenen: () => void;
}) {
  const datum = vandaagISO();
  const blokById = useMemo(() => new Map(BLOKKEN.map((b) => [b.id, b])), []);
  const [planIds] = useState<string[]>(() => {
    const bewaard = laadDagplan(naam, datum);
    if (bewaard && bewaard.length) return bewaard;
    const ids = planVandaag(BLOKKEN, naam, datum).map((p) => p.blok.id);
    bewaarDagplan(naam, datum, ids);
    return ids;
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

  return (
    <main className="lijst">
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
  return (
    <main className="lijst">
      <h1>Voortgang</h1>
      {groepen.map((g) => {
        const kleur = vakKleur(g.vak);
        const blokken = g.hoofdstukken.flatMap((h) => h.blokken);
        const gem = blokken.length
          ? Math.round((blokken.reduce((s, b) => s + blokStatus(naam, b).mastery, 0) / blokken.length) * 100)
          : 0;
        const dagen = dagenTot(datum, PWW_DATUM[g.vak] ?? "2026-07-03");
        return (
          <div key={g.vak} className="card">
            <div className="blok-kop">
              <span className="vak-stip" style={{ background: kleur }} />
              <div className="blok-tekst">
                <div className="card-titel" style={{ color: kleur }}>{vakLabel(g.vak)}</div>
                <div className="muted klein">{gem}% klaar{dagen >= 0 ? ` · toets over ${dagen} dagen` : ""}</div>
              </div>
            </div>
            <div className="balk dun">
              <div className="balk-vuller" style={{ width: `${gem}%`, background: kleur }} />
            </div>
            <div className="voortgang-blokken">
              {blokken.map((b) => {
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
