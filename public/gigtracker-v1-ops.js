import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.7';

const config = await fetch('https://cdn.jsdelivr.net/gh/EVENTSible/eventsible-os@18117735ca2989555fd5296302ab68087e8ea5a5/public/live-config.json', { cache: 'no-store' }).then(r => r.json());
const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true } });
const tz = 'America/Indiana/Indianapolis';
const state = { session: null, events: [], tasks: [], month: new Date(new Date().getFullYear(), new Date().getMonth(), 1) };
const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const closed = task => ['completed', 'cancelled'].includes(task.status);
const dateKey = value => {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const get = type => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};
const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fmtDate = value => value ? new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : 'No date';
const fmtDateTime = value => value ? new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : 'Unscheduled';
const notify = (text, isError = false) => {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.toggle('error', isError);
  toast.classList.remove('hidden');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.add('hidden'), 4200);
};
const go = name => document.querySelector(`[data-view="${name}"]`)?.click();
const startToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const endToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };
const weekEnd = () => { const d = endToday(); d.setDate(d.getDate() + 7); return d; };

function injectStyles() {
  if ($('#gigtracker-ops-css')) return;
  const link = document.createElement('link');
  link.id = 'gigtracker-ops-css';
  link.rel = 'stylesheet';
  link.href = new URL('./gigtracker-v1-ops.css', import.meta.url).href;
  document.head.appendChild(link);
}

function populateEvents() {
  const select = $('#task-event');
  if (select) {
    const current = select.value;
    select.innerHTML = '<option value="">General staff task</option>' + state.events.map(event => `<option value="${esc(event.event_id)}">${esc(fmtDate(event.starts_at))} · ${esc(event.title)}</option>`).join('');
    select.value = current;
  }
  const calendarFilter = $('#calendar-event-filter');
  if (calendarFilter) {
    const current = calendarFilter.value;
    const types = [...new Set(state.events.map(event => event.event_type).filter(Boolean))].sort();
    calendarFilter.innerHTML = '<option value="">All event types</option>' + types.map(type => `<option value="${esc(type)}">${esc(type)}</option>`).join('');
    calendarFilter.value = current;
  }
}

function taskHtml(task, compact = false) {
  const overdue = task.is_overdue ? 'overdue' : task.due_bucket;
  return `<article class="task-card ${closed(task) ? 'completed' : ''}" data-task-id="${esc(task.task_id)}">
    <button class="task-check" data-task-action="toggle" title="${closed(task) ? 'Reopen' : 'Complete'}">${closed(task) ? '✓' : ''}</button>
    <div class="task-copy"><h3>${esc(task.title)}</h3><p>${esc(task.event_title || task.description || 'General EVENTSible task')}</p><div class="task-meta"><span class="task-tag ${esc(overdue)}">${esc(task.due_at ? fmtDateTime(task.due_at) : 'Unscheduled')}</span><span class="task-tag ${esc(task.priority)}">${esc(task.priority)}</span><span class="task-tag">${esc(task.task_type.replaceAll('_', ' '))}</span></div></div>
    ${compact ? '' : '<div class="task-actions"><button class="icon-button" data-task-action="delete" title="Delete">×</button></div>'}
  </article>`;
}

function filteredTasks() {
  const filter = $('#task-filter')?.value || 'open';
  const type = $('#task-type-filter')?.value || '';
  const now = new Date();
  const todayStart = startToday();
  const todayEnd = endToday();
  const nextWeek = weekEnd();
  return state.tasks.filter(task => {
    if (type && task.task_type !== type) return false;
    const due = task.due_at ? new Date(task.due_at) : null;
    if (filter === 'all') return true;
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'overdue') return !closed(task) && due && due < now;
    if (filter === 'due_today') return !closed(task) && due && due >= todayStart && due <= todayEnd;
    if (filter === 'this_week') return !closed(task) && due && due >= todayStart && due <= nextWeek;
    return !closed(task);
  });
}

function renderTasks() {
  const list = filteredTasks();
  const target = $('#task-list');
  if (target) target.innerHTML = list.length ? list.map(task => taskHtml(task)).join('') : '<div class="ops-empty">No tasks match this view.</div>';
  const open = state.tasks.filter(task => !closed(task));
  const now = new Date();
  const todayStart = startToday();
  const todayEnd = endToday();
  const nextWeek = weekEnd();
  const count = (id, value) => { const node = $(id); if (node) node.textContent = value; };
  count('#task-open', open.length);
  count('#task-overdue', open.filter(task => task.due_at && new Date(task.due_at) < now).length);
  count('#task-today', open.filter(task => task.due_at && new Date(task.due_at) >= todayStart && new Date(task.due_at) <= todayEnd).length);
  count('#task-week', open.filter(task => task.due_at && new Date(task.due_at) >= todayStart && new Date(task.due_at) <= nextWeek).length);
  const overview = $('#overview-task-list');
  if (overview) {
    const next = open.slice(0, 5);
    overview.innerHTML = next.length ? next.map(task => taskHtml(task, true)).join('') : '<div class="ops-empty">No open tasks. Nice work.</div>';
  }
  bindTaskActions();
}

function monthRange() {
  const start = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
  const end = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function renderCalendar() {
  const label = $('#calendar-label');
  if (label) label.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(state.month);
  const filter = $('#calendar-event-filter')?.value || '';
  const first = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  const today = dayKey(new Date());
  const cells = [];
  for (let index = 0; index < 42; index++) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = dayKey(date);
    const events = state.events.filter(event => dateKey(event.starts_at) === key && (!filter || event.event_type === filter));
    const tasks = state.tasks.filter(task => !closed(task) && dateKey(task.due_at) === key);
    const chips = [
      ...events.slice(0, 2).map(event => `<button class="calendar-chip" data-calendar-event="${esc(event.title)}">${esc(event.title)}</button>`),
      ...tasks.slice(0, Math.max(0, 3 - Math.min(events.length, 2))).map(task => `<button class="calendar-chip task" data-calendar-task="${esc(task.task_id)}">${esc(task.title)}</button>`)
    ];
    const extra = events.length + tasks.length - chips.length;
    cells.push(`<div class="calendar-day ${date.getMonth() !== state.month.getMonth() ? 'outside' : ''} ${key === today ? 'today' : ''}"><div class="calendar-day-head"><span class="calendar-day-number">${date.getDate()}</span><span class="calendar-day-count">${events.length + tasks.length || ''}</span></div>${chips.join('')}${extra > 0 ? `<div class="calendar-more">+${extra} more</div>` : ''}</div>`);
  }
  const grid = $('#calendar-grid');
  if (grid) grid.innerHTML = cells.join('');
  const { start, end } = monthRange();
  const agenda = [
    ...state.events.filter(event => event.starts_at && new Date(event.starts_at) >= start && new Date(event.starts_at) <= end && (!filter || event.event_type === filter)).map(event => ({ at: event.starts_at, kind: 'event', title: event.title, detail: `${event.event_type || 'Event'} · ${event.venue_name || 'Venue not entered'}` })),
    ...state.tasks.filter(task => !closed(task) && task.due_at && new Date(task.due_at) >= start && new Date(task.due_at) <= end).map(task => ({ at: task.due_at, kind: 'task', title: task.title, detail: `${task.task_type.replaceAll('_', ' ')} · ${task.event_title || 'General task'}` }))
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
  const agendaTarget = $('#calendar-agenda');
  if (agendaTarget) agendaTarget.innerHTML = agenda.length ? agenda.map(item => `<article class="agenda-item"><span class="agenda-date">${esc(fmtDateTime(item.at))} · ${esc(item.kind)}</span><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></article>`).join('') : '<div class="ops-empty">Nothing scheduled this month.</div>';
  $$('[data-calendar-event]').forEach(button => button.onclick = () => { go('events'); const search = $('#event-search'); if (search) { search.value = button.dataset.calendarEvent; search.dispatchEvent(new Event('input')); } });
  $$('[data-calendar-task]').forEach(button => button.onclick = () => { go('tasks'); $('#task-filter').value = 'all'; renderTasks(); document.querySelector(`[data-task-id="${button.dataset.calendarTask}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
}

async function loadOps() {
  const [events, tasks] = await Promise.all([
    supabase.from('os_event_dashboard_v').select('*').order('starts_at', { ascending: true, nullsFirst: false }),
    supabase.from('os_task_board_v').select('*').order('due_at', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
  ]);
  if (events.error) throw events.error;
  if (tasks.error) throw tasks.error;
  state.events = events.data || [];
  state.tasks = tasks.data || [];
  populateEvents();
  renderTasks();
  renderCalendar();
}

async function toggleTask(taskId) {
  const task = state.tasks.find(item => item.task_id === taskId);
  if (!task) return;
  const nextStatus = task.status === 'completed' ? 'todo' : 'completed';
  const update = { status: nextStatus, completed_at: nextStatus === 'completed' ? new Date().toISOString() : null };
  const result = await supabase.from('os_tasks').update(update).eq('id', taskId);
  if (result.error) throw result.error;
  notify(nextStatus === 'completed' ? 'Task completed.' : 'Task reopened.');
  await loadOps();
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task?')) return;
  const result = await supabase.from('os_tasks').delete().eq('id', taskId);
  if (result.error) throw result.error;
  notify('Task deleted.');
  await loadOps();
}

function bindTaskActions() {
  $$('[data-task-action]').forEach(button => {
    button.onclick = async () => {
      const taskId = button.closest('[data-task-id]')?.dataset.taskId;
      if (!taskId) return;
      button.disabled = true;
      try {
        if (button.dataset.taskAction === 'toggle') await toggleTask(taskId);
        if (button.dataset.taskAction === 'delete') await deleteTask(taskId);
      } catch (error) {
        notify(error.message, true);
      } finally {
        button.disabled = false;
      }
    };
  });
}

function bindUi() {
  $('#calendar-prev').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderCalendar(); };
  $('#calendar-next').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderCalendar(); };
  $('#calendar-today').onclick = () => { state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderCalendar(); };
  $('#calendar-event-filter').onchange = renderCalendar;
  $('#task-filter').onchange = renderTasks;
  $('#task-type-filter').onchange = renderTasks;
  $$('[data-view="calendar"], [data-view="tasks"]').forEach(button => button.addEventListener('click', () => setTimeout(() => button.dataset.view === 'calendar' ? renderCalendar() : renderTasks(), 0)));
  $$('#ops-overview-tasks [data-go], [data-view-panel="calendar"] [data-go]').forEach(button => button.onclick = () => go(button.dataset.go));
  $('#task-form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = $('button[type="submit"]', form);
    submit.disabled = true;
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      if (!data.event_id && !['staff', 'custom'].includes(data.task_type)) throw new Error('Choose an event, or use Staff/Custom for a general task.');
      const payload = {
        event_id: data.event_id || null,
        title: String(data.title).trim(),
        description: String(data.description || '').trim() || null,
        task_type: data.task_type,
        status: 'todo',
        priority: data.priority,
        due_at: data.due_at ? new Date(data.due_at).toISOString() : null,
        remind_at: data.remind_at ? new Date(data.remind_at).toISOString() : null,
        assigned_to: state.session.user.id,
        created_by: state.session.user.id,
        metadata: { source: 'gigtracker_ops' }
      };
      const result = await supabase.from('os_tasks').insert(payload);
      if (result.error) throw result.error;
      form.reset();
      notify('Task added.');
      await loadOps();
    } catch (error) {
      notify(error.message, true);
    } finally {
      submit.disabled = false;
    }
  };
}

async function initialize() {
  injectStyles();
  const { data: { session } } = await supabase.auth.getSession();
  state.session = session;
  if (!session) return;
  bindUi();
  await loadOps();
}

supabase.auth.onAuthStateChange(async (_event, session) => {
  state.session = session;
  if (session) {
    try { await loadOps(); } catch (error) { notify(error.message, true); }
  }
});

await initialize().catch(error => notify(error.message, true));