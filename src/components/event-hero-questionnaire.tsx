"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveEventHeroSectionAction } from "@/app/client/event/actions";
import { answerHasValue, eventHeroProgress } from "@/lib/event-hero.mjs";

export type EventHeroQuestion = {
  id: string;
  key: string;
  label: string;
  fieldType: string;
  required: boolean;
  helpText?: string | null;
  options: string[];
};

export type EventHeroSection = {
  id: string;
  key: string;
  title: string;
  description?: string | null;
  questions: EventHeroQuestion[];
};

type Props = {
  eventId: string;
  assignmentId: string;
  sections: EventHeroSection[];
  initialAnswers: Record<string, unknown>;
  initialProgress: number;
  initialSectionKey?: string | null;
  initialStatus?: string | null;
};

function answerText(value: unknown) {
  return Array.isArray(value) ? value.join("\n") : String(value ?? "");
}

export function EventHeroQuestionnaire({ eventId, assignmentId, sections, initialAnswers, initialProgress, initialSectionKey, initialStatus }: Props) {
  const initialIndex = Math.max(0, sections.findIndex((section) => section.key === initialSectionKey));
  const questions = useMemo(() => sections.flatMap((section) => section.questions), [sections]);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [progress, setProgress] = useState(Math.max(initialProgress, eventHeroProgress(questions, initialAnswers)));
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error">("saved");
  const [message, setMessage] = useState(initialStatus === "submitted" ? "Submitted to EVENTSible" : "All changes saved");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const currentSection = sections[currentIndex];

  const persist = useCallback(async (submit = false, sectionIndex = currentIndex) => {
    if (!sections[sectionIndex]) return { ok: false, message: "This Event Hero section is unavailable." };
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    const section = sections[sectionIndex];
    const sectionAnswers = Object.fromEntries(section.questions.map((question) => [question.key, answers[question.key] ?? null]));
    dirtyRef.current = false;
    setSaveState("saving");
    setMessage(submit ? "Submitting…" : "Saving…");
    const result = await saveEventHeroSectionAction({ eventId, assignmentId, sectionKey: section.key, answers: sectionAnswers, submit });
    if (!result.ok) {
      setSaveState("error");
      setMessage(result.message);
      return result;
    }
    setProgress(result.progress ?? eventHeroProgress(questions, answers));
    setLastSaved(result.savedAt ?? null);
    if (dirtyRef.current) {
      setSaveState("dirty");
      setMessage("Unsaved changes");
    } else {
      setSaveState("saved");
      setMessage(result.message);
    }
    return result;
  }, [answers, assignmentId, currentIndex, eventId, questions, sections]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => void persist(false), 1400);
    return () => { if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current); };
  }, [answers, persist]);

  const sectionCompletion = useMemo(() => sections.map((section) => {
    const required = section.questions.filter((question) => question.required);
    return required.length ? required.every((question) => answerHasValue(answers[question.key])) : section.questions.some((question) => answerHasValue(answers[question.key]));
  }), [answers, sections]);

  function updateAnswer(key: string, value: unknown) {
    dirtyRef.current = true;
    setSaveState("dirty");
    setMessage("Unsaved changes");
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  async function goTo(index: number) {
    if (dirtyRef.current) {
      const result = await persist(false);
      if (!result.ok) return;
    }
    setCurrentIndex(Math.max(0, Math.min(sections.length - 1, index)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!currentSection) return <div className="client-empty"><h2>Event Hero is being prepared</h2><p>EVENTSible has not added planning questions yet.</p></div>;

  return (
    <div className="wedding-workspace event-hero-workspace">
      <aside className="wedding-sections" aria-label="Event Hero sections">
        <div className="wedding-progress-card">
          <span>Planning progress</span><b>{progress}%</b>
          <div className="wedding-progress"><span style={{ width: `${progress}%` }} /></div>
          <small>{message}{lastSaved ? ` · ${new Date(lastSaved).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</small>
        </div>
        <nav>{sections.map((section, index) => (
          <button type="button" className={index === currentIndex ? "active" : ""} key={section.key} onClick={() => void goTo(index)}>
            <span>{sectionCompletion[index] ? "✓" : index + 1}</span>
            <div><b>{section.title}</b><small>{sectionCompletion[index] ? "Details added" : section.questions.length ? "Ready when you are" : "No questions yet"}</small></div>
          </button>
        ))}</nav>
      </aside>

      <main className="wedding-form-card">
        <header><span className="eyebrow">Section {currentIndex + 1} of {sections.length}</span><h2>{currentSection.title}</h2><p>{currentSection.description}</p></header>
        <div className="wedding-question-list">
          {currentSection.questions.length ? currentSection.questions.map((question) => (
            <EventQuestionField key={question.key} question={question} value={answers[question.key]} onChange={(value) => updateAnswer(question.key, value)} />
          )) : <div className="client-pending">No additional questions are required in this section yet. Continue when you are ready.</div>}
        </div>
        {saveState === "error" ? <div className="wedding-save-error">{message}</div> : null}
        <footer className="wedding-form-actions">
          <button type="button" className="secondary-button" disabled={currentIndex === 0 || saveState === "saving"} onClick={() => void goTo(currentIndex - 1)}>Back</button>
          <button type="button" className="secondary-button" disabled={saveState === "saving" || !currentSection.questions.length} onClick={() => void persist(false)}>{saveState === "saving" ? "Saving…" : "Save for later"}</button>
          {currentIndex < sections.length - 1
            ? <button type="button" className="primary-button" disabled={saveState === "saving"} onClick={() => void goTo(currentIndex + 1)}>Save & continue</button>
            : <button type="button" className="primary-button" disabled={saveState === "saving"} onClick={() => void persist(true)}>Submit to EVENTSible</button>}
        </footer>
      </main>
    </div>
  );
}

function EventQuestionField({ question, value, onChange }: { question: EventHeroQuestion; value: unknown; onChange: (value: unknown) => void }) {
  const id = `event-hero-${question.key}`;
  const label = <><span>{question.label}{question.required ? <b className="required-mark"> *</b> : null}</span>{question.helpText ? <small>{question.helpText}</small> : null}</>;
  if (question.fieldType === "yes_no") return <fieldset className="wedding-question yes-no"><legend>{label}</legend><div>{[{ label: "Yes", value: true }, { label: "No", value: false }].map((option) => <button type="button" key={option.label} aria-pressed={value === option.value} className={value === option.value ? "selected" : ""} onClick={() => onChange(option.value)}>{option.label}</button>)}</div></fieldset>;
  if (question.fieldType === "multi_select") {
    const selected = Array.isArray(value) ? value.map(String) : [];
    return <fieldset className="wedding-question choice-grid"><legend>{label}</legend><div>{question.options.map((option) => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((item) => item !== option))} /><span>{option}</span></label>)}</div></fieldset>;
  }
  if (question.fieldType === "single_select") return <label className="wedding-question" htmlFor={id}>{label}<select id={id} value={answerText(value)} onChange={(event) => onChange(event.target.value)}><option value="">Choose one</option>{question.options.map((option) => <option key={option}>{option}</option>)}</select></label>;
  if (question.fieldType === "long_text" || question.fieldType === "repeater") return <label className="wedding-question" htmlFor={id}>{label}<textarea id={id} rows={question.fieldType === "repeater" ? 5 : 4} value={answerText(value)} onChange={(event) => onChange(question.fieldType === "repeater" ? event.target.value.split("\n") : event.target.value)} placeholder={question.fieldType === "repeater" ? "One item per line" : "Share the details here"} /></label>;
  const inputType = question.fieldType === "number" ? "number" : question.fieldType === "time" ? "time" : "text";
  return <label className="wedding-question" htmlFor={id}>{label}<input id={id} type={inputType} min={inputType === "number" ? 0 : undefined} value={answerText(value)} onChange={(event) => onChange(event.target.value)} /></label>;
}
