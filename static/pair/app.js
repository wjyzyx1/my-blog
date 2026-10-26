/* 两只 — PaperMod 风格原型
   本地 localStorage 演示，无网络请求。 */

(() => {
  'use strict';

  const KEY = 'pair.proto.v1';
  const app = document.getElementById('pair-app');
  if (!app) return;

  const TABS = [
    ['home', '首页'],
    ['todos', '待办'],
    ['memos', '便签'],
    ['anniv', '纪念日'],
    ['memories', '回忆'],
    ['settings', '设置']
  ];

  let state;
  let activeTab = 'home';
  let todoFilter = 'all';
  let memoryQuery = '';
  let memoryCategory = 'all';
  let pendingImages = [];
  let pendingAvatar = '';
  let posterDataUrl = '';
  let toastTimer = null;
  let davConfig = null;
  let spaceKey = null;
  let syncStatus = { state: 'idle', message: '未连接', lastSync: 0 };
  let syncDebounce = null;
  let syncing = false;
  let pendingSync = false;

  /* ---------- 基础工具 ---------- */

  const pad = n => String(n).padStart(2, '0');

  function uid() {
    return (crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function parseISO(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtISO(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function todayISO() {
    return fmtISO(new Date());
  }

  function addDays(iso, n) {
    const d = parseISO(iso);
    if (!d) return iso;
    d.setDate(d.getDate() + n);
    return fmtISO(d);
  }

  function daysBetween(a, b) {
    const da = parseISO(a);
    const db = parseISO(b);
    if (!da || !db) return 0;
    return Math.round((db - da) / 86400000);
  }

  function daysTogether() {
    return Math.max(1, daysBetween(state.startDate, todayISO()) + 1);
  }

  function fmtShort(iso) {
    const d = parseISO(iso);
    return d ? `${d.getMonth() + 1}月${d.getDate()}日` : '';
  }

  function fmtDate(iso) {
    const d = parseISO(iso);
    return d ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` : '';
  }

  function fmtMonthDay(mmdd) {
    const [m, d] = String(mmdd || '').split('-').map(Number);
    return m && d ? `${m}月${d}日` : '';
  }

  function nextAnniversary(mmdd) {
    const [m, d] = String(mmdd || '').split('-').map(Number);
    if (!m || !d) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let next = new Date(now.getFullYear(), m - 1, d);
    if (next < today) next = new Date(now.getFullYear() + 1, m - 1, d);
    return next;
  }

  function daysUntil(mmdd) {
    const next = nextAnniversary(mmdd);
    if (!next) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((next - today) / 86400000);
  }

  function dueLabel(due, done) {
    if (!due) return '无日期';
    if (done) return fmtShort(due);
    const n = daysBetween(todayISO(), due);
    if (n < 0) return `已过期 ${Math.abs(n)} 天`;
    if (n === 0) return '今天';
    if (n === 1) return '明天';
    return `${n} 天后`;
  }

  function fmtCommentTime(at) {
    const d = at ? new Date(at) : null;
    if (!d || isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function member(id) {
    return (state.members && state.members[id]) || { name: '?', avatar: '' };
  }

  function authorName(author) {
    return author === 'both' ? '一起' : member(author).name;
  }

  function toast(message) {
    let el = document.getElementById('pair-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pair-toast';
      el.className = 'pair-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  /* ---------- 示例数据 ---------- */

  function seedState() {
    const t = todayISO();
    const now = Date.now();
    const comment = (author, text, minutesAgo) => ({
      id: uid(), author, text, at: new Date(now - minutesAgo * 60000).toISOString()
    });

    const seed = {
      v: 1,
      startDate: '2022-11-15',
      current: 'A',
      members: {
        A: { name: '鑫姐', avatar: '' },
        B: { name: '耀哥', avatar: '' }
      },
      todos: [
        { id: uid(), title: '订周五的电影票', due: t, author: 'A', notes: '19:30 那场', done: false },
        { id: uid(), title: '把阳台的绿萝换盆', due: addDays(t, 1), author: 'B', notes: '', done: false },
        { id: uid(), title: '一起做一次晚饭', due: addDays(t, 3), author: 'both', notes: '想试番茄牛腩', done: false },
        { id: uid(), title: '整理上个月的照片', due: addDays(t, 7), author: 'B', notes: '', done: false },
        { id: uid(), title: '交水电费', due: addDays(t, -1), author: 'A', notes: '', done: true },
        { id: uid(), title: '预约周末的牙医', due: addDays(t, 10), author: 'B', notes: '', done: false },
        { id: uid(), title: '给猫买粮', due: addDays(t, 5), author: 'A', notes: '', done: false }
      ],
      memos: [
        { id: uid(), text: '周五记得取快递，驿站 19:00 关门。', pinned: true, author: 'A' },
        { id: uid(), text: '想看的电影清单：\n1. 海边的曼彻斯特\n2. 花束般的恋爱', pinned: false, author: 'B' },
        { id: uid(), text: '周末买菜：番茄、牛腩、鸡蛋、酸奶。', pinned: false, author: 'A' },
        { id: uid(), text: '下次给猫预约洗澡，顺便剪指甲。', pinned: false, author: 'B' }
      ],
      memories: [
        {
          id: uid(), title: '海边的傍晚', date: addDays(t, -12), category: '旅行',
          note: '风很大，但晚霞很好看。', images: ['/pair/demo/m1.svg'],
          comments: [comment('B', '那天的风把我的帽子吹走了', 600), comment('A', '下次给你买顶新的', 590)]
        },
        {
          id: uid(), title: '周末的早餐', date: addDays(t, -25), category: '日常',
          note: '煎蛋终于没有糊。', images: ['/pair/demo/m2.svg'],
          comments: [comment('B', '明明糊了一半', 500)]
        },
        {
          id: uid(), title: '第一次一起搬家', date: addDays(t, -48), category: '里程碑',
          note: '堆满纸箱的客厅，和一顿很晚的外卖。', images: ['/pair/demo/m3.svg'],
          comments: []
        },
        {
          id: uid(), title: '那次吵架之后', date: addDays(t, -70), category: '争吵',
          note: '后来我们学会了先说完，再抱一下。', images: ['/pair/demo/m4.svg'],
          comments: [comment('A', '抱一下很重要', 300)]
        },
        {
          id: uid(), title: '春天的野餐', date: addDays(t, -95), category: '旅行',
          note: '草地、三明治和一只一直想抢吃的狗。', images: ['/pair/demo/m5.svg'],
          comments: [comment('B', '下次还去', 250)]
        },
        {
          id: uid(), title: '雨天的咖啡馆', date: addDays(t, -130), category: '日常',
          note: '靠窗的位置，雨下了一下午。', images: ['/pair/demo/m6.svg'],
          comments: []
        }
      ],
      anniversaries: [
        { id: uid(), title: '在一起纪念日', date: '2022-11-15', repeat: true, note: '' },
        { id: uid(), title: '鑫姐生日', date: '2000-08-12', repeat: true, note: '' },
        { id: uid(), title: '第一次旅行', date: '2024-10-03', repeat: true, note: '' }
      ],
      settings: { notifications: false }
    };

    ['todos', 'memos', 'memories', 'anniversaries'].forEach(key => {
      seed[key].forEach(item => {
        item.updatedAt = now;
        item.deletedAt = 0;
      });
    });
    seed.spaceUpdatedAt = now;
    return seed;
  }

  /* ---------- 状态 ---------- */

  function normalizeState(input) {
    const s = input || {};
    const now = Date.now();
    s.v = 1;
    s.settings = Object.assign({ notifications: false }, s.settings || {});
    s.spaceUpdatedAt = s.spaceUpdatedAt || now;

    let demoMigrated = false;
    if (s.members && s.members.A && (s.members.A.name === '小满' || s.members.A.name === '鑫妹')) {
      s.members.A.name = '鑫姐';
      demoMigrated = true;
    }
    if (s.members && s.members.B && s.members.B.name === '阿澈') {
      s.members.B.name = '耀哥';
      demoMigrated = true;
    }
    if (s.startDate === '2023-05-20') {
      s.startDate = '2022-11-15';
      demoMigrated = true;
    }
    if (demoMigrated) s.spaceUpdatedAt = now;

    s.todos = (Array.isArray(s.todos) ? s.todos : []).map(t => ({
      ...t,
      id: t.id || uid(),
      title: String(t.title || ''),
      due: t.due || '',
      author: t.author || 'A',
      notes: t.notes || '',
      done: !!t.done,
      updatedAt: t.updatedAt || now,
      deletedAt: t.deletedAt || 0
    }));
    s.memos = (Array.isArray(s.memos) ? s.memos : []).map(m => ({
      ...m,
      id: m.id || uid(),
      text: String(m.text || ''),
      pinned: !!m.pinned,
      author: m.author || 'A',
      createdAt: m.createdAt || m.updatedAt || now,
      updatedAt: m.updatedAt || now,
      deletedAt: m.deletedAt || 0
    }));
    s.anniversaries = (Array.isArray(s.anniversaries) ? s.anniversaries : []).map(a => ({
      ...a,
      id: a.id || uid(),
      title: String(a.title || ''),
      date: a.date || todayISO(),
      repeat: a.repeat !== false,
      note: a.note || '',
      updatedAt: a.updatedAt || now,
      deletedAt: a.deletedAt || 0
    }));
    s.anniversaries.forEach(a => {
      if (/^\d{2}-\d{2}$/.test(a.date)) a.date = '2000-' + a.date;
      if (a.title === '小满生日' || a.title === '鑫妹生日') {
        a.title = '鑫姐生日';
        a.updatedAt = now;
        s.spaceUpdatedAt = now;
      }
      if (a.title === '在一起纪念日' && a.date === '2023-05-20') {
        a.date = '2022-11-15';
        a.updatedAt = now;
        s.spaceUpdatedAt = now;
      }
    });
    s.memories = (Array.isArray(s.memories) ? s.memories : []).map(m => ({
      ...m,
      id: m.id || uid(),
      title: String(m.title || ''),
      date: m.date || todayISO(),
      category: m.category || '其他',
      note: m.note || '',
      images: Array.isArray(m.images) ? m.images : [],
      comments: (Array.isArray(m.comments) ? m.comments : []).map(c => ({
        id: c.id || uid(),
        author: c.author || 'A',
        text: String(c.text || ''),
        at: c.at || new Date().toISOString()
      })),
      updatedAt: m.updatedAt || now,
      deletedAt: m.deletedAt || 0
    }));
    if (s.members && s.members[s.current]) {
      s.current = s.current;
    } else {
      s.current = 'A';
    }
    return s;
  }

  function load() {
    let saved = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (err) {
      saved = null;
    }
    if (!saved || saved.v !== 1 || !saved.members || !Array.isArray(saved.todos) || !Array.isArray(saved.memories)) {
      const fresh = seedState();
      saveState(fresh);
      return fresh;
    }
    const normalized = normalizeState(saved);
    saveState(normalized);
    return normalized;
  }

  function saveState(next) {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch (err) {
      toast('本地存储空间不足，图片可能没有保存');
    }
  }

  function save() {
    saveState(state);
    scheduleSync();
  }

  function touch(record) {
    record.updatedAt = Date.now();
    return record;
  }

  function softDelete(record) {
    record.deletedAt = Date.now();
    record.updatedAt = record.deletedAt;
  }

  function alive(record) {
    return !record.deletedAt;
  }

  function visibleTodos() {
    return state.todos.filter(alive);
  }

  function visibleMemos() {
    return state.memos.filter(alive);
  }

  function visibleAnniversaries() {
    return state.anniversaries.filter(alive);
  }

  function visibleMemories() {
    return state.memories.filter(alive);
  }

  function spaceChanged() {
    state.spaceUpdatedAt = Date.now();
  }

  /* ---------- 图片 ---------- */

  function readImage(file, max, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image'));
      };
      img.src = url;
    });
  }

  function renderPreviews() {
    const box = document.getElementById('pair-previews');
    if (!box) return;
    box.innerHTML = pendingImages.map((src, i) =>
      `<div class="pair-preview"><span style="background-image:url('${src}')"></span><button type="button" data-action="remove-image" data-index="${i}" aria-label="移除">×</button></div>`
    ).join('');
  }

  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  /* ---------- 通用片段 ---------- */

  function avatarHTML(id, size) {
    const m = member(id);
    const cls = `pair-avatar ${size === 'lg' ? 'lg' : 'md'}`;
    if (m.avatar) {
      return `<span class="${cls}" style="background-image:url('${esc(m.avatar)}')"></span>`;
    }
    return `<span class="${cls}" aria-hidden="true">${esc((m.name || '?').slice(0, 1))}</span>`;
  }

  function todoRow(t) {
    const meta = `${dueLabel(t.due, t.done)} · ${esc(authorName(t.author))}${t.notes ? ' · ' + esc(t.notes) : ''}`;
    return `<div class="pair-todo ${t.done ? 'done' : ''}">
      <button type="button" class="pair-check ${t.done ? 'on' : ''}" data-action="toggle-todo" data-id="${esc(t.id)}" aria-label="${t.done ? '标记未完成' : '标记完成'}">${t.done ? '✓' : ''}</button>
      <div class="pair-todo-main">
        <div class="pair-todo-title">${esc(t.title)}</div>
        <div class="pair-todo-meta">${meta}</div>
      </div>
      <button type="button" class="pair-icon-btn" data-action="delete-todo" data-id="${esc(t.id)}" aria-label="删除待办">×</button>
    </div>`;
  }

  function memoryCard(m) {
    const cover = m.images[0] || '/pair/demo/m1.svg';
    return `<button type="button" class="pair-memory-card" data-action="open-memory" data-id="${esc(m.id)}">
      <span class="pair-memory-img" style="background-image:url('${esc(cover)}')"></span>
      <span class="pair-memory-body">
        <span class="pair-memory-date">${esc(fmtShort(m.date))} · ${esc(m.category)}</span>
        <strong>${esc(m.title)}</strong>
        <span class="pair-memory-meta">${m.comments.length} 条评论</span>
      </span>
    </button>`;
  }

  function memoryMini(m) {
    return `<button type="button" class="pair-memory-card" data-action="open-memory" data-id="${esc(m.id)}">
      <span class="pair-memory-img" style="background-image:url('${esc(m.images[0] || '/pair/demo/m1.svg')}')"></span>
      <span class="pair-memory-body">
        <span class="pair-memory-date">${esc(fmtShort(m.date))}</span>
        <strong>${esc(m.title)}</strong>
      </span>
    </button>`;
  }

  function memoryFiltered() {
    const q = memoryQuery.trim().toLowerCase();
    return visibleMemories().filter(m => {
      if (memoryCategory !== 'all' && m.category !== memoryCategory) return false;
      if (!q) return true;
      return `${m.title} ${m.note} ${m.category}`.toLowerCase().includes(q);
    }).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function memoryCards() {
    const list = memoryFiltered();
    return list.length
      ? list.map(memoryCard).join('')
      : '<div class="pair-empty">没有符合条件的回忆。</div>';
  }

  function updateMemoryList() {
    const list = document.getElementById('pair-memory-list');
    if (list) list.innerHTML = memoryCards();
  }

  function memberRow(id) {
    const m = member(id);
    return `<div class="pair-member-row">
      ${avatarHTML(id, 'md')}
      <div class="pair-member-main">
        <span>${esc(m.name)}</span>
        ${state.current === id ? '<span class="pair-badge">我</span>' : ''}
      </div>
      <button type="button" class="pair-link" data-action="edit-member" data-id="${id}">编辑</button>
    </div>`;
  }

  /* ---------- 四个页面 ---------- */

  function monthDayOf(iso) {
    const d = parseISO(iso);
    return d ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
  }

  function anniversaryDays(a) {
    if (a.repeat) {
      return daysUntil(monthDayOf(a.date));
    }
    return daysBetween(todayISO(), a.date);
  }

  function anniversaryText(days) {
    if (days === null || days === undefined) return '';
    if (days === 0) return '今天';
    if (days > 0) return `${days} 天后`;
    return `已过 ${Math.abs(days)} 天`;
  }

  function anniversaryDateText(a) {
    return a.repeat ? fmtMonthDay(monthDayOf(a.date)) : fmtShort(a.date);
  }

  function fmtStamp(ms) {
    const d = ms ? new Date(ms) : null;
    if (!d || isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function memoPreviewRow(m) {
    return `<div class="pair-memo">
      <div class="pair-memo-main">
        <div class="pair-memo-text">${esc(m.text)}</div>
        <div class="pair-memo-meta">${esc(authorName(m.author))} · ${esc(fmtStamp(m.updatedAt))}</div>
      </div>
    </div>`;
  }

  function memoRow(m) {
    return `<div class="pair-memo ${m.pinned ? 'pinned' : ''}">
      <button type="button" class="pair-pin ${m.pinned ? 'on' : ''}" data-action="toggle-pin" data-id="${esc(m.id)}" aria-label="${m.pinned ? '取消置顶' : '置顶'}">${m.pinned ? '★' : '☆'}</button>
      <div class="pair-memo-main">
        <div class="pair-memo-text">${esc(m.text)}</div>
        <div class="pair-memo-meta">${esc(authorName(m.author))} · ${esc(fmtStamp(m.updatedAt))}</div>
      </div>
      <div class="pair-memo-actions">
        <button type="button" class="pair-link" data-action="edit-memo" data-id="${esc(m.id)}">编辑</button>
        <button type="button" class="pair-icon-btn" data-action="delete-memo" data-id="${esc(m.id)}" aria-label="删除便签">×</button>
      </div>
    </div>`;
  }

  function renderHome() {
    const todos = visibleTodos();
    const memos = visibleMemos();
    const anniversaries = visibleAnniversaries();
    const memories = visibleMemories();

    const pending = todos.filter(t => !t.done);
    const doneCount = todos.length - pending.length;
    const todayTasks = pending.filter(t => t.due === todayISO());
    const nextTasks = (todayTasks.length ? todayTasks : pending).slice(0, 3);
    const upcoming = anniversaries
      .map(a => ({ ...a, days: anniversaryDays(a) }))
      .filter(a => a.days !== null)
      .sort((a, b) => a.days - b.days)
      .slice(0, 3);
    const memoPreview = memos
      .slice()
      .sort((a, b) => (b.pinned - a.pinned) || ((b.updatedAt || 0) - (a.updatedAt || 0)))
      .slice(0, 2);
    const recent = memories
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 3);

    return `<section class="pair-hero">
      <div class="pair-avatars">${avatarHTML('A', 'lg')}${avatarHTML('B', 'lg')}</div>
      <div>
        <h2>${esc(member('A').name)} &amp; ${esc(member('B').name)}</h2>
        <p>从 ${esc(fmtDate(state.startDate))} 走到今天</p>
      </div>
    </section>
    <div class="pair-stats">
      <div><strong>${doneCount}/${todos.length}</strong><span>待办完成</span></div>
      <div><strong>${memos.length}</strong><span>条便签</span></div>
      <div><strong>${memories.length}</strong><span>条回忆</span></div>
      <div><strong>${anniversaries.length}</strong><span>个纪念日</span></div>
    </div>
    <section class="pair-card">
      <div class="pair-card-head"><h3>接下来</h3><button type="button" class="pair-link" data-action="open-todo">＋ 加待办</button></div>
      ${nextTasks.length ? nextTasks.map(todoRow).join('') : '<div class="pair-empty">今天没有待办，去歇一会儿。</div>'}
    </section>
    <section class="pair-card">
      <div class="pair-card-head"><h3>便签</h3><button type="button" class="pair-link" data-action="tab" data-tab="memos">全部</button></div>
      ${memoPreview.length ? memoPreview.map(memoPreviewRow).join('') : '<div class="pair-empty">还没有便签。</div>'}
    </section>
    <section class="pair-card">
      <div class="pair-card-head"><h3>纪念日</h3><span class="pair-muted">${anniversaries.length} 个</span></div>
      ${upcoming.length ? upcoming.map(a => `<div class="pair-anniv">
        <span class="pair-anniv-date">${esc(anniversaryDateText(a))}</span>
        <span class="pair-anniv-title">${esc(a.title)}</span>
        <span class="pair-anniv-days">${esc(anniversaryText(a.days))}</span>
      </div>`).join('') : '<div class="pair-empty">还没有纪念日。</div>'}
    </section>
    <section class="pair-card">
      <div class="pair-card-head"><h3>最近回忆</h3><button type="button" class="pair-link" data-action="tab" data-tab="memories">全部</button></div>
      ${recent.length ? `<div class="pair-memories-row">${recent.map(memoryMini).join('')}</div>` : '<div class="pair-empty">还没有回忆，去存一条。</div>'}
    </section>
    <div class="pair-actions">
      <button type="button" class="pair-btn primary" data-action="open-todo">＋ 加待办</button>
      <button type="button" class="pair-btn" data-action="open-memo-form">＋ 写便签</button>
      <button type="button" class="pair-btn" data-action="open-memory-form">＋ 存回忆</button>
      <button type="button" class="pair-btn" data-action="share-poster">分享长图</button>
    </div>`;
  }

  function renderTodos() {
    const todos = visibleTodos();
    const pending = todos.filter(t => !t.done).length;
    let list = todos.slice();
    if (todoFilter === 'today') list = list.filter(t => !t.done && t.due && t.due <= todayISO());
    if (todoFilter === 'done') list = list.filter(t => t.done);
    list.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.due && b.due) return 1;
      if (a.due && !b.due) return -1;
      return String(a.due || '').localeCompare(String(b.due || ''));
    });
    const filters = [['all', '全部'], ['today', '今天'], ['done', '已完成']];

    return `<section class="pair-section-head">
      <div><h2>待办</h2><p>${pending} 件未完成</p></div>
      <button type="button" class="pair-btn primary" data-action="open-todo">＋ 新增</button>
    </section>
    <div class="pair-chips">${filters.map(([id, label]) =>
      `<button type="button" class="pair-chip ${todoFilter === id ? 'on' : ''}" data-action="filter" data-filter="${id}">${label}</button>`
    ).join('')}</div>
    <section class="pair-card">${list.length ? list.map(todoRow).join('') : '<div class="pair-empty">这里还没有待办。</div>'}</section>`;
  }

  function renderMemos() {
    const memos = visibleMemos().slice().sort((a, b) =>
      (b.pinned - a.pinned) || ((b.updatedAt || 0) - (a.updatedAt || 0))
    );
    return `<section class="pair-section-head">
      <div><h2>便签</h2><p>${memos.length} 条</p></div>
      <button type="button" class="pair-btn primary" data-action="open-memo-form">＋ 新增</button>
    </section>
    <section class="pair-card">${memos.length ? memos.map(memoRow).join('') : '<div class="pair-empty">还没有便签。</div>'}</section>`;
  }

  function renderAnniv() {
    const list = visibleAnniversaries()
      .map(a => ({ ...a, days: anniversaryDays(a) }))
      .sort((a, b) => {
        const av = a.days === null ? 1e9 : (a.days >= 0 ? a.days : 1e6 + Math.abs(a.days));
        const bv = b.days === null ? 1e9 : (b.days >= 0 ? b.days : 1e6 + Math.abs(b.days));
        return av - bv;
      });

    return `<section class="pair-section-head">
      <div><h2>纪念日</h2><p>${list.length} 个</p></div>
      <button type="button" class="pair-btn primary" data-action="open-anniv-form">＋ 新增</button>
    </section>
    <section class="pair-card">${list.length ? list.map(a => `<div class="pair-anniv-row">
      <div class="pair-anniv-date">${esc(anniversaryDateText(a))}</div>
      <div class="pair-anniv-main">
        <div class="pair-anniv-title">${esc(a.title)}${a.repeat ? '<span class="pair-badge">每年</span>' : ''}</div>
        ${a.note ? `<div class="pair-anniv-note">${esc(a.note)}</div>` : ''}
      </div>
      <div class="pair-anniv-side">
        <span class="pair-anniv-days">${esc(anniversaryText(a.days))}</span>
        <button type="button" class="pair-link" data-action="edit-anniv" data-id="${esc(a.id)}">编辑</button>
      </div>
      <button type="button" class="pair-icon-btn" data-action="delete-anniv" data-id="${esc(a.id)}" aria-label="删除纪念日">×</button>
    </div>`).join('') : '<div class="pair-empty">还没有纪念日。</div>'}</section>`;
  }

  function renderMemories() {
    const memories = visibleMemories();
    const cats = [['all', '全部'], ['旅行', '旅行'], ['日常', '日常'], ['争吵', '争吵'], ['里程碑', '里程碑'], ['其他', '其他']];
    return `<section class="pair-section-head">
      <div><h2>回忆</h2><p>${memories.length} 条</p></div>
      <button type="button" class="pair-btn primary" data-action="open-memory-form">＋ 新增</button>
    </section>
    <input class="pair-search" id="pair-memory-search" type="search" placeholder="搜索标题、备注、分类" value="${esc(memoryQuery)}">
    <div class="pair-chips">${cats.map(([id, label]) =>
      `<button type="button" class="pair-chip ${memoryCategory === id ? 'on' : ''}" data-action="memory-cat" data-cat="${id}">${label}</button>`
    ).join('')}</div>
    <div id="pair-memory-list" class="pair-memory-grid">${memoryCards()}</div>`;
  }

  function renderSettings() {
    const soon = ['留言板', '日历 / 农历', '生理期'];
    return `<section class="pair-section-head"><div><h2>设置</h2><p>空间、同步与数据</p></div></section>
    <section class="pair-card">
      <h3>空间</h3>
      ${memberRow('A')}${memberRow('B')}
      <label class="pair-field">在一起的第一天<input type="date" value="${esc(state.startDate)}" data-change="start-date"></label>
      <div class="pair-identity">
        <span>当前身份</span>
        <div class="pair-seg">${['A', 'B'].map(id =>
          `<button type="button" class="${state.current === id ? 'on' : ''}" data-action="identity" data-id="${id}">${esc(member(id).name)}</button>`
        ).join('')}</div>
      </div>
    </section>
    <section class="pair-card">
      <h3>同步 <span id="pair-sync-status" class="pair-sync-status ${syncStatus.state}">${esc(syncLabel())}</span></h3>
      <p class="pair-muted">Nextcloud WebDAV + AES-GCM。远端只存密文；口令不上传。</p>
      <form class="pair-form" data-form="dav">
        <label>WebDAV 文件夹地址<input name="url" value="${esc(davConfig ? davConfig.url : '')}" placeholder="https://cloud.example.com/remote.php/dav/files/me/pair/"></label>
        <div class="pair-form-row">
          <label>用户名<input name="user" value="${esc(davConfig ? davConfig.user : '')}" placeholder="me"></label>
          <label>应用密码<input name="pass" type="password" placeholder="${davConfig && davConfig.pass ? '已保存，留空不修改' : '应用密码'}"></label>
        </div>
        <label>空间口令<input name="passphrase" type="password" placeholder="${spaceKey ? '已解锁；锁定后需原口令' : '至少 8 位，首次连接会创建'}"></label>
        <label class="pair-checkline"><input type="checkbox" name="auto" data-change="auto-sync" ${!davConfig || davConfig.auto !== false ? 'checked' : ''}> 自动同步（60 秒）</label>
        <div class="pair-actions">
          <button type="submit" class="pair-btn primary">连接并同步</button>
          <button type="button" class="pair-btn" data-action="sync-now" ${!davConfig || !spaceKey ? 'disabled' : ''}>立即同步</button>
          <button type="button" class="pair-btn" data-action="lock-sync" ${!spaceKey ? 'disabled' : ''}>锁定</button>
          <button type="button" class="pair-btn danger" data-action="clear-sync" ${!davConfig ? 'disabled' : ''}>清除配置</button>
        </div>
      </form>
      <p id="pair-sync-message" class="pair-hint pair-sync-error" style="${syncStatus.state === 'error' ? '' : 'display:none'}">${syncStatus.state === 'error' ? esc(syncStatus.message) : ''}</p>
      <p class="pair-hint">WebDAV 地址/用户名/应用密码只存本机 localStorage；空间口令不保存。浏览器直连需要 Nextcloud 开启 CORS。</p>
    </section>
    <section class="pair-card">
      <h3>通知</h3>
      <label class="pair-checkline"><input type="checkbox" data-change="notifications" ${state.settings.notifications ? 'checked' : ''}> 浏览器通知（待办到期、纪念日）</label>
      <p class="pair-hint">原型只保存开关；v1 接入本地通知。</p>
    </section>
    <section class="pair-card">
      <h3>数据</h3>
      <div class="pair-actions">
        <button type="button" class="pair-btn" data-action="export">导出 JSON（明文）</button>
        <button type="button" class="pair-btn" data-action="import">导入 JSON</button>
        <button type="button" class="pair-btn" data-action="share-poster">分享长图</button>
        <button type="button" class="pair-btn danger" data-action="reset">重置示例</button>
      </div>
      <p class="pair-hint">导出文件是本机明文备份；远端同步数据是 AES-GCM 密文。</p>
      <input id="pair-import" type="file" accept="application/json,.json" hidden data-change="import">
    </section>
    <section class="pair-card">
      <h3>即将加入</h3>
      <ul class="pair-soon">${soon.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    </section>
    <section class="pair-card">
      <h3>关于</h3>
      <p class="pair-muted">两只 · 原型 v0.3 · 无登录 / 无积分 / 无位置</p>
    </section>`;
  }

  function render() {
    const dialog = document.getElementById('pair-dialog');
    if (dialog && dialog.open) dialog.close();

    const view = activeTab === 'home' ? renderHome()
      : activeTab === 'todos' ? renderTodos()
      : activeTab === 'memos' ? renderMemos()
      : activeTab === 'anniv' ? renderAnniv()
      : activeTab === 'memories' ? renderMemories()
      : renderSettings();

    app.innerHTML = `<div class="pair-head">
        <div><h1>两只</h1><p>我们的空间</p></div>
        <span class="pair-days">在一起 <strong>${daysTogether()}</strong> 天</span>
      </div>
      <nav class="pair-tabs" aria-label="两只导航">
        ${TABS.map(([id, label]) =>
          `<button type="button" class="pair-tab ${activeTab === id ? 'on' : ''}" data-action="tab" data-tab="${id}">${label}</button>`
        ).join('')}
      </nav>
      <div class="pair-view">${view}</div>
      <div class="pair-foot">本地优先 · 可加密同步</div>
      <dialog id="pair-dialog" class="pair-dialog"></dialog>`;

    const d = document.getElementById('pair-dialog');
    if (d) d.addEventListener('click', event => { if (event.target === d) d.close(); });
  }

  /* ---------- 弹窗 ---------- */

  function openMemoForm(id) {
    const m = id ? state.memos.find(x => x.id === id) : null;
    setDialog(`<div class="pair-dialog-head"><h3>${m ? '编辑便签' : '写一张便签'}</h3>${closeButton()}</div>
      <form class="pair-form pair-dialog-body" data-form="memo" data-id="${m ? esc(m.id) : ''}">
        <label>内容<textarea name="text" rows="5" required maxlength="500" placeholder="随手记下...">${m ? esc(m.text) : ''}</textarea></label>
        <label class="pair-checkline"><input type="checkbox" name="pinned" ${m && m.pinned ? 'checked' : ''}> 置顶</label>
        <div class="pair-dialog-actions">
          <button type="button" class="pair-btn" data-action="close-dialog">取消</button>
          <button type="submit" class="pair-btn primary">保存</button>
        </div>
      </form>`);
  }

  function openAnnivForm(id) {
    const a = id ? state.anniversaries.find(x => x.id === id) : null;
    setDialog(`<div class="pair-dialog-head"><h3>${a ? '编辑纪念日' : '新增纪念日'}</h3>${closeButton()}</div>
      <form class="pair-form pair-dialog-body" data-form="anniv" data-id="${a ? esc(a.id) : ''}">
        <label>名称<input name="title" required maxlength="30" value="${a ? esc(a.title) : ''}" placeholder="例如：在一起纪念日"></label>
        <div class="pair-form-row">
          <label>日期<input type="date" name="date" required value="${a ? esc(a.date) : todayISO()}"></label>
          <label class="pair-checkline" style="margin-top:22px"><input type="checkbox" name="repeat" ${a ? (a.repeat ? 'checked' : '') : 'checked'}> 每年重复</label>
        </div>
        <label>备注<input name="note" maxlength="80" value="${a ? esc(a.note) : ''}" placeholder="可选"></label>
        <div class="pair-dialog-actions">
          <button type="button" class="pair-btn" data-action="close-dialog">取消</button>
          <button type="submit" class="pair-btn primary">保存</button>
        </div>
      </form>`);
  }

  function loadImage(src) {
    return new Promise(resolve => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawCover(ctx, img, x, y, w, h, r) {
    if (!img) {
      ctx.save();
      roundRect(ctx, x, y, w, h, r);
      ctx.fillStyle = '#f3e3db';
      ctx.fill();
      ctx.restore();
      return;
    }
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    ctx.restore();
  }

  function drawAvatarPoster(ctx, img, x, y, r, name) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffe9e0';
    ctx.fill();
    if (img) {
      ctx.clip();
      const scale = Math.max(r * 2 / img.width, r * 2 / img.height);
      const sw = r * 2 / scale;
      const sh = r * 2 / scale;
      ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x - r, y - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = '#e86f52';
      ctx.font = '700 62px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((name || '?').slice(0, 1), x, y + 2);
    }
    ctx.restore();
  }

  async function buildPoster() {
    const W = 1080;
    const H = 1440;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    const todos = visibleTodos();
    const memos = visibleMemos();
    const anniversaries = visibleAnniversaries();
    const memories = visibleMemories();

    ctx.fillStyle = '#fff8f4';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e86f52';
    ctx.fillRect(0, 0, W, 10);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#4a3f38';
    ctx.font = '700 46px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('两只', 72, 108);
    ctx.fillStyle = '#a09088';
    ctx.font = '400 24px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('我们的空间', 72, 150);

    const [imgA, imgB] = await Promise.all([
      loadImage(member('A').avatar),
      loadImage(member('B').avatar)
    ]);
    drawAvatarPoster(ctx, imgA, 430, 285, 76, member('A').name);
    drawAvatarPoster(ctx, imgB, 650, 285, 76, member('B').name);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#4a3f38';
    ctx.font = '500 28px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(`${member('A').name}  &  ${member('B').name}`, 540, 420);

    ctx.fillStyle = '#a09088';
    ctx.font = '400 28px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('在一起', 540, 500);
    ctx.fillStyle = '#e86f52';
    ctx.font = '700 170px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText(String(daysTogether()), 540, 660);
    ctx.fillStyle = '#a09088';
    ctx.font = '400 34px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('天', 540, 710);
    ctx.fillText(`从 ${state.startDate.replace(/-/g, '.')} 到今天`, 540, 765);

    const stats = [
      [`${todos.filter(t => t.done).length}/${todos.length}`, '待办完成'],
      [String(memos.length), '条便签'],
      [String(memories.length), '条回忆'],
      [String(anniversaries.length), '个纪念日']
    ];
    const statX = [150, 410, 670, 930];
    stats.forEach(([num, label], i) => {
      ctx.fillStyle = '#e86f52';
      ctx.font = '700 46px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(num, statX[i], 870);
      ctx.fillStyle = '#a09088';
      ctx.font = '400 22px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText(label, statX[i], 905);
    });

    ctx.textAlign = 'left';
    ctx.fillStyle = '#4a3f38';
    ctx.font = '700 28px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('最近回忆', 72, 975);
    ctx.strokeStyle = '#f0ddd4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 995);
    ctx.lineTo(1008, 995);
    ctx.stroke();

    const picks = memories
      .slice()
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 3);
    if (picks.length) {
      const imgs = await Promise.all(picks.map(m => loadImage(m.images[0] || '')));
      const cardW = 292;
      const cardH = 210;
      const gap = 32;
      const total = picks.length * cardW + (picks.length - 1) * gap;
      let x = (W - total) / 2;
      picks.forEach((m, i) => {
        drawCover(ctx, imgs[i], x, 1025, cardW, cardH, 22);
        ctx.fillStyle = '#4a3f38';
        ctx.font = '500 22px "PingFang SC","Microsoft YaHei",sans-serif';
        ctx.fillText(fmtShort(m.date), x, 1270);
        ctx.fillStyle = '#4a3f38';
        ctx.font = '600 24px "PingFang SC","Microsoft YaHei",sans-serif';
        const title = m.title.length > 10 ? m.title.slice(0, 10) + '…' : m.title;
        ctx.fillText(title, x, 1302);
        x += cardW + gap;
      });
    } else {
      ctx.fillStyle = '#a09088';
      ctx.font = '400 26px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('还没有回忆，去存一条。', 540, 1120);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a09088';
    ctx.font = '400 22px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('两只 · 我们的空间', 540, 1370);

    return canvas.toDataURL('image/png');
  }

  function openSharePoster() {
    posterDataUrl = '';
    setDialog(`<div class="pair-dialog-head"><h3>分享长图</h3>${closeButton()}</div>
      <div class="pair-dialog-body">
        <div id="pair-poster-box" class="pair-poster-box"><div class="pair-empty">正在生成…</div></div>
        <div class="pair-dialog-actions">
          <button type="button" class="pair-btn" data-action="close-dialog">关闭</button>
          <button type="button" class="pair-btn primary" data-action="save-poster" disabled>保存图片</button>
        </div>
      </div>`);
    buildPoster().then(dataUrl => {
      posterDataUrl = dataUrl;
      const box = document.getElementById('pair-poster-box');
      if (box) box.innerHTML = `<img src="${dataUrl}" alt="两只分享长图">`;
      const btn = document.querySelector('[data-action="save-poster"]');
      if (btn) btn.disabled = false;
    }).catch(() => {
      const box = document.getElementById('pair-poster-box');
      if (box) box.innerHTML = '<div class="pair-empty">生成失败，请重试。</div>';
    });
  }

  function savePoster() {
    if (!posterDataUrl) return;
    const a = document.createElement('a');
    a.href = posterDataUrl;
    a.download = `两只-在一起${daysTogether()}天.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('已保存长图');
  }

  function closeButton() {
    return '<button type="button" class="pair-icon-btn" data-action="close-dialog" aria-label="关闭"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  }

  function setDialog(html) {
    const d = document.getElementById('pair-dialog');
    if (!d) return;
    d.innerHTML = html;
    if (!d.open) d.showModal();
    requestAnimationFrame(() => {
      const field = d.querySelector('.pair-dialog-body input, .pair-dialog-body textarea, .pair-dialog-body select');
      if (field) {
        field.focus({ preventScroll: true });
      } else {
        d.tabIndex = -1;
        d.focus({ preventScroll: true });
      }
    });
  }

  function closeDialog() {
    const d = document.getElementById('pair-dialog');
    if (d) d.close();
  }

  function openTodoForm() {
    setDialog(`<div class="pair-dialog-head"><h3>加一条待办</h3>${closeButton()}</div>
      <form class="pair-form pair-dialog-body" data-form="todo">
        <label>要做什么<input name="title" required maxlength="60" placeholder="例如：订周五的电影票"></label>
        <div class="pair-form-row">
          <label>截止日<input type="date" name="due" value="${todayISO()}"></label>
          <label>谁来做<select name="author">
            <option value="A" ${state.current === 'A' ? 'selected' : ''}>${esc(member('A').name)}</option>
            <option value="B" ${state.current === 'B' ? 'selected' : ''}>${esc(member('B').name)}</option>
            <option value="both">一起</option>
          </select></label>
        </div>
        <label>备注<input name="notes" maxlength="80" placeholder="可选"></label>
        <div class="pair-dialog-actions">
          <button type="button" class="pair-btn" data-action="close-dialog">取消</button>
          <button type="submit" class="pair-btn primary">保存</button>
        </div>
      </form>`);
  }

  function openMemoryForm() {
    pendingImages = [];
    setDialog(`<div class="pair-dialog-head"><h3>存一条回忆</h3>${closeButton()}</div>
      <form class="pair-form pair-dialog-body" data-form="memory">
        <label>标题<input name="title" required maxlength="40" placeholder="给这天起个名字"></label>
        <div class="pair-form-row">
          <label>日期<input type="date" name="date" value="${todayISO()}" required></label>
          <label>分类<select name="category">${['旅行', '日常', '争吵', '里程碑', '其他'].map(c => `<option ${c === '日常' ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        </div>
        <label>备注<textarea name="note" maxlength="300" placeholder="发生了什么"></textarea></label>
        <label>照片<input type="file" accept="image/*" multiple data-file="memory-images"><span class="pair-hint">最多 3 张，自动压缩；不选会用一张默认图</span></label>
        <div id="pair-previews" class="pair-previews"></div>
        <div class="pair-dialog-actions">
          <button type="button" class="pair-btn" data-action="close-dialog">取消</button>
          <button type="submit" class="pair-btn primary">保存</button>
        </div>
      </form>`);
  }

  function memoryDetailHTML(id) {
    const m = state.memories.find(x => x.id === id);
    if (!m) return '<div class="pair-dialog-body"><p class="pair-muted">这条回忆不存在。</p></div>';
    const images = m.images.length ? m.images : ['/pair/demo/m1.svg'];
    return `<div class="pair-dialog-head"><h3>${esc(m.title)}</h3>${closeButton()}</div>
      <div class="pair-dialog-body">
        <div class="pair-detail-imgs">${images.map(src => `<img src="${esc(src)}" alt="">`).join('')}</div>
        <p class="pair-muted">${esc(fmtDate(m.date))} · ${esc(m.category)}</p>
        ${m.note ? `<p class="pair-note">${esc(m.note)}</p>` : ''}
        <div class="pair-section-label">评论 · ${m.comments.length}</div>
        ${m.comments.length
          ? m.comments.map(c => `<div class="pair-comment"><div class="pair-comment-meta"><span>${esc(authorName(c.author))}</span><span>${esc(fmtCommentTime(c.at))}</span></div><div class="pair-comment-text">${esc(c.text)}</div></div>`).join('')
          : '<p class="pair-muted">还没有评论</p>'}
        <form class="pair-comment-form" data-form="comment" data-id="${esc(m.id)}">
          <input name="text" maxlength="200" placeholder="写一句..." required>
          <button type="submit" class="pair-btn primary">发送</button>
        </form>
        <div class="pair-dialog-actions">
          <button type="button" class="pair-btn danger" data-action="delete-memory" data-id="${esc(m.id)}">删除回忆</button>
        </div>
      </div>`;
  }

  function openMemory(id) {
    setDialog(memoryDetailHTML(id));
  }

  function openMemberForm(id) {
    const m = member(id);
    pendingAvatar = m.avatar || '';
    setDialog(`<div class="pair-dialog-head"><h3>编辑成员</h3>${closeButton()}</div>
      <form class="pair-form pair-dialog-body" data-form="member" data-id="${id}">
        <label>昵称<input name="name" required maxlength="12" value="${esc(m.name)}"></label>
        <label>头像<input type="file" accept="image/*" data-file="avatar"><span class="pair-hint">可不上传，默认用首字母</span></label>
        <div id="pair-avatar-preview" class="pair-avatar-preview" style="${m.avatar ? `background-image:url('${esc(m.avatar)}')` : ''}">${m.avatar ? '' : esc((m.name || '?').slice(0, 1))}</div>
        <div class="pair-dialog-actions">
          <button type="button" class="pair-btn" data-action="close-dialog">取消</button>
          <button type="submit" class="pair-btn primary">保存</button>
        </div>
      </form>`);
  }

  /* ---------- 数据操作 ---------- */

  function exportJSON() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `两只-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('已导出');
  }

  /* ---------- WebDAV + AES-GCM 同步 ---------- */

  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    return btoa(binary);
  }

  function base64ToBuffer(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }

  function randomSalt() {
    return bufferToBase64(crypto.getRandomValues(new Uint8Array(16)).buffer);
  }

  async function deriveSpaceKey(passphrase, salt) {
    const base = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new Uint8Array(base64ToBuffer(salt)), iterations: 310000, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async function encryptJson(name, value, key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plain = new TextEncoder().encode(JSON.stringify(value));
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(name) },
      key,
      plain
    );
    return JSON.stringify({
      v: 1,
      iv: bufferToBase64(iv.buffer),
      data: bufferToBase64(cipher)
    });
  }

  async function decryptJson(name, text, key) {
    const box = JSON.parse(text);
    const iv = new Uint8Array(base64ToBuffer(box.iv));
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(name) },
      key,
      base64ToBuffer(box.data)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  function openIdb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('pair.sync', 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains('kv')) req.result.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbGet(key) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const req = db.transaction('kv', 'readonly').objectStore('kv').get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, value) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbDel(key) {
    const db = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function davBase(cfg) {
    return String(cfg.url || '').replace(/\/+$/, '') + '/';
  }

  function basicAuth(user, pass) {
    return 'Basic ' + bufferToBase64(new TextEncoder().encode(`${user}:${pass}`));
  }

  function davUrl(cfg, name) {
    return davBase(cfg) + (name || '').split('/').map(encodeURIComponent).join('/');
  }

  async function davRequest(cfg, method, name, body, headers) {
    const h = Object.assign({ Authorization: basicAuth(cfg.user, cfg.pass) }, headers || {});
    let res;
    try {
      res = await fetch(davUrl(cfg, name), { method, headers: h, body });
    } catch (err) {
      throw new Error('网络/CORS 错误：请确认 Nextcloud 允许跨域 (Authorization / PROPFIND / PUT)');
    }
    return res;
  }

  async function davGetText(cfg, name) {
    const res = await davRequest(cfg, 'GET', name);
    if (res.status === 404) return null;
    if (res.status === 401) throw new Error('WebDAV 用户名或应用密码错误');
    if (!res.ok) throw new Error(`WebDAV 读取失败（${res.status}）`);
    return res.text();
  }

  async function davPutText(cfg, name, text) {
    const res = await davRequest(cfg, 'PUT', name, text, { 'Content-Type': 'application/json' });
    if (res.status === 401) throw new Error('WebDAV 用户名或应用密码错误');
    if (!res.ok) throw new Error(`WebDAV 写入失败（${res.status}）`);
  }

  async function davTest(cfg) {
    const xml = '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>';
    let res = await davRequest(cfg, 'PROPFIND', '', xml, { Depth: '0', 'Content-Type': 'application/xml' });
    if (res.status === 404) {
      const mk = await davRequest(cfg, 'MKCOL', '');
      if (![201, 405].includes(mk.status)) throw new Error(`WebDAV 文件夹不存在，且创建失败（${mk.status}）`);
      res = await davRequest(cfg, 'PROPFIND', '', xml, { Depth: '0', 'Content-Type': 'application/xml' });
    }
    if (res.status === 401) throw new Error('WebDAV 用户名或应用密码错误');
    if (![200, 207].includes(res.status)) throw new Error(`WebDAV 连接失败（${res.status}）`);
  }

  async function getMeta(cfg) {
    const text = await davGetText(cfg, 'meta.json');
    if (!text) return null;
    return JSON.parse(text);
  }

  async function putMeta(cfg, meta) {
    await davPutText(cfg, 'meta.json', JSON.stringify(meta));
  }

  function mergeRecords(local, remote) {
    const map = new Map();
    for (const record of [...(local || []), ...(remote || [])]) {
      if (!record || !record.id) continue;
      const prev = map.get(record.id);
      if (!prev) { map.set(record.id, record); continue; }
      const a = record.updatedAt || 0;
      const b = prev.updatedAt || 0;
      if (a > b || (a === b && record.deletedAt && !prev.deletedAt)) map.set(record.id, record);
    }
    return [...map.values()];
  }

  function mergeComments(local, remote) {
    const map = new Map();
    for (const comment of [...(local || []), ...(remote || [])]) {
      if (!comment || !comment.id) continue;
      if (!map.has(comment.id)) map.set(comment.id, comment);
    }
    return [...map.values()];
  }

  function mergeMemories(local, remote) {
    const map = new Map();
    for (const record of [...(local || []), ...(remote || [])]) {
      if (!record || !record.id) continue;
      const prev = map.get(record.id);
      if (!prev) { map.set(record.id, record); continue; }
      const newer = (record.updatedAt || 0) > (prev.updatedAt || 0) ? record : prev;
      const older = newer === record ? prev : record;
      if ((record.updatedAt || 0) === (prev.updatedAt || 0) && record.deletedAt && !prev.deletedAt) {
        map.set(record.id, record);
      } else {
        map.set(record.id, Object.assign({}, newer, {
          comments: mergeComments(older.comments, newer.comments)
        }));
      }
    }
    return [...map.values()];
  }

  function mergeSpace(local, remote) {
    if (!remote) return local;
    return (remote.updatedAt || 0) > (local.updatedAt || 0) ? remote : local;
  }

  function syncLabel() {
    if (!davConfig) return '未连接';
    if (syncStatus.state === 'syncing') return '同步中…';
    if (syncStatus.state === 'error') return '同步失败';
    if (!spaceKey) return '待解锁';
    if (syncStatus.lastSync) {
      const d = new Date(syncStatus.lastSync);
      return `已同步 · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return '待同步';
  }

  function updateSyncStatusUI() {
    const el = document.getElementById('pair-sync-status');
    if (el) {
      el.textContent = syncLabel();
      el.className = 'pair-sync-status ' + syncStatus.state;
      el.title = syncStatus.message || '';
    }
    const message = document.getElementById('pair-sync-message');
    if (message) {
      if (syncStatus.state === 'error') {
        message.textContent = syncStatus.message || '同步失败';
        message.style.display = '';
      } else {
        message.textContent = '';
        message.style.display = 'none';
      }
    }
  }

  async function readEncrypted(name) {
    const text = await davGetText(davConfig, name);
    if (!text) return null;
    return decryptJson(name, text, spaceKey);
  }

  async function writeEncrypted(name, value) {
    await davPutText(davConfig, name, await encryptJson(name, value, spaceKey));
  }

  async function adoptRemote(cfg, key, remoteSpace) {
    async function read(name, fallback) {
      const text = await davGetText(cfg, name);
      return text ? decryptJson(name, text, key) : fallback;
    }
    const todos = await read('todos.enc', []);
    const memos = await read('memos.enc', []);
    const anniversaries = await read('anniversaries.enc', []);
    const memories = await read('memories.enc', []);

    state.members = remoteSpace.members || state.members;
    state.startDate = remoteSpace.startDate || state.startDate;
    state.spaceUpdatedAt = remoteSpace.updatedAt || Date.now();
    state.todos = Array.isArray(todos) ? todos : [];
    state.memos = Array.isArray(memos) ? memos : [];
    state.anniversaries = Array.isArray(anniversaries) ? anniversaries : [];
    state.memories = Array.isArray(memories) ? memories : [];
    saveState(state);
  }

  async function syncNow(options) {
    const opts = options || {};
    if (!davConfig || !spaceKey) {
      if (opts.manual) toast('先在设置里连接并解锁');
      return;
    }
    if (syncing) {
      pendingSync = true;
      if (opts.manual) toast('正在同步，请稍等');
      return;
    }
    syncing = true;
    syncStatus = { state: 'syncing', message: '正在同步…', lastSync: syncStatus.lastSync };
    updateSyncStatusUI();
    try {
      const remoteSpace = await readEncrypted('space.enc');
      const localSpace = {
        members: state.members,
        startDate: state.startDate,
        updatedAt: state.spaceUpdatedAt || 0
      };
      const mergedSpace = mergeSpace(localSpace, remoteSpace);
      state.members = mergedSpace.members || state.members;
      state.startDate = mergedSpace.startDate || state.startDate;
      state.spaceUpdatedAt = mergedSpace.updatedAt || Date.now();

      const collections = [
        ['todos', 'todos.enc'],
        ['memos', 'memos.enc'],
        ['anniversaries', 'anniversaries.enc'],
        ['memories', 'memories.enc']
      ];
      for (const [key, file] of collections) {
        const remote = await readEncrypted(file);
        const merged = key === 'memories'
          ? mergeMemories(state[key], remote || [])
          : mergeRecords(state[key], remote || []);
        state[key] = merged;
        await writeEncrypted(file, merged);
      }
      await writeEncrypted('space.enc', {
        members: state.members,
        startDate: state.startDate,
        updatedAt: state.spaceUpdatedAt
      });

      saveState(state);
      localStorage.setItem('pair.synced', '1');
      syncStatus = { state: 'ok', message: '同步成功', lastSync: Date.now() };
      updateSyncStatusUI();
      if (!document.querySelector('dialog[open]')) render();
      if (opts.manual) toast('已同步');
    } catch (err) {
      syncStatus = { state: 'error', message: err.message || '同步失败', lastSync: syncStatus.lastSync };
      updateSyncStatusUI();
      if (opts.manual) toast(err.message || '同步失败');
    } finally {
      syncing = false;
      if (pendingSync) {
        pendingSync = false;
        setTimeout(() => syncNow({ silent: true }), 600);
      }
    }
  }

  function scheduleSync() {
    if (!davConfig || !spaceKey) return;
    clearTimeout(syncDebounce);
    syncDebounce = setTimeout(() => syncNow({ silent: true }), 1200);
  }

  async function connectDav(fd) {
    const url = String(fd.get('url') || '').trim();
    const user = String(fd.get('user') || '').trim();
    const passInput = String(fd.get('pass') || '');
    const passphrase = String(fd.get('passphrase') || '');
    const auto = fd.get('auto') === 'on';
    if (!url || !user) { toast('WebDAV 地址和用户名必填'); return; }
    if (!/^https:\/\//i.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//i.test(url)) {
      toast('WebDAV 必须使用 HTTPS（本机测试可用 127.0.0.1）');
      return;
    }
    const pass = passInput || (davConfig && davConfig.pass) || '';
    if (!pass) { toast('应用密码必填'); return; }
    const cfg = { url: url.replace(/\/+$/, '') + '/', user, pass, auto };

    syncStatus = { state: 'syncing', message: '正在连接…', lastSync: 0 };
    updateSyncStatusUI();
    try {
      await davTest(cfg);
      const meta = await getMeta(cfg);
      let key = spaceKey;
      let remoteSpace = null;

      if (meta) {
        if (!key) {
          if (!passphrase) throw new Error('这个空间已有口令，请输入空间口令');
          key = await deriveSpaceKey(passphrase, meta.salt);
        }
        const probe = await davGetText(cfg, 'space.enc');
        if (probe) {
          try {
            remoteSpace = await decryptJson('space.enc', probe, key);
          } catch (err) {
            throw new Error('空间口令不对');
          }
        }
        localStorage.setItem('pair.salt', meta.salt);
      } else {
        if (!passphrase) throw new Error('首次连接需要设置空间口令（至少 8 位）');
        if (passphrase.length < 8) throw new Error('空间口令至少 8 位');
        const salt = randomSalt();
        const newMeta = {
          v: 1,
          salt,
          kdf: { iterations: 310000, hash: 'SHA-256' },
          createdAt: new Date().toISOString()
        };
        await putMeta(cfg, newMeta);
        key = await deriveSpaceKey(passphrase, salt);
        localStorage.setItem('pair.salt', salt);
        localStorage.setItem('pair.synced', '1');
      }

      if (!key) throw new Error('无法获取空间密钥');

      if (remoteSpace && !localStorage.getItem('pair.synced')) {
        if (!confirm('远端已有空间数据。继续会以远端为准，覆盖本机当前数据。确定吗？')) {
          throw new Error('已取消连接');
        }
        await adoptRemote(cfg, key, remoteSpace);
        toast('已采用远端数据');
      }

      spaceKey = key;
      await idbSet('spaceKey', key);
      davConfig = cfg;
      localStorage.setItem('pair.dav', JSON.stringify(cfg));
      syncStatus = { state: 'idle', message: '已连接', lastSync: 0 };
      if (!document.querySelector('dialog[open]')) render();
      await syncNow({ manual: true });
    } catch (err) {
      syncStatus = { state: 'error', message: err.message || '连接失败', lastSync: 0 };
      updateSyncStatusUI();
      toast(err.message || '连接失败');
    }
  }

  async function lockSync() {
    spaceKey = null;
    try { await idbDel('spaceKey'); } catch (err) { /* ignore */ }
    syncStatus = { state: 'locked', message: '已锁定', lastSync: syncStatus.lastSync };
    updateSyncStatusUI();
    if (!document.querySelector('dialog[open]')) render();
    toast('已锁定；本地数据仍在');
  }

  async function clearSync() {
    if (!confirm('清除同步配置？本地数据不会删除，远端文件也不会删除。')) return;
    davConfig = null;
    spaceKey = null;
    localStorage.removeItem('pair.dav');
    localStorage.removeItem('pair.salt');
    localStorage.removeItem('pair.synced');
    try { await idbDel('spaceKey'); } catch (err) { /* ignore */ }
    syncStatus = { state: 'idle', message: '未连接', lastSync: 0 };
    updateSyncStatusUI();
    if (!document.querySelector('dialog[open]')) render();
    toast('已清除同步配置');
  }

  async function initSync() {
    try {
      const raw = localStorage.getItem('pair.dav');
      if (raw) davConfig = JSON.parse(raw);
      if (davConfig && crypto && crypto.subtle) {
        spaceKey = (await idbGet('spaceKey')) || null;
      }
      if (davConfig) {
        syncStatus = spaceKey
          ? { state: 'idle', message: '待同步', lastSync: 0 }
          : { state: 'locked', message: '已配置，待解锁', lastSync: 0 };
      }
    } catch (err) {
      syncStatus = { state: 'error', message: '同步配置读取失败', lastSync: 0 };
    }
    updateSyncStatusUI();
    if (davConfig && spaceKey) syncNow({ silent: true });
    setInterval(() => {
      if (davConfig && spaceKey && davConfig.auto !== false && !syncing && document.visibilityState !== 'hidden') {
        syncNow({ silent: true });
      }
    }, 60000);
  }

  /* ---------- 事件 ---------- */

  app.addEventListener('click', event => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'tab') {
      activeTab = el.dataset.tab;
      render();
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    if (action === 'open-todo') { openTodoForm(); return; }
    if (action === 'open-memo-form') { openMemoForm(); return; }
    if (action === 'edit-memo') { openMemoForm(el.dataset.id); return; }
    if (action === 'open-anniv-form') { openAnnivForm(); return; }
    if (action === 'edit-anniv') { openAnnivForm(el.dataset.id); return; }
    if (action === 'open-memory-form') { openMemoryForm(); return; }
    if (action === 'open-memory') { openMemory(el.dataset.id); return; }
    if (action === 'share-poster') { openSharePoster(); return; }
    if (action === 'save-poster') { savePoster(); return; }
    if (action === 'close-dialog') { closeDialog(); return; }

    if (action === 'toggle-todo') {
      const t = state.todos.find(x => x.id === el.dataset.id);
      if (t) { t.done = !t.done; touch(t); save(); render(); }
      return;
    }

    if (action === 'delete-todo') {
      if (!confirm('删除这条待办？')) return;
      const t = state.todos.find(x => x.id === el.dataset.id);
      if (t) { softDelete(t); save(); render(); }
      return;
    }

    if (action === 'toggle-pin') {
      const m = state.memos.find(x => x.id === el.dataset.id);
      if (m) { m.pinned = !m.pinned; touch(m); save(); render(); }
      return;
    }

    if (action === 'delete-memo') {
      if (!confirm('删除这张便签？')) return;
      const m = state.memos.find(x => x.id === el.dataset.id);
      if (m) { softDelete(m); save(); render(); }
      return;
    }

    if (action === 'delete-anniv') {
      if (!confirm('删除这个纪念日？')) return;
      const a = state.anniversaries.find(x => x.id === el.dataset.id);
      if (a) { softDelete(a); save(); render(); }
      return;
    }

    if (action === 'filter') {
      todoFilter = el.dataset.filter;
      render();
      return;
    }

    if (action === 'memory-cat') {
      memoryCategory = el.dataset.cat;
      document.querySelectorAll('.pair-chip[data-action="memory-cat"]').forEach(btn => {
        btn.classList.toggle('on', btn.dataset.cat === memoryCategory);
      });
      updateMemoryList();
      return;
    }

    if (action === 'delete-memory') {
      if (!confirm('删除这条回忆？')) return;
      const m = state.memories.find(x => x.id === el.dataset.id);
      if (m) { softDelete(m); save(); closeDialog(); render(); }
      return;
    }

    if (action === 'edit-member') { openMemberForm(el.dataset.id); return; }

    if (action === 'identity') {
      state.current = el.dataset.id;
      save(); render();
      return;
    }

    if (action === 'remove-image') {
      pendingImages.splice(Number(el.dataset.index), 1);
      renderPreviews();
      return;
    }

    if (action === 'export') { exportJSON(); return; }
    if (action === 'sync-now') { syncNow({ manual: true }); return; }
    if (action === 'lock-sync') { lockSync(); return; }
    if (action === 'clear-sync') { clearSync(); return; }

    if (action === 'import') {
      const input = document.getElementById('pair-import');
      if (input) input.click();
      return;
    }

    if (action === 'reset') {
      const connected = !!(davConfig && spaceKey);
      const warning = connected
        ? '重置会覆盖本地，并把示例数据同步到远端。确定吗？'
        : '重置为示例数据？当前修改会丢失。';
      if (!confirm(warning)) return;

      if (connected) {
        const old = state;
        const fresh = seedState();
        const stamp = Date.now();
        ['todos', 'memos', 'anniversaries', 'memories'].forEach(key => {
          const ids = new Set(fresh[key].map(x => x.id));
          (old[key] || []).forEach(record => {
            if (!ids.has(record.id)) {
              fresh[key].push(Object.assign({}, record, { deletedAt: stamp, updatedAt: stamp }));
            }
          });
        });
        state = fresh;
        save();
      } else {
        localStorage.removeItem(KEY);
        state = seedState();
        saveState(state);
      }

      activeTab = 'home';
      render();
      toast('已重置');
    }
  });

  app.addEventListener('submit', async event => {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    const type = form.dataset.form;
    const fd = new FormData(form);

    if (type === 'dav') {
      await connectDav(fd);
      return;
    }

    if (type === 'todo') {
      const title = String(fd.get('title') || '').trim();
      if (!title) { toast('先写要做什么'); return; }
      state.todos.unshift({
        id: uid(),
        title,
        due: String(fd.get('due') || ''),
        author: String(fd.get('author') || state.current),
        notes: String(fd.get('notes') || '').trim(),
        done: false,
        updatedAt: Date.now(),
        deletedAt: 0
      });
      save(); closeDialog(); render(); toast('已加待办');
      return;
    }

    if (type === 'memo') {
      const text = String(fd.get('text') || '').trim();
      if (!text) { toast('先写内容'); return; }
      const id = form.dataset.id;
      if (id) {
        const m = state.memos.find(x => x.id === id);
        if (m) {
          m.text = text;
          m.pinned = fd.get('pinned') === 'on';
          touch(m);
        }
      } else {
        state.memos.unshift({
          id: uid(),
          text,
          pinned: fd.get('pinned') === 'on',
          author: state.current,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          deletedAt: 0
        });
      }
      save(); closeDialog(); render(); toast('便签已保存');
      return;
    }

    if (type === 'anniv') {
      const title = String(fd.get('title') || '').trim();
      if (!title) { toast('先写名称'); return; }
      const id = form.dataset.id;
      const data = {
        title,
        date: String(fd.get('date') || todayISO()),
        repeat: fd.get('repeat') === 'on',
        note: String(fd.get('note') || '').trim()
      };
      if (id) {
        const a = state.anniversaries.find(x => x.id === id);
        if (a) Object.assign(a, data, { updatedAt: Date.now() });
      } else {
        state.anniversaries.unshift(Object.assign({ id: uid(), updatedAt: Date.now(), deletedAt: 0 }, data));
      }
      save(); closeDialog(); render(); toast('纪念日已保存');
      return;
    }

    if (type === 'memory') {
      const title = String(fd.get('title') || '').trim();
      if (!title) { toast('先写标题'); return; }
      const images = pendingImages.length ? pendingImages.slice() : ['/pair/demo/m1.svg'];
      state.memories.unshift({
        id: uid(),
        title,
        date: String(fd.get('date') || todayISO()),
        category: String(fd.get('category') || '日常'),
        note: String(fd.get('note') || '').trim(),
        images,
        comments: [],
        updatedAt: Date.now(),
        deletedAt: 0
      });
      pendingImages = [];
      save(); closeDialog(); render(); toast('已存下这条回忆');
      return;
    }

    if (type === 'comment') {
      const id = form.dataset.id;
      const text = String(fd.get('text') || '').trim();
      if (!text) return;
      const m = state.memories.find(x => x.id === id);
      if (!m) return;
      m.comments.push({ id: uid(), author: state.current, text, at: new Date().toISOString() });
      touch(m);
      save();
      setDialog(memoryDetailHTML(id));
      toast('已评论');
      return;
    }

    if (type === 'member') {
      const id = form.dataset.id;
      const name = String(fd.get('name') || '').trim();
      if (!name) { toast('昵称不能为空'); return; }
      state.members[id].name = name;
      if (pendingAvatar) state.members[id].avatar = pendingAvatar;
      spaceChanged();
      save(); closeDialog(); render(); toast('已保存');
    }
  });

  app.addEventListener('change', async event => {
    const el = event.target;

    if (el.matches('[data-change="auto-sync"]')) {
      if (davConfig) {
        davConfig.auto = el.checked;
        localStorage.setItem('pair.dav', JSON.stringify(davConfig));
        toast(el.checked ? '自动同步已开启' : '自动同步已关闭');
      }
      return;
    }

    if (el.matches('[data-change="start-date"]')) {
      if (el.value) {
        state.startDate = el.value;
        spaceChanged();
        save();
        const days = document.querySelector('.pair-days strong');
        if (days) days.textContent = daysTogether();
      }
      return;
    }

    if (el.matches('[data-change="notifications"]')) {
      if (el.checked) {
        if (!('Notification' in window)) {
          el.checked = false;
          toast('浏览器不支持通知');
          return;
        }
        const permission = await Notification.requestPermission();
        state.settings.notifications = permission === 'granted';
        el.checked = state.settings.notifications;
        save();
        toast(state.settings.notifications ? '通知已开启' : '未授权通知');
      } else {
        state.settings.notifications = false;
        save();
      }
      return;
    }

    if (el.matches('[data-file="memory-images"]')) {
      const files = Array.from(el.files || []).slice(0, 3);
      pendingImages = [];
      for (const file of files) {
        try { pendingImages.push(await readImage(file, 1400, 0.8)); } catch (err) { /* ignore */ }
      }
      renderPreviews();
      return;
    }

    if (el.matches('[data-file="avatar"]')) {
      const file = el.files && el.files[0];
      if (!file) return;
      try {
        pendingAvatar = await readImage(file, 256, 0.85);
        const preview = document.getElementById('pair-avatar-preview');
        if (preview) {
          preview.style.backgroundImage = `url('${pendingAvatar}')`;
          preview.textContent = '';
        }
      } catch (err) {
        toast('头像处理失败');
      }
      return;
    }

    if (el.matches('[data-change="import"]')) {
      const file = el.files && el.files[0];
      if (!file) return;
      try {
        const text = await readFileText(file);
        const data = JSON.parse(text);
        if (!data || data.v !== 1 || !data.members || !Array.isArray(data.todos) || !Array.isArray(data.memories)) {
          throw new Error('bad');
        }
        if (!confirm('导入会覆盖当前数据，继续？')) return;
        state = normalizeState(data);
        save();
        activeTab = 'home';
        render();
        toast('已导入');
      } catch (err) {
        toast('导入失败：文件格式不对');
      }
      el.value = '';
    }
  });

  app.addEventListener('input', event => {
    if (event.target.id === 'pair-memory-search') {
      memoryQuery = event.target.value;
      updateMemoryList();
    }
  });

  state = load();
  render();
  initSync();
})();
