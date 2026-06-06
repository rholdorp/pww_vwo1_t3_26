import { useMemo, useState } from "react";
import type { Richting, Uitkomst } from "@pww/shared";
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
  type Blok,
  type Card,
} from "./content";
import {
  blokMastery,
  huidigeNaam,
  record,
  sessieVolgorde,
  zetNaam,
} from "./progress";

type Scherm =
  | { type: "home" }
  | { type: "train"; blok: Blok; richting?: Richting };

export default function App() {
  const [naam, setNaam] = useState<string | null>(() => huidigeNaam());
  const [scherm, setScherm] = useState<Scherm>({ type: "home" });

  if (!naam) {
    return <NaamPoort onKlaar={(n) => { zetNaam(n); setNaam(n); }} />;
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="link" onClick={() => setScherm({ type: "home" })}>
          ← PWW Trainer
        </button>
        <span className="naam">{naam}</span>
      </header>

      {scherm.type === "home" ? (
        <Home naam={naam} onStart={(blok, richting) => setScherm({ type: "train", blok, richting })} />
      ) : (
        <Trainer
          key={scherm.blok.id + (scherm.richting ?? "")}
          naam={naam}
          blok={scherm.blok}
          richting={scherm.richting}
          onExit={() => setScherm({ type: "home" })}
        />
      )}
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
                <h3 className="hfd">{h.hoofdstuk === "uitleg" ? "Uitleg & verbanden" : `Hoofdstuk ${h.hoofdstuk}`}</h3>
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
  const [order] = useState<string[]>(() => sessieVolgorde(naam, blok.ids));

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
                setState(startSession(sessieVolgorde(naam, blok.ids)));
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
      <div className="prompt">{card.prompt}</div>
      {hint && !feedback && (
        <div className="muted klein hint">hint: begint met “{card.answer.slice(0, 1)}”</div>
      )}
      <input
        className="tekstveld"
        autoFocus
        placeholder="Typ je antwoord"
        value={input}
        disabled={!!feedback}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
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
          <button className="knop primair" style={{ background: `${kleur}22`, color: kleur, borderColor: kleur }} autoFocus onClick={onVolgende}>
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
