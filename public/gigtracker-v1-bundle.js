const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = new URL('./gigtracker-v1.css', import.meta.url).href;
document.head.appendChild(css);
document.title = 'EVENTSible OS';

document.body.innerHTML = `
<section id="login" class="login-shell">
  <div class="login-copy">
    <div class="wordmark">EVENTS<b>i</b>BLE</div>
    <div>
      <span class="eyebrow light">Excellence in Event Entertainment</span>
      <h1>One place to run every unforgettable event.</h1>
      <p>Quotes, bookings, Wedding Hero, Event Hero, client planning, communications, and event-day readiness—connected through one secure EVENTSible operating system.</p>
    </div>
    <div class="feature-row"><span>GigTracker</span><span>Wedding Hero</span><span>Event Hero</span><span>Client Portals</span></div>
  </div>
  <div class="login-panel-wrap">
    <div class="login-panel">
      <span class="eyebrow">Secure access</span>
      <h2>Welcome back</h2>
      <p>Enter your approved business email and we’ll send a one-time sign-in link.</p>
      <form id="login-form">
        <label for="email">Business email</label>
        <input id="email" type="email" required autocomplete="email" value="thepartys@eventsible.info">
        <button class="primary wide" type="submit">Email my sign-in link</button>
      </form>
      <div id="login-message" class="message hidden"></div>
    </div>
  </div>
</section>

<section id="dashboard" class="app hidden">
  <aside class="sidebar">
    <div>
      <div class="wordmark">EVENTS<b>i</b>BLE</div>
      <small>Operating System</small>
    </div>
    <nav id="main-nav">
      <button class="nav-link active" data-view="overview">Overview</button>
      <button class="nav-link" data-view="events">Events</button>
      <button class="nav-link" data-view="new-event">New event</button>
      <button class="nav-link" data-view="import">Import gigs</button>
      <button class="nav-link" data-view="heroes">Wedding & Event Hero</button>
      <button class="nav-link" data-view="automations">Automations</button>
    </nav>
    <div class="sidebar-foot">
      <span id="role" class="role">Owner</span>
      <button id="logout" class="secondary inverse">Sign out</button>
    </div>
  </aside>

  <main>
    <div id="global-error" class="error-box hidden"></div>
    <div id="toast" class="toast hidden"></div>

    <section class="view" data-view-panel="overview">
      <header class="topbar">
        <div><span class="eyebrow">Owner dashboard</span><h1>Good to see you, Travis.</h1><p>Here is the current pulse of EVENTSible.</p></div>
        <div class="actions"><button class="secondary" data-go="import">Import gigs</button><button class="primary" data-go="new-event">New event</button></div>
      </header>
      <section class="metrics">
        <article class="metric"><span>Active leads</span><b id="m-leads">0</b><small>Builder and direct inquiries</small></article>
        <article class="metric"><span>Booked events</span><b id="m-booked">0</b><small>Confirmed in the system</small></article>
        <article class="metric"><span>Planning now</span><b id="m-planning">0</b><small>Hero work in progress</small></article>
        <article class="metric"><span>Needs attention</span><b id="m-attention">0</b><small>Payments, contracts, or help</small></article>
      </section>
      <section class="grid">
        <article class="panel">
          <div class="panel-head"><div><span class="eyebrow">GigTracker</span><h2>Upcoming events</h2></div><button class="text-button" data-go="events">View all</button></div>
          <div id="overview-events"></div>
        </article>
        <div class="stack">
          <article class="panel"><div class="panel-head"><div><span class="eyebrow">Hero center</span><h2>Planning progress</h2></div></div><div class="mini"><span>Wedding Hero</span><b id="wedding-count">0</b></div><div class="mini"><span>Event Hero</span><b id="event-count">0</b></div></article>
          <article class="panel"><div class="panel-head"><div><span class="eyebrow">Recent imports</span><h2>CSV activity</h2></div></div><div id="recent-imports" class="compact-list"></div></article>
        </div>
      </section>
    </section>

    <section class="view hidden" data-view-panel="events">
      <header class="topbar"><div><span class="eyebrow">GigTracker</span><h1>Events</h1><p>Search, filter, inspect, and update every gig in the shared system.</p></div><div class="actions"><button class="secondary" data-go="import">Import CSV</button><button class="primary" data-go="new-event">Add event</button></div></header>
      <article class="panel">
        <div class="filter-bar">
          <input id="event-search" type="search" placeholder="Search client, event, venue, or service…">
          <select id="event-status-filter"><option value="">All statuses</option><option>inquiry</option><option>quoted</option><option>pending</option><option>booked</option><option>planning</option><option>ready</option><option>active</option><option>completed</option><option>cancelled</option></select>
          <select id="event-type-filter"><option value="">All event types</option></select>
        </div>
        <div id="all-events" class="event-table-wrap"></div>
      </article>
    </section>

    <section class="view hidden" data-view-panel="new-event">
      <header class="topbar"><div><span class="eyebrow">GigTracker</span><h1>Create an event</h1><p>Add a direct lead, confirmed booking, or historical gig without retyping it elsewhere.</p></div></header>
      <form id="event-form" class="form-layout">
        <article class="panel form-section">
          <div class="panel-head"><div><span class="eyebrow">Client</span><h2>Primary contact</h2></div></div>
          <div class="form-grid cols-3">
            <label class="span-2">Client or organization name<input name="client_name" required></label>
            <label>Preferred channel<select name="preferred_channel"><option value="email">Email</option><option value="text">Text</option><option value="phone">Phone</option><option value="portal">Portal</option></select></label>
            <label>Email<input name="client_email" type="email"></label>
            <label>Phone<input name="client_phone" type="tel"></label>
            <label>Organization<input name="organization_name"></label>
          </div>
        </article>
        <article class="panel form-section">
          <div class="panel-head"><div><span class="eyebrow">Event</span><h2>Gig details</h2></div></div>
          <div class="form-grid cols-3">
            <label class="span-2">Event title<input name="event_title" required></label>
            <label>Event type<input name="event_type" list="event-types" required placeholder="Wedding, Karaoke, Corporate…"><datalist id="event-types"></datalist></label>
            <label>Event status<select name="event_status"><option value="inquiry">Inquiry</option><option value="quoted">Quoted</option><option value="pending">Pending</option><option value="booked">Booked</option><option value="planning">Planning</option><option value="ready">Ready</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
            <label>Starts<input name="starts_at" type="datetime-local" required></label>
            <label>Ends<input name="ends_at" type="datetime-local"></label>
            <label>Guest count<input name="guest_count" type="number" min="0"></label>
            <label>Venue name<input name="venue_name"></label>
            <label class="span-2">Street address<input name="venue_address_1"></label>
            <label>City<input name="venue_city"></label>
            <label>State<input name="venue_state" value="IN"></label>
            <label>ZIP<input name="venue_postal_code"></label>
          </div>
        </article>
        <article class="panel form-section">
          <div class="panel-head"><div><span class="eyebrow">Booking</span><h2>Services and money</h2></div></div>
          <div class="form-grid cols-3">
            <label>Booking status<select name="booking_status"><option value="">No booking yet</option><option value="pending">Pending</option><option value="pending_contract">Pending contract</option><option value="pending_deposit">Pending deposit</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
            <label>Contract status<select name="contract_status"><option value="not_sent">Not sent</option><option value="sent">Sent</option><option value="viewed">Viewed</option><option value="signed">Signed</option><option value="void">Void</option></select></label>
            <label>Payment status<select name="payment_status"><option value="unpaid">Unpaid</option><option value="deposit_due">Deposit due</option><option value="deposit_paid">Deposit paid</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option><option value="refunded">Refunded</option></select></label>
            <label>Total amount<input name="total_amount" type="number" min="0" step="0.01"></label>
            <label>Deposit amount<input name="deposit_amount" type="number" min="0" step="0.01"></label>
            <label>Balance due<input name="balance_due" type="number" min="0" step="0.01"></label>
          </div>
          <div class="service-picker"><h3>EVENTSible services</h3><div id="service-options" class="service-options"></div></div>
          <label class="block-label">Internal notes<textarea name="notes" rows="4"></textarea></label>
        </article>
        <div class="form-actions"><button type="reset" class="secondary">Clear</button><button type="submit" class="primary">Create event</button></div>
      </form>
    </section>

    <section class="view hidden" data-view-panel="import">
      <header class="topbar"><div><span class="eyebrow">GigTracker</span><h1>Import existing gigs</h1><p>Preview the CSV first, skip duplicates automatically, and keep an audit record of every import.</p></div><div class="actions"><button id="download-template" class="secondary">Download template</button></div></header>
      <article class="panel import-panel">
        <div class="drop-zone" id="drop-zone"><input id="csv-file" type="file" accept=".csv,text/csv"><div class="drop-icon">⇧</div><h2>Choose or drop a CSV file</h2><p>Up to 250 rows per import. Quoted values and commas inside fields are supported.</p></div>
        <div id="import-message" class="message hidden"></div>
        <div id="import-preview" class="hidden"><div class="preview-head"><div><span class="eyebrow">Preview</span><h2><span id="preview-count">0</span> rows ready</h2></div><button id="run-import" class="primary">Import gigs</button></div><div id="preview-table" class="event-table-wrap"></div></div>
      </article>
      <article class="panel helper-panel"><h2>Supported columns</h2><p><code>client_name</code>, <code>client_email</code>, <code>client_phone</code>, <code>event_title</code>, <code>event_type</code>, <code>event_status</code>, <code>starts_at</code>, <code>ends_at</code>, <code>venue_name</code>, <code>venue_address_1</code>, <code>venue_city</code>, <code>venue_state</code>, <code>venue_postal_code</code>, <code>guest_count</code>, <code>services</code>, <code>booking_status</code>, <code>contract_status</code>, <code>payment_status</code>, <code>total_amount</code>, <code>deposit_amount</code>, <code>balance_due</code>, and <code>notes</code>.</p></article>
    </section>

    <section class="view hidden" data-view-panel="heroes"><header class="topbar"><div><span class="eyebrow">Hero center</span><h1>Wedding Hero & Event Hero</h1><p>Planning assignments and progress are connected to each GigTracker event.</p></div></header><section class="metrics two"><article class="metric"><span>Wedding Hero assignments</span><b id="hero-wedding-total">0</b><small>Wedding planning workspaces</small></article><article class="metric"><span>Event Hero assignments</span><b id="hero-event-total">0</b><small>All other event workspaces</small></article></section><article class="panel"><div id="hero-events"></div></article></section>

    <section class="view hidden" data-view-panel="automations"><header class="topbar"><div><span class="eyebrow">Automation</span><h1>System activity</h1><p>Booking and planning workflows queued by EVENTSible OS.</p></div></header><article class="panel"><div class="panel-head"><div><span class="eyebrow">Workflow status</span><h2>Recent automation jobs</h2></div><span class="live">● Live</span></div><div id="automation-list" class="compact-list"></div></article></section>
  </main>
</section>

<div id="event-modal" class="modal hidden" aria-hidden="true"><div class="modal-card"><button id="modal-close" class="modal-close" aria-label="Close">×</button><div id="modal-content"></div></div></div>
`;

await import(new URL('./gigtracker-v1.js', import.meta.url).href);
