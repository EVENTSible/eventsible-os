"use client";

import { useActionState, useRef, useState } from "react";

export type OperationalTimingActionState = {
  status: "idle" | "success" | "error";
  message: string;
  errors?: Record<string, string>;
};

type TimingValues = {
  arrival_time: string;
  load_in_start: string;
  load_in_end: string;
  setup_complete_by: string;
  breakdown_start: string;
  must_be_out: string;
};

type Props = {
  eventId: string;
  initialValues: TimingValues;
  action: (state: OperationalTimingActionState, formData: FormData) => Promise<OperationalTimingActionState>;
};

const INITIAL_STATE: OperationalTimingActionState = { status: "idle", message: "" };

function TimeField({ name, label, value, error }: { name: keyof TimingValues; label: string; value: string; error?: string }) {
  return <label><span>{label}</span><input aria-describedby={error ? `${name}-error` : undefined} aria-invalid={Boolean(error)} defaultValue={value} name={name} type="time" />{error ? <small className="field-error" id={`${name}-error`}>{error}</small> : null}</label>;
}

export function OperationalTimingEditor({ eventId, initialValues, action }: Props) {
  const [editing, setEditing] = useState(false);
  async function submitTiming(state: OperationalTimingActionState, formData: FormData) {
    const nextState = await action(state, formData);
    if (nextState.status === "success") setEditing(false);
    return nextState;
  }
  const [state, formAction, pending] = useActionState(submitTiming, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const hydrationKey = Object.values(initialValues).join("|");

  function cancel() {
    formRef.current?.reset();
    setEditing(false);
  }

  return <div className="operational-editor">
    <div className="operational-editor-heading">
      <p>Times are stored as event-local clock times and are never shifted automatically.</p>
      <button className="secondary-button" type="button" onClick={() => setEditing((current) => !current)} aria-expanded={editing} aria-controls="operational-timing-form">{editing ? "Close editor" : "Edit times"}</button>
    </div>
    {state.message ? <p className={state.status === "error" ? "operational-message error" : "operational-message success"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p> : null}
    {editing ? <form action={formAction} className="operational-form" id="operational-timing-form" key={hydrationKey} ref={formRef}>
      <input name="event_id" type="hidden" value={eventId} />
      <div className="operational-form-grid">
        <TimeField name="arrival_time" label="Arrival time" value={initialValues.arrival_time} error={state.errors?.arrival_time} />
        <fieldset><legend>Load-in</legend><div className="load-in-fields"><TimeField name="load_in_start" label="Start" value={initialValues.load_in_start} error={state.errors?.load_in_start} /><TimeField name="load_in_end" label="End (optional)" value={initialValues.load_in_end} error={state.errors?.load_in_end} /></div></fieldset>
        <TimeField name="setup_complete_by" label="Setup complete by" value={initialValues.setup_complete_by} error={state.errors?.setup_complete_by} />
        <TimeField name="breakdown_start" label="Breakdown" value={initialValues.breakdown_start} error={state.errors?.breakdown_start} />
        <TimeField name="must_be_out" label="Must be out by" value={initialValues.must_be_out} error={state.errors?.must_be_out} />
      </div>
      <p className="workspace-help">Blank inputs preserve the existing value. Removing a recorded time is intentionally not part of this slice.</p>
      <div className="operational-form-actions"><button className="primary-button" disabled={pending} type="submit">{pending ? "Saving…" : "Save times"}</button><button className="secondary-button" disabled={pending} type="button" onClick={cancel}>Cancel</button></div>
    </form> : null}
  </div>;
}
