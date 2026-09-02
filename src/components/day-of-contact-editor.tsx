"use client";

import { useActionState, useState } from "react";

export type DayOfContactActionState = {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string>;
};

type ContactOption = { id: string; label: string; isPrimary: boolean };

type Props = {
  eventId: string;
  initialContactId: string;
  primaryContactId: string;
  contacts: ContactOption[];
  action: (state: DayOfContactActionState, formData: FormData) => Promise<DayOfContactActionState>;
};

const INITIAL_STATE: DayOfContactActionState = { status: "idle", message: "" };

export function DayOfContactEditor({ eventId, initialContactId, primaryContactId, contacts, action }: Props) {
  const [editing, setEditing] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState(initialContactId);

  async function submitContact(state: DayOfContactActionState, formData: FormData) {
    const nextState = await action(state, formData);
    if (nextState.status === "success") setEditing(false);
    return nextState;
  }

  const [state, formAction, pending] = useActionState(submitContact, INITIAL_STATE);

  function cancel() {
    setSelectedContactId(initialContactId);
    setEditing(false);
  }

  return <div className="operational-editor day-of-contact-editor">
    <div className="operational-editor-heading">
      <p>Select an existing canonical OS contact. Name and phone stay owned by that contact record.</p>
      <button className="secondary-button" type="button" onClick={() => setEditing((current) => !current)} aria-expanded={editing} aria-controls="day-of-contact-form">{editing ? "Close editor" : "Edit day-of contact"}</button>
    </div>
    {state.message ? <p className={state.status === "error" ? "operational-message error" : "operational-message success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
    {editing ? <form action={formAction} className="operational-form" id="day-of-contact-form">
      <input name="event_id" type="hidden" value={eventId} />
      <label>
        <span>Day-of contact</span>
        <select aria-describedby={state.errors?.day_of_contact_id ? "day_of_contact_id-error" : undefined} aria-invalid={Boolean(state.errors?.day_of_contact_id)} name="day_of_contact_id" required value={selectedContactId} onChange={(event) => setSelectedContactId(event.target.value)}>
          <option value="">Choose an existing contact</option>
          {contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.label}</option>)}
        </select>
        {state.errors?.day_of_contact_id ? <small className="field-error" id="day_of_contact_id-error">{state.errors.day_of_contact_id}</small> : null}
      </label>
      {primaryContactId ? <button className="secondary-button day-of-primary-shortcut" disabled={pending} type="button" onClick={() => setSelectedContactId(primaryContactId)}>Use Primary Client as Day-Of Contact</button> : null}
      <p className="workspace-help">Creating a contact or removing an assignment is intentionally not part of this slice.</p>
      <div className="operational-form-actions"><button className="primary-button" disabled={pending || !selectedContactId} type="submit">{pending ? "Saving…" : "Save day-of contact"}</button><button className="secondary-button" disabled={pending} type="button" onClick={cancel}>Cancel</button></div>
    </form> : null}
  </div>;
}
