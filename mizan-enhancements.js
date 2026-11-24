(function () {
  'use strict';
  var SUPABASE_URL = 'https://jrhihuaswonlcdkhoabf.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_48l_e94YWetezy99KDGqWQ_uGj7sf9i';
  var BUCKET = 'mizan-private-documents';
  var dbClient = null;
  var marketTimer = null;
  var reminderTimer = null;
  var marketCache = null;
  if (window.Icons) {
    var iconAliases = { sparkles: 'star', fileText: 'info', image: 'activity', externalLink: 'upload', bellRing: 'bell', send: 'check', trendingUp: 'activity', arrowDownLeft: 'chevR', arrowUpRight: 'chevL', chevronRight: 'chevR', chevronLeft: 'chevL', users: 'user', shield: 'lock' };
    Object.keys(iconAliases).forEach(function (name) { if (!Icons[name]) Icons[name] = Icons[iconAliases[name]] || ''; });
  }

  function h(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function money(v) {
    return Math.round(Number(v) || 0).toLocaleString('fa-IR') + ' تومان';
  }
  function num(v) { return Number(v) || 0; }
  function el(cls, html) {
    var x = document.createElement('section');
    x.className = cls || '';
    x.innerHTML = html || '';
    return x;
  }
  function head(title, subtitle, action) {
    return '<div class="mzn-head"><div><h2>' + h(title) + '</h2><p>' + h(subtitle || '') + '</p></div>' + (action || '') + '</div>';
  }
  function card(title, value, sub, icon, cls) {
    return '<div class="mzn-card ' + (cls || '') + '"><div class="mzn-card-top"><span>' + (icon || '') + '</span><small>' + h(title) + '</small></div><strong>' + value + '</strong>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>';
  }
  function button(id, label, icon, cls) {
    return '<button type="button" id="' + id + '" class="btn ' + (cls || 'btn-primary') + '">' + (icon || '') + '<span>' + h(label) + '</span></button>';
  }
  function todayJ() {
    var t = Jalali.today();
    return Jalali.fmt(t[0], t[1], t[2]);
  }
  function jToISO(s) {
    var p = Jalali.parse(s);
    if (!p) return '';
    var g = Jalali.toGregorian(p[0], p[1], p[2]);
    return String(g[0]).padStart(4, '0') + '-' + String(g[1]).padStart(2, '0') + '-' + String(g[2]).padStart(2, '0');
  }
  function isoToJ(s) {
    if (!s) return '—';
    var m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return '—';
    var j = Jalali.toJalali(+m[1], +m[2], +m[3]);
    return Jalali.faDigits(Jalali.fmt(j[0], j[1], j[2]));
  }
  function jAddDays(s, amount) {
    var p = Jalali.parse(s);
    if (!p) return todayJ();
    var g = Jalali.toGregorian(p[0], p[1], p[2]);
    var d = new Date(g[0], g[1] - 1, g[2] + amount);
    var j = Jalali.toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return Jalali.fmt(j[0], j[1], j[2]);
  }
  function getClient() {
    if (!dbClient) {
      if (!window.supabase || !window.supabase.createClient) throw new Error('کتابخانه اتصال دیتابیس بارگذاری نشده است.');
      dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, experimental: { passkey: true } }
      });
    }
    return dbClient;
  }
  async function session() {
    var c = getClient();
    var r = await c.auth.getSession();
    if (r.error) throw r.error;
    return { client: c, user: r.data && r.data.session ? r.data.session.user : null };
  }
  function notify(msg) {
    if (window.Toast && Toast.success) Toast.success(msg);
    else if (window.alert) alert(msg);
  }
  function errorMsg(err) {
    return h(err && err.message ? err.message : 'خطای نامشخص');
  }
  function greeting() {
    var hr = new Date().getHours();
    var choices=hr<11?['صبح بخیر','صبح قشنگت بخیر','روزت پر از اتفاق‌های خوب']:hr<16?['ظهر بخیر','امیدوارم روزت عالی پیش بره','وقتشه یه نفس تازه کنی']:hr<20?['عصر بخیر','خسته نباشی، عصر خوبی داشته باشی','امیدوارم روزت به خوبی پیش رفته باشه']:['شب بخیر','شبت آروم و پربرکت','وقتشه با خیال راحت روزت رو مرور کنی'];return choices[Math.floor(Math.random()*choices.length)];
  }
  function payrollData() {
    var t = Jalali.today();
    var month = Store.loadMonth(t[0], t[1] - 1);
    var cfg = Store.loadSettings();
    return { today: t, month: month, cfg: cfg, stats: Payroll.compute(month, cfg) };
  }
  function weeklyData() {
    var out = [];
    var today = todayJ();
    for (var i = 6; i >= 0; i--) {
      var ds = jAddDays(today, -i);
      var p = Jalali.parse(ds);
      var m = Store.loadMonth(p[0], p[1] - 1);
      var ev = Payroll.dayEvents(m, ds);
      out.push({ date: ds, label: Jalali.faDigits(ds.slice(8)), sales: num(ev.websiteSales) + num(ev.storeSales), expenses: num(ev.expenses) });
    }
    return out;
  }
  function forecast(data) {
    var t = data.today, days = Jalali.daysInMonth(t[0], t[1]), elapsed = Math.max(1, t[2]), stats = data.stats;
    var variableToDate = stats.netSalary - stats.fixedSalary;
    var runRate = Math.round(stats.fixedSalary + variableToDate * days / elapsed);
    var prior = [];
    for (var i = 1; i <= 5; i++) {
      var serial = t[0] * 12 + (t[1] - 1) - i;
      var y = Math.floor(serial / 12), m = serial % 12;
      var month = Store.loadMonth(y, m), s = Payroll.compute(month, data.cfg);
      if ((month.hours || []).length || (month.websiteSales || []).length || (month.storeSales || []).length) prior.push(s.netSalary);
    }
    var average = prior.length ? Math.round(prior.reduce(function (x, y) { return x + y; }, 0) / prior.length) : null;
    var projected = prior.length >= 3 ? Math.round(runRate * 0.7 + average * 0.3) : runRate;
    var deviation = null;
    if (prior.length >= 3) {
      var variance = prior.reduce(function (x, y) { return x + Math.pow(y - average, 2); }, 0) / prior.length;
      deviation = Math.round(Math.sqrt(variance));
    }
    return { projected: projected, average: average, sample: prior.length, elapsed: elapsed, days: days,
      lower: deviation == null ? null : Math.max(0, projected - deviation),
      upper: deviation == null ? null : projected + deviation };
  }
  function renderDashboard() {
    var d = payrollData();
    var t = d.today;
    var week = weeklyData();
    var max = Math.max(1, ...week.map(function (x) { return Math.max(x.sales, x.expenses); }));
    var f = forecast(d);
    var goals = Goals.load().filter(function (g) { return g.status === 'inprogress' || g.status === 'active'; });
    var rems = Reminders.load().filter(function (r) { return !r.completed; }).sort(function (a, b) { return new Date(a.dateTime || 0) - new Date(b.dateTime || 0); }).slice(0, 3);
    var root = el('mzn-page mzn-dashboard',
      '<div class="mzn-welcome"><div><span class="mzn-eyebrow">MIZAN · PERSONAL FINANCE</span><h2>' + greeting() + '، ' + h((Auth.getUser() && (Auth.getUser().name || Auth.getUser().username)) || 'خوش آمدی') + '</h2><p>امروز ' + h(Jalali.faDigits(Jalali.fmt(t[0], t[1], t[2]))) + ' است؛ وضعیت مالی‌ات را یک‌جا ببین.</p></div><div class="mzn-date-chip">' + h(Jalali.MONTHS[t[1] - 1].fa + ' ' + Jalali.faDigits(t[0])) + '</div></div>' +
      '<div class="mzn-hero-balance"><div class="mzn-hero-label">حقوق خالص این ماه</div><div class="mzn-hero-value">' + money(d.stats.netSalary) + '</div><div class="mzn-hero-foot"><span>حقوق ناخالص: ' + money(d.stats.grossSalary) + '</span><span>پورسانت: ' + money(d.stats.commission) + '</span></div><div class="mzn-orb mzn-orb-a"></div><div class="mzn-orb mzn-orb-b"></div></div>' +
      '<div class="mzn-grid">' +
      card('فروش این ماه', money(d.stats.totalSales), 'وب‌سایت و فروشگاه', Icons.bag, 'mzn-green') +
      card('هزینه‌های ثبت‌شده', money(d.stats.totalExpenses), 'هزینه‌های ماه جاری', Icons.receipt, 'mzn-olive') +
      card('ساعت کار', num(d.stats.totalHours).toLocaleString('fa-IR') + ' ساعت', 'روزهای کاری: ' + num(d.stats.workDays).toLocaleString('fa-IR'), Icons.clock, 'mzn-sage') +
      card('پورسانت', money(d.stats.commission), Number(d.stats.commissionPct || 0).toLocaleString('fa-IR') + '٪', Icons.percent, 'mzn-gold') +
      '</div>' +
      '<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>این هفته چه خبر؟</h3><p>مجموع ثبت‌های هفت روز اخیر</p></div><span class="mzn-pill">۷ روز</span></div><div class="mzn-week-bars">' +
      week.map(function (x) {
        var sh = Math.max(4, Math.round(x.sales / max * 100));
        var eh = Math.max(4, Math.round(x.expenses / max * 100));
        return '<div class="mzn-week-col" data-week-date="' + x.date + '"><div class="mzn-bars"><i style="height:' + sh + '%" title="فروش"></i><b style="height:' + eh + '%" title="هزینه"></b></div><small>' + x.label + '</small></div>';
      }).join('') +
      '</div><div class="mzn-week-legend"><span><i class="mzn-dot-sale"></i>فروش</span><span><i class="mzn-dot-exp"></i>هزینه</span><strong>فروش: ' + money(week.reduce(function (a, x) { return a + x.sales; }, 0)) + '</strong></div></div>' +
      '<div class="mzn-grid mzn-grid-two">' +
      '<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>پیش‌بینی پایان ماه</h3><p>بر اساس روند ثبت‌های این ماه</p></div>' + Icons.trendingUp + '</div><strong class="mzn-forecast-value">' + money(f.projected) + '</strong><p class="mzn-muted">برآورد حقوق خالص · روز ' + f.elapsed.toLocaleString('fa-IR') + ' از ' + f.days.toLocaleString('fa-IR') + ' روز</p>' + (f.average != null ? '<p class="mzn-muted">میانگین ' + f.sample.toLocaleString('fa-IR') + ' ماه ثبت‌شده قبل: ' + money(f.average) + (f.lower != null ? ' · بازه تقریبی: ' + money(f.lower) + ' تا ' + money(f.upper) : '') + '</p>' : '<p class="mzn-muted">برای مقایسه تاریخی، اطلاعات ماه‌های بیشتری ثبت کن.</p>') + '</div>' +
      '<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>هدف‌های فعال</h3><p>مانده تا رسیدن به هدف به‌صورت خودکار</p></div>' + Icons.target + '</div>' +
      (goals.length ? goals.slice(0, 3).map(function (g) {
        var target = num(g.targetAmount), saved = num(g.currentAmount), pct = target > 0 ? Math.min(100, saved / target * 100) : num(g.progress);
        return '<div class="mzn-goal-mini"><div><b>' + h(g.title) + '</b><span>' + (target > 0 ? money(Math.max(0, target - saved)) + ' مانده' : pct.toFixed(0) + '٪') + '</span></div><div class="mzn-progress"><i style="width:' + pct + '%"></i></div></div>';
      }).join('') : '<p class="mzn-muted">هنوز هدفی ثبت نکرده‌ای.</p>') +
      '</div></div>' +
      '<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>یادآوری‌های نزدیک</h3><p>مواردی که نباید فراموش شوند</p></div><button class="mzn-text-btn" id="mzn-go-reminders">همه یادآورها</button></div>' +
      (rems.length ? rems.map(function (r) { return '<div class="mzn-list-row"><span class="mzn-list-icon">' + Icons.bell + '</span><div><b>' + h(r.title) + '</b><small>' + h(r.dateTime ? new Date(r.dateTime).toLocaleString('fa-IR-u-ca-persian') : 'بدون زمان') + '</small></div></div>'; }).join('') : '<p class="mzn-muted">یادآوری فعالی نداری.</p>') +
      '</div><div class="mzn-actions">' +
      button('mzn-go-calendar', 'تقویم مالی', Icons.calendar, 'btn btn-primary') +
      button('mzn-go-market', 'قیمت بازار', Icons.activity, 'btn btn-ghost') +
      button('mzn-go-assistant', 'دستیار میزان', Icons.sparkles, 'btn btn-ghost') +
      '</div><div id="mzn-fin-overview" class="mzn-panel"><div class="mzn-muted">در حال دریافت خلاصه تعهدات مالی...</div></div>'
    );
    root.querySelector('#mzn-go-reminders').onclick = function () { App.navigate('reminders-db'); };
    root.querySelector('#mzn-go-calendar').onclick = function () { App.navigate('calendar'); };
    root.querySelector('#mzn-go-market').onclick = function () { App.navigate('market'); };
    root.querySelector('#mzn-go-assistant').onclick = function () { App.navigate('assistant'); };
    root.querySelectorAll('[data-week-date]').forEach(function (bar) { bar.addEventListener('click', function () { App.openDayDetail(bar.dataset.weekDate); }); });
    loadFinanceOverview(root);
    return root;
  }
  async function loadFinanceOverview(root) {
    var box = root.querySelector('#mzn-fin-overview');
    if (!box) return;
    try {
      var s = await session();
      if (!s.user) { box.innerHTML = '<h3>خلاصه تعهدات مالی</h3><p class="mzn-muted">برای مشاهده مطالبات و بدهی‌ها وارد حساب مالی شو.</p>'; return; }
      var names = ['receivables', 'personal_debt', 'installments'];
      var results = await Promise.all(names.map(function (n) { return s.client.from(n).select('amount,paid_amount,due_date'); }));
      results.forEach(function (r) { if (r.error) throw r.error; });
      function balance(rows) { return (rows || []).reduce(function (a, x) { return a + Math.max(0, num(x.amount) - num(x.paid_amount)); }, 0); }
      var rec = balance(results[0].data), debt = balance(results[1].data), inst = balance(results[2].data);
      box.innerHTML = '<div class="mzn-panel-head"><div><h3>خلاصه تعهدات مالی</h3><p>از دیتابیس امور مالی میزان</p></div>' + Icons.wallet + '</div><div class="mzn-grid mzn-grid-three">' +
        card('مطالبات باقی‌مانده', money(rec), 'قابل دریافت', Icons.arrowDownLeft, '') +
        card('بدهی باقی‌مانده', money(debt), 'قابل پرداخت', Icons.arrowUpRight, '') +
        card('اقساط باقی‌مانده', money(inst), 'سررسید اقساط', Icons.calendar, '') +
        '</div>';
    } catch (e) {
      box.innerHTML = '<h3>خلاصه تعهدات مالی</h3><p class="mzn-muted">دریافت اطلاعات ممکن نشد: ' + errorMsg(e) + '</p>';
    }
  }

  function marketTime(v) {
    if (!v) return 'زمان منبع اعلام نشده';
    var x = String(v);
    if (!/[zZ]|[+-]\d\d:\d\d$/.test(x)) x += 'Z';
    var d = new Date(x);
    if (isNaN(d.getTime())) return 'زمان نامعتبر';
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Tehran' }).format(d);
  }
  async function saveMarketHistory(items, user, c) {
    if (!user) return;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      try {
        var last = await c.from('mizan_market_snapshots').select('captured_at').eq('user_id', user.id).eq('symbol', item.id).order('captured_at', { ascending: false }).limit(1).maybeSingle();
        var lastAt = last.data && last.data.captured_at ? new Date(last.data.captured_at).getTime() : 0;
        if (Date.now() - lastAt < 8 * 60 * 1000) continue;
        await c.from('mizan_market_snapshots').insert({
          user_id: user.id, symbol: item.id, price_toman: item.price,
          change_pct: item.change_pct == null ? null : item.change_pct,
          source: 'NerkhAra', source_updated_at: item.updated_utc ? (/[zZ]|[+-]\d\d:\d\d$/.test(item.updated_utc) ? item.updated_utc : item.updated_utc + 'Z') : null
        });
      } catch (e) { console.warn('market history save failed', e); }
    }
  }
  function renderMarket() {
    if (marketTimer) clearInterval(marketTimer);
    var root = el('mzn-page mzn-market',
      head('بازار و قیمت‌ها', 'نرخ‌های بازار آزاد ایران · واحد نمایش تومان', '<span class="mzn-source-badge">منبع رایگان</span>') +
      '<div class="mzn-market-status" id="mzn-market-status">در حال دریافت آخرین نرخ‌های منتشرشده...</div>' +
      '<div class="mzn-market-grid" id="mzn-market-grid"><div class="mzn-panel">در حال بارگذاری...</div></div>' +
      '<div class="mzn-panel mzn-market-note"><b>درباره تازگی قیمت‌ها</b><p>این منبع رایگان معمولاً هر ۱۰ دقیقه داده‌ها را بازسازی می‌کند؛ بنابراین «لحظه‌به‌لحظه واقعی» نیست. میزان زمان آخرین به‌روزرسانی منبع را کنار قیمت نشان می‌دهد و در صورت کهنه‌بودن داده هشدار می‌دهد.</p><p>منبع: <a href="https://nerkhara.com/en/api/" target="_blank" rel="noopener">NerkhAra</a> · نرخ‌ها اطلاعاتی هستند و توصیه خرید یا فروش نیستند.</p></div>' +
      button('mzn-market-refresh', 'به‌روزرسانی', Icons.refresh, 'btn btn-ghost')
    );
    async function refresh() {
      var status = root.querySelector('#mzn-market-status');
      var grid = root.querySelector('#mzn-market-grid');
      if (!status || !grid || !root.isConnected) return;
      status.textContent = 'در حال دریافت نرخ‌ها...';
      try {
        var response = await fetch('https://nerkhara.com/api/v1/latest.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('پاسخ منبع بازار: ' + response.status);
        var payload = await response.json();
        var all = payload.items || [];
        var ids = ['gold-18k', 'usd', 'omr', 'gbp'];
        var labels = { 'gold-18k': 'طلای ۱۸ عیار · هر گرم', usd: 'دلار آمریکا', omr: 'ریال عمان', gbp: 'پوند انگلیس' };
        var items = ids.map(function (id) { return all.find(function (x) { return x.id === id; }); }).filter(function (x) { return x && Number(x.price) > 0; });
        if (!items.length) throw new Error('قیمت‌های درخواستی در پاسخ منبع موجود نیستند.');
        marketCache = items;
        grid.innerHTML = items.map(function (x) {
          var pct = x.change_pct == null ? 'بدون داده تغییر روزانه' : ((x.change_pct > 0 ? '+' : '') + Number(x.change_pct).toLocaleString('fa-IR', { maximumFractionDigits: 2 }) + '٪');
          var trend = x.change_pct > 0 ? 'up' : x.change_pct < 0 ? 'down' : 'flat';
          return '<article class="mzn-market-card"><div class="mzn-market-card-head"><span>' + h(labels[x.id] || x.id) + '</span><span class="mzn-trend ' + trend + '">' + pct + '</span></div><strong>' + money(x.price) + '</strong><small>آخرین دریافت منبع: ' + h(marketTime(x.updated_utc || payload.generated_utc)) + '</small>' + (x.stale ? '<em class="mzn-stale">داده کهنه است؛ با احتیاط استفاده کن.</em>' : '<em class="mzn-fresh">وضعیت منبع: تازه</em>') + '</article>';
        }).join('');
        var gen = marketTime(payload.generated_utc);
        status.innerHTML = '<span class="mzn-live-dot"></span> آخرین انتشار منبع: ' + h(gen) + ' · بررسی خودکار هر ۱۰ دقیقه';
        try { var s = await session(); await saveMarketHistory(items, s.user, s.client); } catch (e) { console.warn(e); }
      } catch (e) {
        status.innerHTML = '<span class="mzn-error-dot"></span> دریافت نرخ‌ها ناموفق بود: ' + errorMsg(e) + (marketCache ? ' · آخرین داده ذخیره‌شده در همین صفحه حفظ شده است.' : '');
        if (!marketCache) grid.innerHTML = '<div class="mzn-panel">فعلاً قیمت قابل اعتمادی دریافت نشد. کمی بعد دوباره تلاش کن.</div>';
      }
    }
    root.querySelector('#mzn-market-refresh').onclick = refresh;
    refresh();
    marketTimer = setInterval(function () {
      if (!root.isConnected) { clearInterval(marketTimer); marketTimer = null; return; }
      refresh();
    }, 10 * 60 * 1000);
    return root;
  }

  function renderDocuments() {
    var root = el('mzn-page mzn-documents',
      head('مدیریت مدارک', 'رسیدها، فاکتورها و اسناد مالی در فضای خصوصی') +
      '<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>افزودن مدرک جدید</h3><p>حداکثر ۱۵ مگابایت · PDF و تصویر</p></div>' + Icons.fileText + '</div><div class="mzn-form-grid"><label class="mzn-field">عنوان مدرک<input id="mzn-doc-title" type="text" placeholder="مثلاً فاکتور خرید"></label><label class="mzn-field">دسته‌بندی<select id="mzn-doc-category"><option value="general">عمومی</option><option value="receipt">رسید</option><option value="invoice">فاکتور</option><option value="contract">قرارداد</option><option value="bank">مدرک بانکی</option><option value="other">سایر</option></select></label><label class="mzn-field mzn-full">توضیحات<input id="mzn-doc-note" type="text" placeholder="توضیح اختیاری"></label><label class="mzn-field mzn-full">انتخاب فایل<input id="mzn-doc-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.docx,.xlsx,.txt"></label></div>' + button('mzn-doc-upload', 'بارگذاری امن مدرک', Icons.upload, 'btn btn-primary') + '<div id="mzn-doc-msg" class="mzn-muted"></div></div>' +
      '<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>آرشیو مدارک</h3><p>فقط فایل‌های متعلق به حساب خودت</p></div><span id="mzn-doc-count" class="mzn-pill">۰</span></div><div id="mzn-doc-list" class="mzn-doc-list">در حال بارگذاری...</div></div>'
    );
    var msg = root.querySelector('#mzn-doc-msg');
    async function load() {
      var list = root.querySelector('#mzn-doc-list');
      try {
        var s = await session();
        if (!s.user) { list.textContent = 'برای استفاده از آرشیو مدارک ابتدا وارد حساب مالی شو.'; return; }
        var r = await s.client.from('mizan_documents').select('*').order('created_at', { ascending: false });
        if (r.error) throw r.error;
        root.querySelector('#mzn-doc-count').textContent = (r.data || []).length.toLocaleString('fa-IR');
        if (!r.data || !r.data.length) { list.innerHTML = '<div class="mzn-empty">هنوز مدرکی بارگذاری نشده است.</div>'; return; }
        list.innerHTML = r.data.map(function (x) {
          return '<div class="mzn-doc-row"><span class="mzn-doc-icon">' + (x.mime_type.indexOf('image/') === 0 ? Icons.image : Icons.fileText) + '</span><div class="mzn-doc-info"><b>' + h(x.file_name) + '</b><small>' + h(x.category) + ' · ' + h(new Date(x.created_at).toLocaleDateString('fa-IR-u-ca-persian')) + ' · ' + h((x.file_size / 1024 / 1024).toFixed(2)) + ' MB</small>' + (x.note ? '<small>' + h(x.note) + '</small>' : '') + '</div><div class="mzn-doc-actions"><button type="button" data-open="' + h(x.id) + '" title="مشاهده">' + Icons.externalLink + '</button><button type="button" data-del="' + h(x.id) + '" title="حذف">' + Icons.trash + '</button></div></div>';
        }).join('');
        list.querySelectorAll('[data-open]').forEach(function (b) {
          b.onclick = async function () {
            try {
              var item = r.data.find(function (x) { return x.id === b.dataset.open; });
              var u = await s.client.storage.from(BUCKET).createSignedUrl(item.file_path, 120);
              if (u.error) throw u.error;
              window.open(u.data.signedUrl, '_blank', 'noopener');
            } catch (e) { notify('بازکردن فایل ناموفق بود: ' + (e.message || '')); }
          };
        });
        list.querySelectorAll('[data-del]').forEach(function (b) {
          b.onclick = async function () {
            if (!confirm('این مدرک و فایل خصوصی آن حذف شود؟')) return;
            try {
              var item = r.data.find(function (x) { return x.id === b.dataset.del; });
              var rm = await s.client.storage.from(BUCKET).remove([item.file_path]);
              if (rm.error) throw rm.error;
              var dr = await s.client.from('mizan_documents').delete().eq('id', item.id);
              if (dr.error) throw dr.error;
              notify('مدرک حذف شد.');
              load();
            } catch (e) { notify('حذف انجام نشد: ' + (e.message || '')); }
          };
        });
      } catch (e) { list.innerHTML = '<div class="mzn-empty">خطا در دریافت مدارک: ' + errorMsg(e) + '</div>'; }
    }
    root.querySelector('#mzn-doc-upload').onclick = async function () {
      var file = root.querySelector('#mzn-doc-file').files[0];
      if (!file) { msg.textContent = 'ابتدا یک فایل انتخاب کن.'; return; }
      if (file.size > 15 * 1024 * 1024) { msg.textContent = 'حجم فایل نباید بیشتر از ۱۵ مگابایت باشد.'; return; }
      var allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (allowed.indexOf(file.type) < 0) { msg.textContent = 'نوع این فایل مجاز نیست.'; return; }
      var b = root.querySelector('#mzn-doc-upload');
      b.disabled = true; msg.textContent = 'در حال بارگذاری امن...';
      try {
        var s = await session();
        if (!s.user) throw new Error('ابتدا وارد حساب مالی شو.');
        var clean = file.name.replace(/[^a-zA-Z0-9._\-\u0600-\u06FF]/g, '_').slice(0, 100);
        var path = s.user.id + '/' + Date.now() + '_' + clean;
        var up = await s.client.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
        if (up.error) throw up.error;
        var ins = await s.client.from('mizan_documents').insert({
          user_id: s.user.id, file_path: path, file_name: root.querySelector('#mzn-doc-title').value.trim() || file.name,
          mime_type: file.type, file_size: file.size, category: root.querySelector('#mzn-doc-category').value,
          note: root.querySelector('#mzn-doc-note').value.trim()
        });
        if (ins.error) {
          await s.client.storage.from(BUCKET).remove([path]);
          throw ins.error;
        }
        root.querySelector('#mzn-doc-file').value = '';
        root.querySelector('#mzn-doc-title').value = '';
        root.querySelector('#mzn-doc-note').value = '';
        msg.textContent = 'مدرک با موفقیت و به‌صورت خصوصی ذخیره شد.';
        load();
      } catch (e) { msg.textContent = 'بارگذاری ناموفق بود: ' + (e.message || ''); }
      finally { b.disabled = false; }
    };
    setTimeout(load, 0);
    return root;
  }

  function renderReminders() {
    if (reminderTimer) { clearInterval(reminderTimer); reminderTimer = null; }
    var root = el('mzn-page mzn-reminders',
      head('یادآور هوشمند', 'سررسیدها و کارهای مالی را فراموش نکن') +
      '<div class="mzn-panel"><h3>یادآوری جدید</h3><div class="mzn-form-grid"><label class="mzn-field mzn-full">عنوان<input id="mzn-rem-title" type="text" placeholder="مثلاً پرداخت قسط"></label><div class="mzn-field mzn-full" id="mzn-rem-date-wrap">' + makeDpf('mzn-rem-date', todayJ(), 'تاریخ شمسی') + '</div><label class="mzn-field">ساعت<input id="mzn-rem-time" type="time" value="09:00"></label><label class="mzn-field">اولویت<select id="mzn-rem-priority"><option value="normal">معمولی</option><option value="high">مهم</option><option value="urgent">فوری</option><option value="low">کم</option></select></label><label class="mzn-field">تکرار<select id="mzn-rem-repeat"><option value="none">بدون تکرار</option><option value="daily">روزانه</option><option value="weekly">هفتگی</option><option value="monthly">ماهانه</option><option value="yearly">سالانه</option></select></label><label class="mzn-field mzn-full">توضیحات<input id="mzn-rem-note" type="text" placeholder="اختیاری"></label></div>' + button('mzn-rem-save', 'ثبت یادآوری', Icons.bell, 'btn btn-primary') + ' ' + button('mzn-rem-notify', 'فعال‌سازی اعلان مرورگر', Icons.bellRing, 'btn btn-ghost') + '<div id="mzn-rem-msg" class="mzn-muted"></div></div>' +
      '<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>یادآوری‌ها</h3><p>فعال، انجام‌شده و عقب‌افتاده</p></div></div><div id="mzn-rem-list">در حال بارگذاری...</div></div>'
    );
    var datePicker = null;
    setTimeout(function () { datePicker = bindDp('mzn-rem-date', todayJ()); }, 0);
    async function load() {
      var list = root.querySelector('#mzn-rem-list');
      try {
        var s = await session();
        if (!s.user) { list.textContent = 'برای ذخیره یادآورها در فضای ابری وارد حساب مالی شو.'; return; }
        var r = await s.client.from('mizan_reminders').select('*').order('due_date', { ascending: true });
        if (r.error) throw r.error;
        var rows = r.data || [];
        if (!rows.length) { list.innerHTML = '<div class="mzn-empty">یادآوری‌ای ثبت نشده است.</div>'; return; }
        list.innerHTML = rows.map(function (x) {
          var due = x.due_date ? isoToJ(x.due_date) : 'بدون تاریخ';
          var overdue = !x.completed && x.due_date && x.due_date < jToISO(todayJ());
          return '<div class="mzn-rem-row ' + (x.completed ? 'is-done' : overdue ? 'is-overdue' : '') + '"><div class="mzn-rem-main"><b>' + h(x.title) + '</b><small>' + h(due) + (x.due_at ? ' · ' + h(new Date(x.due_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })) : '') + ' · ' + h(x.priority) + '</small>' + (x.note ? '<small>' + h(x.note) + '</small>' : '') + '</div><div class="mzn-doc-actions"><button type="button" data-done="' + h(x.id) + '" title="انجام شد">' + Icons.check + '</button><button type="button" data-remove="' + h(x.id) + '" title="حذف">' + Icons.trash + '</button></div></div>';
        }).join('');
        list.querySelectorAll('[data-done]').forEach(function (b) {
          b.onclick = async function () {
            var row = rows.find(function (x) { return x.id === b.dataset.done; });
            if (!row.completed && row.repeat_rule !== 'none' && row.due_at) {
              var next = new Date(row.due_at);
              if (row.repeat_rule === 'daily') next.setDate(next.getDate() + 1);
              else if (row.repeat_rule === 'weekly') next.setDate(next.getDate() + 7);
              else if (row.repeat_rule === 'monthly') next.setMonth(next.getMonth() + 1);
              else if (row.repeat_rule === 'yearly') next.setFullYear(next.getFullYear() + 1);
              var nextDate = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0') + '-' + String(next.getDate()).padStart(2, '0');
              var repeatInsert = await s.client.from('mizan_reminders').insert({ user_id: s.user.id, title: row.title, note: row.note, due_at: next.toISOString(), due_date: nextDate, priority: row.priority, repeat_rule: row.repeat_rule });
              if (repeatInsert.error) { notify('ساخت یادآوری بعدی انجام نشد: ' + repeatInsert.error.message); return; }
            }
            var up = await s.client.from('mizan_reminders').update({ completed: !row.completed, completed_at: row.completed ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', row.id);
            if (up.error) notify(up.error.message); else load();
          };
        });
        list.querySelectorAll('[data-remove]').forEach(function (b) {
          b.onclick = async function () {
            if (!confirm('یادآوری حذف شود؟')) return;
            var rm = await s.client.from('mizan_reminders').delete().eq('id', b.dataset.remove);
            if (rm.error) notify(rm.error.message); else load();
          };
        });
      } catch (e) { list.innerHTML = '<div class="mzn-empty">خطا: ' + errorMsg(e) + '</div>'; }
    }
    root.querySelector('#mzn-rem-save').onclick = async function () {
      var title = root.querySelector('#mzn-rem-title').value.trim();
      var date = datePicker ? datePicker.getValue() : todayJ();
      var time = root.querySelector('#mzn-rem-time').value || '09:00';
      var msg = root.querySelector('#mzn-rem-msg');
      if (!title || !date) { msg.textContent = 'عنوان و تاریخ شمسی الزامی است.'; return; }
      try {
        var s = await session();
        if (!s.user) throw new Error('ابتدا وارد حساب مالی شو.');
        var iso = jToISO(date);
        var local = new Date(iso + 'T' + time + ':00');
        var ins = await s.client.from('mizan_reminders').insert({
          user_id: s.user.id, title: title, note: root.querySelector('#mzn-rem-note').value.trim(),
          due_date: iso, due_at: local.toISOString(), priority: root.querySelector('#mzn-rem-priority').value,
          repeat_rule: root.querySelector('#mzn-rem-repeat').value
        });
        if (ins.error) throw ins.error;
        root.querySelector('#mzn-rem-title').value = '';
        root.querySelector('#mzn-rem-note').value = '';
        msg.textContent = 'یادآوری ذخیره شد.';
        load();
      } catch (e) { msg.textContent = 'ذخیره انجام نشد: ' + (e.message || ''); }
    };
    root.querySelector('#mzn-rem-notify').onclick = async function () {
      if (!('Notification' in window)) { notify('این مرورگر اعلان وب را پشتیبانی نمی‌کند.'); return; }
      try { var p = await Notification.requestPermission(); notify(p === 'granted' ? 'اجازه اعلان داده شد؛ اعلان‌ها هنگام بازبودن سایت بررسی می‌شوند.' : 'اجازه اعلان داده نشد.'); }
      catch (e) { notify('مرورگر اجازه اعلان نداد: ' + (e.message || '')); }
    };
    setTimeout(load, 0);
    async function checkDueNotifications() {
      if (!root.isConnected) { if (reminderTimer) clearInterval(reminderTimer); reminderTimer = null; return; }
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      try {
        var s = await session(); if (!s.user) return;
        var now = Date.now(), from = new Date(now - 60000).toISOString(), to = new Date(now + 60000).toISOString();
        var due = await s.client.from('mizan_reminders').select('id,title,due_at').eq('completed', false).gte('due_at', from).lte('due_at', to);
        if (due.error) return;
        (due.data || []).forEach(function (x) { var key = 'mizan-notified-' + x.id; if (!localStorage.getItem(key)) { if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function (reg) { return reg.showNotification('یادآوری میزان', { body: x.title, tag: key }); }).catch(function () { new Notification('یادآوری میزان', { body: x.title }); }); else new Notification('یادآوری میزان', { body: x.title }); localStorage.setItem(key, String(Date.now())); } });
      } catch (e) { console.warn('Reminder notification check failed', e); }
    }
    checkDueNotifications();
    reminderTimer = setInterval(checkDueNotifications, 60000);
    return root;
  }

  function renderCalendar() {
    var now = Jalali.today();
    var state = { y: now[0], m: now[1], selected: todayJ(), events: [] };
    var root = el('mzn-page mzn-calendar',
      head('تقویم مالی شمسی', 'سررسیدها، اقساط، طلب‌ها و بدهی‌ها در یک تقویم') +
      '<div class="mzn-panel"><div class="mzn-cal-head"><button id="mzn-cal-prev" type="button">' + Icons.chevronRight + '</button><strong id="mzn-cal-title"></strong><button id="mzn-cal-next" type="button">' + Icons.chevronLeft + '</button></div><div class="mzn-cal-grid" id="mzn-cal-grid"></div><div class="mzn-cal-legend"><span>● یادآوری</span><span>● قسط</span><span>● طلب/بدهی</span></div></div>' +
      '<div class="mzn-panel"><div class="mzn-panel-head"><div><h3 id="mzn-cal-selected"></h3><p>رویدادهای انتخاب‌شده</p></div>' + button('mzn-cal-add', 'یادآوری جدید', Icons.plus, 'btn btn-primary') + '</div><div id="mzn-cal-events">در حال دریافت...</div></div>'
    );
    async function loadEvents() {
      try {
        var s = await session();
        if (!s.user) { state.events = []; draw(); return; }
        var qs = await Promise.all([
          s.client.from('mizan_reminders').select('id,title,due_date,due_at,completed,priority').eq('completed', false),
          s.client.from('installments').select('id,installment_number,amount,paid_amount,due_date').is('paid_at', null),
          s.client.from('receivables').select('id,person_name,amount,paid_amount,due_date'),
          s.client.from('personal_debt').select('id,creditor_name,amount,paid_amount,due_date')
        ]);
        qs.forEach(function (x) { if (x.error) throw x.error; });
        state.events = [];
        (qs[0].data || []).forEach(function (x) { if (x.due_date) state.events.push({ date: x.due_date, title: x.title, type: 'یادآوری', icon: 'rem' }); });
        (qs[1].data || []).forEach(function (x) { if (x.due_date && num(x.amount) > num(x.paid_amount)) state.events.push({ date: x.due_date, title: 'قسط ' + x.installment_number + ' · ' + money(num(x.amount) - num(x.paid_amount)), type: 'قسط', icon: 'inst' }); });
        (qs[2].data || []).forEach(function (x) { if (x.due_date && num(x.amount) > num(x.paid_amount)) state.events.push({ date: x.due_date, title: 'طلب از ' + (x.person_name || 'شخص') + ' · ' + money(num(x.amount) - num(x.paid_amount)), type: 'طلب', icon: 'fin' }); });
        (qs[3].data || []).forEach(function (x) { if (x.due_date && num(x.amount) > num(x.paid_amount)) state.events.push({ date: x.due_date, title: 'بدهی به ' + (x.creditor_name || 'شخص') + ' · ' + money(num(x.amount) - num(x.paid_amount)), type: 'بدهی', icon: 'fin' }); });
      } catch (e) { root.querySelector('#mzn-cal-events').innerHTML = '<div class="mzn-muted">برخی رویدادها بارگذاری نشدند: ' + errorMsg(e) + '</div>'; }
      draw();
    }
    function draw() {
      var title = root.querySelector('#mzn-cal-title'), grid = root.querySelector('#mzn-cal-grid'), evbox = root.querySelector('#mzn-cal-events');
      if (!title || !grid) return;
      title.textContent = Jalali.MONTHS[state.m - 1].fa + ' ' + Jalali.faDigits(state.y);
      var dim = Jalali.daysInMonth(state.y, state.m), first = Jalali.weekday(state.y, state.m, 1), html = '';
      ['ش','ی','د','س','چ','پ','ج'].forEach(function (x) { html += '<span class="mzn-cal-weekday">' + x + '</span>'; });
      for (var z = 0; z < first; z++) html += '<span class="mzn-cal-empty"></span>';
      for (var d = 1; d <= dim; d++) {
        var ds = Jalali.fmt(state.y, state.m, d), n = state.events.filter(function (x) { return x.date === jToISO(ds); }).length;
        html += '<button type="button" class="mzn-cal-day ' + (ds === state.selected ? 'selected' : '') + (ds === todayJ() ? ' today' : '') + '" data-date="' + ds + '">' + Jalali.faDigits(d) + (n ? '<i>' + n.toLocaleString('fa-IR') + '</i>' : '') + '</button>';
      }
      grid.innerHTML = html;
      grid.querySelectorAll('[data-date]').forEach(function (b) { b.onclick = function () { state.selected = b.dataset.date; draw(); }; });
      root.querySelector('#mzn-cal-selected').textContent = 'رویدادهای ' + Jalali.faDigits(state.selected);
      var selectedISO = jToISO(state.selected);
      var found = state.events.filter(function (x) { return x.date === selectedISO; });
      evbox.innerHTML = found.length ? found.map(function (x) { return '<div class="mzn-list-row"><span class="mzn-list-icon">' + (x.icon === 'inst' ? Icons.calendar : x.icon === 'fin' ? Icons.wallet : Icons.bell) + '</span><div><b>' + h(x.title) + '</b><small>' + h(x.type) + '</small></div></div>'; }).join('') : '<div class="mzn-empty">برای این روز رویدادی ثبت نشده است.</div>';
    }
    root.querySelector('#mzn-cal-prev').onclick = function () { if (state.m === 1) { state.m = 12; state.y--; } else state.m--; draw(); };
    root.querySelector('#mzn-cal-next').onclick = function () { if (state.m === 12) { state.m = 1; state.y++; } else state.m++; draw(); };
    root.querySelector('#mzn-cal-add').onclick = function () { App.navigate('reminders-db'); };
    loadEvents();
    return root;
  }

  function assistantReply(question) {
    var q = String(question || '').toLowerCase();
    var d = payrollData(), s = d.stats, f = forecast(d);
    var goals = Goals.load();
    var rems = Reminders.load().filter(function (x) { return !x.completed; });
    if (/حقوق|دستمزد|خالص/.test(q)) return 'حقوق خالص ثبت‌شده این ماه ' + money(s.netSalary) + ' است. حقوق ناخالص ' + money(s.grossSalary) + ' و کسورات ' + money(s.totalDeductions) + ' است.';
    if (/فروش/.test(q)) return 'فروش ثبت‌شده این ماه ' + money(s.totalSales) + ' است؛ فروش وب‌سایت ' + money(s.websiteSales) + ' و فروش فروشگاه ' + money(s.storeSales) + ' است.';
    if (/درآمد/.test(q)) return 'حقوق خالص محاسبه‌شده این ماه ' + money(s.netSalary) + ' و فروش ثبت‌شده ' + money(s.totalSales) + ' است. این دو عدد جدا از هم نمایش داده شده‌اند تا با هم اشتباه نشوند.';
    if (/هزینه|خرج/.test(q)) return 'هزینه‌های ثبت‌شده این ماه ' + money(s.totalExpenses) + ' و کسورات حقوق ' + money(s.totalDeductions) + ' است.';
    if (/پیش.?بین|آینده|آخر ماه/.test(q)) return 'برآورد ساده حقوق خالص پایان ماه ' + money(f.projected) + ' است. این تخمین از مقدار ثبت‌شده تا امروز و تعداد روزهای ماه محاسبه شده؛ تضمین یا توصیه مالی نیست.';
    if (/هدف|پس.?انداز/.test(q)) {
      if (!goals.length) return 'هنوز هدفی ثبت نشده است. از بخش «بیشتر ← دستاوردها و اهداف» یک هدف با مبلغ کل و مبلغ پس‌انداز فعلی بساز.';
      return goals.map(function (g) { var target = num(g.targetAmount), saved = num(g.currentAmount); return g.title + ': ' + (target > 0 ? 'مانده ' + money(Math.max(0, target - saved)) + ' از ' + money(target) : num(g.progress) + ' درصد پیشرفت'); }).join('؛ ');
    }
    if (/یادآور|سررسید|قسط/.test(q)) return rems.length ? 'تعداد یادآوری‌های باز فعلی ' + rems.length.toLocaleString('fa-IR') + ' مورد است. برای سررسیدهای مالی از تقویم مالی شمسی هم استفاده کن.' : 'یادآوری بازی در فهرست محلی فعلی ثبت نشده است.';
    if (/هفته/.test(q)) {
      var w = weeklyData();
      return 'در هفت روز اخیر ' + money(w.reduce(function (a, x) { return a + x.sales; }, 0)) + ' فروش و ' + money(w.reduce(function (a, x) { return a + x.expenses; }, 0)) + ' هزینه ثبت شده است.';
    }
    return 'خلاصه این ماه: حقوق خالص ' + money(s.netSalary) + '، فروش ' + money(s.totalSales) + '، هزینه ' + money(s.totalExpenses) + '، ساعت کار ' + num(s.totalHours).toLocaleString('fa-IR') + ' ساعت. می‌توانی درباره حقوق، فروش، هزینه‌ها، اهداف، یادآورها یا پیش‌بینی پایان ماه سؤال کنی.';
  }
  function renderAssistant() {
    var root = el('mzn-page mzn-assistant',
      head('دستیار میزان', 'نسخه تحلیلی رایگان و داخلی · بدون API و بدون هزینه') +
      '<div class="mzn-assistant-hero"><span>' + Icons.sparkles + '</span><h3>سلام! من دستیار تحلیلی میزان هستم.</h3><p>می‌توانم از داده‌های ثبت‌شده در میزان خلاصه و محاسبه بسازم. این نسخه مدل زبانی مثل ChatGPT نیست و پاسخ آزاد عمومی تولید نمی‌کند.</p></div>' +
      '<div class="mzn-prompt-chips"><button data-q="حقوق خالص این ماه چقدر است؟">حقوق خالص من</button><button data-q="این هفته چه خبر؟">گزارش این هفته</button><button data-q="چقدر تا هدفم مانده؟">مانده هدف‌ها</button><button data-q="پیش‌بینی پایان ماه">پیش‌بینی پایان ماه</button></div>' +
      '<div class="mzn-panel"><div id="mzn-chat-log" class="mzn-chat-log"><div class="mzn-chat-bot">برای شروع یکی از سؤال‌های بالا را انتخاب کن یا سؤال خودت را بنویس.</div></div><div class="mzn-chat-compose"><input id="mzn-chat-input" type="text" placeholder="مثلاً این ماه چقدر هزینه کردم؟"><button id="mzn-chat-send" type="button">' + Icons.send + '</button></div></div>'
    );
    var log = root.querySelector('#mzn-chat-log');
    function ask(q) {
      if (!q || !q.trim()) return;
      var user = document.createElement('div'); user.className = 'mzn-chat-user'; user.textContent = q; log.appendChild(user);
      var bot = document.createElement('div'); bot.className = 'mzn-chat-bot'; bot.textContent = assistantReply(q); log.appendChild(bot);
      root.querySelector('#mzn-chat-input').value = '';
      log.scrollTop = log.scrollHeight;
    }
    root.querySelector('#mzn-chat-send').onclick = function () { ask(root.querySelector('#mzn-chat-input').value); };
    root.querySelector('#mzn-chat-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') ask(this.value); });
    root.querySelectorAll('[data-q]').forEach(function (b) { b.onclick = function () { ask(b.dataset.q); }; });
    return root;
  }

  function renderMore() {
    var items = [
      ['today', 'امروز و ثبت سریع', Icons.home, 'ساعت کار، فروش و ثبت روزانه'],
      ['months', 'ماه‌ها و گزارش حقوق', Icons.grid, 'گزارش ماهانه و سوابق'],
      ['reminders', 'یادآوری‌های قبلی', Icons.bell, 'یادآورهای فعلی سایت'],
      ['reminders-db', 'یادآور هوشمند مالی', Icons.bellRing, 'سررسیدهای ابری و اعلان‌ها'],
      ['calendar', 'تقویم مالی شمسی', Icons.calendar, 'نمایش تمام سررسیدها'],
      ['records', 'سوابق', Icons.activity, 'تاریخچه ثبت‌ها'],
      ['achievements', 'دستاوردها و اهداف', Icons.target, 'پیشرفت هدف و تبریک تکمیل'],
      ['assistant', 'دستیار میزان', Icons.sparkles, 'تحلیل رایگان داده‌های خودت'],
      ['settings', 'تنظیمات', Icons.settings, 'ظاهر و پشتیبان‌گیری']
    ];
    if (Perms.isAdmin()) { items.push(['users', 'مدیریت کاربران', Icons.users, 'مدیریت دسترسی']); items.push(['audit', 'گزارش فعالیت', Icons.shield, 'تاریخچه تغییرات']); }
    var root = el('mzn-page mzn-more', head('بیشتر', 'همه بخش‌های میزان در یک جا'));
    root.innerHTML += '<div class="mzn-more-grid">' + items.map(function (x) {
      return '<button type="button" class="mzn-more-item" data-page="' + x[0] + '"><span>' + x[2] + '</span><b>' + h(x[1]) + '</b><small>' + h(x[3]) + '</small>' + Icons.chevronLeft + '</button>';
    }).join('') + '</div>';
    root.querySelectorAll('[data-page]').forEach(function (b) { b.onclick = function () { App.navigate(b.dataset.page); }; });
    return root;
  }

  async function syncGoalToDatabase(goal) {
    try {
      var s = await session();
      if (!s.user || !goal || !goal.id) return;
      var target = num(goal.targetAmount);
      if (target <= 0) {
        await s.client.from('mizan_goals').delete().eq('user_id', s.user.id).eq('legacy_id', String(goal.id));
        return;
      }
      var status = goal.status === 'completed' ? 'completed' : goal.status === 'paused' ? 'paused' : 'active';
      var due = goal.endDate ? jToISO(goal.endDate) : null;
      var result = await s.client.from('mizan_goals').upsert({
        user_id: s.user.id, legacy_id: String(goal.id), title: goal.title || 'هدف مالی',
        description: goal.description || '', target_amount: target, current_amount: num(goal.currentAmount),
        due_date: due || null, status: status, updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,legacy_id' });
      if (result.error) console.warn('Mizan goal sync failed', result.error);
    } catch (e) { console.warn('Mizan goal sync failed', e); }
  }
  async function syncAllGoals() {
    try {
      var goals = Goals.load();
      for (var i = 0; i < goals.length; i++) if (num(goals[i].targetAmount) > 0) await syncGoalToDatabase(goals[i]);
    } catch (e) { console.warn('Mizan goals initial sync failed', e); }
  }
  function installGoalSync() {
    if (!window.Goals || Goals.__mizanSyncInstalled) return;
    var add = Goals.add, update = Goals.update, remove = Goals.remove;
    Goals.add = function (goal, user) { var result = add.call(Goals, goal, user); syncGoalToDatabase(result); return result; };
    Goals.update = function (id, patch, user) { var result = update.call(Goals, id, patch, user); if (result) syncGoalToDatabase(result); return result; };
    Goals.remove = function (id, user) { var old = Goals.load(user).find(function (g) { return g.id === id; }); var result = remove.call(Goals, id, user); if (old) syncGoalToDatabase(Object.assign({}, old, { targetAmount: 0 })); return result; };
    Goals.__mizanSyncInstalled = true;
  }


  function installAssistantFab() {
    if (document.getElementById('mzn-assistant-fab') || !document.body) return;
    var tips = [
      'می‌توانم حقوق خالص این ماهت را حساب کنم.',
      'می‌توانم خرج‌ها و فروش‌هایت را خلاصه کنم.',
      'می‌توانم پیشرفت هدف‌های مالی‌ات را بررسی کنم.',
      'می‌توانم وضعیت این هفته‌ات را جمع‌بندی کنم.',
      'می‌توانم برای پایان ماه یک برآورد بسازم.',
      'می‌توانم یادآورها و سررسیدهایت را مرور کنم.'
    ];
    var tipIndex = Math.floor(Math.random() * tips.length);
    var tip = document.createElement('button');
    tip.type = 'button'; tip.id = 'mzn-assistant-tip'; tip.className = 'mzn-assistant-tip';
    tip.setAttribute('aria-label', 'باز کردن دستیار میزان'); tip.textContent = tips[tipIndex];
    var fab = document.createElement('button');
    fab.type = 'button'; fab.id = 'mzn-assistant-fab'; fab.className = 'mzn-assistant-fab';
    fab.setAttribute('aria-label', 'باز کردن دستیار میزان'); fab.setAttribute('title', 'دستیار میزان');
    fab.innerHTML = (Icons.sparkles || Icons.star || '✦') + '<span class="mzn-fab-pulse"></span>';
    function openAssistant() { if (window.App && App.navigate) App.navigate('assistant'); }
    tip.addEventListener('click', openAssistant);
    fab.addEventListener('click', openAssistant);
    document.body.appendChild(tip); document.body.appendChild(fab);
    function setTip() { if (!tip.isConnected) return; tip.classList.remove('mzn-tip-in'); void tip.offsetWidth; tip.textContent = tips[tipIndex++ % tips.length]; tip.classList.add('mzn-tip-in'); }
    setTip(); window.setInterval(setTip, 7600);
    window.MizanAssistantFab = {
      update: function (page) {
        var opened = page === 'assistant';
        fab.classList.toggle('is-open', opened);
        fab.setAttribute('aria-label', opened ? 'بازگشت به خانه' : 'باز کردن دستیار میزان');
        fab.innerHTML = opened ? (Icons.x || '×') : (Icons.sparkles || Icons.star || '✦') + '<span class="mzn-fab-pulse"></span>';
        tip.hidden = opened;
        if (opened) fab.onclick = function () { App.navigate('dashboard'); };
        else fab.onclick = openAssistant;
      }
    };
  }
  function installMotionStyles() {
    var doc = window.parent && window.parent.document ? window.parent.document : document;
    if (doc.getElementById('mizan-motion-parent-style')) return;
    var style = doc.createElement('style'); style.id = 'mizan-motion-parent-style';
    style.textContent = '.global-nav.nav-tabs{isolation:isolate}.global-nav .nav-tab{position:relative!important;overflow:hidden!important;transition:transform .24s cubic-bezier(.2,.75,.25,1),color .24s ease,background .24s ease,box-shadow .24s ease!important}.global-nav .nav-tab:active{transform:scale(.93)!important}.global-nav .nav-tab.active{transform:translateY(-2px)!important;box-shadow:0 8px 22px rgba(35,107,77,.25),inset 0 1px 0 rgba(255,255,255,.28)!important}.global-nav .nav-tab.active:after{content:"";position:absolute;bottom:3px;left:50%;width:15px;height:2px;border-radius:3px;background:rgba(255,255,255,.9);transform:translateX(-50%);animation:mznNavLine .3s ease both}.global-nav .nav-tab svg{transition:transform .28s cubic-bezier(.2,.8,.2,1)!important}.global-nav .nav-tab.active svg{transform:translateY(-1px) scale(1.08)}@keyframes mznNavLine{from{width:0;opacity:0}to{width:15px;opacity:1}}.mzn-assistant-fab{position:fixed;z-index:2147482500;right:17px;bottom:calc(102px + env(safe-area-inset-bottom));width:58px;height:58px;border:1px solid rgba(255,255,255,.7);border-radius:21px;display:grid;place-items:center;color:#fff;background:linear-gradient(145deg,#236b4d,#8fb394);box-shadow:0 12px 30px rgba(35,107,77,.34),inset 0 1px 0 rgba(255,255,255,.35);animation:mznFabFloat 2.7s ease-in-out infinite;transition:transform .25s ease,box-shadow .25s ease}.mzn-assistant-fab>svg{width:26px;height:26px}.mzn-assistant-fab:active{transform:scale(.91)}.mzn-assistant-fab.is-open{animation:none;background:linear-gradient(145deg,#5c7961,#236b4d)}.mzn-fab-pulse{position:absolute;inset:-5px;border:1px solid rgba(95,157,111,.4);border-radius:24px;animation:mznFabPulse 2.2s ease-out infinite;pointer-events:none}.mzn-assistant-tip{position:fixed;z-index:2147482500;right:15px;bottom:calc(170px + env(safe-area-inset-bottom));max-width:min(245px,calc(100vw - 40px));padding:10px 13px;border:1px solid rgba(35,107,77,.16);border-radius:15px 15px 5px 15px;background:rgba(250,249,240,.94);color:#28583f;font:600 11px/1.8 system-ui,sans-serif;text-align:right;box-shadow:0 9px 24px rgba(30,65,42,.14);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);cursor:pointer;animation:mznTipFloat 3.2s ease-in-out infinite}.mzn-assistant-tip:after{content:"";position:absolute;right:22px;bottom:-6px;width:11px;height:11px;background:inherit;border-right:1px solid rgba(35,107,77,.16);border-bottom:1px solid rgba(35,107,77,.16);transform:rotate(45deg)}.mzn-assistant-tip[hidden]{display:none!important}.mzn-tip-in{animation:mznTipIn .35s cubic-bezier(.2,.8,.2,1) both}@keyframes mznFabFloat{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-5px) rotate(-2deg)}}@keyframes mznFabPulse{0%{transform:scale(.9);opacity:.7}100%{transform:scale(1.32);opacity:0}}@keyframes mznTipFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}@keyframes mznTipIn{from{opacity:0;transform:translateY(7px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}@media(max-width:420px){.mzn-assistant-fab{width:54px;height:54px;right:13px;bottom:calc(100px + env(safe-area-inset-bottom))}.mzn-assistant-tip{right:12px;bottom:calc(164px + env(safe-area-inset-bottom));font-size:10px}}@media(prefers-reduced-motion:reduce){.mzn-assistant-fab,.mzn-assistant-tip,.mzn-fab-pulse{animation:none!important}.global-nav .nav-tab{transition:none!important}}';
    doc.head.appendChild(style);
  }

  function installNavigation() {
    if (!window.UI || !window.App || UI.__mizanNavigationInstalled) return;
    var old = UI.navTabs;
    UI.navTabs = function (page) {
      var nav = old.call(UI, page);
      nav.innerHTML = '';
      nav.dataset.theme = Store.getTheme() || 'light';
      var tabs = [
        { id: 'dashboard', label: 'خانه', icon: Icons.home },
        { id: 'finance', label: 'مالی', icon: Icons.wallet },
        { id: 'market', label: 'بازار', icon: Icons.activity },
        { id: 'documents', label: 'اسناد', icon: Icons.fileText },
        { id: 'more', label: 'بیشتر', icon: Icons.grid }
      ];
      var activePage = tabs.some(function (x) { return x.id === page; }) ? page : 'more';
      tabs.forEach(function (t) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'nav-tab' + (activePage === t.id ? ' active' : '');
        b.dataset.page = t.id;
        b.innerHTML = t.icon + '<span>' + t.label + '</span>';
        b.onclick = function () { App.navigate(t.id); };
        nav.appendChild(b);
      });
      return nav;
    };
    var originalNavigate = App.navigate;
    App.navigate = function (page) {
      var pageHost = document.getElementById('page-content');
      if (pageHost) { pageHost.classList.remove('mzn-page-switch'); void pageHost.offsetWidth; pageHost.classList.add('mzn-page-switch'); }
      var result = originalNavigate.call(App, page);
      if (window.MizanAssistantFab) window.MizanAssistantFab.update(page);
      try {
        var doc = window.parent.document;
        var core = ['dashboard', 'finance', 'market', 'documents'];
        var active = core.indexOf(page) >= 0 ? page : 'more';
        doc.querySelectorAll('.global-nav .nav-tab').forEach(function (tab) { tab.classList.toggle('active', tab.dataset.page === active); });
        var nav = doc.querySelector('.global-nav');
        if (nav) nav.dataset.theme = Store.getTheme() || 'light';
      } catch (e) {}
      return result;
    };
    UI.__mizanNavigationInstalled = true;
  }

  window.MizanEnhancements = {
    dashboard: renderDashboard,
    market: renderMarket,
    documents: renderDocuments,
    reminders: renderReminders,
    calendar: renderCalendar,
    assistant: renderAssistant,
    more: renderMore,
    assistantReply: assistantReply,
    syncGoals: syncAllGoals
  };
  installGoalSync();
  installMotionStyles();
  installAssistantFab();
  installNavigation();
  document.addEventListener('DOMContentLoaded', function () { setTimeout(syncAllGoals, 1800); });
  document.addEventListener('click', function (e) {
    var nav = e.target && e.target.closest ? e.target.closest('.global-nav') : null;
    if (nav) nav.dataset.theme = Store.getTheme() || 'light';
  });
})();