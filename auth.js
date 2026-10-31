import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const $ = (id) => document.getElementById(id);
const signIn = $('signinGoogle');
const signOut = $('signout');
const status = $('accountStatus');
const banner = $('authBanner');
const bannerText = $('authMessage');
let supabase = null;
let currentSession = null;
let syncTimer = null;
let syncing = false;
let syncAgain = false;

function notify(message) {
  const toast = $('toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3200);
  }
}

function installExportButton() {
  const tools = document.querySelector('.auth-tools');
  if (!tools || $('exportWorkspace')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'exportWorkspace';
  button.className = 'btn';
  button.textContent = 'Export data';
  button.setAttribute('aria-label', 'Download a copy of your CareerOS workspace');
  button.addEventListener('click', () => {
    const workspace = window.CareerOSState?.get?.();
    if (!workspace) {
      notify('Workspace is not ready to export yet.');
      return;
    }
    const payload = {
      product: 'CareerOS',
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      account: currentSession?.user?.email || null,
      workspace
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'careeros-workspace-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Workspace export downloaded.');
  });
  tools.insertBefore(button, signIn || tools.firstChild);
  const privacyNote = document.querySelector('#profile aside .notice');
  if (privacyNote) {
    privacyNote.textContent = 'CareerOS saves your workspace in this browser. When you sign in, it also syncs to your private account. Use Export data to keep your own JSON copy.';
  }
}

function showSignedIn(session) {
  currentSession = session;
  if (session && session.user) {
    status.textContent = session.user.user_metadata?.full_name || session.user.email || 'Signed in';
    signIn.hidden = true;
    signOut.hidden = false;
    banner.hidden = false;
    bannerText.textContent = 'Signed in. Your workspace is syncing to your private CareerOS account.';
  } else {
    status.textContent = 'Guest workspace';
    signIn.hidden = false;
    signOut.hidden = true;
    banner.hidden = false;
    bannerText.textContent = 'Guest mode saves on this device. Sign in with Google to sync your workspace across devices.';
  }
}

async function syncWorkspace() {
  if (!supabase || !currentSession?.user || !window.CareerOSState) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  try {
    const userId = currentSession.user.id;
    const { data, error } = await supabase.from('user_workspaces')
      .select('payload, updated_at').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    const local = window.CareerOSState.get();
    if (data?.payload && typeof data.payload === 'object') {
      window.CareerOSState.replace(data.payload);
      notify('Your cloud workspace is up to date.');
    } else {
      const { error: saveError } = await supabase.from('user_workspaces').upsert({
        user_id: userId, payload: local, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (saveError) throw saveError;
      notify('Your local workspace has been backed up to your account.');
    }
  } catch (error) {
    console.error('CareerOS initial sync failed:', error);
    notify('Cloud sync could not start. Your local data is still available.');
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; scheduleSync(); }
  }
}

function scheduleSync() {
  if (!currentSession?.user || !supabase) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(async () => {
    if (syncing) { syncAgain = true; return; }
    syncing = true;
    try {
      const { error } = await supabase.from('user_workspaces').upsert({
        user_id: currentSession.user.id,
        payload: window.CareerOSState.get(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (error) throw error;
      bannerText.textContent = 'Cloud sync is on. Your latest changes are saved to your account.';
    } catch (error) {
      console.error('CareerOS cloud save failed:', error);
      bannerText.textContent = 'Cloud sync paused. Your latest changes remain saved in this browser.';
    } finally {
      syncing = false;
      if (syncAgain) { syncAgain = false; scheduleSync(); }
    }
  }, 700);
}

signIn?.addEventListener('click', async () => {
  if (!supabase) {
    notify('Google sign-in is not configured yet. Add the Supabase environment variables in Vercel.');
    return;
  }
  signIn.disabled = true;
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/app' }
    });
    if (error) throw error;
  } catch (error) {
    notify(error.message || 'Google sign-in could not start.');
    signIn.disabled = false;
  }
});
signOut?.addEventListener('click', async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) notify(error.message);
  else {
    showSignedIn(null);
    notify('Signed out. Your local workspace remains on this device.');
  }
});

window.CareerOSAuth = {
  getAccessToken: async () => {
    if (!supabase) return null;
    const result = await supabase.auth.getSession();
    return result.data?.session?.access_token || null;
  }
};
window.addEventListener('careeros:state-changed', scheduleSync);

(async function initAuth() {
  showSignedIn(null);
  installExportButton();
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) throw new Error('Supabase public configuration is missing.');
    const config = await response.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Supabase public configuration is incomplete.');
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const { data: { session } } = await supabase.auth.getSession();
    showSignedIn(session);
    if (session) await syncWorkspace();
    supabase.auth.onAuthStateChange((event, sessionValue) => {
      showSignedIn(sessionValue);
      if (event === 'SIGNED_IN' && sessionValue) window.setTimeout(syncWorkspace, 0);
      if (event === 'SIGNED_OUT') notify('You are signed out.');
    });
  } catch (error) {
    console.info('Supabase authentication is awaiting project configuration:', error.message);
    status.textContent = 'Guest workspace';
    banner.hidden = false;
    bannerText.textContent = 'Guest mode is available. Google sign-in activates after Supabase is configured in Vercel.';
  }
})();
