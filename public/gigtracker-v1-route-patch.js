import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.7';

const config = await fetch('https://cdn.jsdelivr.net/gh/EVENTSible/eventsible-os@18117735ca2989555fd5296302ab68087e8ea5a5/public/live-config.json', { cache: 'no-store' }).then((response) => response.json());
const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
});

const callbackUrl = 'https://eventsible-os-firstfamdjs-5913s-projects.vercel.app/';
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const emailInput = document.querySelector('#email');

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  loginMessage.textContent = 'Sending secure link…';
  loginMessage.classList.remove('hidden', 'error');

  const { error } = await supabase.auth.signInWithOtp({
    email: emailInput.value.trim().toLowerCase(),
    options: { shouldCreateUser: false, emailRedirectTo: callbackUrl },
  });

  loginMessage.textContent = error ? error.message : 'Check your inbox for a secure one-time sign-in link.';
  loginMessage.classList.toggle('error', Boolean(error));
}, true);

const logoutButton = document.querySelector('#logout');
logoutButton?.addEventListener('click', async (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  await supabase.auth.signOut();
  location.href = '/';
}, true);
