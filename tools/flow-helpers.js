// Paste into the Flow project tab with javascript_tool once per page load.
// Defines:
//   __keys()            asset keys of every generated image on the page, newest first
//   __seen              keys already handled; reset it right before each submit
//   __ready(ms)         waits until the send button is enabled (only true AFTER typing a prompt)
//   __waitPush(path,ms) waits for a new image, sends it full-size to the local receiver
const RECEIVER = 'http://127.0.0.1:17999/';
// Send button as seen in the Korean Flow UI; check its aria-label if the UI language differs.
const SEND_BUTTON = 'button[aria-label="생성 시작"]';
const key = (s) => s.match(/\/asb\/([^=]+)/)[1];
window.__keys = () => [...new Set([...document.querySelectorAll('img[src*="/asb/"]')].map((i) => key(i.src)))];
window.__seen = new Set(window.__keys());
window.__push = async (k, path) => {
  const b = await (await fetch(`/asb/${k}=s0`)).blob();
  if (!b.type.startsWith('image')) return { err: b.type };
  const r = await fetch(RECEIVER + path, { method: 'POST', body: b });
  return { path, status: r.status, msg: await r.text() };
};
window.__waitPush = async (path, ms = 40000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const fresh = window.__keys().filter((k) => !window.__seen.has(k));
    if (fresh.length >= 1) {
      const r = await window.__push(fresh[0], path);
      if (r.status === 200) fresh.forEach((k) => window.__seen.add(k));
      return { ...r, fresh: fresh.length };
    }
    await new Promise((res) => setTimeout(res, 3000));
  }
  return { path, timeout: true };
};
window.__ready = async (ms = 40000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const b = document.querySelector(SEND_BUTTON);
    if (b && !b.disabled) return 'ready';
    await new Promise((res) => setTimeout(res, 1000));
  }
  return 'not-ready';
};
'flow helpers ready';
