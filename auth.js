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

function downloadWorkspace() {
  const workspace = window.CareerOSState?.get?.();
  if (!workspace) return notify('Workspace is not ready to export yet.');
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
}

function installAccountTools() {
  const tools = document.querySelector('.auth-tools');
  if (!tools) return;
  if (!$('exportWorkspace')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'exportWorkspace';
    button.className = 'btn';
    button.textContent = 'Export data';
    button.setAttribute('aria-label', 'Download a copy of your CareerOS workspace');
    button.addEventListener('click', downloadWorkspace);
    tools.insertBefore(button, signIn || tools.firstChild);
  }
  if (!$('deleteAccount')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'deleteAccount';
    button.className = 'btn';
    button.textContent = 'Delete account';
    button.hidden = true;
    button.addEventListener('click', deleteAccount);
    tools.appendChild(button);
  }
  const privacyNote = document.querySelector('#profile aside .notice');
  if (privacyNote) {
    privacyNote.textContent = 'Guest data is stored in this browser. Signed-in workspaces sync to your private account. Export a JSON copy or delete your account and associated cloud data from the account controls.';
  }
}

function showSignedIn(session) {
  currentSession = session;
  const signedIn = !!session?.user;
  if (signedIn) {
    status.textContent = session.user.user_metadata?.full_name || session.user.email || 'Signed in';
    signIn.hidden = true;
    signOut.hidden = false;
    if ($('deleteAccount')) $('deleteAccount').hidden = false;
    banner.hidden = false;
    bannerText.textContent = 'Signed in. Your workspace syncs to your private CareerOS account.';
  } else {
    status.textContent = 'Guest workspace';
    signIn.hidden = false;
    signOut.hidden = true;
    if ($('deleteAccount')) $('deleteAccount').hidden = true;
    banner.hidden = false;
    bannerText.textContent = 'Guest mode saves on this device. Sign in with Google to sync your workspace across devices.';
  }
}

function mergeWorkspace(cloud, local) {
  const c = cloud && typeof cloud === 'object' ? cloud : {};
  const l = local && typeof local === 'object' ? local : {};
  const localSkills = Array.isArray(l.skills) ? l.skills : [];
  const skillsChanged = localSkills.length > 0;
  const localProfile = l.profile && typeof l.profile === 'object' ? l.profile : {};
  const localProfileEdited = (
    !!String(localProfile.role || '').trim() ||
    !!String(localProfile.experience || '').trim() ||
    !!String(localProfile.timeline || '').trim() ||
    !!String(localProfile.objective || '').trim() ||
    !!String(localProfile.evidence || '').trim() ||
    !!String(localProfile.jd || '').trim()
  );
  const localDone = Array.isArray(l.done) ? l.done : [];
  const progressChanged = localDone.some(Boolean);
  const localResume = l.resume && typeof l.resume === 'object' ? l.resume : {};
  const localResumeEdited = Object.values(localResume).some(value => String(value || '').trim());
  const localHasWork = localProfileEdited || skillsChanged || progressChanged || localResumeEdited ||
    (Array.isArray(l.apps) && l.apps.length > 0) ||
    (Array.isArray(l.answers) && l.answers.length > 0) ||
    Number(l.sessions) > 0;

  // A pristine new-device workspace contains seeded defaults, not user edits.
  // Prefer the existing cloud profile in that case instead of overwriting it with defaults.
  if (!localHasWork) return c;

  const mergeByName = (a, b) => {
    const map = new Map();
    for (const item of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
      if (!item || typeof item.name !== 'string') continue;
      const key = item.name.trim().toLowerCase();
      if (!key) continue;
      const previous = map.get(key) || {};
      map.set(key, {
        ...previous, ...item,
        level: Math.max(Number(previous.level) || 0, Number(item.level) || 0),
        required: Math.max(Number(previous.required) || 0, Number(item.required) || 0)
      });
    }
    return [...map.values()];
  };
  const unique = (items, keyFn) => {
    const map = new Map();
    for (const item of Array.isArray(items) ? items : []) {
      if (!item) continue;
      const key = keyFn(item);
      if (key !== undefined && key !== null) map.set(String(key), item);
    }
    return [...map.values()];
  };
  const cloudProfile = c.profile && typeof c.profile === 'object' ? c.profile : {};
  const roleChanged = !!String(localProfile.role || '').trim() && localProfile.role !== cloudProfile.role;
  const profile = { ...cloudProfile };
  const resume = { ...(c.resume && typeof c.resume === 'object' ? c.resume : {}) };
  for (const [key,value] of Object.entries(localResume)) if (String(value || '').trim()) resume[key] = value;
  if (String(localProfile.role || '').trim()) profile.role = localProfile.role;
  if (String(localProfile.experience || '').trim()) profile.experience = localProfile.experience;
  if (String(localProfile.timeline || '').trim()) profile.timeline = localProfile.timeline;
  if (String(localProfile.objective || '').trim()) profile.objective = localProfile.objective;
  if (String(localProfile.evidence || '').trim()) profile.evidence = localProfile.evidence;
  if (String(localProfile.jd || '').trim()) profile.jd = localProfile.jd;
  const cloudDone = Array.isArray(c.done) ? c.done : [];
  const done = Array.from({ length: Math.max(cloudDone.length, localDone.length) }, (_,i) => !!cloudDone[i] || !!localDone[i]);
  const answers = unique([...(Array.isArray(c.answers) ? c.answers : []), ...(Array.isArray(l.answers) ? l.answers : [])],
    item => item.id || item.at + '|' + item.question);
  const apps = unique([...(Array.isArray(c.apps) ? c.apps : []), ...(Array.isArray(l.apps) ? l.apps : [])],
    item => item.id || item.company + '|' + item.role + '|' + item.status);
  return {
    ...c, ...l, profile,
    skills: roleChanged ? localSkills : (skillsChanged ? mergeByName(c.skills, localSkills) : (Array.isArray(c.skills) ? c.skills : localSkills)),
    resume,
    done: roleChanged ? localDone : (progressChanged ? done : (cloudDone.length ? cloudDone : localDone)),
    answers,
    apps,
    sessions: Math.max(Number(c.sessions) || 0, Number(l.sessions) || 0)
  };
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
      // Merge instead of blindly replacing: signing in must not silently discard guest work.
      const merged = mergeWorkspace(data.payload, local);
      window.CareerOSState.replace(merged);
      const { error: saveError } = await supabase.from('user_workspaces').upsert({
        user_id: userId, payload: merged, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (saveError) throw saveError;
      notify('Cloud and this-device workspace data have been combined.');
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

async function deleteAccount() {
  if (!supabase || !currentSession?.user) return;
  const phrase = 'DELETE MY CAREEROS ACCOUNT';
  if (!window.confirm('This permanently deletes your CareerOS account and cloud workspace data. Export your data first if you need a copy. Continue?')) return;
  const typed = window.prompt('Type exactly: ' + phrase);
  if (typed !== phrase) return notify('Account deletion cancelled. The confirmation phrase did not match.');
  const button = $('deleteAccount');
  button.disabled = true;
  button.textContent = 'Deleting…';
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Your session has expired. Sign in again.');
    const response = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      cache: 'no-store',
      body: JSON.stringify({ confirmation: phrase })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Account deletion failed.');
    await supabase.auth.signOut({ scope: 'global' });
    showSignedIn(null);
    notify('Account and cloud data deleted. Your local browser copy remains available.');
  } catch (error) {
    notify(error.message || 'Account deletion could not be completed.');
  } finally {
    button.disabled = false;
    button.textContent = 'Delete account';
  }
}

signIn?.addEventListener('click', async () => {
  if (!supabase) {
    notify('Google sign-in is not configured yet. Check the Supabase environment and OAuth provider settings.');
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
  installAccountTools();
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
    console.info('CareerOS authentication configuration:', error.message);
    status.textContent = 'Guest workspace';
    banner.hidden = false;
    bannerText.textContent = 'Guest mode is available. Sign-in and cloud sync activate when Supabase and Google OAuth are configured.';
  }
})();
