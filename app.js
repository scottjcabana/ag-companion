// Antigravity Android Companion Client - Upgraded Durable Edition
(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Boot Pairing & Endpoint Persistence (URL Hash -> localStorage)
  // --------------------------------------------------------------------------
  function normalizeApiBase(url) {
    if (!url) return '';
    return String(url).trim().replace(/\/+$/, '');
  }

  function isStaticLauncherHost() {
    return /\.(github\.io|pages\.dev|netlify\.app|vercel\.app)$/i.test(window.location.hostname);
  }

  (function bootstrapPairingFromHash() {
    const rawHash = window.location.hash ? window.location.hash.slice(1) : '';
    if (!rawHash) return;
    const params = new URLSearchParams(rawHash);
    const key = params.get('key') || params.get('token');
    const gist = params.get('gist');
    const api = params.get('api');

    if (key) localStorage.setItem('ag_token', key.trim());
    if (gist) localStorage.setItem('ag_gist_id', gist.trim());
    if (api) {
      localStorage.setItem('ag_api_base', normalizeApiBase(api));
    } else if ((key || gist) && !isStaticLauncherHost()) {
      localStorage.removeItem('ag_api_base');
    }

    if (key || gist || api) {
      try {
        history.replaceState(
          { view: 'conversations' },
          '',
          window.location.pathname + window.location.search
        );
      } catch (e) {}
    }
  })();

  // State
  let currentConvoId = null;
  let conversations = [];
  let pollTimer = null;
  let selectedModel = 'flash';
  let lastMessageCount = 0;
  let currentFilter = 'all';
  let wasLastSessionActive = false;

  // DOM Elements
  const viewConversations = document.getElementById('viewConversations');
  const viewChat = document.getElementById('viewChat');
  const convoList = document.getElementById('convoList');
  const chatFeed = document.getElementById('chatFeed');
  const filterInput = document.getElementById('filterInput');
  const appTitle = document.getElementById('appTitle');
  const appSubtitle = document.getElementById('appSubtitle');
  const btnBack = document.getElementById('btnBack');
  const btnRefresh = document.getElementById('btnRefresh');
  const btnPairTop = document.getElementById('btnPairTop');
  const btnInfo = document.getElementById('btnInfo');
  const btnTheme = document.getElementById('btnTheme');
  const btnNotif = document.getElementById('btnNotif');
  const fabNew = document.getElementById('fabNew');
  const modalNewConvo = document.getElementById('modalNewConvo');
  const btnCloseSheet = document.getElementById('btnCloseSheet');
  const btnSubmitNewConvo = document.getElementById('btnSubmitNewConvo');
  const modalInfo = document.getElementById('modalInfo');
  const btnCloseInfo = document.getElementById('btnCloseInfo');
  const infoDetails = document.getElementById('infoDetails');
  const promptInput = document.getElementById('promptInput');
  const btnSend = document.getElementById('btnSend');
  const btnVoice = document.getElementById('btnVoice');
  const modelChips = document.getElementById('modelChips');
  const quickChipsBar = document.getElementById('quickChipsBar');
  const countAll = document.getElementById('countAll');
  const countChats = document.getElementById('countChats');
  const countSubagents = document.getElementById('countSubagents');
  const countActive = document.getElementById('countActive');
  const subagentNavRow = document.getElementById('subagentNavRow');
  const btnScrollBottom = document.getElementById('btnScrollBottom');
  const modalToolInspector = document.getElementById('modalToolInspector');
  const btnCloseInspector = document.getElementById('btnCloseInspector');
  const inspectorTitle = document.getElementById('inspectorTitle');
  const inspectorContent = document.getElementById('inspectorContent');
  const btnArtifacts = document.getElementById('btnArtifacts');
  const modalArtifacts = document.getElementById('modalArtifacts');
  const btnCloseArtifacts = document.getElementById('btnCloseArtifacts');
  const artifactsContent = document.getElementById('artifactsContent');
  const btnAttach = document.getElementById('btnAttach');
  const mediaUploadInput = document.getElementById('mediaUploadInput');
  const attachPreviewContainer = document.getElementById('attachPreviewContainer');
  const attachThumbnail = document.getElementById('attachThumbnail');
  const attachFileName = document.getElementById('attachFileName');
  const attachFileSize = document.getElementById('attachFileSize');
  const btnRemoveAttach = document.getElementById('btnRemoveAttach');
  const connBanner = document.getElementById('connBanner');
  const connBannerIcon = document.getElementById('connBannerIcon');
  const connBannerText = document.getElementById('connBannerText');
  const btnConnRetry = document.getElementById('btnConnRetry');
  const btnConnPair = document.getElementById('btnConnPair');
  const modalPair = document.getElementById('modalPair');
  const btnClosePair = document.getElementById('btnClosePair');
  const pairHintText = document.getElementById('pairHintText');
  const pairKeyInput = document.getElementById('pairKeyInput');
  const pairGistInput = document.getElementById('pairGistInput');
  const pairApiInput = document.getElementById('pairApiInput');
  const btnToggleKeyVis = document.getElementById('btnToggleKeyVis');
  const btnScanQr = document.getElementById('btnScanQr');
  const qrScannerWrap = document.getElementById('qrScannerWrap');
  const qrVideo = document.getElementById('qrVideo');
  const btnStopQr = document.getElementById('btnStopQr');
  const btnSyncBeacon = document.getElementById('btnSyncBeacon');
  const btnSavePair = document.getElementById('btnSavePair');

  let pendingAttachment = null;

  // Global helper for opening sessions from links/chips
  window.openConvo = function (id, title) {
    vibrate(10);
    showChatView(id, title);
  };

  // Register PWA Service Worker (relative path for subpath portability)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  }

  // --------------------------------------------------------------------------
  // Haptics & Toasts
  // --------------------------------------------------------------------------
  function vibrate(pattern = 15) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  function showToast(text, isError = false) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'm3-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = text;
    toast.style.borderColor = isError ? 'var(--danger)' : 'var(--outline)';
    toast.classList.remove('hide');
    setTimeout(() => {
      toast.classList.add('hide');
    }, 2800);
  }

  // --------------------------------------------------------------------------
  // OLED Theme Manager
  // --------------------------------------------------------------------------
  const savedTheme = localStorage.getItem('ag_theme');
  if (savedTheme === 'oled') {
    document.body.classList.add('oled-theme');
    btnTheme.classList.add('active-state');
  }

  btnTheme.addEventListener('click', () => {
    vibrate(10);
    const isOled = document.body.classList.toggle('oled-theme');
    if (isOled) {
      localStorage.setItem('ag_theme', 'oled');
      btnTheme.classList.add('active-state');
      showToast('OLED Pure Black enabled');
    } else {
      localStorage.setItem('ag_theme', 'default');
      btnTheme.classList.remove('active-state');
      showToast('Material Dark enabled');
    }
  });

  // --------------------------------------------------------------------------
  // Web Notifications Manager
  // --------------------------------------------------------------------------
  function updateNotifButton() {
    if ('Notification' in window && Notification.permission === 'granted') {
      btnNotif.classList.add('active-state');
      btnNotif.title = 'Notifications active';
    } else {
      btnNotif.classList.remove('active-state');
      btnNotif.title = 'Enable notifications';
    }
  }
  updateNotifButton();

  btnNotif.addEventListener('click', async () => {
    vibrate(10);
    if (!('Notification' in window)) {
      showToast('Notifications not supported by this browser', true);
      return;
    }

    if (Notification.permission === 'granted') {
      showToast('Push alerts already active!');
    } else {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        showToast('Push notifications enabled!');
        updateNotifButton();
        new Notification('Antigravity Mobile', {
          body: 'You will receive alerts when agent tasks finish.',
          icon: './icon.svg'
        });
      } else {
        showToast('Notification permission denied', true);
      }
    }
  });

  function triggerTaskFinishedAlert(title) {
    vibrate([80, 50, 120]);
    showToast(`Task completed: ${title}`);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Antigravity: Task Complete', {
        body: `Agent has finished: ${title}`,
        icon: '/icon.svg'
      });
    }
  }

  // --------------------------------------------------------------------------
  // Markdown & Code Copying Engine
  // --------------------------------------------------------------------------
  function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  window.copyCode = function (btn) {
    vibrate(15);
    const wrapper = btn.closest('.code-block-wrapper');
    const codeEl = wrapper ? wrapper.querySelector('code') : null;
    if (codeEl) {
      navigator.clipboard.writeText(codeEl.innerText).then(() => {
        btn.textContent = '✓ Copied';
        showToast('Code copied to clipboard');
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      }).catch(() => {
        showToast('Copy failed', true);
      });
    }
  };

  function renderMarkdown(md) {
    if (!md) return '';
    let html = escapeHtml(md);

    // Code blocks ```code``` with one-tap copy button & language tag
    html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, function (_, lang, code) {
      const displayLang = lang || 'code';
      return `
        <div class="code-block-wrapper">
          <div class="code-header">
            <span>${displayLang}</span>
            <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          </div>
          <pre><code class="lang-${displayLang}">${code.trim()}</code></pre>
        </div>
      `;
    });

    // GitHub alerts: > [!NOTE], > [!TIP], > [!WARNING], > [!IMPORTANT]
    html = html.replace(/^>\s*\[!NOTE\]\s*(.*$)/gim, '<div class="md-alert note"><strong>Note:</strong> $1</div>');
    html = html.replace(/^>\s*\[!TIP\]\s*(.*$)/gim, '<div class="md-alert tip"><strong>Tip:</strong> $1</div>');
    html = html.replace(/^>\s*\[!WARNING\]\s*(.*$)/gim, '<div class="md-alert warning"><strong>Warning:</strong> $1</div>');
    html = html.replace(/^>\s*\[!IMPORTANT\]\s*(.*$)/gim, '<div class="md-alert important"><strong>Important:</strong> $1</div>');

    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic *text*
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bullet points
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');

    // Paragraph line breaks
    html = html.replace(/\n{2,}/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    return `<p>${html}</p>`;
  }

  function formatTime(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  }

  function timeAgo(isoStr) {
    if (!isoStr) return '';
    try {
      const diff = (new Date() - new Date(isoStr)) / 1000;
      if (diff < 60) return 'Just now';
      if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
      return `${Math.floor(diff / 86400)}d ago`;
    } catch (e) {
      return '';
    }
  }

  // --------------------------------------------------------------------------
  // Auth, Unified apiFetch(), Encrypted Gist Beacon, & Connection Health UX
  // --------------------------------------------------------------------------
  let connState = 'online'; // 'online' | 'reconnecting' | 'failover' | 'daemon_offline' | 'auth' | 'offline'
  let consecutiveFailures = 0;
  let cachedHostName = localStorage.getItem('ag_hostname') || 'Fortuna';
  let beaconDiscoveryPromise = null;
  let recoveryHideTimer = null;
  let qrStream = null;
  let qrScanTimer = null;

  const CONN_SVGS = {
    sync: '<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>',
    route: '<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/></svg>',
    daemon: '<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h6l-2 2v1h8v-1l-2-2h6c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
  };

  function getToken() {
    return (localStorage.getItem('ag_token') || '').trim();
  }

  function getGistId() {
    return (localStorage.getItem('ag_gist_id') || '').trim();
  }

  function getApiBase() {
    return normalizeApiBase(localStorage.getItem('ag_api_base') || '');
  }

  function syncTopSubtitle() {
    if (!appSubtitle) return;
    if (connState === 'auth') {
      appSubtitle.innerHTML = '<span class="pulse-dot auth-err"></span> Pairing Required';
    } else if (connState === 'daemon_offline') {
      appSubtitle.innerHTML = '<span class="pulse-dot degraded"></span> IDE Daemon Offline';
    } else if (connState !== 'online') {
      appSubtitle.innerHTML = '<span class="pulse-dot degraded"></span> Reconnecting...';
    } else if (!currentConvoId) {
      appSubtitle.innerHTML = `<span class="pulse-dot"></span> ${escapeHtml(cachedHostName)} Connected`;
    }
  }

  function setConnState(nextState, message) {
    const prevState = connState;
    connState = nextState;

    if (!connBanner) {
      syncTopSubtitle();
      return;
    }

    if (recoveryHideTimer) {
      clearTimeout(recoveryHideTimer);
      recoveryHideTimer = null;
    }

    if (nextState === 'online') {
      syncTopSubtitle();
      if (prevState !== 'online' && !connBanner.classList.contains('hide')) {
        connBanner.dataset.state = 'recovered';
        connBannerIcon.className = 'conn-banner-icon';
        connBannerIcon.innerHTML = CONN_SVGS.check;
        connBannerText.textContent = message || `${cachedHostName} connected`;
        btnConnPair.classList.add('hide');
        btnConnRetry.classList.add('hide');
        recoveryHideTimer = setTimeout(() => {
          if (connState === 'online') connBanner.classList.add('hide');
        }, 900);
      } else {
        connBanner.classList.add('hide');
      }
      return;
    }

    connBanner.classList.remove('hide');
    btnConnRetry.classList.remove('hide');

    if (nextState === 'auth') {
      connBanner.dataset.state = 'auth';
      connBannerIcon.className = 'conn-banner-icon';
      connBannerIcon.innerHTML = CONN_SVGS.lock;
      connBannerText.textContent = message || 'Pairing Key Required';
      btnConnPair.classList.remove('hide');
      btnConnRetry.classList.add('hide');
    } else if (nextState === 'failover') {
      connBanner.dataset.state = 'failover';
      connBannerIcon.className = 'conn-banner-icon spin';
      connBannerIcon.innerHTML = CONN_SVGS.route;
      connBannerText.textContent = message || 'Updating tunnel route...';
      btnConnPair.classList.add('hide');
    } else if (nextState === 'daemon_offline') {
      connBanner.dataset.state = 'daemon';
      connBannerIcon.className = 'conn-banner-icon';
      connBannerIcon.innerHTML = CONN_SVGS.daemon;
      connBannerText.textContent = message || `Antigravity IDE closed on ${cachedHostName}`;
      btnConnPair.classList.add('hide');
    } else {
      connBanner.dataset.state = nextState;
      connBannerIcon.className = nextState === 'reconnecting' ? 'conn-banner-icon spin' : 'conn-banner-icon';
      connBannerIcon.innerHTML = CONN_SVGS.sync;
      connBannerText.textContent = message || `Reconnecting to ${cachedHostName}...`;
      btnConnPair.classList.add('hide');
    }

    syncTopSubtitle();
  }

  function decodeCipherField(raw, forceHex) {
    const clean = String(raw || '').trim();
    if (!clean) return new Uint8Array(0);
    if (forceHex) {
      const out = new Uint8Array(clean.length / 2);
      for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(clean.substr(i * 2, 2), 16);
      }
      return out;
    }
    const b64 = clean.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const bin = atob(b64 + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function probeCandidateApi(candidateBase) {
    const base = normalizeApiBase(candidateBase);
    if (!base) return false;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(`${base}/api/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: ctrl.signal
      });
      if (!res.ok) return false;
      const info = await res.json().catch(() => null);
      return Boolean(info && (info.ok === true || info.status === 'ok'));
    } catch (_) {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async function discoverTunnelFromBeacon({ manual = false } = {}) {
    if (beaconDiscoveryPromise) return beaconDiscoveryPromise;

    beaconDiscoveryPromise = (async () => {
      const gistId = getGistId();
      const pairingKey = getToken();
      if (!gistId || !pairingKey) {
        if (manual) showToast('Enter both Pairing Key and Gist ID first', true);
        return null;
      }
      if (!window.crypto || !window.crypto.subtle) {
        if (manual) showToast('Web Crypto requires HTTPS context', true);
        return null;
      }

      setConnState('failover', 'Updating tunnel route...');

      try {
        const gistRes = await fetch(`https://api.github.com/gists/${encodeURIComponent(gistId)}`, {
          method: 'GET',
          cache: 'no-store',
          headers: { Accept: 'application/vnd.github+json' }
        });
        if (!gistRes.ok) throw new Error(`Gist HTTP ${gistRes.status}`);

        const gistData = await gistRes.json();
        const files = gistData.files || {};
        const fileEntry =
          files['beacon.json'] ||
          Object.values(files).find((f) => f && /\.json$/i.test(f.filename || '')) ||
          Object.values(files)[0];

        if (!fileEntry) throw new Error('beacon.json missing in Gist');

        let rawContent = fileEntry.content;
        if (fileEntry.truncated && fileEntry.raw_url) {
          const rawRes = await fetch(fileEntry.raw_url, { cache: 'no-store' });
          rawContent = await rawRes.text();
        }

        const beacon = JSON.parse(rawContent);
        const ivStr = beacon.iv || beacon.nonce || '';
        const ctStr = beacon.ct || beacon.ciphertext || '';
        const isHex = beacon.encoding === 'hex' || /^[0-9a-fA-F]{24}$/.test(ivStr);

        const iv = decodeCipherField(ivStr, isHex);
        const cipherBytes = decodeCipherField(ctStr, isHex);

        const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pairingKey));
        const cryptoKey = await crypto.subtle.importKey(
          'raw',
          keyHash,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );

        const decryptedBuf = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          cryptoKey,
          cipherBytes
        );

        const plainText = new TextDecoder().decode(decryptedBuf).trim();
        let candidateUrl = plainText;
        if (plainText.startsWith('{')) {
          const parsed = JSON.parse(plainText);
          candidateUrl = parsed.url || parsed.tunnelUrl || parsed.api || '';
          if (parsed.hostname) {
            cachedHostName = parsed.hostname;
            localStorage.setItem('ag_hostname', cachedHostName);
          }
        }
        candidateUrl = normalizeApiBase(candidateUrl);
        if (!/^https?:\/\//i.test(candidateUrl)) {
          throw new Error('Decrypted beacon did not contain a valid URL');
        }

        const healthy = await probeCandidateApi(candidateUrl);
        if (!healthy) {
          throw new Error('Beacon tunnel endpoint failed /api/health verification');
        }

        localStorage.setItem('ag_api_base', candidateUrl);
        if (pairApiInput) pairApiInput.value = candidateUrl;
        consecutiveFailures = 0;
        setConnState('online', 'Tunnel route updated');
        if (manual) showToast('Discovered & verified live tunnel!');
        return candidateUrl;
      } catch (err) {
        console.warn('Beacon discovery failed:', err);
        if (manual) showToast(`Beacon sync failed: ${err.message}`, true);
        return null;
      } finally {
        beaconDiscoveryPromise = null;
      }
    })();

    return beaconDiscoveryPromise;
  }

  async function apiFetch(endpoint, options = {}, _isRetry = false) {
    if (isStaticLauncherHost() && !getApiBase()) {
      if (getGistId() && getToken()) {
        await discoverTunnelFromBeacon();
      }
      if (!getApiBase()) {
        setConnState('auth', 'Pairing Key Required');
        openPairingModal('Connect to your workstation by pasting your pairing link or scanning the PC QR code.');
        const err = new Error('Workstation pairing required');
        err.isAuthError = true;
        throw err;
      }
    }

    const base = getApiBase();
    const url = endpoint.startsWith('http') ? endpoint : `${base}${endpoint}`;
    const method = (options.method || 'GET').toUpperCase();
    const headers = new Headers(options.headers || {});

    const token = getToken();
    if (token) {
      headers.set('X-AG-Token', token);
    }
    if (
      options.body &&
      !(options.body instanceof FormData) &&
      typeof options.body === 'string' &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json');
    }

    const timeoutMs = options.timeoutMs || (method === 'GET' ? 8000 : 35000);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        method,
        headers,
        signal: ctrl.signal
      });

      if (res.status === 401 || res.status === 403 || res.status === 429) {
        stopPolling();
        if (res.status === 429) {
          setConnState('auth', 'Rate limited — wait 60s then re-pair');
          showToast('Too many failed auth attempts — wait 60s', true);
        } else {
          setConnState('auth', 'Pairing Key Required');
          openPairingModal('Workstation pairing required — paste your Pairing Key/Link or scan the PC QR code.');
        }
        const authErr = new Error(res.status === 429 ? 'Rate limited (429)' : 'Pairing key required');
        authErr.isAuthError = true;
        throw authErr;
      }

      if (res.status === 502 || res.status === 503 || res.status === 504 || res.status === 530) {
        throw new Error(`Tunnel unreachable (HTTP ${res.status})`);
      }

      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error(`Unexpected non-JSON response (HTTP ${res.status})`);
      }

      const wasDegraded = connState !== 'online' && connState !== 'daemon_offline';
      consecutiveFailures = 0;
      if (wasDegraded) {
        setConnState('online');
        if (!options.quiet) checkSystemHealthQuietly();
      }

      return res;
    } catch (err) {
      if (err && err.isAuthError) throw err;

      consecutiveFailures += 1;
      if (!navigator.onLine) {
        setConnState('offline', 'Phone network offline — waiting for connection');
      } else {
        setConnState(
          'reconnecting',
          `Reconnecting to ${cachedHostName} (attempt ${consecutiveFailures})...`
        );
      }

      if (!_isRetry && consecutiveFailures >= 2 && getGistId() && getToken()) {
        const newApi = await discoverTunnelFromBeacon();
        if (newApi) {
          return apiFetch(endpoint, options, true);
        }
        setConnState(
          'reconnecting',
          `Reconnecting to ${cachedHostName} (attempt ${consecutiveFailures})...`
        );
      }

      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async function checkSystemHealthQuietly() {
    try {
      const res = await apiFetch('/api/system', { quiet: true, timeoutMs: 6000 });
      const data = await res.json();
      if (data && data.hostname) {
        cachedHostName = data.hostname;
        localStorage.setItem('ag_hostname', cachedHostName);
      }
      if (data && data.daemon && data.daemon.running === false) {
        setConnState('daemon_offline', `Antigravity IDE closed on ${cachedHostName}`);
      } else if (connState === 'daemon_offline' || connState === 'online') {
        setConnState('online');
      }
    } catch (_) {}
  }

  function extractPairingFromString(raw) {
    const val = String(raw || '').trim();
    if (!val) return {};
    try {
      if (/^https?:\/\//i.test(val) || val.includes('#key=') || val.includes('?key=')) {
        const u = new URL(val, window.location.origin);
        const hp = new URLSearchParams(u.hash ? u.hash.slice(1) : '');
        const sp = u.searchParams;
        const key = hp.get('key') || hp.get('token') || sp.get('key') || sp.get('token') || '';
        const gist = hp.get('gist') || sp.get('gist') || '';
        let api = hp.get('api') || sp.get('api') || '';
        if (!api && /^https?:\/\//i.test(val) && !/\.(github\.io|pages\.dev)$/i.test(u.hostname)) {
          api = u.origin;
        }
        return { key: key.trim(), gist: gist.trim(), api: normalizeApiBase(api) };
      }
    } catch (_) {}
    return { key: val };
  }

  function stopQrScanner() {
    if (qrScanTimer) {
      clearInterval(qrScanTimer);
      qrScanTimer = null;
    }
    if (qrStream) {
      qrStream.getTracks().forEach((t) => t.stop());
      qrStream = null;
    }
    if (qrVideo) qrVideo.srcObject = null;
    if (qrScannerWrap) qrScannerWrap.classList.add('hide');
  }

  function openPairingModal(hintMessage, replaceModalState = false) {
    if (!modalPair) return;
    if (pairHintText && hintMessage) pairHintText.textContent = hintMessage;
    if (pairKeyInput) pairKeyInput.value = getToken();
    if (pairGistInput) pairGistInput.value = getGistId();
    if (pairApiInput) pairApiInput.value = getApiBase();

    const alreadyOpen = modalPair.classList.contains('open');
    modalPair.classList.add('open');
    if (!alreadyOpen) {
      if (replaceModalState) {
        history.replaceState({ modal: 'pair' }, '');
      } else {
        history.pushState({ modal: 'pair' }, '');
      }
    }
  }

  function closePairingModal() {
    stopQrScanner();
    if (modalPair && modalPair.classList.contains('open')) {
      if (history.state && history.state.modal === 'pair') history.back();
      else modalPair.classList.remove('open');
    }
  }

  if (btnPairTop) {
    btnPairTop.addEventListener('click', () => {
      vibrate(10);
      openPairingModal();
    });
  }

  if (pairKeyInput) {
    pairKeyInput.addEventListener('input', () => {
      const parsed = extractPairingFromString(pairKeyInput.value);
      if (parsed.key && (parsed.gist || parsed.api)) {
        pairKeyInput.value = parsed.key;
        if (parsed.gist && pairGistInput) pairGistInput.value = parsed.gist;
        if (parsed.api && pairApiInput) pairApiInput.value = parsed.api;
        showToast('Extracted key & endpoint from pairing link');
      }
    });
  }

  if (btnToggleKeyVis && pairKeyInput) {
    btnToggleKeyVis.addEventListener('click', () => {
      vibrate(8);
      pairKeyInput.type = pairKeyInput.type === 'password' ? 'text' : 'password';
    });
  }

  if (btnClosePair) {
    btnClosePair.addEventListener('click', () => closePairingModal());
  }

  if (btnStopQr) {
    btnStopQr.addEventListener('click', () => stopQrScanner());
  }

  if (btnScanQr) {
    btnScanQr.addEventListener('click', async () => {
      vibrate(10);
      if (!('BarcodeDetector' in window) || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Point your Android Camera app at the PC QR code, or paste the link above', true);
        return;
      }
      try {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        qrStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        qrVideo.srcObject = qrStream;
        await qrVideo.play();
        qrScannerWrap.classList.remove('hide');

        qrScanTimer = setInterval(async () => {
          if (!qrVideo || qrVideo.readyState < 2) return;
          try {
            const codes = await detector.detect(qrVideo);
            if (codes && codes.length > 0 && codes[0].rawValue) {
              vibrate([20, 40, 20]);
              const scanned = extractPairingFromString(codes[0].rawValue);
              stopQrScanner();
              if (scanned.key && pairKeyInput) pairKeyInput.value = scanned.key;
              if (scanned.gist && pairGistInput) pairGistInput.value = scanned.gist;
              if (scanned.api && pairApiInput) pairApiInput.value = scanned.api;
              btnSavePair.click();
            }
          } catch (_) {}
        }, 220);
      } catch (err) {
        stopQrScanner();
        showToast(`Camera unavailable: ${err.message}`, true);
      }
    });
  }

  if (btnSyncBeacon) {
    btnSyncBeacon.addEventListener('click', async () => {
      vibrate(10);
      if (pairKeyInput && pairKeyInput.value.trim()) {
        const p = extractPairingFromString(pairKeyInput.value);
        if (p.key) localStorage.setItem('ag_token', p.key);
      }
      if (pairGistInput && pairGistInput.value.trim()) {
        localStorage.setItem('ag_gist_id', pairGistInput.value.trim());
      }
      btnSyncBeacon.disabled = true;
      btnSyncBeacon.textContent = 'Syncing...';
      const found = await discoverTunnelFromBeacon({ manual: true });
      btnSyncBeacon.disabled = false;
      btnSyncBeacon.textContent = 'Sync Beacon';
      if (found) {
        closePairingModal();
        triggerImmediateReconnect();
      }
    });
  }

  if (btnSavePair) {
    btnSavePair.addEventListener('click', async () => {
      vibrate([10, 25]);
      const parsed = extractPairingFromString(pairKeyInput ? pairKeyInput.value : '');
      const keyVal = parsed.key || (pairKeyInput ? pairKeyInput.value.trim() : '');
      const gistVal = parsed.gist || (pairGistInput ? pairGistInput.value.trim() : '');
      const apiVal = normalizeApiBase(parsed.api || (pairApiInput ? pairApiInput.value : ''));

      if (keyVal) localStorage.setItem('ag_token', keyVal);
      else localStorage.removeItem('ag_token');

      if (gistVal) localStorage.setItem('ag_gist_id', gistVal);
      else localStorage.removeItem('ag_gist_id');

      if (apiVal) localStorage.setItem('ag_api_base', apiVal);
      else localStorage.removeItem('ag_api_base');

      consecutiveFailures = 0;
      if (connState === 'auth') setConnState('online');
      closePairingModal();
      showToast('Pairing saved — connecting...');
      await triggerImmediateReconnect();
    });
  }

  if (btnConnPair) {
    btnConnPair.addEventListener('click', () => {
      vibrate(10);
      openPairingModal();
    });
  }

  if (btnConnRetry) {
    btnConnRetry.addEventListener('click', () => {
      vibrate(10);
      consecutiveFailures = 0;
      triggerImmediateReconnect();
    });
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  }

  function scheduleNextPoll() {
    stopPolling();
    if (document.hidden || connState === 'auth') return;

    let delay;
    if (consecutiveFailures > 0) {
      const exp = Math.min(2000 * Math.pow(1.8, Math.min(consecutiveFailures - 1, 5)), 30000);
      delay = Math.round(exp * (0.85 + Math.random() * 0.3));
    } else if (currentConvoId) {
      delay = wasLastSessionActive ? 1800 : 3200;
    } else {
      delay = connState === 'daemon_offline' ? 6000 : 15000;
    }

    pollTimer = setTimeout(async () => {
      if (currentConvoId) {
        await loadChatMessages(false);
      } else {
        await loadConversations(true);
        if (connState === 'daemon_offline') await checkSystemHealthQuietly();
      }
      scheduleNextPoll();
    }, delay);
  }

  async function triggerImmediateReconnect() {
    stopPolling();
    if (getGistId() && getToken() && isStaticLauncherHost() && !getApiBase()) {
      await discoverTunnelFromBeacon();
    }
    if (currentConvoId) {
      await loadChatMessages(true);
    } else {
      await loadConversations(false);
    }
    checkSystemHealthQuietly();
    scheduleNextPoll();
  }

  // --------------------------------------------------------------------------
  // Navigation & Views with Android Hardware Back Support
  // --------------------------------------------------------------------------
  function showConversationsView(pushHistory = false) {
    currentConvoId = null;
    lastMessageCount = 0;
    wasLastSessionActive = false;
    stopPolling();
    
    appTitle.textContent = 'Antigravity';
    syncTopSubtitle();
    btnBack.classList.add('hide');
    if (btnArtifacts) btnArtifacts.classList.add('hide');
    viewChat.classList.remove('active');
    viewConversations.classList.add('active');

    if (pushHistory) {
      history.pushState({ view: 'conversations' }, '');
    }

    loadConversations(false).finally(() => scheduleNextPoll());
  }

  function showChatView(convoId, title, pushHistory = true) {
    currentConvoId = convoId;
    lastMessageCount = 0;
    wasLastSessionActive = false;
    stopPolling();
    chatFeed.innerHTML = '<div class="loader-box"><div class="spinner"></div><p>Loading session...</p></div>';

    appTitle.textContent = title || 'Session';
    btnBack.classList.remove('hide');
    if (btnArtifacts) btnArtifacts.classList.remove('hide');
    viewConversations.classList.remove('active');
    viewChat.classList.add('active');

    if (pushHistory) {
      history.pushState({ view: 'chat', convoId, title }, '');
    }

    loadChatMessages(true).finally(() => scheduleNextPoll());
  }

  // Handle Android Hardware Back Button and Edge Swipes
  window.addEventListener('popstate', (e) => {
    // 1. If any modal bottom sheet is currently open, close it first
    const openModals = document.querySelectorAll('.bottom-sheet-backdrop.open');
    if (openModals.length > 0) {
      stopQrScanner();
      openModals.forEach(m => m.classList.remove('open'));
      return;
    }

    // 2. Route between chat and conversations
    const state = e.state;
    if (state && state.view === 'chat' && state.convoId) {
      showChatView(state.convoId, state.title, false);
    } else {
      showConversationsView(false);
    }
  });

  // --------------------------------------------------------------------------
  // Data Fetching & Filtering
  // --------------------------------------------------------------------------
  async function loadConversations(isBackground = false) {
    try {
      const res = await apiFetch('/api/conversations');
      const data = await res.json();
      conversations = data.conversations || [];
      if (data.daemon && data.daemon.running === false) {
        setConnState('daemon_offline', `Antigravity IDE closed on ${cachedHostName}`);
      }
      updateFilterCounts(conversations);
      renderConversationList(conversations);
    } catch (e) {
      if (conversations.length === 0 && !isBackground) {
        const msg = e && e.isAuthError
          ? 'Workstation pairing key required.'
          : `Waiting for ${escapeHtml(cachedHostName)} (${escapeHtml(e.message || 'reconnecting')})`;
        convoList.innerHTML = `<div class="loader-box"><p>${msg}</p></div>`;
      }
    }
  }

  function updateFilterCounts(items) {
    const activeCount = items.filter(c => c.isActive).length;
    const chatsCount = items.filter(c => !c.isSubagent).length;
    const subagentsCount = items.filter(c => c.isSubagent).length;

    if (countAll) countAll.textContent = items.length;
    if (countChats) countChats.textContent = chatsCount;
    if (countSubagents) countSubagents.textContent = subagentsCount;
    if (countActive) countActive.textContent = activeCount;
  }

  function renderConversationList(items) {
    const filter = (filterInput.value || '').toLowerCase();

    const filtered = items.filter(c => {
      const matchesSearch = (c.title || '').toLowerCase().includes(filter) ||
                            (c.preview || '').toLowerCase().includes(filter);
      if (!matchesSearch) return false;

      if (currentFilter === 'chats') return !c.isSubagent;
      if (currentFilter === 'subagents') return c.isSubagent;
      if (currentFilter === 'active') return c.isActive;
      return true;
    });

    if (filtered.length === 0) {
      convoList.innerHTML = '<div class="loader-box"><p>No sessions matching criteria.</p></div>';
      return;
    }

    convoList.innerHTML = filtered.map(c => {
      const typeChip = c.isSubagent 
        ? `<span class="type-chip subagent">🤖 ${escapeHtml(c.agentName || 'Subagent')}</span>`
        : `<span class="type-chip chat">💬 Chat</span>`;

      return `
        <div class="convo-card ${c.isSubagent ? 'subagent-card' : ''} ${c.isActive ? 'active-run' : ''}" data-id="${c.id}" data-title="${escapeHtml(c.title)}">
          <div class="convo-header">
            <span class="convo-title">${escapeHtml(c.title)}</span>
            <div style="display:flex;align-items:center;gap:6px;">
              ${typeChip}
              ${c.isActive ? '<span class="active-chip">Running</span>' : ''}
            </div>
          </div>
          <div class="convo-preview">${escapeHtml(c.preview || 'No messages yet.')}</div>
          <div class="convo-meta">
            <span>${timeAgo(c.lastModified)}</span>
            <span>&bull;</span>
            <span>${c.stepCount} steps</span>
            ${c.nestingDepth > 0 ? `<span>&bull;</span><span>Depth ${c.nestingDepth}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    convoList.querySelectorAll('.convo-card').forEach(card => {
      card.addEventListener('click', () => {
        vibrate(10);
        showChatView(card.dataset.id, card.dataset.title);
      });
    });
  }

  // Filter tab buttons
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      vibrate(8);
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.filter;
      renderConversationList(conversations);
    });
  });

  async function loadChatMessages(forceScroll = false) {
    if (!currentConvoId) return;

    try {
      const res = await apiFetch(`/api/conversations/${currentConvoId}`);
      const data = await res.json();
      if (!data || !data.messages) return;

      // Detect task completion transition
      if (wasLastSessionActive && !data.isActive) {
        triggerTaskFinishedAlert(data.title || 'Session');
      }
      wasLastSessionActive = data.isActive;

      // Update subtitle status with subagent indicator
      const sub = document.getElementById('appSubtitle');
      const isRunning = data.isActive;
      const dotHtml = isRunning 
        ? '<span class="pulse-dot"></span>' 
        : '<span class="pulse-dot" style="background-color:#9aa0a6;box-shadow:none"></span>';

      if (data.isSubagent) {
        sub.innerHTML = `${dotHtml} 🤖 Subagent (${escapeHtml(data.agentName || 'Agent')}${data.nestingDepth ? ' • L' + data.nestingDepth : ''}) • ${isRunning ? 'Running' : 'Idle'}`;
      } else {
        sub.innerHTML = `${dotHtml} 💬 Chat • ${isRunning ? 'Running' : 'Idle'}`;
      }

      // Update subagent hierarchy navigation bar (safe data-* delegation, immune to quote breakout)
      if (data.parentId || (data.children && data.children.length > 0)) {
        subagentNavRow.classList.remove('hide');
        let navHtml = '';
        if (data.parentId) {
          navHtml += `<button class="subagent-nav-btn" data-convo-id="${escapeHtml(data.parentId)}" data-convo-title="Parent Chat">↩ Parent Chat</button>`;
        }
        if (data.children && data.children.length > 0) {
          navHtml += `<span style="font-size:12px;color:var(--text-secondary);display:inline-flex;align-items:center;gap:4px;">🤖 Subagents (${data.children.length}):</span>`;
          data.children.forEach(ch => {
            navHtml += `<button class="subagent-nav-btn" data-convo-id="${escapeHtml(ch.id)}" data-convo-title="${escapeHtml(ch.title)}">${ch.isActive ? '⚡' : '🤖'} ${escapeHtml(ch.title)}</button>`;
          });
        }
        subagentNavRow.innerHTML = navHtml;
        subagentNavRow.querySelectorAll('.subagent-nav-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            window.openConvo(btn.dataset.convoId, btn.dataset.convoTitle);
          });
        });
      } else {
        subagentNavRow.classList.add('hide');
      }

      const messages = data.messages;
      const countChanged = messages.length !== lastMessageCount;

      if (countChanged) {
        renderMessages(messages);
        if (messages.length > lastMessageCount) {
          if (!forceScroll) vibrate(20);
          scrollToBottom();
        }
        lastMessageCount = messages.length;
      }

      // Live thinking shimmer card management
      let thinkingCard = document.getElementById('liveThinkingCard');
      if (data.isActive) {
        if (!thinkingCard) {
          thinkingCard = document.createElement('div');
          thinkingCard.id = 'liveThinkingCard';
          thinkingCard.className = 'agent-thinking-card';
          thinkingCard.innerHTML = `
            <div class="agent-thinking-icon">
              <svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8A8 8 0 0 1 12 20Zm-1-13h2v6h-2Zm0 8h2v2h-2Z"/></svg>
            </div>
            <div class="agent-thinking-text">
              <span>Antigravity is actively executing...</span>
              <span class="agent-thinking-sub">Running tools and generating response</span>
            </div>
          `;
          chatFeed.appendChild(thinkingCard);
          scrollToBottom();
        }
      } else {
        if (thinkingCard) thinkingCard.remove();
      }
    } catch (e) {
      console.warn('Poll error:', e);
    }
  }

  function renderMessages(messages) {
    if (messages.length === 0) {
      chatFeed.innerHTML = '<div class="loader-box"><p>No messages in this session yet.<br>Type below to send a prompt.</p></div>';
      return;
    }

    let html = '';
    messages.forEach(msg => {
      if (msg.role === 'user') {
        html += `
          <div class="message-bubble user">
            ${escapeHtml(msg.content)}
          </div>
        `;
      } else if (msg.type === 'thinking') {
        html += `
          <div class="thinking-box">
            <div class="thinking-header" onclick="this.nextElementSibling.classList.toggle('hide')">
              <span>&#128161; Thinking Process</span>
              <span>&#9662;</span>
            </div>
            <div class="thinking-content hide">${escapeHtml(msg.content)}</div>
          </div>
        `;
      } else if (msg.type === 'tool_call') {
        const rawJsonAttr = msg.toolArgs ? escapeHtml(JSON.stringify(msg.toolArgs)) : '{}';
        if (msg.toolName === 'invoke_subagent') {
          const role = msg.toolArgs ? (msg.toolArgs.Role || msg.toolArgs.TypeName || 'Subagent') : 'Subagent';
          html += `
            <div class="tool-chip" style="background-color:rgba(179,136,255,0.18);border-color:rgba(179,136,255,0.4);color:#d1b3ff;" onclick="inspectTool('${escapeHtml(msg.toolName)}', this.dataset.args)" data-args="${rawJsonAttr}">
              <span>🤖 Invoked Subagent: <strong>${escapeHtml(role)}</strong></span>
            </div>
          `;
        } else {
          html += `
            <div class="tool-chip" onclick="inspectTool('${escapeHtml(msg.toolName || 'tool')}', this.dataset.args)" data-args="${rawJsonAttr}">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>
              <span>${escapeHtml(msg.toolName || 'tool')}</span>
            </div>
          `;
        }
      } else if (msg.role === 'assistant' && msg.type === 'text') {
        const textToSpeakAttr = encodeURIComponent(msg.content);
        html += `
          <div class="message-bubble assistant">
            <div class="message-text">
              ${renderMarkdown(msg.content)}
            </div>
            <div class="message-action-bar">
              <button class="msg-action-btn btn-speak" onclick="speakMessage(this, decodeURIComponent('${textToSpeakAttr}'))" title="Listen aloud">
                <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                <span>Listen</span>
              </button>
              <button class="msg-action-btn" onclick="copyAssistantMessage(this)" title="Copy message">
                <svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
                <span>Copy</span>
              </button>
            </div>
          </div>
        `;
      }
    });

    chatFeed.innerHTML = html;
  }

  // Tool Call Inspector Modal with Code Diff Viewer
  window.inspectTool = function (name, argsJson) {
    vibrate(10);
    inspectorTitle.textContent = `Tool: ${name}`;
    let parsed = null;
    let formattedArgs = '';
    try {
      parsed = JSON.parse(argsJson);
      formattedArgs = JSON.stringify(parsed, null, 2);
    } catch (e) {
      formattedArgs = argsJson;
    }

    let extraHtml = '';

    // If edit_file, render visual red/green code diff
    if (name === 'edit_file' && parsed && parsed.Target !== undefined && parsed.Replacement !== undefined) {
      extraHtml = `
        <div class="diff-container">
          <div class="diff-file-path">📝 ${escapeHtml(parsed.Path || 'File Edit')}</div>
          <div class="diff-block">
            <div class="diff-line diff-del"><span class="diff-prefix">-</span><span>${escapeHtml(parsed.Target)}</span></div>
            <div class="diff-line diff-add"><span class="diff-prefix">+</span><span>${escapeHtml(parsed.Replacement)}</span></div>
          </div>
        </div>
      `;
    } else if (name === 'run_command' && parsed && parsed.CommandLine) {
      extraHtml = `
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:6px;">Task: <strong>${escapeHtml(parsed.toolSummary || '')}</strong></div>
        <div class="code-block-wrapper">
          <div class="code-header">
            <span>powershell</span>
            <button class="copy-btn" onclick="copyCode(this)">Copy</button>
          </div>
          <pre><code class="lang-powershell">${escapeHtml(parsed.CommandLine)}</code></pre>
        </div>
      `;
    } else if (name === 'read_file' && parsed && parsed.Path) {
      extraHtml = `
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:6px;">File: <code>${escapeHtml(parsed.Path)}</code></div>
        ${parsed.StartLine ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">Lines: ${parsed.StartLine} - ${parsed.EndLine || 'end'}</div>` : ''}
      `;
    }

    inspectorContent.innerHTML = `
      ${extraHtml}
      <div style="font-size:13px;color:var(--text-secondary);margin:8px 0 4px;">Raw Tool Arguments:</div>
      <div class="code-block-wrapper">
        <div class="code-header">
          <span>json</span>
          <button class="copy-btn" onclick="copyCode(this)">Copy</button>
        </div>
        <pre><code class="lang-json">${escapeHtml(formattedArgs)}</code></pre>
      </div>
    `;
    modalToolInspector.classList.add('open');
    history.pushState({ modal: 'inspector' }, '');
  };

  if (btnCloseInspector) {
    btnCloseInspector.addEventListener('click', () => {
      if (history.state && history.state.modal) history.back();
      else modalToolInspector.classList.remove('open');
    });
  }

  // Scroll to bottom helper and floating button
  function scrollToBottom() {
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  if (chatFeed && btnScrollBottom) {
    chatFeed.addEventListener('scroll', () => {
      const distFromBottom = chatFeed.scrollHeight - chatFeed.scrollTop - chatFeed.clientHeight;
      if (distFromBottom > 160) {
        btnScrollBottom.classList.remove('hide');
      } else {
        btnScrollBottom.classList.add('hide');
      }
    });

    btnScrollBottom.addEventListener('click', () => {
      vibrate(10);
      chatFeed.scrollTo({ top: chatFeed.scrollHeight, behavior: 'smooth' });
    });
  }

  // --------------------------------------------------------------------------
  // Attachments & Photo Uploads
  // --------------------------------------------------------------------------
  if (btnAttach && mediaUploadInput) {
    btnAttach.addEventListener('click', () => {
      vibrate(10);
      mediaUploadInput.click();
    });

    mediaUploadInput.addEventListener('change', () => {
      if (mediaUploadInput.files && mediaUploadInput.files[0]) {
        const file = mediaUploadInput.files[0];
        pendingAttachment = file;

        // Preview
        attachFileName.textContent = file.name;
        attachFileSize.textContent = (file.size / 1024).toFixed(1) + ' KB';

        const reader = new FileReader();
        reader.onload = (e) => {
          attachThumbnail.src = e.target.result;
          attachPreviewContainer.classList.remove('hide');
        };
        reader.readAsDataURL(file);
        vibrate(15);
      }
    });

    if (btnRemoveAttach) {
      btnRemoveAttach.addEventListener('click', () => {
        vibrate(5);
        clearPendingAttachment();
      });
    }
  }

  function clearPendingAttachment() {
    pendingAttachment = null;
    if (mediaUploadInput) mediaUploadInput.value = '';
    if (attachPreviewContainer) attachPreviewContainer.classList.add('hide');
    if (attachThumbnail) attachThumbnail.src = '';
  }

  // --------------------------------------------------------------------------
  // Message Sending
  // --------------------------------------------------------------------------
  async function sendMessage(textToSend) {
    let text = (textToSend || promptInput.value).trim();
    if (!text && !pendingAttachment) return;
    if (!currentConvoId) return;

    vibrate([10, 30]);
    promptInput.value = '';
    promptInput.style.height = 'auto';

    btnSend.disabled = true;

    // Handle photo/media upload if attached
    if (pendingAttachment) {
      showToast('Uploading attachment...');
      const formData = new FormData();
      formData.append('file', pendingAttachment);
      try {
        const uploadRes = await apiFetch(`/api/conversations/${currentConvoId}/upload`, {
          method: 'POST',
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.filePath) {
          const photoRef = `[Attached mobile upload: ${uploadData.filePath}]`;
          text = text ? `${photoRef}\n\n${text}` : `${photoRef}\nPlease analyze this uploaded photo.`;
        } else {
          showToast('Upload failed: ' + (uploadData.error || 'Unknown error'), true);
        }
      } catch (uploadErr) {
        showToast('Upload network error: ' + uploadErr.message, true);
      }
      clearPendingAttachment();
    }

    // Optimistically render user message
    const tempUserMsg = document.createElement('div');
    tempUserMsg.className = 'message-bubble user';
    tempUserMsg.textContent = text;
    chatFeed.appendChild(tempUserMsg);
    scrollToBottom();

    try {
      const res = await apiFetch(`/api/conversations/${currentConvoId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: text })
      });
      const data = await res.json();
      btnSend.disabled = false;

      if (data.error) {
        showToast('Error: ' + data.error, true);
      } else {
        showToast('Prompt sent to agent');
        setTimeout(() => loadChatMessages(true), 500);
      }
    } catch (e) {
      btnSend.disabled = false;
      showToast('Network error: ' + e.message, true);
    }
  }

  // Quick Action Chips Event Delegation
  if (quickChipsBar) {
    quickChipsBar.querySelectorAll('.quick-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.dataset.prompt;
        if (prompt) {
          vibrate(10);
          promptInput.value = prompt;
          promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
          promptInput.focus();
          showToast('Prompt inserted');
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Voice Input (Web Speech Recognition for Android)
  // --------------------------------------------------------------------------
  let recognition = null;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      btnVoice.classList.add('listening');
      vibrate(20);
      showToast('Listening...');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      promptInput.value = (promptInput.value ? promptInput.value + ' ' : '') + transcript;
      vibrate([10, 20]);
    };

    recognition.onerror = () => {
      btnVoice.classList.remove('listening');
    };

    recognition.onend = () => {
      btnVoice.classList.remove('listening');
    };

    btnVoice.addEventListener('click', () => {
      try {
        recognition.start();
      } catch (e) {
        recognition.stop();
      }
    });
  } else {
    btnVoice.style.display = 'none';
  }

  // --------------------------------------------------------------------------
  // New Conversation Modal
  // --------------------------------------------------------------------------
  fabNew.addEventListener('click', () => {
    vibrate(10);
    modalNewConvo.classList.add('open');
    history.pushState({ modal: 'new' }, '');
  });

  btnCloseSheet.addEventListener('click', () => {
    if (history.state && history.state.modal) history.back();
    else modalNewConvo.classList.remove('open');
  });

  modelChips.querySelectorAll('.m3-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      vibrate(5);
      modelChips.querySelectorAll('.m3-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedModel = chip.dataset.model;
    });
  });

  btnSubmitNewConvo.addEventListener('click', async () => {
    const prompt = document.getElementById('newPrompt').value.trim();
    const title = document.getElementById('newTitle').value.trim();

    if (!prompt) {
      showToast('Please enter a goal or prompt', true);
      return;
    }

    vibrate([15, 30]);
    btnSubmitNewConvo.disabled = true;
    btnSubmitNewConvo.innerHTML = '<span>Launching...</span>';

    try {
      const res = await apiFetch('/api/conversations/new', {
        method: 'POST',
        body: JSON.stringify({ prompt, title, model: selectedModel })
      });
      const data = await res.json();
      btnSubmitNewConvo.disabled = false;
      btnSubmitNewConvo.innerHTML = '<span>Launch Agent</span>';

      if (data.error) {
        showToast('Failed: ' + data.error, true);
      } else {
        showToast('Agent launched successfully!');
        if (history.state && history.state.modal) history.back();
        else modalNewConvo.classList.remove('open');
        document.getElementById('newPrompt').value = '';
        document.getElementById('newTitle').value = '';
        showConversationsView();
      }
    } catch (e) {
      btnSubmitNewConvo.disabled = false;
      btnSubmitNewConvo.innerHTML = '<span>Launch Agent</span>';
      showToast('Network error: ' + e.message, true);
    }
  });

  // --------------------------------------------------------------------------
  // Workstation Info Modal
  // --------------------------------------------------------------------------
  btnInfo.addEventListener('click', async () => {
    vibrate(10);
    modalInfo.classList.add('open');
    history.pushState({ modal: 'info' }, '');
    infoDetails.innerHTML = '<div class="spinner"></div>';

    const pairBtnHtml = `
      <button id="btnOpenPairFromInfo" class="m3-secondary-btn" type="button" style="margin-top:10px;width:100%;">
        Re-pair / Endpoint Settings
      </button>
    `;

    try {
      const res = await apiFetch('/api/system');
      const data = await res.json();
      if (data.hostname) {
        cachedHostName = data.hostname;
        localStorage.setItem('ag_hostname', cachedHostName);
      }
      if (data.daemon && data.daemon.running === false) {
        setConnState('daemon_offline', `Antigravity IDE closed on ${cachedHostName}`);
      }
      const activeEndpoint = getApiBase() || window.location.origin;
      infoDetails.innerHTML = `
        <div style="font-size:14px;display:flex;flex-direction:column;gap:8px;">
          <div><strong>Host Machine:</strong> ${escapeHtml(data.hostname || 'PC')}</div>
          <div><strong>Active Endpoint:</strong> <code style="word-break:break-all;">${escapeHtml(activeEndpoint)}</code></div>
          <div><strong>LAN IP (Wi-Fi):</strong> <code>${escapeHtml(((data.ips && data.ips.lan) || []).join(', '))}</code></div>
          ${data.ips && data.ips.tailscale ? `<div><strong>Tailscale IP:</strong> <code>${escapeHtml(data.ips.tailscale)}</code></div>` : ''}
          ${data.tunnelUrl ? `<div><strong>HTTPS Remote Tunnel:</strong> <a href="${escapeHtml(data.tunnelUrl)}" target="_blank" style="color:var(--primary);word-break:break-all;">${escapeHtml(data.tunnelUrl)}</a></div>` : ''}
          ${data.permanentPwaUrl ? `<div><strong>Permanent PWA Origin:</strong> <code style="word-break:break-all;">${escapeHtml(data.permanentPwaUrl)}</code></div>` : ''}
          <div><strong>Beacon Auto-Failover:</strong> ${getGistId() ? '<span style="color:var(--active-green)">Active (AES-256-GCM)</span>' : '<span style="color:var(--text-secondary)">Not configured</span>'}</div>
          <div><strong>Antigravity Daemon:</strong> ${data.daemon && data.daemon.running ? '<span style="color:var(--active-green)">Active (Port ' + escapeHtml(String(data.daemon.httpPort)) + ')</span>' : '<span style="color:#ffb74d">Offline</span>'}</div>
          ${pairBtnHtml}
        </div>
      `;
    } catch (e) {
      infoDetails.innerHTML = `
        <div style="font-size:14px;display:flex;flex-direction:column;gap:10px;">
          <p style="color:#ff897d">Unable to reach workstation: ${escapeHtml(e.message)}</p>
          <div><strong>Configured Endpoint:</strong> <code style="word-break:break-all;">${escapeHtml(getApiBase() || '(Same Origin)')}</code></div>
          ${pairBtnHtml}
        </div>
      `;
    }

    const btnPairInfo = document.getElementById('btnOpenPairFromInfo');
    if (btnPairInfo) {
      btnPairInfo.addEventListener('click', () => {
        vibrate(10);
        modalInfo.classList.remove('open');
        openPairingModal(null, true);
      });
    }
  });

  btnCloseInfo.addEventListener('click', () => {
    if (history.state && history.state.modal) history.back();
    else modalInfo.classList.remove('open');
  });

  // Auto-resize prompt textarea
  promptInput.addEventListener('input', () => {
    promptInput.style.height = 'auto';
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + 'px';
  });

  // Event Listeners
  btnBack.addEventListener('click', () => {
    vibrate(10);
    if (history.state && history.state.view === 'chat') {
      history.back();
    } else {
      showConversationsView();
    }
  });
  btnRefresh.addEventListener('click', () => {
    vibrate(10);
    if (currentConvoId) loadChatMessages(true);
    else loadConversations();
    showToast('Refreshed');
  });
  btnSend.addEventListener('click', () => sendMessage());
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  filterInput.addEventListener('input', () => renderConversationList(conversations));

  // --------------------------------------------------------------------------
  // Artifacts & Reports Reader Modal
  // --------------------------------------------------------------------------
  if (btnArtifacts) {
    btnArtifacts.addEventListener('click', async () => {
      vibrate(10);
      if (!currentConvoId) return;

      modalArtifacts.classList.add('open');
      history.pushState({ modal: 'artifacts' }, '');
      artifactsContent.innerHTML = '<div class="spinner"></div><p style="text-align:center;color:var(--text-secondary);">Scanning conversation artifacts...</p>';

      try {
        const res = await apiFetch(`/api/conversations/${currentConvoId}/artifacts`);
        const data = await res.json();
        const artifacts = data.artifacts || [];

        if (artifacts.length === 0) {
          artifactsContent.innerHTML = `
            <div class="loader-box">
              <svg viewBox="0 0 24 24" width="48" height="48" style="color:var(--text-secondary);margin-bottom:8px;"><path fill="currentColor" d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
              <p>No markdown artifacts or reports generated in this session yet.</p>
            </div>
          `;
          return;
        }

        let html = '<div class="artifact-list">';
        artifacts.forEach((art, idx) => {
          html += `
            <div class="artifact-card" data-idx="${idx}">
              <div class="artifact-card-info">
                <span class="artifact-card-title">📄 ${escapeHtml(art.name)}</span>
                <span class="artifact-card-size">${(art.size / 1024).toFixed(1)} KB • Markdown Document</span>
              </div>
              <svg viewBox="0 0 24 24" width="20" height="20" style="color:var(--text-secondary);"><path fill="currentColor" d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
            </div>
          `;
        });
        html += '</div>';
        artifactsContent.innerHTML = html;

        artifactsContent.querySelectorAll('.artifact-card').forEach(card => {
          card.addEventListener('click', () => {
            vibrate(10);
            const art = artifacts[parseInt(card.dataset.idx, 10)];
            renderArtifactReader(art);
          });
        });
      } catch (e) {
        artifactsContent.innerHTML = `<p style="color:#ff6b6b">Error loading artifacts: ${e.message}</p>`;
      }
    });
  }

  function renderArtifactReader(artifact) {
    artifactsContent.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <button id="btnArtifactBack" class="subagent-nav-btn">↩ All Artifacts</button>
        <button class="copy-btn" id="btnCopyArtifact">Copy Document</button>
      </div>
      <div class="artifact-view-pane">
        <h3 style="margin-top:0;color:var(--primary);border-bottom:1px solid var(--outline);padding-bottom:8px;">${escapeHtml(artifact.name)}</h3>
        <div class="markdown-body">${renderMarkdown(artifact.content)}</div>
      </div>
    `;

    document.getElementById('btnCopyArtifact').addEventListener('click', () => {
      vibrate(10);
      navigator.clipboard.writeText(artifact.content).catch(() => {});
      showToast('Document copied to clipboard');
    });

    document.getElementById('btnArtifactBack').addEventListener('click', () => {
      vibrate(10);
      btnArtifacts.click();
    });
  }

  if (btnCloseArtifacts) {
    btnCloseArtifacts.addEventListener('click', () => {
      if (history.state && history.state.modal) history.back();
      else modalArtifacts.classList.remove('open');
    });
  }

  // --------------------------------------------------------------------------
  // Text-To-Speech (Listen Aloud with Android Google TTS)
  // --------------------------------------------------------------------------
  let currentSpeakingBtn = null;

  window.speakMessage = function (btn, text) {
    vibrate(15);
    if (!('speechSynthesis' in window)) {
      showToast('Text-to-speech not supported on this device', true);
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (currentSpeakingBtn) {
        currentSpeakingBtn.classList.remove('speaking');
        currentSpeakingBtn.querySelector('span').textContent = 'Listen';
      }
      if (currentSpeakingBtn === btn) {
        currentSpeakingBtn = null;
        return;
      }
    }

    // Clean text for natural speech reading
    const clean = text
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`.*?`/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[*_~#>-]/g, '')
      .replace(/file:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) {
      showToast('No readable text to speak');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      btn.classList.add('speaking');
      btn.querySelector('span').textContent = 'Stop';
      currentSpeakingBtn = btn;
    };

    utterance.onend = () => {
      btn.classList.remove('speaking');
      btn.querySelector('span').textContent = 'Listen';
      currentSpeakingBtn = null;
    };

    utterance.onerror = () => {
      btn.classList.remove('speaking');
      btn.querySelector('span').textContent = 'Listen';
      currentSpeakingBtn = null;
    };

    window.speechSynthesis.speak(utterance);
  };

  window.copyAssistantMessage = function (btn) {
    vibrate(10);
    const bubble = btn.closest('.message-bubble');
    const textEl = bubble ? bubble.querySelector('.message-text') : null;
    const content = textEl ? textEl.innerText : '';
    if (content) {
      navigator.clipboard.writeText(content).then(() => {
        showToast('Copied to clipboard');
      }).catch(() => {
        showToast('Copy failed', true);
      });
    }
  };

  // --------------------------------------------------------------------------
  // Pull-To-Refresh for Android Touch Screens
  // --------------------------------------------------------------------------
  let touchStartY = 0;
  let isPulling = false;
  const pullEl = document.getElementById('pullRefreshIndicator');

  if (convoList && pullEl) {
    convoList.addEventListener('touchstart', (e) => {
      if (convoList.scrollTop <= 0) {
        touchStartY = e.touches[0].clientY;
        isPulling = true;
      } else {
        isPulling = false;
      }
    }, { passive: true });

    convoList.addEventListener('touchmove', (e) => {
      if (!isPulling) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY;
      if (diff > 25 && convoList.scrollTop <= 0) {
        pullEl.classList.add('pulling');
      }
    }, { passive: true });

    convoList.addEventListener('touchend', () => {
      if (isPulling && pullEl.classList.contains('pulling')) {
        vibrate(20);
        pullEl.classList.remove('pulling');
        showToast('Refreshing sessions...');
        loadConversations();
      }
      isPulling = false;
    }, { passive: true });
  }

  // Auto-reconnect & resume when phone is unlocked or browser tab is focused
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (connState === 'auth') return;
      consecutiveFailures = 0;
      triggerImmediateReconnect();
    } else {
      stopPolling();
    }
  });

  window.addEventListener('online', () => {
    showToast('Network connected');
    if (connState === 'auth') return;
    consecutiveFailures = 0;
    triggerImmediateReconnect();
  });

  window.addEventListener('offline', () => {
    setConnState('offline', 'Phone network offline — waiting for connection');
    showToast('Network offline', true);
  });

  // Initialize with base state for Android back navigation
  try {
    history.replaceState({ view: 'conversations' }, '');
  } catch (e) {}
  showConversationsView();
  checkSystemHealthQuietly();
})();
