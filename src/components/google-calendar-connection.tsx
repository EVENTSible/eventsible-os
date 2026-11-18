import { connectGoogleAction, disconnectGoogleAction, selectGoogleCalendarsAction, syncGoogleCalendarsAction } from '@/app/admin/calendar/google/actions';

type Source = { calendar_id: string; label: string; selected: boolean; share_busy: boolean; last_successful_sync_at: string | null };
type Settings = { configured: boolean; connected: boolean; sources: Source[]; status: string; lastSync: string | null };

export function GoogleCalendarConnection({ settings }: { settings: Settings }) {
  return <details className="calendar-owner-tools">
    <summary><span>Google Calendar</span><small>{settings.connected ? `Connected${settings.lastSync ? `, last synced ${new Date(settings.lastSync).toLocaleString('en-US')}` : ', not synced yet'}` : settings.configured ? 'Not connected' : 'Setup pending'}</small></summary>
    <div className="calendar-owner-tools-content">
      <section className="calendar-owner-panel panel">
        <h2>External calendar connection</h2>
        <p>Google entries are read only. Syncing does not create EVENTSible gigs or change bookings.</p>
        {!settings.configured ? <p>Google OAuth or the calendar schema is not configured in this environment.</p> : null}
        {settings.status === 'reauthorize' ? <p role="alert">Google access expired. Reconnect to resume sync.</p> : null}
        {settings.configured && (!settings.connected || settings.status === 'reauthorize') ? <form action={connectGoogleAction}><button className="primary-button" type="submit">Connect Google Calendar</button></form> : null}
        {settings.connected ? <>
          <form action={selectGoogleCalendarsAction}>
            <fieldset><legend>Calendars HQ may read</legend>{settings.sources.map(source => <div key={source.calendar_id}>
              <label><input type="checkbox" name="calendar_id" value={source.calendar_id} defaultChecked={source.selected} /> {source.label}</label>
              <label><input type="checkbox" name="share_busy" value={source.calendar_id} defaultChecked={source.share_busy} /> Show busy time to staff</label>
            </div>)}</fieldset>
            <p>Staff see busy time only on calendars you share. Titles, addresses and descriptions remain Owner only.</p>
            <button className="secondary-button" type="submit">Save calendar selection</button>
          </form>
          <form action={syncGoogleCalendarsAction}><button className="primary-button" type="submit">Sync Now</button></form>
          <form action={disconnectGoogleAction}><button className="secondary-button" type="submit">Disconnect Google Calendar</button></form>
        </> : null}
      </section>
    </div>
  </details>;
}
