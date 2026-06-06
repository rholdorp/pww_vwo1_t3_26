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
  richtingLabel,
  type Blok,
  type Card,
} from "./content";
import {
  blokMastery,
  huidigeNaam,
  record,
  sorteerOpBakje,
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

const SOORT_LABEL: Record<Blok["soort"], string> = {
  vocab: "Cat 1 · typen",
  flashcards: "Cat 1 · begrippen",
  oefenvragen: "Cat 3 · begripsvragen",
};

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
      <h1>Kies wat je wilt oefenen</h1>
      {groepen.map((g) => (
        <section key={g.vak}>
          <h2>{vakLabel(g.vak)}</h2>
          {g.blokken.map((blok) => {
            const ids = blok.bouwCards(blok.richtingen?.[0]).map((c) => c.id);
            const m = Math.round(blokMastery(naam, ids) * 100);
            return (
              <div key={blok.id} className="card">
                <div className="card-kop">
                  <div>
                    <div className="card-titel">{blok.titel}</div>
                    <div className="muted klein">
                      {SOORT_LABEL[blok.soort]} · {blok.aantal} kaarten · {m}% beheerst
                    </div>
                  </div>
                </div>
                <div className="knoppen">
                  {blok.soort === "vocab" && blok.richtingen ? (
                    blok.richtingen.map((r) => (
                      <button key={r} className="knop" onClick={() => onStart(blok, r)}>
                        {richtingLabel(blok.vak, r)}
                      </button>
                    ))
                  ) : (
                    <button className="knop primair" onClick={() => onStart(blok)}>
                      Start
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      ))}
      <p className="muted klein voetnoot">
        Prototype · voortgang lokaal op dit apparaat · {groepen.reduce((n, g) => n + g.blokken.length, 0)} blokken geladen
      </p>
    </main>
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
  const cards = useMemo(() => blok.bouwCards(richting), [blok, richting]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const totaal = cards.length;

  const [state, setState] = useState<SessionState>(() =>
    startSession(sorteerOpBakje(naam, cards.map((c) => c.id))),
  );
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ uitkomst: Uitkomst; answer: string } | null>(null);
  const [onthuld, setOnthuld] = useState(false);

  const currentId = currentItem(state);

  if (isComplete(state) || currentId === null) {
    const m = Math.round(blokMastery(naam, cards.map((c) => c.id)) * 100);
    return (
      <main className="lijst center">
        <div className="card narrow">
          <h1>Klaar! 🎉</h1>
          <p>Je hebt alle {totaal} kaarten doorlopen.</p>
          <p className="muted">{m}% beheerst (bakje 3 of hoger).</p>
          <div className="knoppen">
            <button
              className="knop primair"
              onClick={() => {
                setState(startSession(sorteerOpBakje(naam, cards.map((c) => c.id))));
                setInput("");
                setFeedback(null);
                setOnthuld(false);
              }}
            >
              Nog een ronde
            </button>
            <button className="knop" onClick={onExit}>
              Terug
            </button>
          </div>
        </div>
      </main>
    );
  }

  const card = cardById.get(currentId)!;
  const gedaan = state.cleared.length;
  const progressPct = Math.round((gedaan / totaal) * 100);

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
      <div className="balk">
        <div className="balk-vuller" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="balk-tekst muted klein">
        {gedaan} / {totaal} af · nog {state.remaining.length} in de rij
      </div>

      <div className="card kaart-groot">
        {card.kind === "typed" ? (
          <TypedKaart
            card={card}
            input={input}
            setInput={setInput}
            feedback={feedback}
            hint={needsHint(state, card.id)}
            onNakijken={nakijken}
            onVolgende={() => feedback && volgende(feedback.uitkomst)}
          />
        ) : (
          <FlipKaart
            card={card}
            onthuld={onthuld}
            onToon={() => setOnthuld(true)}
            onBeoordeel={volgende}
          />
        )}
      </div>

      <button className="link" onClick={onExit}>
        Stoppen
      </button>
    </main>
  );
}

function TypedKaart({
  card,
  input,
  setInput,
  feedback,
  hint,
  onNakijken,
  onVolgende,
}: {
  card: Extract<Card, { kind: "typed" }>;
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
            {feedback.uitkomst === "fout" && "Fout"}
          </div>
          {feedback.uitkomst !== "goed" && (
            <div className="juiste">Juiste antwoord: <strong>{card.answer}</strong></div>
          )}
          <button className="knop primair" autoFocus onClick={onVolgende}>
            Volgende
          </button>
        </>
      ) : (
        <button className="knop primair" disabled={!input.trim()} onClick={onNakijken}>
          Nakijken
        </button>
      )}
    </>
  );
}

function FlipKaart({
  card,
  onthuld,
  onToon,
  onBeoordeel,
}: {
  card: Extract<Card, { kind: "flip" }>;
  onthuld: boolean;
  onToon: () => void;
  onBeoordeel: (uitkomst: Uitkomst) => void;
}) {
  return (
    <>
      {card.image && <img className="kaart-beeld" src={card.image} alt="" />}
      <div className="prompt">{card.front}</div>
      {!onthuld ? (
        <button className="knop primair" onClick={onToon}>
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
            <button className="knop goed" onClick={() => onBeoordeel("goed")}>
              Wist ik ✅
            </button>
            <button className="knop fout" onClick={() => onBeoordeel("fout")}>
              Nog niet
            </button>
          </div>
        </>
      )}
    </>
  );
}
