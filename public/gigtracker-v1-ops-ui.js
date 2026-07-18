const waitFor = (selector, timeout = 12000) => new Promise((resolve, reject) => {
  const found = document.querySelector(selector);
  if (found) return resolve(found);
  const observer = new MutationObserver(() => {
    const node = document.querySelector(selector);
    if (node) { observer.disconnect(); resolve(node); }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => { observer.disconnect(); reject(new Error(`Timed out waiting for ${selector}`)); }, timeout);
});

await waitFor('#main-nav');
if (!document.querySelector('[data-view="calendar"]')) {
  const eventsButton = document.querySelector('[data-view="events"]');
  eventsButton.insertAdjacentHTML('afterend', '<button class="nav-link" data-view="calendar">Calendar</button><button class="nav-link" data-view="tasks">Follow-ups</button>');
}

const main = document.querySelector('#dashboard main');
if (!document.querySelector('[data-view-panel="calendar"]')) {
  const heroes = document.querySelector('[data-view-panel="heroes"]');
  heroes.insertAdjacentHTML('beforebegin', `
    <section class="view hidden" data-view-panel="calendar">
      <header class="topbar"><div><span class="eyebrow">Date Book</span><h1>Calendar & agenda</h1><p>See every event and due follow-up in one operating calendar.</p></div><div class="actions"><button class="secondary" id="calendar-today">Today</button><button class="primary" data-go="new-event">New event</button></div></header>
      <div class="ops-toolbar"><div class="cluster"><button class="secondary" id="calendar-prev">←</button><button class="secondary" id="calendar-next">→</button><h2 id="calendar-label" style="margin:0"></h2></div><div class="cluster"><select id="calendar-event-filter"><option value="">All event types</option></select></div></div>
      <section class="ops-calendar-layout">
        <article class="panel calendar-shell"><div class="calendar-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div id="calendar-grid" class="calendar-grid"></div></article>
        <article class="panel"><div class="panel-head"><div><span class="eyebrow">Month agenda</span><h2>Events & deadlines</h2></div></div><div id="calendar-agenda" class="agenda-list"></div></article>
      </section>
    </section>
    <section class="view hidden" data-view-panel="tasks">
      <header class="topbar"><div><span class="eyebrow">Follow-up center</span><h1>Tasks & reminders</h1><p>Keep contracts, payments, client follow-ups, planning, and event-day work from slipping.</p></div></header>
      <section class="task-metrics"><article class="task-metric"><span>Overdue</span><b id="task-overdue">0</b><small>Needs attention now</small></article><article class="task-metric"><span>Due today</span><b id="task-today">0</b><small>Before midnight</small></article><article class="task-metric"><span>This week</span><b id="task-week">0</b><small>Next seven days</small></article><article class="task-metric"><span>Open</span><b id="task-open">0</b><small>All active tasks</small></article></section>
      <section class="task-layout">
        <article class="panel"><div class="ops-toolbar"><div><span class="eyebrow">Task board</span><h2 style="margin:4px 0 0">What needs attention</h2></div><div class="cluster"><select id="task-filter"><option value="open">Open tasks</option><option value="overdue">Overdue</option><option value="due_today">Due today</option><option value="this_week">This week</option><option value="completed">Completed</option><option value="all">All tasks</option></select><select id="task-type-filter"><option value="">All types</option><option value="follow_up">Follow-up</option><option value="planning">Planning</option><option value="contract">Contract</option><option value="payment">Payment</option><option value="staff">Staff</option><option value="event_day">Event day</option><option value="custom">Custom</option></select></div></div><div id="task-list" class="task-list"></div></article>
        <article class="panel"><div class="panel-head"><div><span class="eyebrow">Quick add</span><h2>New task</h2></div></div><form id="task-form" class="task-form"><label>Task title<input name="title" required placeholder="Follow up about deposit"></label><label>Related event<select name="event_id" id="task-event"><option value="">General staff task</option></select></label><div class="two-col"><label>Type<select name="task_type"><option value="follow_up">Follow-up</option><option value="planning">Planning</option><option value="contract">Contract</option><option value="payment">Payment</option><option value="staff">Staff</option><option value="event_day">Event day</option><option value="custom">Custom</option></select></label><label>Priority<select name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option><option value="low">Low</option></select></label></div><label>Due date and time<input name="due_at" type="datetime-local"></label><label>Reminder time<input name="remind_at" type="datetime-local"></label><label>Notes<textarea name="description" rows="4" placeholder="What needs to happen?"></textarea></label><button class="primary" type="submit">Add task</button></form></article>
      </section>
    </section>`);
}

if (!document.querySelector('#ops-overview-tasks')) {
  const overview = document.querySelector('[data-view-panel="overview"]');
  overview.insertAdjacentHTML('beforeend', '<article class="panel ops-overview-panel" id="ops-overview-tasks"><div class="panel-head"><div><span class="eyebrow">Follow-up center</span><h2>Next tasks</h2></div><button class="text-button" data-go="tasks">View all</button></div><div id="overview-task-list" class="task-list"></div></article>');
}

export { waitFor };