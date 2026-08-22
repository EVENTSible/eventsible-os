"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveWeddingSectionAction } from "@/app/client/wedding/actions";
import { WeddingHeroContact } from "@/components/wedding-hero-contact";
import {
  answerHasValue,
  formatWeddingAnswer,
  guidedResumeSectionKey,
  isQuestionVisible,
  isSectionComplete,
  shouldRevealAllWeddingQuestions,
  weddingProgress,
  WEDDING_SECTIONS,
} from "@/lib/wedding-companion.mjs";
import { buildWeddingDaySheet } from "@/lib/wedding-day-sheet.mjs";
import {
  isStructuredWeddingField,
  StructuredWeddingField,
  type StructuredWeddingQuestion,
} from "@/components/wedding-structured-fields";

type WeddingQuestion = StructuredWeddingQuestion & {
  helpText?: string | null;
  options?: string[];
  condition?: { answer?: string; equals?: unknown; includes?: string; hasValue?: boolean };
  promptIdeas?: string[];
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
  initialPrintView?: PrintView;
  publicDraft?: boolean;
  supportEmail: string;
};

type PlanningMode = "guided" | "form" | "print";
type PrintView = "planner" | "day-of";

type ResourceLink = {
  slug: string;
  title: string;
  description: string;
};

const sections = WEDDING_SECTIONS as WeddingSection[];
const songsSectionIndex = sections.findIndex((section) => section.key === "songs_and_dances");
const PUBLIC_DRAFT_KEY = "eventsible:wedding-hero:draft:v1";
const SECTION_RESOURCES: Record<string, ResourceLink[]> = {
  event_basics: [
    { slug: "meeting-companion", title: "Meeting Companion", description: "Keep planning calls focused." },
    { slug: "master-guest-list", title: "Master Guest List", description: "Track RSVPs, tables, and gifts." },
  ],
  ceremony: [
    { slug: "vow-builder", title: "Vow Builder", description: "Turn memories into personal vows." },
    { slug: "song-moment-guide", title: "Ceremony Song Ideas", description: "Find music for every cue." },
  ],
  reception: [
    { slug: "day-of-timeline", title: "Day-of Timeline", description: "Build the master run-of-show." },
  ],
  songs_and_dances: [
    { slug: "song-moment-guide", title: "Song & Moment Guide", description: "Get ideas for entrances, dances, and exits." },
  ],
  music: [
    { slug: "song-moment-guide", title: "Song & Moment Guide", description: "Choose music by feeling and moment." },
  ],
  logistics: [
    { slug: "vendor-tracker", title: "Vendor Tracker", description: "Keep contacts, arrival times, and instructions together." },
    { slug: "day-of-timeline", title: "Day-of Timeline", description: "Coordinate every vendor cue." },
  ],
  services: [
    { slug: "meeting-companion", title: "Meeting Companion", description: "Review every booked experience together." },
  ],
};
const QUESTION_RESOURCES: Record<string, ResourceLink[]> = {
  wedding_vision: [
    { slug: "song-moment-guide", title: "Vibe-to-music guide", description: "Turn the feeling into ceremony, dinner, and dance-floor direction." },
    { slug: "meeting-companion", title: "Planning call prompts", description: "Use a few examples to decide what matters most." },
  ],
  special_considerations: [
    { slug: "meeting-companion", title: "Sensitive details checklist", description: "Think through announcements, surprises, and family dynamics before the day." },
  ],
  ceremony_included: [
    { slug: "meeting-companion", title: "Ceremony planning prompts", description: "A practical way to capture setup, cues, people, and timing." },
  ],
  ceremony_location: [
    { slug: "day-of-timeline", title: "Ceremony timeline helper", description: "Work backward from guest arrival, lineup, and the processional." },
  ],
  ceremony_start_time: [
    { slug: "day-of-timeline", title: "Ceremony timing", description: "Build buffers around arrivals, lineup, photos, and transitions." },
  ],
  cocktail_hour_included: [
    { slug: "day-of-timeline", title: "Cocktail-hour flow", description: "Map the transition from ceremony to dinner without rushing guests." },
  ],
  cocktail_hour_sound: [
    { slug: "song-moment-guide", title: "Cocktail-hour sound", description: "Choose whether this should feel elegant, upbeat, background, or hosted." },
  ],
  cocktail_hour_plan: [
    { slug: "day-of-timeline", title: "Cocktail-hour timing", description: "Coordinate the room flip, photos, bar service, and reception doors." },
  ],
  reception_timeline: [
    { slug: "day-of-timeline", title: "Reception flow builder", description: "Shape introductions, dinner, toasts, dances, and open dancing." },
  ],
};

function answerText(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").join("\n") : String(value ?? "");
}

const PRINTABLE_LIST_TYPES = new Set(["reorderable_people_list", "introduction_list", "speaker_list", "timeline_list", "song_list"]);
const PRINTABLE_LINE = "________________________________________________________________";

function printableRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function printableValue(value: unknown, fallback = PRINTABLE_LINE) {
  if (!answerHasValue(value)) return fallback;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function PrintableFieldLine({ label, value, fallback }: { label: string; value?: unknown; fallback?: string }) {
  return <div className="wedding-print-field"><span>{label}</span><p>{printableValue(value, fallback)}</p></div>;
}

function PrintableQuestion({ question, value }: { question: WeddingQuestion; value: unknown }) {
  const conditionHint = question.condition?.answer ? <span className="wedding-print-if-applicable">If applicable</span> : null;

  if (PRINTABLE_LIST_TYPES.has(question.fieldType)) {
    const primaryKey = question.legacyField ?? question.itemFields?.[0]?.key ?? "name";
    const sourceItems = Array.isArray(value)
      ? value.map((item) => typeof item === "string" ? { [primaryKey]: item } : printableRecord(item))
      : typeof value === "string" && value.trim()
        ? value.split("\n").filter(Boolean).map((item) => ({ [primaryKey]: item }))
        : [];
    const rowCount = Math.max(sourceItems.length, question.defaultRows ?? 1);
    const rows = Array.from({ length: rowCount }, (_, index) => sourceItems[index] ?? {});
    return (
      <div className="wedding-print-question wedding-print-structured">
        <div className="wedding-print-question-heading"><b>{question.label}</b>{conditionHint}</div>
        <div className="wedding-print-modules">
          {rows.map((item, index) => (
            <div className="wedding-print-module" key={`${question.key}-${index}`}>
              <strong>{question.fieldType === "timeline_list" ? "Moment" : question.fieldType === "speaker_list" ? "Speaker" : "Entry"} {index + 1}</strong>
              {(question.itemFields ?? []).map((field) => <PrintableFieldLine key={field.key} label={field.label} value={item[field.key]} />)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (question.fieldType === "song_moment" || question.fieldType === "details_group") {
    const details = typeof value === "string"
      ? { [question.fieldType === "song_moment" ? "songTitle" : "notes"]: value }
      : printableRecord(value);
    const status = details.status === "chosen" ? "Add song" : details.status === "not_sure" ? "Not sure yet" : details.status === "not_doing" ? "Not doing this" : undefined;
    return (
      <div className="wedding-print-question wedding-print-structured">
        <div className="wedding-print-question-heading"><b>{question.label}</b>{conditionHint}</div>
        <div className="wedding-print-fields">
          {question.fieldType === "song_moment" ? <PrintableFieldLine label="Status" value={status} fallback="□ Add song   □ Not sure yet   □ Not doing this" /> : null}
          {(question.fields ?? []).map((field) => <PrintableFieldLine key={field.key} label={field.label} value={details[field.key]} />)}
        </div>
      </div>
    );
  }

  if (question.fieldType === "sensitive_checklist") {
    const source = printableRecord(value);
    const items = Array.isArray(source.items) ? source.items.map(printableRecord) : [];
    return (
      <div className="wedding-print-question wedding-print-structured">
        <div className="wedding-print-question-heading"><b>{question.label}</b>{conditionHint}</div>
        <div className="wedding-print-options">
          {(question.options ?? []).map((option) => {
            const item = items.find((candidate) => candidate.topic === option);
            return <PrintableFieldLine key={option} label={`${item ? "☒" : "☐"} ${option}`} value={item?.notes} />;
          })}
          <PrintableFieldLine label="Other details" value={source.otherNotes} />
        </div>
      </div>
    );
  }

  if (question.fieldType === "service_checklist") {
    const items = Array.isArray(value) ? value.map((item) => typeof item === "string" ? { service: item, status: "booked" } : printableRecord(item)) : [];
    return (
      <div className="wedding-print-question wedding-print-structured">
        <div className="wedding-print-question-heading"><b>{question.label}</b>{conditionHint}</div>
        <div className="wedding-print-modules">
          {(question.options ?? []).map((service) => {
            const item = items.find((candidate) => candidate.service === service);
            const status = item?.status === "booked" ? "Booked" : item?.status === "recommendation" ? "Need recommendation" : item?.status === "considering" ? "Not sure yet" : undefined;
            return (
              <div className="wedding-print-module" key={service}>
                <strong>{service}</strong>
                <PrintableFieldLine label="Status" value={status} fallback="□ Booked   □ Not sure yet   □ Need recommendation" />
                <PrintableFieldLine label="Setup location" value={item?.location} />
                <PrintableFieldLine label="Time needed" value={item?.time} />
                <PrintableFieldLine label="Notes" value={item?.notes} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="wedding-print-question">
      <div className="wedding-print-question-heading"><b>{question.label}</b>{conditionHint}</div>
      <p>{answerHasValue(value) ? formatWeddingAnswer(question, value) : PRINTABLE_LINE}</p>
    </div>
  );
}

function SectionResourceLinks({ sectionKey, compact = false }: { sectionKey: string; compact?: boolean }) {
  const resources = SECTION_RESOURCES[sectionKey] ?? [];
  if (resources.length === 0) return null;

  return (
    <aside className={`wedding-resource-nudges${compact ? " compact" : ""}`} aria-label="Helpful Wedding Hero resources">
      <span>Helpful right now</span>
      <div>
        {resources.map((resource) => (
          <Link href={`/client/wedding/resources/${resource.slug}`} key={resource.slug} target="_blank" rel="noreferrer">
            <b>{resource.title}</b>
            {!compact ? <small>{resource.description}</small> : null}
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}

function QuestionResourceLinks({ questionKey }: { questionKey: string }) {
  const resources = QUESTION_RESOURCES[questionKey] ?? [];
  if (resources.length === 0) return null;

  return (
    <div className="wedding-question-resources">
      {resources.map((resource) => (
        <Link href={`/client/wedding/resources/${resource.slug}`} key={resource.slug} target="_blank" rel="noreferrer">
          <b>{resource.title}</b>
          <small>{resource.description}</small>
        </Link>
      ))}
    </div>
  );
}

export function WeddingQuestionnaire({
  eventId,
  assignmentId,
  initialAnswers,
  initialProgress,
  initialSectionKey,
  initialStatus,
  initialMode = "guided",
  initialPrintView = "planner",
  publicDraft = false,
  supportEmail,
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
  const [printView, setPrintView] = useState<PrintView>(initialPrintView);
  const [draftReady, setDraftReady] = useState(!publicDraft);
  const [resumeSectionIndex, setResumeSectionIndex] = useState(initialIndex);
  const [hasDeviceDraft, setHasDeviceDraft] = useState(false);
  const [contactRequestReceipt, setContactRequestReceipt] = useState<{ requestId: string; createdAt: string } | null>(null);
  const revealAll = shouldRevealAllWeddingQuestions(planningMode);
  const dirtyRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const guidedCardRef = useRef<HTMLElement | null>(null);
  const currentSection = sections[currentIndex];
  const currentGuidedQuestions = useMemo(
    () => currentSection.questions.filter((question) => isQuestionVisible(question, answers)),
    [answers, currentSection],
  );
  const guidedAtStart = currentIndex === 0;
  const guidedAtEnd = currentIndex === sections.length - 1;
  const completedSections = useMemo(() => sections.filter((section) => isSectionComplete(section, answers)).length, [answers]);
  const daySheet = useMemo(() => buildWeddingDaySheet(answers), [answers]);

  useEffect(() => {
    if (!publicDraft) return;

    let restoredAnswers: Record<string, unknown> | null = null;
    let restoredAt: string | null = null;
    let restoredSectionKey: string | null = null;
    let restoredContactReceipt: { requestId: string; createdAt: string } | null = null;
    let restoreMessage = "Saved on this device";
    try {
      const storedDraft = window.localStorage.getItem(PUBLIC_DRAFT_KEY);
      if (storedDraft) {
        const parsed = JSON.parse(storedDraft) as {
          answers?: Record<string, unknown>;
          updatedAt?: string;
          sectionKey?: string;
          contactRequest?: { requestId?: string; createdAt?: string };
        };
        if (parsed.answers && typeof parsed.answers === "object") {
          restoredAnswers = parsed.answers;
          restoredAt = parsed.updatedAt ?? null;
          restoredSectionKey = parsed.sectionKey ?? null;
          restoreMessage = "Draft restored. Continue where you left off or start fresh.";
        }
        if (parsed.contactRequest?.requestId && parsed.contactRequest.createdAt) {
          restoredContactReceipt = { requestId: parsed.contactRequest.requestId, createdAt: parsed.contactRequest.createdAt };
        }
      }
    } catch {
      restoreMessage = "Start anywhere. Your draft will save on this device.";
    }

    const restoreTimer = window.setTimeout(() => {
      if (restoredAnswers) {
        const mergedAnswers = { ...initialAnswers, ...restoredAnswers };
        const resumeKey = guidedResumeSectionKey(mergedAnswers, restoredSectionKey);
        const nextResumeIndex = Math.max(0, sections.findIndex((section) => section.key === resumeKey));
        setAnswers(mergedAnswers);
        setProgress(weddingProgress(mergedAnswers));
        setLastSaved(restoredAt);
        setCurrentIndex(nextResumeIndex);
        setResumeSectionIndex(nextResumeIndex);
        setHasDeviceDraft(true);
      }
      if (restoredContactReceipt) setContactRequestReceipt(restoredContactReceipt);
      setMessage(restoreMessage);
      setDraftReady(true);
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, [initialAnswers, publicDraft]);

  const savePublicDraft = useCallback((sectionKey = currentSection.key, feedbackMessage = "Section saved on this device") => {
    const savedAt = new Date().toISOString();
    const nextProgress = weddingProgress(answers);

    try {
      window.localStorage.setItem(PUBLIC_DRAFT_KEY, JSON.stringify({
        version: 3,
        answers,
        updatedAt: savedAt,
        sectionKey,
        contactRequest: contactRequestReceipt,
      }));
      setProgress(nextProgress);
      setLastSaved(savedAt);
      setSaveState("saved");
      setMessage(feedbackMessage);
      setHasDeviceDraft(true);
      return { ok: true as const, message: feedbackMessage, progress: nextProgress, savedAt };
    } catch {
      setSaveState("error");
      setMessage("This browser could not save the draft. You can still print or save it as a PDF.");
      return { ok: false as const, message: "This browser could not save the draft." };
    }
  }, [answers, contactRequestReceipt, currentSection.key]);

  const sectionCompletion = useMemo(() => sections.map((section) => {
    return isSectionComplete(section, answers);
  }), [answers]);

  const sectionSavedMessage = useCallback((sectionKey: string, currentAnswers: Record<string, unknown>, sectionIndex = currentIndex) => {
    if (sectionKey === "ceremony" && currentAnswers.ceremony_included === true) return "Section saved. Nice, ceremony details are unlocked.";
    if (sectionKey === "reception" && currentAnswers.cocktail_hour_included === true) return "Section saved. Cocktail-hour flow is captured with the reception plan.";
    if (sectionCompletion[sectionIndex]) return "Section saved. Core details are complete.";
    return "Section saved. You can keep moving and fill gaps later.";
  }, [currentIndex, sectionCompletion]);

  const persist = useCallback(async (submit = false, sectionIndex = currentIndex) => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    const section = sections[sectionIndex];
    const sectionAnswers = Object.fromEntries(section.questions.map((question) => [question.key, answers[question.key] ?? null]));
    dirtyRef.current = false;
    setSaveState("saving");
    setMessage(publicDraft ? "Saving this section on this device…" : submit ? "Submitting…" : "Saving this section…");

    const feedbackMessage = sectionSavedMessage(section.key, answers);
    if (publicDraft) return savePublicDraft(section.key, feedbackMessage);
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
      mode: planningMode,
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
    setMessage(submit ? result.message : feedbackMessage);
    return result;
  }, [answers, assignmentId, currentIndex, eventId, planningMode, publicDraft, savePublicDraft, sectionSavedMessage]);

  const persistAll = useCallback(async (submit = false) => {
    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    dirtyRef.current = false;
    setSaveState("saving");
    setMessage(publicDraft ? "Saving on this device…" : submit ? "Submitting…" : "Saving the full form…");

    if (publicDraft) return savePublicDraft(currentSection.key, "Printable draft saved on this device.");
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
        mode: planningMode,
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
  }, [answers, assignmentId, currentSection.key, eventId, planningMode, publicDraft, savePublicDraft]);

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

  function updateAnswer(key: string, value: unknown) {
    dirtyRef.current = true;
    setSaveState("dirty");
    const unlockMessage = key === "ceremony_included" && value === true
      ? "Nice, ceremony details unlocked."
      : key === "cocktail_hour_included" && value === true
        ? "Great, cocktail-hour details opened."
        : key === "rehearsal_needed" && value === true
          ? "Rehearsal notes are ready when you are."
          : "Unsaved changes";
    setMessage(unlockMessage);
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function scrollGuidedCardIntoView() {
    window.requestAnimationFrame(() => {
      guidedCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function moveGuided(direction: -1 | 1) {
    if (direction === 1 || dirtyRef.current) {
      const result = await persist(false);
      if (!result.ok) return;
    }

    if (direction === 1 && currentIndex < sections.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (direction === -1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
    scrollGuidedCardIntoView();
  }

  async function goToSection(sectionIndex: number) {
    if (planningMode === "form") {
      document.getElementById(`wedding-section-${sections[sectionIndex].key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (sectionIndex === currentIndex) return;
    if (dirtyRef.current) {
      const result = await persist(false);
      if (!result.ok) return;
    }
    setCurrentIndex(sectionIndex);
    scrollGuidedCardIntoView();
  }

  function continueDeviceDraft() {
    setCurrentIndex(resumeSectionIndex);
    setPlanningMode("guided");
    window.history.replaceState(null, "", `${window.location.pathname}?mode=guided`);
    scrollGuidedCardIntoView();
  }

  function clearDeviceDraft() {
    if (!publicDraft) return;
    const confirmed = window.confirm("Start fresh on this device? This only clears the local Wedding Hero draft saved in this browser. Online or private plans are not affected.");
    if (!confirmed) return;
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    window.localStorage.removeItem(PUBLIC_DRAFT_KEY);
    dirtyRef.current = false;
    setAnswers(initialAnswers);
    setProgress(weddingProgress(initialAnswers));
    setLastSaved(null);
    setCurrentIndex(0);
    setResumeSectionIndex(0);
    setHasDeviceDraft(false);
    setContactRequestReceipt(null);
    setSaveState("saved");
    setMessage("Device draft cleared. Online or private plans were not changed.");
  }

  async function submit() {
    const result = planningMode === "form" ? await persistAll(!publicDraft) : await persist(!publicDraft);
    if (!result.ok) return;
    if (publicDraft) {
      setPrintView("planner");
      setPlanningMode("print");
      window.history.replaceState(null, "", `${window.location.pathname}?mode=print`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function chooseMode(mode: PlanningMode) {
    if (mode === planningMode && (mode !== "print" || printView === "planner")) return;
    if (dirtyRef.current) {
      const result = planningMode === "form" ? await persistAll(false) : await persist(false);
      if (!result.ok) return;
    }
    if (mode === "print") setPrintView("planner");
    setPlanningMode(mode);
    window.history.replaceState(null, "", `${window.location.pathname}?mode=${mode}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function openDayOfSheet() {
    if (dirtyRef.current) {
      const result = planningMode === "form" ? await persistAll(false) : await persist(false);
      if (!result.ok) return;
    }
    setPrintView("day-of");
    setPlanningMode("print");
    window.history.replaceState(null, "", `${window.location.pathname}?mode=print&view=day-of`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function changePrintView(view: PrintView) {
    setPrintView(view);
    const suffix = view === "day-of" ? "&view=day-of" : "";
    window.history.replaceState(null, "", `${window.location.pathname}?mode=print${suffix}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function recordContactRequest(receipt: { requestId: string; createdAt: string }) {
    setContactRequestReceipt(receipt);
    if (!publicDraft) return;
    const savedAt = new Date().toISOString();
    try {
      const stored = window.localStorage.getItem(PUBLIC_DRAFT_KEY);
      const previous = stored ? JSON.parse(stored) as Record<string, unknown> : {};
      window.localStorage.setItem(PUBLIC_DRAFT_KEY, JSON.stringify({
        ...previous,
        version: 3,
        answers,
        updatedAt: savedAt,
        sectionKey: currentSection.key,
        contactRequest: receipt,
      }));
      setLastSaved(savedAt);
      setHasDeviceDraft(true);
    } catch {
      setMessage("Your callback request was sent, but its receipt could not be saved on this device.");
    }
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

      <WeddingHeroContact
        supportEmail={supportEmail}
        mode={planningMode}
        source={publicDraft ? "public_planner" : "private_plan"}
        eventId={eventId}
        assignmentId={assignmentId}
        coupleNames={[answerText(answers.partner_one_name), answerText(answers.partner_two_name)].filter(Boolean).join(" & ")}
        eventDate={answerText(answers.event_date)}
        progress={progress}
        initialName={answerText(answers.day_of_contact)}
        initialPhone={answerText(answers.day_of_contact_phone)}
        onRequestRecorded={recordContactRequest}
      />

      {planningMode === "print" ? (
        <main className="wedding-print-workspace">
          <header className="wedding-print-controls">
            <div>
              <span className="wedding-kicker">{printView === "day-of" ? "Wedding Hero production output" : "Printable Wedding Hero"}</span>
              <h2>{printView === "day-of" ? "The essentials for wedding day." : "Take the planner offline."}</h2>
              <p>{printView === "day-of" ? "A concise production sheet built from the answers already entered. Review any missing confirmations, then print it or save a PDF for the couple, planner, venue, or wedding party." : "Print the answers you have already entered, with writing space left wherever a question is still blank. You can also save this page as a PDF and send it to EVENTSible."}</p>
            </div>
            <div className="wedding-print-actions">
              <button type="button" className="wedding-print-switch" onClick={() => changePrintView(printView === "day-of" ? "planner" : "day-of")}>{printView === "day-of" ? "View full planner" : "View Day-of Cheat Sheet"}</button>
              <button type="button" className="wedding-print-button" onClick={() => window.print()}>{printView === "day-of" ? "Print or save Cheat Sheet PDF" : "Print or save as PDF"}</button>
            </div>
          </header>
          {printView === "day-of" ? (
            <div className="wedding-print-sheet wedding-day-sheet">
              <header><b>EVENTSIBLE WEDDING HERO</b><span>Day-of Production Cheat Sheet</span></header>
              <div className="wedding-day-sheet-title">
                <span>Wedding day production sheet</span>
                <h2>{daySheet.coupleName}</h2>
                {daySheet.eventDate ? <p>{daySheet.eventDate}</p> : null}
              </div>
              {daySheet.missing.length > 0 ? (
                <aside className="wedding-day-missing">
                  <b>Still needs confirmation</b>
                  <p>{daySheet.missing.join(" · ")}</p>
                </aside>
              ) : (
                <aside className="wedding-day-ready"><b>Core production details are ready.</b><span>Do one final review with the couple and planning team before event day.</span></aside>
              )}
              <div className="wedding-day-sections">
                {daySheet.sections.map((section: { title: string; items: Array<{ label: string; value: string }> }) => (
                  <section key={section.title}>
                    <h3>{section.title}</h3>
                    <dl>
                      {section.items.map((item) => (
                        <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                      ))}
                    </dl>
                  </section>
                ))}
              </div>
              <footer><b>EVENTSible · Excellence in Event Entertainment</b><span>{lastSaved ? `Draft saved ${new Date(lastSaved).toLocaleString()}` : "Generated from the current Wedding Hero draft"}</span></footer>
            </div>
          ) : (
            <div className="wedding-print-sheet">
              <header><b>EVENTSIBLE WEDDING HERO</b><span>Interactive Wedding Companion · Printable Planner</span></header>
              {sections.map((section) => (
                <section key={section.key}>
                  <h3>{section.title}</h3>
                  {section.questions.filter((question) => isQuestionVisible(question, answers, revealAll)).map((question) => (
                    <PrintableQuestion question={question} value={answers[question.key]} key={question.key} />
                  ))}
                </section>
              ))}
            </div>
          )}
        </main>
      ) : (
        <div className={`wedding-workspace${planningMode === "form" ? " full-form-mode" : ""}`}>
      <aside className="wedding-sections" aria-label="Wedding Hero planning sections">
        <div className="wedding-progress-card">
          <span>Planning progress</span>
          <b>{progress}%</b>
          <div className="wedding-progress"><span style={{ width: `${progress}%` }} /></div>
          <small>{message}{lastSaved ? ` · ${new Date(lastSaved).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}</small>
          {publicDraft ? (
            <div className="wedding-draft-actions">
              {hasDeviceDraft ? <button type="button" onClick={continueDeviceDraft}>Continue where you left off</button> : null}
              <button type="button" onClick={clearDeviceDraft}>Start fresh</button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="wedding-song-shortcut"
          onClick={() => void goToSection(songsSectionIndex)}
        >
          <span aria-hidden="true">♫</span>
          <div><b>Songs & Special Dances</b><small>Jump straight to the soundtrack</small></div>
        </button>
        <button type="button" className="wedding-output-shortcut" onClick={() => void openDayOfSheet()}>
          <span aria-hidden="true">✓</span>
          <div><b>Day-of Cheat Sheet</b><small>Print the production essentials</small></div>
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

      {planningMode === "guided" ? <main className="wedding-form-card wedding-guided-card" ref={guidedCardRef} style={{ scrollMarginTop: 18 }}>
        <header>
          <div className="wedding-guided-heading">
            <div>
              <span className="eyebrow">Guided section · {completedSections} of {sections.length} complete</span>
              <h2>{currentSection.title}</h2>
              <p>{currentSection.description}</p>
            </div>
            <span className="wedding-guided-count">{currentIndex + 1}<small>of {sections.length}</small></span>
          </div>
          <div className="wedding-guided-progress" aria-label={`Section ${currentIndex + 1} of ${sections.length}`}>
            <span style={{ width: `${((currentIndex + 1) / Math.max(1, sections.length)) * 100}%` }} />
          </div>
        </header>

        <div className="wedding-guided-prompt">
          <div className="wedding-guided-section-intro">
            <span className="wedding-kicker">{sectionCompletion[currentIndex] ? "Core details complete" : "Fill what you know"}</span>
            <small>Each section saves together. Skip unknowns, use the idea chips, and let conditional details unfold only when they matter.</small>
          </div>
          <div className="wedding-guided-section-flow">
            {currentGuidedQuestions.length > 0 ? currentGuidedQuestions.map((question) => (
              <div className={`wedding-question-card${isStructuredWeddingField(question.fieldType) ? " structured-shell" : ""}${question.condition?.answer ? " unfolding" : ""}`} key={question.key}>
                <QuestionField
                  question={question}
                  value={answers[question.key]}
                  onChange={(value) => updateAnswer(question.key, value)}
                />
              </div>
            )) : <p>This section is ready. Continue to the next part of your wedding.</p>}
          </div>
          <small className="wedding-guided-help">Wedding Hero keeps this professional for the production team while still helping you think through the day like humans.</small>
          <SectionResourceLinks sectionKey={currentSection.key} compact />
        </div>

        {saveState === "error" ? <div className="wedding-save-error">{message}</div> : null}

        <footer className="wedding-form-actions">
          <button type="button" className="secondary-button" disabled={guidedAtStart || saveState === "saving"} onClick={() => void moveGuided(-1)}>Back</button>
          <button type="button" className="secondary-button" disabled={saveState === "saving"} onClick={() => void persist(false)}>
            {saveState === "saving" ? "Saving…" : "Save for later"}
          </button>
          {!guidedAtEnd ? (
            <button type="button" className="primary-button" disabled={saveState === "saving"} onClick={() => void moveGuided(1)}>{sectionCompletion[currentIndex] ? "Next section" : "Save section and continue"}</button>
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
              <SectionResourceLinks sectionKey={section.key} />
              <div className="wedding-question-list">
                {section.questions.filter((question) => isQuestionVisible(question, answers, revealAll)).map((question) => (
                  <QuestionField key={question.key} question={question} value={answers[question.key]} onChange={(value) => updateAnswer(question.key, value)} revealAll={revealAll} />
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

function QuestionField({ question, value, onChange, revealAll = false }: { question: WeddingQuestion; value: unknown; onChange: (value: unknown) => void; revealAll?: boolean }) {
  const id = `wedding-${question.key}`;
  const label = <><span>{question.label}{question.required ? <b className="required-mark"> *</b> : null}{revealAll && question.condition?.answer ? <em> If applicable</em> : null}</span>{question.helpText ? <small>{question.helpText}</small> : null}</>;
  const promptIdeas = question.promptIdeas ?? [];

  function addPromptIdea(idea: string) {
    if (question.fieldType === "repeater") {
      const currentItems = Array.isArray(value) ? value.map(String).filter(Boolean) : answerText(value).split("\n").filter(Boolean);
      onChange([...currentItems, idea]);
      return;
    }
    const currentText = answerText(value).trim();
    onChange(currentText ? `${currentText}\n${idea}` : idea);
  }

  const promptChips = promptIdeas.length > 0 ? (
    <div className="wedding-prompt-chips" aria-label={`Starter ideas for ${question.label}`}>
      {promptIdeas.map((idea) => (
        <button type="button" key={idea} onClick={() => addPromptIdea(idea)}>{idea}</button>
      ))}
    </div>
  ) : null;

  if (isStructuredWeddingField(question.fieldType)) {
    return <><StructuredWeddingField question={question} value={value} onChange={onChange} revealAll={revealAll} /><QuestionResourceLinks questionKey={question.key} /></>;
  }

  if (question.fieldType === "yes_no") {
    return (
      <fieldset className="wedding-question yes-no">
        <legend>{label}</legend>
        <div>
          {[{ label: "Yes", value: true }, { label: "No", value: false }].map((option) => (
            <button type="button" aria-pressed={value === option.value} className={value === option.value ? "selected" : ""} key={option.label} onClick={() => onChange(option.value)}>{option.label}</button>
          ))}
        </div>
        <QuestionResourceLinks questionKey={question.key} />
      </fieldset>
    );
  }

  if (question.fieldType === "tri_state") {
    const options = [
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
      { label: "We'll add this later", value: "unsure" },
    ];
    return (
      <fieldset className="wedding-question yes-no wedding-tri-state">
        <legend>{label}</legend>
        <div>
          {options.map((option) => (
            <button type="button" aria-pressed={value === option.value} className={value === option.value ? "selected" : ""} key={option.value} onClick={() => onChange(option.value)}>{option.label}</button>
          ))}
        </div>
        <QuestionResourceLinks questionKey={question.key} />
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
        <QuestionResourceLinks questionKey={question.key} />
      </fieldset>
    );
  }

  if (question.fieldType === "single_select") {
    return (
      <div className="wedding-question">
        <label htmlFor={id}>{label}</label>
        <select id={id} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>
          <option value="">Choose one</option>
          {(question.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <QuestionResourceLinks questionKey={question.key} />
      </div>
    );
  }

  if (question.fieldType === "long_text" || question.fieldType === "repeater") {
    return (
      <div className="wedding-question">
        <label htmlFor={id}>{label}</label>
        <textarea
          id={id}
          rows={question.fieldType === "repeater" ? 5 : 4}
          value={answerText(value)}
          onChange={(event) => onChange(question.fieldType === "repeater" ? event.target.value.split("\n") : event.target.value)}
          placeholder={question.fieldType === "repeater" ? "One item per line" : "Share the details here"}
        />
        {promptChips}
        <QuestionResourceLinks questionKey={question.key} />
      </div>
    );
  }

  const inputType = question.fieldType === "number" ? "number"
    : question.fieldType === "time" ? "time"
      : question.fieldType === "date" ? "date"
      : question.fieldType === "phone" ? "tel"
        : "text";
  return (
    <div className="wedding-question">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type={inputType}
        min={inputType === "number" ? 0 : undefined}
        value={answerText(value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={question.fieldType === "song" ? "Song title and artist" : undefined}
      />
      <QuestionResourceLinks questionKey={question.key} />
    </div>
  );
}
