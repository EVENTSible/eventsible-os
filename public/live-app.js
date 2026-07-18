import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.7';

const login = document.querySelector('#login');
const dashboard = document.querySelector('#dashboard');
const message = document.querySelector('#login-message');
const configUrl = new URL('./live-config.json', import.meta.url);
const config = await fetch(configUrl, { cache: 'no-store' }).then((response) => response.json());

if (!config.supabaseUrl || !config.supabasePublishableKey) {
  message.textContent = 'The site is not connected to EVENTSible OS yet.';
  message.classList.remove('hidden');
  message.classList.add('error');
  throw new Error('Missing EVENTSible OS browser configuration');
}

const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
});

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));

function formatDate(value) {
  if (!value) return 'Date not set';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Indiana/Indianapolis',
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(new Date(value));
}

async function render() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    login.classList.remove('hidden');
    dashboard.classList.add('hidden');
    return;
  }

  const role = session.user.app_metadata?.role || 'client';
  if (!['owner', 'manager', 'staff', 'host'].includes(role)) {
    await supabase.auth.signOut();
    message.textContent = 'This account does not have staff access.';
    message.classList.remove('hidden');
    message.classList.add('error');
    return;
  }

  login.classList.add('hidden');
  dashboard.classList.remove('hidden');
  document.querySelector('#role').textContent = role;

  const { data, error } = await supabase
    .from('os_event_dashboard_v')
    .select('*')
    .order('starts_at', { ascending: true, nullsFirst: false });

  if (error) {
    const errorBox = document.querySelector('#error');
    errorBox.textContent = error.message;
    errorBox.classList.remove('hidden');
    return;
  }

  const events = data || [];
  const leads = events.filter((event) => ['new', 'qualifying', 'quoted', 'follow_up'].includes(event.lead_status));
  const booked = events.filter((event) => ['confirmed', 'completed'].includes(event.booking_status));
  const planning = events.filter((event) => ['assigned', 'opened', 'in_progress', 'reopened'].includes(event.planning_status) || (event.progress_percent || 0) > 0);
  const attention = events.filter((event) => event.contract_status === 'sent' || event.payment_status === 'deposit_due' || (event.last_activity_type || '').includes('help'));

  document.querySelector('#m-leads').textContent = leads.length;
  document.querySelector('#m-booked').textContent = booked.length;
  document.querySelector('#m-planning').textContent = planning.length;
  document.querySelector('#m-attention').textContent = attention.length;
  document.querySelector('#wedding-count').textContent = events.filter((event) => event.planning_template_name === 'Wedding Hero').length;
  document.querySelector('#event-count').textContent = events.filter((event) => event.planning_template_name === 'Event Hero').length;

  const eventContent = document.querySelector('#event-content');
  if (!events.length) {
    eventContent.innerHTML = '<div class="empty"><div class="icon">✦</div><h3>Your connected event list starts here.</h3><p>When Event Builder submissions and existing GigTracker records are connected, leads and bookings will appear automatically.</p></div>';
    return;
  }

  eventContent.innerHTML = events.slice(0, 10).map((event) => `
    <article class="event">
      <div class="date"><b>${escapeHtml(formatDate(event.starts_at))}</b><span>${escapeHtml(event.event_type || 'Event')}</span></div>
      <div><h3>${escapeHtml(event.title)}</h3><p>${escapeHtml(event.primary_contact_name || 'Client not entered')} · ${escapeHtml(event.venue_name || 'Venue not entered')}</p></div>
      <div class="status"><span>${escapeHtml((event.booking_status || event.event_status || 'Not started').replaceAll('_', ' '))}</span><small>${escapeHtml(event.progress_percent || 0)}% planned</small></div>
    </article>`).join('');
}

document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = document.querySelector('#email').value.trim().toLowerCase();
  message.textContent = 'Sending secure link…';
  message.classList.remove('hidden', 'error');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/auth/callback` },
  });
  message.textContent = error ? error.message : 'Check your inbox for a secure one-time sign-in link.';
  message.classList.toggle('error', Boolean(error));
});

document.querySelector('#logout').addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.href = '/login';
});

supabase.auth.onAuthStateChange(() => render());
await render();
