"use client";

import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { FragranceSearchResultVisual } from "@/components/FragranceSearchResultVisual";
import { ResultsSummary } from "@/components/ResultsSummary";
import {
  answerTwentyQuestionsQuestion,
  createTwentyQuestionsQuestionBank,
  filterCandidatesByAnswer,
  questionImpactLabel,
  rankMeaningfulQuestions,
  scoreTwentyQuestions,
  TWENTY_QUESTIONS_CATEGORIES,
  TWENTY_QUESTIONS_LIMIT,
  type TwentyQuestionsAnswer,
  type TwentyQuestionsCategory,
  type TwentyQuestionsQuestion,
} from "@/lib/engines/fragrance-20-questions";
import type { Fragrance, GameModeMeta } from "@/lib/types";
import { HouseMark } from "./HouseMark";
import { useSaveRecord } from "./useSaveRecord";

interface Fragrance20QuestionsGameProps {
  meta: GameModeMeta;
  pool: Fragrance[];
  onPlayAgain: () => void;
}

interface AskedQuestion {
  question: TwentyQuestionsQuestion;
  answer: TwentyQuestionsAnswer;
  remaining: number;
}

type GameStatus = "playing" | "won" | "gave-up";
type CategoryFilter = "all" | TwentyQuestionsCategory;

const ANSWER_STYLES: Record<TwentyQuestionsAnswer, string> = {
  yes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  no: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  unknown: "border-border bg-background text-muted",
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function Fragrance20QuestionsGame({
  meta,
  pool,
  onPlayAgain,
}: Fragrance20QuestionsGameProps) {
  const hidden = pool[0];
  const bank = useMemo(() => createTwentyQuestionsQuestionBank(pool), [pool]);
  const [candidates, setCandidates] = useState(pool);
  const [history, setHistory] = useState<AskedQuestion[]>([]);
  const [wrongGuessIds, setWrongGuessIds] = useState<string[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [guessQuery, setGuessQuery] = useState("");
  const [selectedGuessId, setSelectedGuessId] = useState<string | null>(null);
  const [status, setStatus] = useState<GameStatus>("playing");
  const [message, setMessage] = useState(
    "Pick a high-impact question or make a guess.",
  );
  const [isNewBest, setIsNewBest] = useState(false);
  const savedRef = useRef(false);
  const saveRecord = useSaveRecord();

  const askedIds = useMemo(
    () => new Set(history.map((entry) => entry.question.id)),
    [history],
  );
  const rankedQuestions = useMemo(
    () => rankMeaningfulQuestions(bank, candidates, askedIds),
    [bank, candidates, askedIds],
  );
  const filteredQuestions = useMemo(() => {
    const search = normalize(questionSearch);
    return rankedQuestions
      .filter(
        ({ question }) =>
          (category === "all" || question.category === category) &&
          (!search || question.searchText.includes(search)),
      )
      .slice(0, 18);
  }, [rankedQuestions, questionSearch, category]);

  const wrongGuessSet = useMemo(
    () => new Set(wrongGuessIds),
    [wrongGuessIds],
  );
  const candidateIds = useMemo(
    () => new Set(candidates.map((candidate) => candidate.id)),
    [candidates],
  );
  const guessSuggestions = useMemo(() => {
    const search = normalize(guessQuery);
    if (search.length < 2) return [];
    return pool
      .filter(
        (fragrance) =>
          !wrongGuessSet.has(fragrance.id) &&
          normalize(`${fragrance.name} ${fragrance.house}`).includes(search),
      )
      .sort(
        (a, b) =>
          Number(candidateIds.has(b.id)) - Number(candidateIds.has(a.id)) ||
          (b.votes ?? 0) - (a.votes ?? 0) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, 7);
  }, [guessQuery, pool, wrongGuessSet, candidateIds]);

  const score = scoreTwentyQuestions(history.length, wrongGuessIds.length);
  const questionsLeft = TWENTY_QUESTIONS_LIMIT - history.length;

  function saveResult(finalScore: number, finalStatus: GameStatus) {
    if (savedRef.current) return;
    savedRef.current = true;
    setIsNewBest(
      saveRecord({
        mode: "fragrance-20-questions",
        score: finalScore,
        total: 100,
        label:
          finalStatus === "won"
            ? `${history.length} questions, ${wrongGuessIds.length} incorrect guesses`
            : "gave up",
      }),
    );
  }

  function askQuestion(questionToAsk: TwentyQuestionsQuestion) {
    if (!hidden || status !== "playing" || questionsLeft <= 0) return;
    const answer = answerTwentyQuestionsQuestion(questionToAsk, hidden);
    const nextCandidates = filterCandidatesByAnswer(
      candidates,
      questionToAsk,
      answer,
    );
    setCandidates(nextCandidates);
    setHistory((current) => [
      ...current,
      {
        question: questionToAsk,
        answer,
        remaining: nextCandidates.length,
      },
    ]);
    setQuestionSearch("");
    setMessage(
      nextCandidates.length === 1
        ? "One candidate remains. Make your guess."
        : `${nextCandidates.length} candidates remain.`,
    );
  }

  function selectGuess(fragrance: Fragrance) {
    setGuessQuery(`${fragrance.name} — ${fragrance.house}`);
    setSelectedGuessId(fragrance.id);
    setMessage(`${fragrance.name} selected. Submit when ready.`);
  }

  function submitGuess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hidden || status !== "playing") return;
    const guessed = selectedGuessId
      ? pool.find((fragrance) => fragrance.id === selectedGuessId)
      : undefined;
    if (!guessed) {
      setMessage("Choose an exact fragrance from the search results.");
      return;
    }

    if (guessed.id === hidden.id) {
      const finalScore = scoreTwentyQuestions(
        history.length,
        wrongGuessIds.length,
      );
      saveResult(finalScore, "won");
      setStatus("won");
      setMessage(`Correct. It was ${hidden.name} by ${hidden.house}.`);
      return;
    }

    const nextWrongIds = [...wrongGuessIds, guessed.id];
    setWrongGuessIds(nextWrongIds);
    setCandidates((current) =>
      current.filter((candidate) => candidate.id !== guessed.id),
    );
    setGuessQuery("");
    setSelectedGuessId(null);
    setMessage(
      `${guessed.name} is not the hidden fragrance. 12 points deducted.`,
    );
  }

  function giveUp() {
    saveResult(0, "gave-up");
    setStatus("gave-up");
    setMessage(
      hidden
        ? `The hidden fragrance was ${hidden.name} by ${hidden.house}.`
        : "No fragrance was available.",
    );
  }

  if (!hidden) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted">
        No fragrances available for this game.
      </div>
    );
  }

  if (status !== "playing") {
    return (
      <ResultsSummary
        title={status === "won" ? "Mystery solved" : "Mystery revealed"}
        scoreText={`${status === "won" ? score : 0} points`}
        subText={message}
        isNewBest={status === "won" && isNewBest}
        onPlayAgain={onPlayAgain}
      >
        <div className="grid w-full max-w-xl gap-5 rounded-2xl border border-border bg-card p-5 text-left sm:grid-cols-[9rem_1fr]">
          <div className="flex min-h-40 items-center justify-center rounded-xl bg-white p-3 dark:bg-stone-100">
            <FragranceBottleImage
              imageUrl={hidden.imageUrl}
              alt={`${hidden.name} by ${hidden.house}`}
              eager
            />
          </div>
          <div className="self-center">
            <p className="font-display text-2xl font-semibold">{hidden.name}</p>
            <p className="mt-1 flex items-center gap-2 text-muted">
              <HouseMark name={hidden.house} size="sm" />
              {hidden.house}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <ResultStat label="Questions" value={history.length} />
              <ResultStat label="Misses" value={wrongGuessIds.length} />
              <ResultStat
                label="Narrowed to"
                value={Math.max(candidates.length, 1)}
              />
            </div>
          </div>
        </div>
      </ResultsSummary>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 py-3 sm:py-6">
      <header className="rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              Hidden fragrance
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {meta.title}
            </h1>
            <p aria-live="polite" className="mt-2 text-sm text-muted">
              {message}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:min-w-80">
            <Metric
              label="Questions"
              value={`${history.length}/${TWENTY_QUESTIONS_LIMIT}`}
            />
            <Metric label="Candidates" value={candidates.length} />
            <Metric label="Score" value={score} accent />
          </div>
        </div>
      </header>

      <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.8fr)]">
        <section
          aria-labelledby="question-browser-title"
          className="rounded-3xl border border-border bg-card p-5 sm:p-7"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Question browser
              </p>
              <h2
                id="question-browser-title"
                className="mt-1 font-display text-2xl font-semibold"
              >
                What do you want to know?
              </h2>
            </div>
            <p className="shrink-0 text-sm tabular-nums text-muted">
              {questionsLeft} left
            </p>
          </div>

          <label className="mt-5 block">
            <span className="sr-only">Search questions</span>
            <input
              type="search"
              value={questionSearch}
              onChange={(event) => setQuestionSearch(event.target.value)}
              placeholder="Search vanilla, French, 2010…"
              className="h-12 w-full rounded-full border border-border bg-background px-5 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </label>

          <div
            className="mt-3 flex gap-2 overflow-x-auto pb-2"
            aria-label="Question categories"
          >
            {TWENTY_QUESTIONS_CATEGORIES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={`min-h-9 shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  category === item.id
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-background text-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {questionsLeft > 0 ? (
            filteredQuestions.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {filteredQuestions.map(({ question, distribution }) => (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => askQuestion(question)}
                    className="group flex min-h-24 flex-col justify-between rounded-2xl border border-border bg-background p-4 text-left transition-[border-color,transform,background-color] hover:-translate-y-0.5 hover:border-accent hover:bg-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span className="text-sm font-semibold leading-5">
                      {question.label}
                    </span>
                    <span className="mt-3 flex items-center justify-between gap-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">
                      <span>{question.category}</span>
                      <span className="text-accent">
                        {questionImpactLabel(
                          distribution,
                          candidates.length,
                        )}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyQuestions />
            )
          ) : (
            <p className="mt-5 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-sm font-medium text-foreground">
              All 20 questions used. Final guess time.
            </p>
          )}
        </section>

        <aside className="flex flex-col gap-5">
          <section
            aria-labelledby="guess-title"
            className="rounded-3xl border border-accent/40 bg-card p-5 sm:p-6"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Guess anytime
            </p>
            <h2
              id="guess-title"
              className="mt-1 font-display text-2xl font-semibold"
            >
              Name the fragrance
            </h2>
            <form className="mt-4" onSubmit={submitGuess}>
              <label>
                <span className="sr-only">Search fragrances to guess</span>
                <input
                  type="search"
                  value={guessQuery}
                  onChange={(event) => {
                    setGuessQuery(event.target.value);
                    setSelectedGuessId(null);
                  }}
                  placeholder="Search fragrance or house…"
                  autoComplete="off"
                  className="h-11 w-full rounded-full border border-border bg-background px-4 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent-soft"
                />
              </label>
              {guessQuery.length >= 2 &&
                !selectedGuessId &&
                guessSuggestions.length > 0 && (
                  <ul className="mt-2 overflow-hidden rounded-2xl border border-border bg-background p-1">
                    {guessSuggestions.map((fragrance) => (
                      <li key={fragrance.id}>
                        <button
                          type="button"
                          onClick={() => selectGuess(fragrance)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-card-hover"
                        >
                          <FragranceSearchResultVisual
                            fragrance={fragrance}
                            showBottle={false}
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              <button
                type="submit"
                className="mt-3 min-h-11 w-full rounded-full bg-accent px-5 py-2.5 font-semibold text-[#17120a] transition-[opacity,transform] hover:-translate-y-0.5 hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Submit guess
              </button>
            </form>
            <p className="mt-3 text-center text-xs text-muted">
              Incorrect guess: −12 points
            </p>
          </section>

          {candidates.length <= 12 && (
            <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Shortlist
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => selectGuess(candidate)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs font-semibold transition-colors hover:border-accent hover:text-accent"
                  >
                    {candidate.name}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section
            aria-labelledby="case-file-title"
            className="min-h-56 flex-1 rounded-3xl border border-border bg-card p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                  Case file
                </p>
                <h2
                  id="case-file-title"
                  className="mt-1 font-display text-xl font-semibold"
                >
                  Answers
                </h2>
              </div>
              {history.length > 0 && (
                <span className="text-xs text-muted">−3 each</span>
              )}
            </div>

            {history.length === 0 ? (
              <p className="mt-8 text-center text-sm leading-6 text-muted">
                Answers appear here as you investigate.
              </p>
            ) : (
              <ol className="mt-4 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {[...history].reverse().map((entry, reverseIndex) => (
                  <li
                    key={entry.question.id}
                    className="rounded-2xl border border-border bg-background p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium leading-5">
                        {entry.question.label}
                      </p>
                      <AnswerBadge answer={entry.answer} />
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Q{history.length - reverseIndex} · {entry.remaining}{" "}
                      candidates left
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <button
            type="button"
            onClick={giveUp}
            className="mx-auto text-sm font-medium text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            Reveal fragrance
          </button>
        </aside>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background px-3 py-3 text-center">
      <p
        className={`text-xl font-bold tabular-nums ${accent ? "text-accent" : ""}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
    </div>
  );
}

function AnswerBadge({ answer }: { answer: TwentyQuestionsAnswer }) {
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wider ${ANSWER_STYLES[answer]}`}
    >
      {answer}
    </span>
  );
}

function ResultStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-background px-2 py-3">
      <p className="font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[0.62rem] uppercase tracking-wider text-muted">
        {label}
      </p>
    </div>
  );
}

function EmptyQuestions() {
  return (
    <p className="mt-5 rounded-2xl border border-border bg-background p-5 text-center text-sm leading-6 text-muted">
      No useful questions match this filter. Try another category or search.
    </p>
  );
}
