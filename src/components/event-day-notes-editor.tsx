"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_DAY_NOTE_BODY_LIMIT } from "@/lib/event-day-notes.mjs";

export type EventDayNoteActionState = {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string>;
};

export type EventDayNote = {
  id: string;
  body: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

type Props = {
  eventId: string;
  notes: EventDayNote[];
  loadFailed?: boolean;
  action: (state: EventDayNoteActionState, formData: FormData) => Promise<EventDayNoteActionState>;
};

const INITIAL_STATE: EventDayNoteActionState = { status: "idle", message: "" };

function NoteForm({ eventId, note, action, onClose }: {
  eventId: string;
  note?: EventDayNote;
  action: Props["action"];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pinned, setPinned] = useState(Boolean(note?.is_pinned));
  const formRef = useRef<HTMLFormElement>(null);

  async function submitNote(state: EventDayNoteActionState, formData: FormData) {
    const nextState = await action(state, formData);
    if (nextState.status === "success") {
      router.refresh();
      onClose();
    }
    return nextState;
  }

  const [state, formAction, pending] = useActionState(submitNote, INITIAL_STATE);

  function cancel() {
    formRef.current?.reset();
    setPinned(Boolean(note?.is_pinned));
    onClose();
  }

  return <form action={formAction} className="operational-form event-day-note-form" ref={formRef}>
    <input name="event_id" type="hidden" value={eventId} />
    <input name="note_id" type="hidden" value={note?.id ?? ""} />
    <input name="is_pinned" type="hidden" value={pinned ? "true" : "false"} />
    <label>
      <span>{note ? "Event-day note" : "New event-day note"}</span>
      <textarea aria-describedby={state.errors?.body ? `${note?.id ?? "new"}-note-error` : undefined} aria-invalid={Boolean(state.errors?.body)} defaultValue={note?.body ?? ""} maxLength={EVENT_DAY_NOTE_BODY_LIMIT} name="body" required rows={4} />
      {state.errors?.body ? <small className="field-error" id={`${note?.id ?? "new"}-note-error`}>{state.errors.body}</small> : null}
      <small>{EVENT_DAY_NOTE_BODY_LIMIT.toLocaleString("en-US")} characters maximum. Staff-private plain text only.</small>
    </label>
    <button className="secondary-button note-pin-toggle" disabled={pending} type="button" onClick={() => setPinned((current) => !current)} aria-pressed={pinned}>{pinned ? "Unpin note" : "Pin note"}</button>
    {state.message ? <p className={state.status === "error" ? "operational-message error" : "operational-message success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
    <div className="operational-form-actions"><button className="primary-button" disabled={pending} type="submit">{pending ? "Saving…" : note ? "Save note" : "Add note"}</button><button className="secondary-button" disabled={pending} type="button" onClick={cancel}>Cancel</button></div>
  </form>;
}

function NoteCard({ eventId, note, action }: { eventId: string; note: EventDayNote; action: Props["action"] }) {
  const [editing, setEditing] = useState(false);
  return <article className={note.is_pinned ? "event-day-note pinned" : "event-day-note"}>
    <div className="event-day-note-heading"><div>{note.is_pinned ? <span className="note-pin">Pinned</span> : <span className="note-standard">Event-day note</span>}</div><button className="secondary-button" type="button" onClick={() => setEditing((current) => !current)} aria-expanded={editing}>{editing ? "Close editor" : "Edit"}</button></div>
    <p>{note.body}</p>
    {editing ? <NoteForm action={action} eventId={eventId} note={note} onClose={() => setEditing(false)} /> : null}
  </article>;
}

export function EventDayNotesEditor({ eventId, notes, loadFailed = false, action }: Props) {
  const [adding, setAdding] = useState(false);

  return <div className="event-day-notes-editor">
    <div className="operational-editor-heading"><p>Pinned notes stay first. Notes are staff-private and do not change readiness.</p><button className="secondary-button" type="button" onClick={() => setAdding((current) => !current)} aria-expanded={adding}>{adding ? "Close editor" : "Add Note"}</button></div>
    {loadFailed ? <p className="workspace-empty">Event-day notes could not be loaded. No note state is assumed.</p> : notes.length ? <div className="event-day-notes-list">{notes.map((note) => <NoteCard action={action} eventId={eventId} key={note.id} note={note} />)}</div> : <p className="workspace-empty">No active staff event-day notes are recorded.</p>}
    {adding ? <NoteForm action={action} eventId={eventId} onClose={() => setAdding(false)} /> : null}
  </div>;
}
