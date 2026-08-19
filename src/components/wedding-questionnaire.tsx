"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveWeddingSectionAction } from "@/app/client/wedding/actions";
import {
  answerHasValue,
  isQuestionVisible,
  weddingProgress,
  WEDDING_SECTIONS,
} from "@/lib/wedding-companion.mjs";

type WeddingQuestion = {
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  helpText?: string | null;
  options?: string[];
  condition?: { answer?: string; equals?: unknown; includes?: string };
};

type WeddingSection = {
  key: string;
  title: string;
  description: string;
  questions: WeddingQuestion[];
};

type Props = {
  eventId?: string;
  assignmentId?: string;
  initialAnswers: Record<string, unknown>;
  initialProgress: number;
  initialSectionKey?: string | null;
  initialStatus?: string | null;
  initialMode?: PlanningMode;
  publicDraft?: boolean;
};

type PlanningMode = "guided" | "form" | "print";

const sections = WEDDING_SECTIONS as WeddingSection[];
const songsSectionIndex = sections.findIndex((section) => section.key === "songs_and_dances");
const PUBLIC_DRAFT_KEY = "eventsible:wedding-hero:draft:v1";

function answerText(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return Array.isArray(value) ? value.join("\n") : String(value ?? "");
}

export function WeddingQuestionnaire({
  eventId,
  assignmentId,
  initialAnswers,
  initialProgress,
  initialSectionKey,
  initialStatus,
  initialMode = "guided",
  publicDraft = false,
}: Props) {
  const initialIndex = Math.max(0, sections.findIndex((section) => section.key === initialSectionKey));
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [progress, setProgress] = useState(Math.max(initialProgress, weddingProgress(initialAnswers)));
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [message, setMessage] = useState(initialStatus === "submitted"
    ? "Submitted to EVENTSible"
    : publicDraft ? "Saved on this device" : "All changes saved");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [planningMode, setPlanningMode] = useState<PlanningMode>(initialMode);
  const [draftReady, setDraftReady] = useState(!publicDraft);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const currentSection = sections[currentIndex];
  const currentGuidedQuestions = useMemo(
    () => currentSection.questions.filter((question) => isQuestionVisible(question, answers)),
    [answers, currentSection],
  );
  const guidedQuestionIndex = Math.min(currentQuestionIndex, Math.max(0, currentGuidedQuestions.length - 1));
  const currentGuidedQuestion = currentGuidedQuestions[guidedQuestionIndex];
  const guidedAtStart = currentIndex === 0 && guidedQuestionIndex === 0;
  const guidedAtEnd = currentIndex === sections.length - 1 && guidedQuestionIndex === currentGuidedQuestions.length - 1;

  useEffect(() => {
    if (!publicDraft) return;

    let restoredAnswers: Record<string, unknown> | null = null;
    let restoredAt: string | null = null;
    let restoreMessage = "Saved on this device";
    try {
      const storedDraft = window.localStorage.getItem(PUBLIC_DRAFT_KEY);
      if (storedDraft) {
        const parsed = JSON.parse(storedDraft) as { answers?: Record<string, unknown>; updatedAt?: string };
        if (parsed.answers && typeof parsed.answers === "object") {
          restoredAnswers = parsed.answers;
          restoredAt = parsed.updatedAt ?? null;
          restoreMessage = "Draft restored on this device";
        }
      }
    } catch {
      restoreMessage = "Start anywhere. Your draft will save on this device.";
    }

    const restoreTimer = window.setTimeout(() => {
      if (restoredAnswers) {
        setAnswers((current) => ({ ...current, ...restoredAnswers }));
        setProgress(weddingProgress(restoredAnswers));
        setLastSaved(restoredAt);
      }
      setMessage(restoreMessage);
      setDraftReady(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [publicDraft]);

  const savePublicDraft = useCallback(() => {
    const savedAt = new Date().toISOString();
    const nextProgress = weddingProgress(answers);

    try {
      window.localStorage.setItem(PUBLIC_DRAFT_KEY, JSON.stringify({ version: 1, answers, updatedAt: savedAt }));
      setProgress(nextProgress);
      setLastSaved(savedAt);
      setSaveState("saved");
      setMessage("Saved on this device");
      return { ok: true as const, message: "Saved on this device", progress: nextProgress, savedAt };
    } catch {
      setSaveState("error");
      setMessage("This browser could not save the draft. You can still print or save it as a PDF.");
      return { ok: false as const, message: "This browser could not save the draft." };
    }
  }, [answers]);

  const persist = useCallback(async (submit = false, sectionIndex = currentIndex) => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const section = sections[sectionIndex];
    const sectionAnswers = Object.fromEntries(section.questions.map((question) => [question.key, answers[question.key] ?? null]));
    dirtyRef.current = false;
    setSaveState("saving");
    setMessage(publicDraft ? "Saving on this device…" : submit ? "Submitting…" : "Saving…");

    if (publicDraft) return savePublicDraft();
    if (!eventId || !assignmentId) {
      const result = { ok: false as const, message: "This saved workspace is missing its event connection." };
      setSaveState("error");
      setMessage(result.message);
      return result;
    }

    const result = await saveWeddingSectionAction({
      eventId,
      assignmentId,
      sectionKey: section.key,
      answers: sectionAnswers,
      submit,
    });

    if (!result.ok) {
      setSaveState("error");
      setMessage(result.message);
      return result;
    }

    setProgress(result.progress ?? weddingProgress(answers));
    setLastSaved(result.savedAt ?? null);
    if (dirtyRef.current) {
      setSaveState("dirty");
      setMessage("Unsaved changes");
      return result;
    }
    setSaveState("saved");
    setMessage(result.message);
    return result;
  }, [answers, assignmentId, currentIndex, eventId, publicDraft, savePublicDraft]);

  const persistAll = useCallback(async (submit = false) => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    dirtyRef.current = false;
    setSaveState("saving");
    setMessage(publicDraft ? "Saving on this device…" : submit ? "Submitting…" : "Saving the full form…");

    if (publicDraft) return savePublicDraft();
    if (!eventId || !assignmentId) {
      const result = { ok: false as const, message: "This saved workspace is missing its event connection." };
      setSaveState("error");
      setMessage(result.message);
      return result;
    }

    let finalResult: Awaited<ReturnType<typeof saveWeddingSectionAction>> | null = null;
    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      const sectionAnswers = Object.fromEntries(section.questions.map((question) => [question.key, answers[question.key] ?? null]));
      finalResult = await saveWeddingSectionAction({
        eventId,
        assignmentId,
        sectionKey: section.key,
        answers: sectionAnswers,
        submit: submit && index === sections.length - 1,
      });
      if (!finalResult.ok) {
        setSaveState("error");
        setMessage(finalResult.message);
        return finalResult;
      }
    }

    setProgress(finalResult?.progress ?? weddingProgress(answers));
    setLastSaved(finalResult?.savedAt ?? null);
    setSaveState("saved");
    setMessage(finalResult?.message ?? "Saved.");
    return finalResult ?? { ok: true, message: "Saved." };
  }, [answers, assignmentId, eventId, publicDraft, savePublicDraft]);

  useEffect(() => {
    if (!dirtyRef.current || !draftReady) return;
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      if (planningMode === "form") void persistAll(false);
      else void persist(false);
    }, 1400);
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [answers, draftReady, persist, persistAll, planningMode]);

  const sectionCompletion = useMemo(() => sections.map((section) => {
    const required = section.questions.filter((question) => question.required && isQuestionVisible(question, answers));
    return required.length > 0 && required.every((question) => answerHasValue(answers[question.key]));
  }), [answers]);

  function updateAnswer(key: string, value: unknown) {
    dirtyRef.current = true;
    setSaveState("dirty");
    setMessage("Unsaved changes");
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  async function moveGuided(direction: -1 | 1) {
    if (dirtyRef.current) {
      const result = await persist(false);
      if (!result.ok) return;
    }

    if (direction === 1 && guidedQuestionIndex < currentGuidedQuestions.length - 1) {
      setCurrentQuestionIndex(guidedQuestionIndex + 1);
    } else if (direction === 1 && currentIndex < sections.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentQuestionIndex(0);
    } else if (direction === -1 && guidedQuestionIndex > 0) {
      setCurrentQuestionIndex(guidedQuestionIndex - 1);
    } else if (direction === -1 && currentIndex > 0) {
      const previousIndex = currentIndex - 1;
      const previousQuestions = sections[previousIndex].questions.filter((question) => isQuestionVisible(question, answers));
      setCurrentIndex(previousIndex);
      setCurrentQuestionIndex(Math.max(0, previousQuestions.length - 1));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function goToSection(sectionIndex: number) {
    if (planningMode === "form") {
      document.getElementById(`wedding-section-${sections[sectionIndex].key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (sectionIndex === currentIndex && currentQuestionIndex === 0) return;
    if (dirtyRef.current) {
      const result = await persist(false);
      if (!result.ok) return;
    }
    setCurrentIndex(sectionIndex);
    setCurrentQuestionIndex(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    const result = planningMode === "form" ? await persistAll(!publicDraft) : await persist(!publicDraft);
    if (!result.ok) return;
    if (publicDraft) {
      setPlanningMode("print");
      window.history.replaceState(null, "", `${window.location.pathname}?mode=print`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function chooseMode(mode: PlanningMode) {
    if (mode === planningMode) return;
    if (dirtyRef.current) {
      const result = planningMode === "form" ? await persistAll(false) : await persist(false);
      if (!result.ok) return;
    }
    setPlanningMode(mode);
    window.history.replaceState(null, "", `${window.location.pathname}?mode=${mode}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <nav className="wedding-mode-toolbar" aria-label="Choose a Wedding Hero planning method">
        <div><span className="wedding-kicker">Plan your way</span><b>{publicDraft ? "Start now. No email required." : "Switch methods anytime"}</b></div>
        <div>
          <button type="button" className={planningMode === "guided" ? "active" : ""} onClick={() => void chooseMode("guided")}><span>✦</span> Interactive</button>
          <button type="button" className={planningMode === "form" ? "active" : ""} onClick={() => void chooseMode("form")}><span>✓</span> Full form</button>
          <button type="button" className={planningMode === "print" ? "active" : ""} onClick={() => void chooseMode("print")}><span>⇩</span> Printable</button>
        </div>
      </nav>

      {planningMode === "print" ? (
        <main className="wedding-print-workspace">
          <header className="wedding-print-controls">
            <div><span className="wedding-kicker">Printable Wedding Hero</span><h2>Take the planner offline.</h2><p>Print the answers you have already entered, with writing space left wherever a question is still blank. You can also save this page as a PDF and send it to EVENTSible.</p></div>
            <button type="button" className="wedding-print-button" onClick={() => window.print()}>Print or save as PDF</button>
          </header>
          <div className="wedding-print-sheet">
            <header><b>EVENTSIBLE WEDDING HERO</b><span>Interactive Wedding Companion · Printable Planner</span></header>
            {sections.map((section) => (
              <section key={section.key}>
                <h3>{section.title}</h3>
                {section.questions.filter((question) => isQuestionVisible(question, answers)).map((question) => (
                  <div className="wedding-print-question" key={question.key}>
                    <b>{question.label}</b>
                    <p>{answerHasValue(answers[question.key]) ? answerText(answers[question.key]) : "________________________________________________________________"}</p>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </main>
      ) : (
        <div className={`wedding-workspace${planningMode === "form" ? " full-form-mode" : ""}`}>
      <aside className="wedding-sections" aria-label="Wedding Hero planning sections">
        <div className="wedding-progress-card">
          <span>Planning progress</span>
          <b>{progress}%</b>
          <div className="wedding-progress"><span style={{ width: `${progress}%` }} /></div>
          <small>{message}{lastSaved ? ` · ${new Date(lastSaved).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</small>
        </div>
        <button
          type="button"
          className="wedding-song-shortcut"
          onClick={() => void goToSection(songsSectionIndex)}
        >
          <span aria-hidden="true">♫</span>
          <div><b>Songs & Special Dances</b><small>Jump straight to the soundtrack</small></div>
        </button>
        <nav>
          {sections.map((section, index) => (
            <button
              type="button"
              className={index === currentIndex ? "active" : ""}
              key={section.key}
              onClick={() => void goToSection(index)}
            >
              <span>{sectionCompletion[index] ? "✓" : index + 1}</span>
              <div><b>{section.title}</b><small>{sectionCompletion[index] ? "Core details complete" : "Ready when you are"}</small></div>
            </button>
          ))}
        </nav>
      </aside>

      {planningMode === "guided" ? <main className="wedding-form-card wedding-guided-card">
        <header>
          <div className="wedding-guided-heading">
            <div>
              <span className="eyebrow">Guided moment · Section {currentIndex + 1} of {sections.length}</span>
              <h2>{currentSection.title}</h2>
              <p>{currentSection.description}</p>
            </div>
            <span className="wedding-guided-count">{guidedQuestionIndex + 1}<small>of {currentGuidedQuestions.length}</small></span>
          </div>
          <div className="wedding-guided-progress" aria-label={`Question ${guidedQuestionIndex + 1} of ${currentGuidedQuestions.length}`}>
            <span style={{ width: `${((guidedQuestionIndex + 1) / Math.max(1, currentGuidedQuestions.length)) * 100}%` }} />
          </div>
        </header>

        <div className="wedding-guided-prompt">
          <span className="wedding-kicker">One thing at a time</span>
          {currentGuidedQuestion ? (
            <QuestionField
              key={currentGuidedQuestion.key}
              question={currentGuidedQuestion}
              value={answers[currentGuidedQuestion.key]}
              onChange={(value) => updateAnswer(currentGuidedQuestion.key, value)}
            />
          ) : <p>This section is ready. Continue to the next part of your wedding.</p>}
          <small className="wedding-guided-help">Skip anything you do not know yet. Wedding Hero will keep your place.</small>
        </div>

        {saveState === "error" ? <div className="wedding-save-error">{message}</div> : null}

        <footer className="wedding-form-actions">
          <button type="button" className="secondary-button" disabled={guidedAtStart || saveState === "saving"} onClick={() => void moveGuided(-1)}>Back</button>
          <button type="button" className="secondary-button" disabled={saveState === "saving"} onClick={() => void persist(false)}>
            {saveState === "saving" ? "Saving…" : "Save for later"}
          </button>
          {!guidedAtEnd ? (
            <button type="button" className="primary-button" disabled={saveState === "saving"} onClick={() => void moveGuided(1)}>{currentGuidedQuestion && answerHasValue(answers[currentGuidedQuestion.key]) ? "Save & next" : "Skip for now"}</button>
          ) : (
            <button type="button" className="primary-button" disabled={saveState === "saving"} onClick={() => void submit()}>{publicDraft ? "Review printable copy" : "Submit to EVENTSible"}</button>
          )}
        </footer>
      </main> : (
        <main className="wedding-form-card wedding-full-form">
          <header><span className="wedding-kicker">Traditional planning form</span><h2>The complete Wedding Hero form.</h2><p>Every applicable section is open below. Work from top to bottom or jump around. Changes save while you plan.</p></header>
          {sections.map((section, index) => (
            <section className="wedding-full-section" id={`wedding-section-${section.key}`} key={section.key}>
              <header><span>Section {index + 1}</span><h3>{section.title}</h3><p>{section.description}</p></header>
              <div className="wedding-question-list">
                {section.questions.filter((question) => isQuestionVisible(question, answers)).map((question) => (
                  <QuestionField key={question.key} question={question} value={answers[question.key]} onChange={(value) => updateAnswer(question.key, value)} />
                ))}
              </div>
            </section>
          ))}
          {saveState === "error" ? <div className="wedding-save-error">{message}</div> : null}
          <footer className="wedding-form-actions">
            <button type="button" className="secondary-button" disabled={saveState === "saving"} onClick={() => void persistAll(false)}>{saveState === "saving" ? "Saving…" : "Save for later"}</button>
            <button type="button" className="primary-button" disabled={saveState === "saving"} onClick={() => void submit()}>{publicDraft ? "Review printable copy" : "Submit to EVENTSible"}</button>
          </footer>
        </main>
      )}
        </div>
      )}
    </>
  );
}

function QuestionField({ question, value, onChange }: { question: WeddingQuestion; value: unknown; onChange: (value: unknown) => void }) {
  const id = `wedding-${question.key}`;
  const label = <><span>{question.label}{question.required ? <b className="required-mark"> *</b> : null}</span>{question.helpText ? <small>{question.helpText}</small> : null}</>;

  if (question.fieldType === "yes_no") {
    return (
      <fieldset className="wedding-question yes-no">
        <legend>{label}</legend>
        <div>
          {[{ label: "Yes", value: true }, { label: "No", value: false }].map((option) => (
            <button type="button" aria-pressed={value === option.value} className={value === option.value ? "selected" : ""} key={option.label} onClick={() => onChange(option.value)}>{option.label}</button>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.fieldType === "multi_select") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return (
      <fieldset className="wedding-question choice-grid">
        <legend>{label}</legend>
        <div>
          {(question.options ?? []).map((option) => (
            <label key={option}>
              <input
                type="checkbox"
                checked={selected.includes(option)}
                onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (question.fieldType === "single_select") {
    return (
      <label className="wedding-question" htmlFor={id}>
        {label}
        <select id={id} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose one</option>
          {(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  if (question.fieldType === "long_text" || question.fieldType === "repeater") {
    return (
      <label className="wedding-question" htmlFor={id}>
        {label}
        <textarea
          id={id}
          rows={question.fieldType === "repeater" ? 5 : 4}
          value={answerText(value)}
          onChange={(event) => onChange(question.fieldType === "repeater" ? event.target.value.split("\n") : event.target.value)}
          placeholder={question.fieldType === "repeater" ? "One item per line" : "Share the details here"}
        />
      </label>
    );
  }

  const inputType = question.fieldType === "number" ? "number"
    : question.fieldType === "time" ? "time"
      : question.fieldType === "date" ? "date"
      : question.fieldType === "phone" ? "tel"
        : "text";
  return (
    <label className="wedding-question" htmlFor={id}>
      {label}
      <input
        id={id}
        type={inputType}
        min={inputType === "number" ? 0 : undefined}
        value={answerText(value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={question.fieldType === "song" ? "Song title and artist" : undefined}
      />
    </label>
  );
}
