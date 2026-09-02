"use client";

import { useActionState, useRef, useState } from "react";

export type EventDayLogisticsActionState = {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string>;
};

type LogisticsValues = {
  staff_call_time: string;
  setup_start: string;
  room_area: string;
  load_in_details: string;
};

type Props = {
  eventId: string;
  initialValues: LogisticsValues;
  action: (state: EventDayLogisticsActionState, formData: FormData) => Promise<EventDayLogisticsActionState>;
};

const INITIAL_STATE: EventDayLogisticsActionState = { status: "idle", message: "" };

function FieldError({ field, message }: { field: string; message?: string }) {
  return message ? <small className="field-error" id={`${field}-error`}>{message}</small> : null;
}

export function EventDayLogisticsEditor({ eventId, initialValues, action }: Props) {
  const [editing, setEditing] = useState(false);
  async function submitLogistics(state: EventDayLogisticsActionState, formData: FormData) {
    const nextState = await action(state, formData);
    if (nextState.status === "success") setEditing(false);
    return nextState;
  }
  const [state, formAction, pending] = useActionState(submitLogistics, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const hydrationKey = Object.values(initialValues).join("|");

  function cancel() {
    formRef.current?.reset();
    setEditing(false);
  }

  return <div className="operational-editor logistics-editor">
    <div className="operational-editor-heading">
      <p>Staff call and setup start are event-local clock times. Blank fields preserve existing values.</p>
      <button className="secondary-button" type="button" onClick={() => setEditing((current) => !current)} aria-expanded={editing} aria-controls="event-day-logistics-form">{editing ? "Close editor" : "Edit logistics"}</button>
    </div>
    {state.message ? <p className={state.status === "error" ? "operational-message error" : "operational-message success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
    {editing ? <form action={formAction} className="operational-form logistics-form" id="event-day-logistics-form" key={hydrationKey} ref={formRef}>
      <input name="event_id" type="hidden" value={eventId} />
      <div className="operational-form-grid">
        <label><span>Staff call</span><input aria-describedby={state.errors?.staff_call_time ? "staff_call_time-error" : undefined} aria-invalid={Boolean(state.errors?.staff_call_time)} defaultValue={initialValues.staff_call_time} name="staff_call_time" type="time" /><FieldError field="staff_call_time" message={state.errors?.staff_call_time} /></label>
        <label><span>Setup start</span><input aria-describedby={state.errors?.setup_start ? "setup_start-error" : undefined} aria-invalid={Boolean(state.errors?.setup_start)} defaultValue={initialValues.setup_start} name="setup_start" type="time" /><FieldError field="setup_start" message={state.errors?.setup_start} /></label>
        <label><span>Room / area</span><input aria-describedby={state.errors?.room_area ? "room_area-error" : undefined} aria-invalid={Boolean(state.errors?.room_area)} defaultValue={initialValues.room_area} maxLength={160} name="room_area" type="text" /><FieldError field="room_area" message={state.errors?.room_area} /></label>
        <label className="logistics-notes"><span>Load-in / access notes</span><textarea aria-describedby={state.errors?.load_in_details ? "load_in_details-error" : undefined} aria-invalid={Boolean(state.errors?.load_in_details)} defaultValue={initialValues.load_in_details} maxLength={1500} name="load_in_details" rows={5} /><FieldError field="load_in_details" message={state.errors?.load_in_details} /></label>
      </div>
      <p className="workspace-help">Removing a recorded value is intentionally not part of this slice.</p>
      <div className="operational-form-actions"><button className="primary-button" disabled={pending} type="submit">{pending ? "Saving…" : "Save logistics"}</button><button className="secondary-button" disabled={pending} type="button" onClick={cancel}>Cancel</button></div>
    </form> : null}
  </div>;
}
