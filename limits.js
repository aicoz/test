// limits.js - minimal trial/email/limit manager (uses chrome.storage.local)
// Adds runtime message handlers for: 'register', 'getState', 'checkStatus', 'postUsage', 'linkEmail'.
// Data model per deviceId stored under 'users' key as object: users[deviceId] = { device_id, created_at, email, trial_extensions, is_pro, daily_seconds_used, daily_seconds_last_reset }

const FREE_DAILY_LIMIT = 600; // seconds
const TRIAL_DAYS = 5;
const EXTENSION_DAYS = 5;

function todayDate(){ return new Date().toISOString().slice(0,10); }

function ensureDailyResetSync(user){
  const today = todayDate();
  if (user.daily_seconds_last_reset !== today) {
    user.daily_seconds_used = 0;
    user.daily_seconds_last_reset = today;
  }
  return user;
}

function computeState(user){
  const now = new Date();
  const created = new Date(user.created_at);
  const days_since = Math.floor((now - created) / (24*3600*1000));
  const trial_days = TRIAL_DAYS + (user.trial_extensions||0) * EXTENSION_DAYS;
  const trial_remaining = Math.max(0, trial_days - days_since);
  ensureDailyResetSync(user);
  if (user.is_pro) return { mode:'pro', unlimited:true, trial_remaining_days: trial_remaining };
  if (trial_remaining > 0) return { mode:'trial', unlimited:true, trial_remaining_days: trial_remaining };
  const seconds_left_today = Math.max(0, FREE_DAILY_LIMIT - (user.daily_seconds_used||0));
  return { mode:'free', unlimited:false, seconds_left_today };
}

function readUsers(callback){
  chrome.storage.local.get(['users'], (res) => {
    const users = res.users || {};
    callback(users);
  });
}
function writeUsers(users, callback){
  chrome.storage.local.set({ users: users }, () => { if (callback) callback(); });
}

function ensureUser(deviceId, callback){
  readUsers((users)=>{
    if (!users[deviceId]){
      users[deviceId] = {
        device_id: deviceId,
        created_at: new Date().toISOString(),
        email: null,
        trial_extensions: 0,
        is_pro: false,
        daily_seconds_used: 0,
        daily_seconds_last_reset: todayDate()
      };
      writeUsers(users, ()=>callback(users[deviceId]));
    } else {
      callback(users[deviceId]);
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // message-based API
  (async ()=>{
    try {
      // Kullanıcı kaydı
      if (msg && msg.type === 'register' && msg.deviceId){
        ensureUser(msg.deviceId, (user) => {
          sendResponse({ ok:true, created: true, deviceId: msg.deviceId });
        });
        return true;
      }

      // Durum sorgulama (eski: getState / checkStatus, yeni: get_license_status)
      if (msg && (msg.type === 'getState' || msg.type === 'checkStatus' || msg.type === 'get_license_status') && msg.deviceId){
        readUsers((users)=>{
          const user = users[msg.deviceId];
          if (!user) { sendResponse({ error: 'user_not_found' }); return; }
          const state = computeState(user);

          // account.js'in beklediği format
          if (msg.type === 'get_license_status') {
            const response = {
              plan: state.mode, // "pro", "trial", "free"
              trialDaysRemaining: state.trial_remaining_days || 0,
              freeDailySecondsRemaining: state.seconds_left_today ?? (state.unlimited ? null : 0),
              account: user.email ? { email: user.email } : null
            };
            sendResponse(response);
          } else {
            sendResponse(Object.assign({ deviceId: msg.deviceId }, state));
          }
        });
        return true;
      }

      // Kullanım süresi gönderme
      if (msg && msg.type === 'postUsage' && msg.deviceId && typeof msg.seconds !== 'undefined'){
        readUsers((users)=>{
          const user = users[msg.deviceId];
          if (!user) { sendResponse({ error: 'user_not_found' }); return; }
          ensureDailyResetSync(user);
          user.daily_seconds_used = (user.daily_seconds_used||0) + Number(msg.seconds);
          users[msg.deviceId] = user;
          writeUsers(users, ()=>{
            const remaining = Math.max(0, FREE_DAILY_LIMIT - user.daily_seconds_used);
            sendResponse({ remaining });
          });
        });
        return true;
      }

      // Email ilişkilendirme
      if (msg && msg.type === 'linkEmail' && msg.deviceId && msg.email){
        readUsers((users)=>{
          let user = users[msg.deviceId];
          if (!user){
            user = {
              device_id: msg.deviceId,
              created_at: new Date().toISOString(),
              email: msg.email,
              trial_extensions: 1,
              is_pro: false,
              daily_seconds_used: 0,
              daily_seconds_last_reset: todayDate()
            };
          } else {
            if (user.email !== msg.email){
              user.email = msg.email;
              user.trial_extensions = (user.trial_extensions||0) + 1;
            }
          }
          users[msg.deviceId] = user;
          writeUsers(users, ()=> sendResponse({ ok:true, trial_extensions: user.trial_extensions }));
        });
        return true;
      }

      // Bilinmeyen mesaj
      sendResponse({ error: 'unknown_message' });
    } catch(e){
      sendResponse({ error: String(e) });
    }
  })();
  return true; // indicate async sendResponse
});
