(function () {
  'use strict';
  var SUPABASE_URL = 'https://jrhihuaswonlcdkhoabf.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_48l_e94YWetezy99KDGqWQ_uGj7sf9i';
  var BUCKET = 'mizan-private-documents';
  var dbClient = null;
  var marketTimer = null;
  var reminderTimer = null;
  var marketCache = null;
  var weatherWatchId = null;
  var weatherLastCoords = null;
  var weatherLastRefresh = 0;
  var weatherLastPlace = '';
  var weatherWatchError = null;
  var weatherRefreshTimer = null;
  var weatherListeners = [];
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
  function tehranDateTimeParts(value) {
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return null;
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    var out = {};
    parts.forEach(function (part) { if (part.type !== 'literal') out[part.type] = part.value; });
    return out;
  }
  function tehranDateTimeToISO(dateISO, time) {
    var date = String(dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    var clock = String(time || '').match(/^(\d{2}):(\d{2})$/);
    if (!date || !clock) return '';
    var utc = Date.UTC(+date[1], +date[2] - 1, +date[3], +clock[1], +clock[2]) - 210 * 60000;
    return new Date(utc).toISOString();
  }
  function formatTehranTime(value) {
    var date = new Date(value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date) : '—';
  }
  function shiftGregorianDate(dateISO, rule) {
    var match = String(dateISO || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    var year = +match[1], month = +match[2], day = +match[3], date;
    if (rule === 'daily' || rule === 'weekly') {
      date = new Date(Date.UTC(year, month - 1, day));
      date.setUTCDate(date.getUTCDate() + (rule === 'daily' ? 1 : 7));
    } else if (rule === 'monthly') {
      var targetMonth = new Date(Date.UTC(year, month, 1));
      var lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
      date = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(day, lastDay)));
    } else if (rule === 'yearly') {
      var targetYear = year + 1;
      var yearLastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
      date = new Date(Date.UTC(targetYear, month - 1, Math.min(day, yearLastDay)));
    } else return '';
    return date.toISOString().slice(0, 10);
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
    var hr = Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tehran',hour:'2-digit',hourCycle:'h23'}).format(new Date()));
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
  function renderDashboard() {
    var d = payrollData();
    var t = d.today;
    var week = weeklyData();
    var max = Math.max(1, ...week.map(function (x) { return Math.max(x.sales, x.expenses); }));
    var quote = dailyQuote();
    var rems = Reminders.load().filter(function (r) { return !r.completed; }).sort(function (a, b) { return new Date(a.dateTime || 0) - new Date(b.dateTime || 0); }).slice(0, 3);
    var root = el('mzn-page mzn-dashboard',
      '<div class="mzn-welcome"><div><span class="mzn-eyebrow">MIZAN · PERSONAL FINANCE</span><h2>' + greeting() + '، ' + h((Auth.getUser() && (Auth.getUser().name || Auth.getUser().username)) || 'خوش آمدی') + '</h2><p>امروز ' + h(Jalali.faDigits(Jalali.fmt(t[0], t[1], t[2]))) + ' است؛ وضعیت مالی‌ات را یک‌جا ببین.</p><p class="mzn-daily-quote">' + h(quote) + '</p></div><div class="mzn-date-chip">' + h(Jalali.MONTHS[t[1] - 1].fa + ' ' + Jalali.faDigits(t[0])) + '</div></div>' +
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
      '<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>یادآوری‌های نزدیک</h3><p>مواردی که نباید فراموش شوند</p></div><button class="mzn-text-btn" id="mzn-go-reminders">همه یادآورها</button></div>' +
      (rems.length ? rems.map(function (r) { return '<div class="mzn-list-row"><span class="mzn-list-icon">' + Icons.bell + '</span><div><b>' + h(r.title) + '</b><small>' + h(r.dateTime ? new Date(r.dateTime).toLocaleString('fa-IR-u-ca-persian') : 'بدون زمان') + '</small></div></div>'; }).join('') : '<p class="mzn-muted">یادآوری فعالی نداری.</p>') +
      '</div><div class="mzn-actions">' +
      button('mzn-go-calendar', 'تقویم مالی', Icons.calendar, 'btn btn-primary') +
      button('mzn-go-market', 'قیمت بازار', Icons.activity, 'btn btn-ghost') +
      '</div><div id="mzn-fin-overview" class="mzn-panel mzn-fin-overview"><div class="mzn-muted">در حال دریافت خلاصه تعهدات مالی...</div></div><div class="mzn-panel mzn-home-weather-wrap"><div class="mzn-panel-head"><div><h3>آب‌وهوای منطقه من</h3><p>شرایط زنده محل فعلی و پیش‌بینی ساعتی</p></div><span class="mzn-pill">LIVE</span></div><div id="mzn-home-weather"></div></div>'
    );
    root.querySelector('#mzn-go-reminders').onclick = function () { App.navigate('reminders-db'); };
    root.querySelector('#mzn-go-calendar').onclick = function () { App.navigate('calendar'); };
    root.querySelector('#mzn-go-market').onclick = function () { App.navigate('market'); };
    root.querySelectorAll('[data-week-date]').forEach(function (bar) { bar.addEventListener('click', function () { App.openDayDetail(bar.dataset.weekDate); }); });
    loadFinanceOverview(root);
    var homeWeather=root.querySelector('#mzn-home-weather');if(homeWeather){var weatherPage=renderWeather(),weatherCard=weatherPage.querySelector('#mzn-weather-card');if(weatherCard)homeWeather.appendChild(weatherCard);}
    return root;
  }
  function dailyQuote(){
    var starts=['هر قدم کوچک در مسیر نظم مالی','ثبت دقیق درآمد و هزینه','صبوری در تصمیم‌های مالی','برنامه‌ریزی واقع‌بینانه','شناخت عادت‌های خرج‌کردن','پس‌انداز منظم حتی با مبلغ کم','توجه به جزئیات روزمره','پایبندی به هدف‌های روشن','یادگیری از اشتباه‌های گذشته','مقایسه خودت با دیروزت','کنترل خریدهای هیجانی','شفافیت در حساب‌وکتاب','تقسیم درست درآمد','ثبت به‌موقع هر پرداخت','نگاه بلندمدت به پول','پیشرفت آرام و پیوسته','انتخاب آگاهانه پیش از خرید','مرور منظم عملکرد ماهانه','حفظ تعادل میان کار و زندگی','اعتماد به توانایی یادگیری','شروع دوباره پس از یک روز سخت','تبدیل هدف‌های بزرگ به کارهای کوچک'];
    var ends=['می‌تواند آینده‌ای آرام‌تر برایت بسازد.','به تو کمک می‌کند انتخاب بعدی را آگاهانه‌تر انجام بدهی.','ارزشمندتر از یک تصمیم بزرگ و عجولانه است.','وقتی تکرار شود، به عادتی قدرتمند تبدیل می‌شود.','نشانه احترام به زمان و زحمتی است که می‌کشی.','راه را روشن‌تر می‌کند، حتی اگر مقصد هنوز دور باشد.','به جای نگرانی، فرصتی برای بهتر عمل کردن می‌دهد.','به تو یادآوری می‌کند که کنترل از آگاهی شروع می‌شود.','می‌تواند فاصله میان خواسته و واقعیت را کمتر کند.','به مرور نتیجه‌ای می‌سازد که امروز شاید دیده نشود.','قرار نیست کامل باشد؛ کافی است آگاهانه و پیوسته باشد.','به تو قدرت می‌دهد برای اولویت‌های مهم‌تر جا باز کنی.','وقتی با آرامش همراه شود، تصمیم‌های بهتری می‌سازد.','بهتر از حدس زدن است و پایه اعتماد به خودت می‌شود.','تو را یک قدم به استقلال و آسودگی بیشتر نزدیک می‌کند.','یادآور این است که مسیر موفقیت با استمرار ساخته می‌شود.','می‌تواند از یک انتخاب کوچک، تغییری ماندگار بسازد.','کمک می‌کند انرژی‌ات را روی چیزهایی بگذاری که اهمیت دارند.','به تو اجازه می‌دهد اشتباه را به تجربه‌ای مفید تبدیل کنی.','ثابت می‌کند که پیشرفت، بیشتر از سرعت به استمرار نیاز دارد.'];
    var all=[];starts.forEach(function(s){ends.forEach(function(t){all.push(s+' '+t);});});
    var key='mizan-motivation-bag-v2',bag=[];try{bag=JSON.parse(localStorage.getItem(key)||'[]');}catch(err){}
    if(!Array.isArray(bag)||!bag.length||bag.some(function(x){return !Number.isInteger(x)||x<0||x>=all.length;})){bag=Array.from({length:all.length},function(_,i){return i;});for(var i=bag.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),tmp=bag[i];bag[i]=bag[j];bag[j]=tmp;}}
    var index=bag.pop();try{localStorage.setItem(key,JSON.stringify(bag));localStorage.setItem('mizan-motivation-last-v2',all[index]);}catch(err){}return all[index];
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
    if (!user || !c) return;
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      try {
        var last = await c.from('mizan_market_snapshots').select('captured_at').eq('user_id', user.id).eq('symbol', item.id).order('captured_at', { ascending: false }).limit(1).maybeSingle();
        if (last.error) continue;
        var lastAt = last.data && last.data.captured_at ? new Date(last.data.captured_at).getTime() : 0;
        if (Date.now() - lastAt < 25 * 60 * 1000) continue;
        var inserted = await c.from('mizan_market_snapshots').insert({
          user_id: user.id, symbol: item.id, price_toman: item.price,
          change_pct: item.change_pct == null ? null : item.change_pct,
          source: item.source || 'Iran Market Data',
          source_updated_at: item.updated_utc ? (/[zZ]|[+-]\\d\\d:\\d\\d$/.test(item.updated_utc) ? item.updated_utc : item.updated_utc + 'Z') : null
        });
        if (inserted.error) console.warn('market history save failed', inserted.error);
      } catch (e) { console.warn('market history save failed', e); }
    }
  }
  function normalizeMarketPayload(payload) {
    if (!payload || !payload.data) throw new Error('ساختار اطلاعات بازار معتبر نیست.');
    var definitions = [
      ['USD_IRR_FREE','usd','دلار آمریکا'],['CAD_IRR_FREE','cad','دلار کانادا'],['EUR_IRR_FREE','eur','یورو'],['GBP_IRR_FREE','gbp','پوند انگلیس'],
      ['GOLD_18K_IRR','gold-18k','طلای ۱۸ عیار · هر گرم'],['COIN_EMAMI_IRR','coin-emami','سکه امامی'],['USDT_IRR','usdt','تتر']
    ];
    var rows=Array.isArray(payload.data)?payload.data:[];
    if(!rows.length&&payload.data&&payload.data.categories){rows=Object.keys(payload.data.categories).reduce(function(all,key){return all.concat(Array.isArray(payload.data.categories[key])?payload.data.categories[key]:[]);},[]);}
    var published=(payload.meta&&payload.meta.published_at)||(payload.data&&payload.data.generated_at)||null;
    var out = [];
    definitions.forEach(function (def) {
      var raw = rows.find(function (x) { return x && x.symbol === def[0]; });
      if (!raw || raw.price == null || !Number.isFinite(Number(raw.price)) || Number(raw.price) <= 0) return;
      var currency=String(raw.currency || payload.meta && payload.meta.currency || '').toUpperCase();
      var price=Number(raw.price);
      if(currency==='IRR')price=price/10;
      else if(currency!=='IRT'&&currency!=='TOMAN'&&currency!=='')return;
      var stamp=raw.timestamp_tehran||raw.timestamp||raw.checked_at||published||null;
      var stampMs=stamp?new Date(stamp).getTime():0;
      out.push({
        id:def[1],symbol:raw.symbol,name:raw.name_fa||def[2],price:price,currency:'IRT',
        change_pct:raw.change_pct==null?null:Number(raw.change_pct),
        updated_utc:raw.timestamp||raw.checked_at||null,updated_display:stamp,
        stale:!!raw.stale||!!(payload.meta&&payload.meta.stale)||!stampMs||Date.now()-stampMs>45*60*1000,
        source:raw.source||'Iran Market Data'
      });
    });
    if(!out.length)throw new Error('هیچ‌کدام از نمادهای اصلی بازار در پاسخ موجود نیست.');
    return out;
  }
  async function fetchBitcoin(items){
    try{var response=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true',{cache:'no-store'});if(!response.ok)throw new Error('CoinGecko HTTP '+response.status);var payload=await response.json(),btc=payload&&payload.bitcoin;if(!btc||!Number.isFinite(Number(btc.usd))||Number(btc.usd)<=0)throw new Error('قیمت بیت‌کوین معتبر نیست');var dollar=(items||[]).find(function(x){return x.id==='usd';}),rate=dollar&&Number(dollar.price)>0?Number(dollar.price):null;return{id:'bitcoin',symbol:'BTC',name:'بیت‌کوین · BTC',price:rate?Number(btc.usd)*rate:Number(btc.usd),currency:rate?'IRT':'USD',usd:Number(btc.usd),change_pct:Number.isFinite(Number(btc.usd_24h_change))?Number(btc.usd_24h_change):null,updated_utc:btc.last_updated_at?new Date(Number(btc.last_updated_at)*1000).toISOString():null,updated_display:btc.last_updated_at?new Date(Number(btc.last_updated_at)*1000).toISOString():null,stale:!btc.last_updated_at||Date.now()-Number(btc.last_updated_at)*1000>10*60*1000,source:'CoinGecko'};}catch(err){console.warn('Mizan Bitcoin price unavailable',err);return null;}
  }
  function renderMarket() {
    if (marketTimer) clearInterval(marketTimer);
    var root = el('mzn-page mzn-market',
      head('بازار و قیمت‌ها', 'نرخ‌های بازار آزاد ایران · نمایش قیمت‌ها به تومان') +
      '<div class="mzn-market-status" id="mzn-market-status">در حال دریافت آخرین قیمت‌ها...</div>' +
      '<div class="mzn-market-grid" id="mzn-market-grid"><div class="mzn-panel">در حال بارگذاری...</div></div>' +
      '<div class="mzn-panel mzn-market-note"><b>زمان و اعتبار داده‌ها</b><p>قیمت‌ها بر اساس آخرین زمان ثبت‌شده از بازار نمایش داده می‌شوند. انتشار داده‌ها ممکن است با تأخیر انجام شود؛ زمان آخرین دریافت هر قیمت و هشدار کهنگی کنار آن آمده است.</p><p>داده‌ها از مجموعهٔ عمومی <a href="https://github.com/iran-market/iran-market.github.io" target="_blank" rel="noopener">Iran Market Data</a> دریافت می‌شوند. ارزیابی زیر هر قیمت فقط بر پایهٔ تغییر روزانه است و توصیهٔ سرمایه‌گذاری نیست؛ پیش از خرید یا فروش، روند چندروزه و شرایط خودت را هم بررسی کن.</p></div>' +
      button('mzn-market-refresh', 'به‌روزرسانی', Icons.refresh, 'btn btn-ghost')
    );
    var labels = {
      usd:'دلار آمریکا', cad:'دلار کانادا', eur:'یورو', gbp:'پوند انگلیس',
      'gold-18k':'طلای ۱۸ عیار · هر گرم', 'coin-emami':'سکه امامی',
      usdt:'تتر', bitcoin:'بیت‌کوین · BTC'
    };
    function renderItems(items,fromCache,publishedAt){
      var grid=root.querySelector('#mzn-market-grid'),status=root.querySelector('#mzn-market-status');
      if(!grid||!status)return;
      grid.innerHTML=items.map(function(x){
        var pct=x.change_pct==null?'تغییر روزانه ثبت نشده':((x.change_pct>0?'+':'')+Number(x.change_pct).toLocaleString('fa-IR',{maximumFractionDigits:2})+'٪');
        var trend=x.change_pct>0?'up':x.change_pct<0?'down':'flat';
        var advice=x.stale||x.change_pct==null?{text:'داده کافی یا تازه برای ارزیابی وجود ندارد؛ فعلاً تصمیم نگیر.',cls:'stale'}:x.change_pct<=-1.5?{text:'افت روزانه؛ فقط بررسی خرید پله‌ای پس از بررسی روند بلندمدت.',cls:'buy'}:x.change_pct>=1.5?{text:'رشد روزانه؛ اگر از قبل داری، بررسی فروش بخشی و ذخیره سود.',cls:'sell'}:{text:'تغییر محدود؛ فعلاً صبر و نگهداری، بدون سیگنال قوی.',cls:'wait'};
        var priceText=x.id==='bitcoin'?(x.currency==='IRT'?money(x.price):'
      }).join('');
      var time=marketTime(publishedAt||items[0].updated_utc);
      status.innerHTML=(fromCache?'<span class="mzn-error-dot"></span>':'<span class="mzn-live-dot"></span>')+(fromCache?'نمایش آخرین دادهٔ ذخیره‌شده':'داده‌ها با موفقیت دریافت شدند')+' · زمان انتشار: '+h(time);
    }
    async function refresh(){
      var status=root.querySelector('#mzn-market-status'),grid=root.querySelector('#mzn-market-grid');
      if(!status||!grid||!root.isConnected)return;
      status.textContent='در حال دریافت قیمت‌ها...';
      var urls=[
        'https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/latest-toman.json',
        'https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/popular.json',
        'https://cdn.jsdelivr.net/gh/iran-market/iran-market.github.io@main/data/latest-toman.json'
      ],lastError=null;
      for(var n=0;n<urls.length;n++){
        try{
          var response=await fetch(urls[n],{cache:'no-store'});
          if(!response.ok)throw new Error('پاسخ سرویس بازار: '+response.status);
          var payload=await response.json(),items=normalizeMarketPayload(payload),bitcoin=await fetchBitcoin(items);
          if(bitcoin)items.push(bitcoin);
          marketCache=items;
          try{localStorage.setItem('mizan-market-cache-v2',JSON.stringify({items:items,publishedAt:payload.meta&&payload.meta.published_at,savedAt:new Date().toISOString()}));}catch(e){}
          renderItems(items,false,(payload.meta&&payload.meta.published_at)||(payload.data&&payload.data.generated_at));
          try{var s=await session();if(s.user)await saveMarketHistory(items,s.user,s.client);}catch(e){console.warn('market history save failed',e);}
          return;
        }catch(e){lastError=e;}
      }
      if(!marketCache){
        try{var cached=JSON.parse(localStorage.getItem('mizan-market-cache-v2')||'null');if(cached&&Array.isArray(cached.items)&&cached.items.length)marketCache=cached.items;}catch(e){}
      }
      if(marketCache&&marketCache.length)renderItems(marketCache,true,null);
      else{status.innerHTML='<span class="mzn-error-dot"></span> دریافت قیمت‌ها ممکن نشد: '+errorMsg(lastError);grid.innerHTML='<div class="mzn-panel">در حال حاضر دادهٔ معتبر بازار در دسترس نیست. اتصال اینترنت را بررسی و دوباره تلاش کن.</div>';}
    }
    root.querySelector('#mzn-market-refresh').onclick=refresh;
    setTimeout(refresh,0);
    marketTimer=setInterval(function(){if(!root.isConnected){clearInterval(marketTimer);marketTimer=null;return;}refresh();},30*60*1000);
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
          return '<div class="mzn-doc-row"><span class="mzn-doc-icon">' + (x.mime_type.indexOf('image/') === 0 ? Icons.image : Icons.fileText) + '</span><div class="mzn-doc-info"><b>' + h(x.file_name) + '</b><small>' + h(x.category) + ' · ' + h(new Date(x.created_at).toLocaleDateString('fa-IR-u-ca-persian',{timeZone:'Asia/Tehran'})) + ' · ' + h((x.file_size / 1024 / 1024).toFixed(2)) + ' MB</small>' + (x.note ? '<small>' + h(x.note) + '</small>' : '') + '</div><div class="mzn-doc-actions"><button type="button" data-open="' + h(x.id) + '" title="مشاهده">' + Icons.externalLink + '</button><button type="button" data-del="' + h(x.id) + '" title="حذف">' + Icons.trash + '</button></div></div>';
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
          return '<div class="mzn-rem-row ' + (x.completed ? 'is-done' : overdue ? 'is-overdue' : '') + '"><div class="mzn-rem-main"><b>' + h(x.title) + '</b><small>' + h(due) + (x.due_at ? ' · ' + h(formatTehranTime(x.due_at)) : '') + ' · ' + h(x.priority) + '</small>' + (x.note ? '<small>' + h(x.note) + '</small>' : '') + '</div><div class="mzn-doc-actions"><button type="button" data-done="' + h(x.id) + '" title="انجام شد">' + Icons.check + '</button><button type="button" data-remove="' + h(x.id) + '" title="حذف">' + Icons.trash + '</button></div></div>';
        }).join('');
        list.querySelectorAll('[data-done]').forEach(function (b) {
          b.onclick = async function () {
            var row = rows.find(function (x) { return x.id === b.dataset.done; });
            if (!row.completed && row.repeat_rule !== 'none' && row.due_at) {
              var parts = tehranDateTimeParts(row.due_at);
              var baseDate = row.due_date || (parts ? parts.year + '-' + parts.month + '-' + parts.day : '');
              var nextDate = shiftGregorianDate(baseDate, row.repeat_rule);
              var nextTime = parts ? parts.hour + ':' + parts.minute : '09:00';
              var nextDueAt = tehranDateTimeToISO(nextDate, nextTime);
              if (!nextDate || !nextDueAt) { notify('زمان تکرار یادآوری معتبر نیست.'); return; }
              var repeatInsert = await s.client.from('mizan_reminders').insert({ user_id: s.user.id, title: row.title, note: row.note, due_at: nextDueAt, due_date: nextDate, priority: row.priority, repeat_rule: row.repeat_rule });
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
        var dueAt = tehranDateTimeToISO(iso, time);
        if (!dueAt) throw new Error('زمان یادآوری معتبر نیست.');
        var ins = await s.client.from('mizan_reminders').insert({
          user_id: s.user.id, title: title, note: root.querySelector('#mzn-rem-note').value.trim(),
          due_date: iso, due_at: dueAt, priority: root.querySelector('#mzn-rem-priority').value,
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
      try {
        var s = await session(); if (!s.user) return;
        var now = Date.now(), from = new Date(now - 30*86400000).toISOString(), to = new Date(now + 60000).toISOString();
        var due = await s.client.from('mizan_reminders').select('id,title,due_at').eq('completed', false).gte('due_at', from).lte('due_at', to);
        if (due.error) throw due.error;
        await Promise.all((due.data || []).map(function (x) { return sendMizanNotification('یادآوری میزان', x.title, 'reminder:'+x.id, 'reminder', {reminder_id:x.id,due_at:x.due_at}); }));
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

  function monthStats(y,m){var data=Store.loadMonth(y,m-1)||{},cfg=Store.loadSettings()||{},s=Payroll.compute(data,cfg)||{};return{sales:num(s.totalSales),expenses:num(s.totalExpenses),commission:num(s.commission),netSalary:num(s.netSalary),hours:num(s.totalHours),workDays:num(s.workDays),gross:num(s.grossSalary)};}
  function prevJMonth(y,m){return m===1?{y:y-1,m:12}:{y:y,m:m-1};}
  function renderMonthlyCompare(){var t=Jalali.today(),p=prevJMonth(t[0],t[1]),a=monthStats(t[0],t[1]),b=monthStats(p.y,p.m),labels=[['حقوق خالص','netSalary'],['فروش','sales'],['هزینه‌ها','expenses'],['پورسانت','commission'],['ساعت کار','hours'],['روز کاری','workDays']],root=el('mzn-page mzn-compare',head('مقایسه ماهانه','عملکرد مالی ماه جاری در برابر ماه گذشته')+'<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>'+h(Jalali.MONTHS[t[1]-1].fa+' '+Jalali.faDigits(t[0]))+'</h3><p>در مقایسه با '+h(Jalali.MONTHS[p.m-1].fa+' '+Jalali.faDigits(p.y))+'</p></div><span class="mzn-pill">ماه به ماه</span></div><div class="mzn-compare-grid">'+labels.map(function(x){var av=a[x[1]],bv=b[x[1]],pct=bv?((av-bv)/bv*100):null,unit=x[1]==='hours'?' ساعت':x[1]==='workDays'?' روز':'',val=x[1]==='hours'||x[1]==='workDays'?num(av).toLocaleString('fa-IR')+unit:money(av),old=x[1]==='hours'||x[1]==='workDays'?num(bv).toLocaleString('fa-IR')+unit:money(bv),w=Math.max(3,Math.min(100,bv?av/Math.max(av,bv)*100:av?100:3));return'<article class="mzn-compare-item"><div class="mzn-compare-title">'+x[0]+'</div><strong>'+val+'</strong><small>ماه قبل: '+old+'</small><div class="mzn-compare-track"><i style="width:'+w+'%"></i></div><span class="mzn-compare-delta">'+(pct===null?'داده‌ای از ماه قبل نیست':(pct>0?'+':'')+pct.toFixed(1).replace('.', '٫')+'٪ نسبت به ماه قبل')+'</span></article>';}).join('')+'</div></div><div class="mzn-panel"><h3>جمع‌بندی</h3><p class="mzn-muted">'+(a.sales>b.sales?'فروش نسبت به ماه قبل بیشتر شده است. ':'فروش نسبت به ماه قبل کمتر یا برابر است. ')+(a.expenses>b.expenses?'هزینه‌ها افزایش داشته‌اند. ':'هزینه‌ها افزایش نداشته‌اند. ')+'مقایسه بر اساس داده‌های ثبت‌شده هر ماه است.</p></div>');return root;}
  function renderBehaviorAlerts(){var t=Jalali.today(),p=prevJMonth(t[0],t[1]),cur=monthStats(t[0],t[1]),old=monthStats(p.y,p.m),elapsed=Math.max(1,t[2]),prevDays=Jalali.daysInMonth(p.y,p.m),baseDays=Math.min(elapsed,prevDays),curExpenseRate=cur.expenses/elapsed,oldExpenseRate=old.expenses/Math.max(1,baseDays),curSalesRate=cur.sales/elapsed,oldSalesRate=old.sales/Math.max(1,baseDays),alerts=[];if(oldExpenseRate>0&&curExpenseRate>oldExpenseRate*1.25)alerts.push({type:'warning',title:'افزایش سرعت هزینه‌کرد',body:'میانگین هزینه روزانه '+Math.round((curExpenseRate/oldExpenseRate-1)*100)+'٪ بیشتر از بازه مشابه ماه قبل است.'});if(oldSalesRate>0&&curSalesRate<oldSalesRate*.75)alerts.push({type:'warning',title:'افت سرعت فروش',body:'میانگین فروش روزانه نسبت به بازه مشابه ماه قبل بیش از ۲۵٪ کاهش داشته است.'});if(cur.expenses>cur.sales&&cur.sales>0)alerts.push({type:'danger',title:'هزینه بیشتر از فروش',body:'هزینه ثبت‌شده این ماه از فروش ثبت‌شده بیشتر است؛ جزئیات ثبت‌ها را بررسی کن.'});if(!alerts.length)alerts.push({type:'success',title:'فعلاً رفتار غیرعادی دیده نشد',body:'با داده‌های ثبت‌شده تا امروز، هشدار مهمی شناسایی نشده است.'});var root=el('mzn-page mzn-behavior',head('هشدار رفتار مالی','بررسی خودکار روند هزینه و درآمد با داده‌های ثبت‌شده')+'<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>وضعیت این ماه</h3><p>مقایسه میانگین روزانه با همین تعداد روز از ماه قبل</p></div><span class="mzn-pill">'+Jalali.faDigits(t[2])+' روز گذشته</span></div>'+alerts.map(function(x){return'<div class="mzn-alert mzn-alert-'+x.type+'"><b>'+x.title+'</b><p>'+x.body+'</p></div>';}).join('')+'</div><div class="mzn-panel"><h3>مبنای تحلیل</h3><p class="mzn-muted">هشدارها از فروش و هزینه‌های ثبت‌شده ساخته می‌شوند؛ اگر داده‌ای ثبت نشده باشد، نتیجه قطعی نیست. این بخش توصیه مالی قطعی ارائه نمی‌کند.</p></div>');return root;}
  function weatherSeason(timezone){try{var parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone||'Asia/Tehran',calendar:'persian',month:'numeric'}).formatToParts(new Date()),part=parts.find(function(x){return x.type==='month';}),m=Number(part&&part.value);return m<=3?'spring':m<=6?'summer':m<=9?'autumn':'winter';}catch(err){return'winter';}}
  function weatherInfo(code){code=Number(code);if(code===0)return{kind:'clear',label:'آسمان صاف',icon:'☀️'};if(code<=2)return{kind:'partly',label:'نیمه‌ابری',icon:'🌤️'};if(code===3)return{kind:'cloudy',label:'ابری',icon:'☁️'};if(code===45||code===48)return{kind:'fog',label:'مه‌آلود',icon:'🌫️'};if(code>=51&&code<=57)return{kind:'rain',label:'نم‌نم باران',icon:'🌦️'};if(code>=61&&code<=67)return{kind:'rain',label:'بارندگی',icon:'🌧️'};if(code>=71&&code<=77)return{kind:'snow',label:'بارش برف',icon:'❄️'};if(code>=80&&code<=82)return{kind:'rain',label:'رگبار',icon:'🌧️'};if(code>=85&&code<=86)return{kind:'snow',label:'بارش برف',icon:'🌨️'};if(code>=95)return{kind:'thunder',label:'رعدوبرق',icon:'⛈️'};return{kind:'cloudy',label:'وضعیت متغیر',icon:'☁️'};}
  function clothingAdvice(temp,feels,wind,rain){var t=Number(feels);if(!Number.isFinite(t))t=Number(temp)||15;var out=[];if(t>=30)out.push('لباس نخی، خنک و رنگ روشن بپوش؛ در آفتاب کلاه و عینک آفتابی همراه داشته باش.');else if(t>=22)out.push('لباس سبک و تنفس‌پذیر مناسب است؛ یک لایه نازک برای فضای خنک همراه داشته باش.');else if(t>=16)out.push('لباس روزمره با یک سویشرت یا ژاکت سبک انتخاب خوبی است.');else if(t>=10)out.push('ژاکت یا کاپشن متوسط و لباس چندلایه بپوش.');else if(t>=5)out.push('کاپشن گرم و لایه میانی مثل پلیور لازم است.');else out.push('پالتو یا کاپشن ضخیم، لایه گرم و پوشش مناسب سر و گردن بپوش.');if(Number(wind)>=25)out.push('باد نسبتاً شدید است؛ لایه رویی بادگیر و شال سبک همراه داشته باش.');if(Number(rain)>=40)out.push('احتمال بارش قابل توجه است؛ چتر یا بارانی و کفش مقاوم به آب بردار.');else if(Number(rain)>=20)out.push('احتمال بارش کم تا متوسط وجود دارد؛ یک چتر کوچک احتیاطاً همراه داشته باش.');if(t>=27&&Number(rain)<20)out.push('آب آشامیدنی همراه داشته باش و در ساعات آفتابی مستقیم کمتر بمان.');return out;}
  function renderWeather(){var root=el('mzn-page mzn-weather',head('آب‌وهوای منطقه','دمای لحظه‌ای، روند ساعتی امروز و پیشنهاد پوشش بر اساس محل فعلی')+'<div class="mzn-panel mzn-weather-panel" id="mzn-weather-card"><div class="mzn-weather-empty"><span>🌤️</span><h3>آب‌وهوای محل فعلی</h3><p>برای دریافت وضعیت دقیق منطقه، یک‌بار اجازه موقعیت مکانی را بده. بعد از تأیید، مکان و هوا به‌صورت زنده به‌روزرسانی می‌شوند.</p><button class="btn btn-primary" id="mzn-weather-locate">فعال‌سازی موقعیت زنده</button></div></div>');var box=root.querySelector('#mzn-weather-card'),locBtn=root.querySelector('#mzn-weather-locate'),last=null;
    function fetchWeather(lat,lon){last={lat:lat,lon:lon};box.innerHTML='<div class="mzn-weather-loading">در حال دریافت پیش‌بینی منطقه...</div>';var url='https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m&forecast_days=1&timezone=auto';fetch(url,{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('weather_http_'+r.status);return r.json();}).then(function(d){if(!box.isConnected)return;var c=d.current||{},hourly=d.hourly||{},info=weatherInfo(c.weather_code),today=String(c.time||'').slice(0,10),hours=(hourly.time||[]).map(function(time,i){return{time:time,index:i,hour:Number(String(time).slice(11,13)),temp:Number(hourly.temperature_2m[i]),feels:Number(hourly.apparent_temperature[i]),rain:Number(hourly.precipitation_probability[i]||0),code:Number(hourly.weather_code[i]),wind:Number(hourly.wind_speed_10m[i])};}).filter(function(x){return x.time.slice(0,10)===today&&x.hour>=6&&x.hour<=23;}),nowHour=Number(String(c.time||'').slice(11,13)),next=hours.filter(function(x){return x.hour>=nowHour&&x.hour<=nowHour+3;}),currentHourIndex=(hourly.time||[]).findIndex(function(x){return String(x).slice(0,13)===String(c.time||'').slice(0,13);}),currentRainProb=currentHourIndex>=0?Number(hourly.precipitation_probability[currentHourIndex]||0):0,rainSoon=Math.max(Number(c.precipitation||0)>0?100:0,currentRainProb,next.reduce(function(a,x){return Math.max(a,x.rain);},0)),advice=clothingAdvice(c.temperature_2m,c.apparent_temperature,c.wind_speed_10m,rainSoon),particleCount=info.kind==='snow'?20:info.kind==='rain'||info.kind==='thunder'?16:0,particles=Array.from({length:particleCount},function(_,i){return'<i style="left:'+((i*100/particleCount)+2).toFixed(1)+'%;animation-delay:-'+(i*(info.kind==='snow'?.31:.13)).toFixed(2)+'s"></i>';}).join(''),dayClass=Number(c.is_day)===1?'is-day':'is-night';box.className='mzn-panel mzn-weather-panel weather-'+info.kind+' season-'+weatherSeason(d.timezone)+' '+dayClass;box.innerHTML='<div class="mzn-weather-scene"><div class="mzn-weather-season-layer"></div><div class="mzn-weather-sun"></div><div class="mzn-weather-cloud cloud-one"></div><div class="mzn-weather-cloud cloud-two"></div><div class="mzn-weather-particles">'+particles+'</div><div class="mzn-weather-scene-copy"><span>'+(dayClass==='is-night'&&info.kind==='clear'?'🌙':info.icon)+'</span><b>'+info.label+'</b><small>'+(dayClass==='is-day'?'وضعیت روز':'وضعیت شب')+'</small></div></div><div class="mzn-weather-current"><div><small>دمای همین ساعت</small><strong>'+Math.round(Number(c.temperature_2m))+'°</strong><span>احساس واقعی '+Math.round(Number(c.apparent_temperature))+'°</span></div><div class="mzn-weather-current-meta"><b>'+info.label+'</b><span data-mzn-location-label>در حال شناسایی منطقه...</span><span>رطوبت '+Math.round(Number(c.relative_humidity_2m))+'٪</span><span>باد '+Math.round(Number(c.wind_speed_10m))+' km/h</span><span>احتمال بارش '+Math.round(currentRainProb)+'٪</span><span>بارش فعلی '+Number(c.precipitation||0)+' mm</span></div></div><section class="mzn-weather-hourly"><div class="mzn-weather-section-head"><h3>دمای هوا از صبح تا شب</h3><small>امروز · ساعت محلی منطقه</small></div><div class="mzn-weather-hour-list">'+(hours.length?hours.map(function(x){var wi=weatherInfo(x.code);return'<article class="mzn-weather-hour"><time>'+String(x.hour).padStart(2,'0')+':00</time><span class="mzn-weather-hour-icon">'+wi.icon+'</span><b>'+Math.round(x.temp)+'°</b><small>بارش '+Math.round(x.rain)+'٪</small></article>';}).join(''):'<p class="mzn-muted">اطلاعات ساعتی امروز در دسترس نیست.</p>')+'</div></section><section class="mzn-weather-advice"><div class="mzn-weather-section-head"><h3>چی بپوشم؟</h3><span>پیشنهاد هوشمند پوشش</span></div><div class="mzn-weather-advice-icon">🧥</div><ul>'+advice.map(function(x){return'<li>'+x+'</li>';}).join('')+'</ul><small>بر اساس دمای '+Math.round(Number(c.temperature_2m))+'°، احساس دما، باد و بیشترین احتمال بارش چند ساعت آینده</small></section><div class="mzn-weather-footer"><span>منبع: Open-Meteo · '+new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})+'</span><button class="btn btn-ghost" id="mzn-weather-refresh">به‌روزرسانی</button></div>';var refresh=box.querySelector('#mzn-weather-refresh');if(refresh)refresh.onclick=function(){if(last)fetchWeather(last.lat,last.lon);};}).catch(function(err){if(!box.isConnected)return;box.className='mzn-panel mzn-weather-panel';box.innerHTML='<div class="mzn-weather-empty"><span>⚠️</span><h3>دریافت اطلاعات هواشناسی انجام نشد</h3><p>اتصال اینترنت یا سرویس هواشناسی را بررسی کن و دوباره تلاش کن.</p><button class="btn btn-primary" id="mzn-weather-retry">تلاش دوباره</button></div>';var retry=box.querySelector('#mzn-weather-retry');if(retry)retry.onclick=function(){if(last)fetchWeather(last.lat,last.lon);};console.warn('Mizan weather error',err);});}
    function resolvePlace(lat,lon){
      var url='https://api.bigdatacloud.net/data/reverse-geocode-client?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&localityLanguage=fa';
      fetch(url,{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('reverse_geocode_'+r.status);return r.json();}).then(function(p){
        var local=p.locality||p.city||p.localityInfo&&p.localityInfo.administrative&&p.localityInfo.administrative[0]&&p.localityInfo.administrative[0].name||'',province=p.principalSubdivision||'',country=p.countryName||'';
        weatherLastPlace=[local,province,country].filter(Boolean).filter(function(x,i,a){return a.indexOf(x)===i;}).join('، ')||'منطقه فعلی';
        document.querySelectorAll('[data-mzn-location-label]').forEach(function(n){n.textContent='📍 '+weatherLastPlace;});
      }).catch(function(err){console.warn('Mizan reverse geocoding unavailable',err);});
    }
    function startLiveLocation(force){
      if(!navigator.geolocation){box.innerHTML='<div class="mzn-weather-empty"><p>مرورگر موقعیت مکانی را پشتیبانی نمی‌کند.</p></div>';return;}
      try{if(localStorage.getItem('mizan-location-denied-v1')==='1'&&!force){box.innerHTML='<div class="mzn-weather-empty"><span>📍</span><h3>دسترسی موقعیت مکانی غیرفعال است</h3><p>برای فعال‌سازی، دسترسی Location را در تنظیمات Safari روشن کن.</p><button class="btn btn-primary" id="mzn-weather-again">تلاش دوباره</button></div>';var retry=box.querySelector('#mzn-weather-again');if(retry)retry.onclick=function(){startLiveLocation(true);};return;}}catch(err){}
      var listener=function(coords){if(!box.isConnected)return;fetchWeather(coords.latitude,coords.longitude);if(!weatherLastPlace)resolvePlace(coords.latitude,coords.longitude);};
      weatherListeners=weatherListeners.filter(function(fn){return fn._box&&fn._box.isConnected;});
      listener._box=box;weatherListeners.push(listener);
      if(weatherLastCoords){last=weatherLastCoords;listener(weatherLastCoords);}
      if(weatherWatchId!==null)return;
      try{localStorage.setItem('mizan-location-requested-v1','1');}catch(err){}
      weatherWatchId=navigator.geolocation.watchPosition(function(pos){
        var coords={latitude:pos.coords.latitude,longitude:pos.coords.longitude,accuracy:pos.coords.accuracy};
        var old=weatherLastCoords,dist=old?Math.sqrt(Math.pow((coords.latitude-old.latitude)*111,2)+Math.pow((coords.longitude-old.longitude)*111*Math.cos(coords.latitude*Math.PI/180),2)):999;
        var shouldRefresh=!old||dist>=.35||Date.now()-weatherLastRefresh>10*60*1000;
        weatherLastCoords=coords;
        try{localStorage.setItem('mizan-location-granted-v1','1');localStorage.removeItem('mizan-location-denied-v1');}catch(err){}
        if(shouldRefresh){weatherLastRefresh=Date.now();weatherListeners=weatherListeners.filter(function(fn){return fn._box&&fn._box.isConnected;});weatherListeners.forEach(function(fn){fn(coords);});}
        if(!weatherLastPlace||dist>=.8)resolvePlace(coords.latitude,coords.longitude);
      },function(err){
        weatherWatchId=null;weatherWatchError=err;
        if(err&&err.code===1){try{localStorage.setItem('mizan-location-denied-v1','1');}catch(e){}}
        box.innerHTML='<div class="mzn-weather-empty"><span>📍</span><h3>دسترسی به موقعیت فعلی ممکن نشد</h3><p>'+(err&&err.code===1?'اجازه Location را در تنظیمات Safari برای این سایت فعال کن.':'اتصال موقعیت‌یابی را بررسی کن و دوباره تلاش کن.')+'</p><button class="btn btn-primary" id="mzn-weather-again">تلاش دوباره</button></div>';
        var again=box.querySelector('#mzn-weather-again');if(again)again.onclick=function(){startLiveLocation(true);};
      },{enableHighAccuracy:true,maximumAge:30000,timeout:20000});
      if(weatherRefreshTimer===null)weatherRefreshTimer=window.setInterval(function(){if(!weatherLastCoords)return;weatherLastRefresh=Date.now();weatherListeners=weatherListeners.filter(function(fn){return fn._box&&fn._box.isConnected;});weatherListeners.forEach(function(fn){fn(weatherLastCoords);});},10*60*1000);
    }
    if(locBtn)locBtn.onclick=function(){startLiveLocation(true);};startLiveLocation(false);return root;}
  function installNumericKeypads(){function prepare(input){if(!input||input.dataset.mznNumericReady)return;if(input.type==='number'||input.dataset.numeric==='true'||input.classList.contains('money-input')){input.dataset.mznNumericReady='1';input.setAttribute('inputmode','decimal');input.setAttribute('pattern','[0-9]*');input.setAttribute('lang','en');input.setAttribute('dir','ltr');input.style.textAlign='left';}}document.querySelectorAll('input[type="number"],input[data-numeric="true"],input.money-input').forEach(prepare);new MutationObserver(function(records){records.forEach(function(r){r.addedNodes.forEach(function(n){if(n.nodeType!==1)return;if(n.matches&&n.matches('input'))prepare(n);if(n.querySelectorAll)n.querySelectorAll('input[type="number"],input[data-numeric="true"],input.money-input').forEach(prepare);});});}).observe(document.body,{childList:true,subtree:true});document.addEventListener('focusin',function(ev){prepare(ev.target);});}

  function installSeasonalThemes(){if(window.__mizanSeasonalInstalled)return;window.__mizanSeasonalInstalled=true;function parts(date,zone,opts){var out={};new Intl.DateTimeFormat('en-US',Object.assign({timeZone:zone},opts)).formatToParts(date).forEach(function(p){if(p.type!=='literal')out[p.type]=p.value;});return out;}function apply(){var now=new Date(),g=parts(now,'Asia/Tehran',{year:'numeric',month:'numeric',day:'numeric',hour:'numeric',hourCycle:'h23'}),month=Number(g.month),day=Number(g.day),hour=Number(g.hour),theme='';if(month===12&&((day===24&&hour>=18)||day===25||day===26||(day===27&&hour<18)))theme='christmas';try{var j=parts(now,'Asia/Tehran',{calendar:'persian',year:'numeric',month:'numeric',day:'numeric'});if(Number(j.month)===1&&Number(j.day)>=1&&Number(j.day)<=10)theme='nowruz';}catch(err){}var docs=[document];try{if(window.parent&&window.parent!==window&&window.parent.document!==document)docs.push(window.parent.document);}catch(err){}docs.forEach(function(doc){var root=doc.documentElement;if(!root)return;root.classList.remove('mzn-theme-christmas','mzn-theme-nowruz');if(theme)root.classList.add('mzn-theme-'+theme);var meta=doc.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',theme==='christmas'?'#173b32':theme==='nowruz'?'#2f8058':'#236b4d');});}apply();window.__mizanSeasonalTimer=window.setInterval(apply,60000);}
  function renderMore() {
    var items = [
      ['today', 'امروز و ثبت سریع', Icons.home, 'ساعت کار، فروش و ثبت روزانه'],
      ['months', 'ماه‌ها و گزارش حقوق', Icons.grid, 'گزارش ماهانه و سوابق'],
      ['reminders', 'یادآوری‌های قبلی', Icons.bell, 'یادآورهای فعلی سایت'],
      ['reminders-db', 'یادآور هوشمند مالی', Icons.bellRing, 'سررسیدهای ابری و اعلان‌ها'],
      ['calendar', 'تقویم مالی شمسی', Icons.calendar, 'نمایش تمام سررسیدها'],
      ['compare', 'مقایسه ماهانه', Icons.activity, 'مقایسه درآمد، هزینه و عملکرد ماه‌ها'],
      ['behavior', 'هشدار رفتار مالی', Icons.alert, 'تشخیص تغییرات غیرعادی درآمد و هزینه'],
      ['weather', 'آب‌وهوای منطقه', Icons.cloud, 'آب‌وهوای محل فعلی با اجازه موقعیت مکانی'],
      ['records', 'سوابق', Icons.activity, 'تاریخچه ثبت‌ها'],
      ['achievements', 'دستاوردها و اهداف', Icons.target, 'پیشرفت هدف و تبریک تکمیل'],
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


  function installMotionStyles() {
    var css = '.global-nav.nav-tabs{isolation:isolate}.global-nav .nav-tab{position:relative!important;overflow:hidden!important;transition:transform .24s cubic-bezier(.2,.75,.25,1),color .24s ease,background .24s ease,box-shadow .24s ease!important}.global-nav .nav-tab:active{transform:scale(.93)!important}.global-nav .nav-tab.active{transform:translateY(-2px)!important;box-shadow:0 8px 22px rgba(35,107,77,.25),inset 0 1px 0 rgba(255,255,255,.28)!important}.global-nav .nav-tab.active:after{content:"";position:absolute;bottom:3px;left:50%;width:15px;height:2px;border-radius:3px;background:rgba(255,255,255,.9);transform:translateX(-50%);animation:mznNavLine .3s ease both}.global-nav .nav-tab svg{transition:transform .28s cubic-bezier(.2,.8,.2,1)!important}.global-nav .nav-tab.active svg{transform:translateY(-1px) scale(1.08)}@keyframes mznNavLine{from{width:0;opacity:0}to{width:15px;opacity:1}}';
    css += 'html.mzn-theme-christmas body{background:radial-gradient(ellipse at 10% 0%,rgba(190,52,58,.16),transparent 34%),radial-gradient(ellipse at 90% 100%,rgba(43,119,82,.22),transparent 38%),var(--bg)!important}html.mzn-theme-christmas .mzn-page .mzn-panel,html.mzn-theme-christmas .fin-card{border-color:rgba(180,65,70,.28)!important}html.mzn-theme-christmas .global-nav .nav-tab.active{background:linear-gradient(135deg,#9e303d,#2d7652)!important}html.mzn-theme-nowruz body{background:radial-gradient(ellipse at 15% 0%,rgba(72,165,111,.2),transparent 34%),radial-gradient(ellipse at 90% 100%,rgba(231,193,107,.16),transparent 36%),var(--bg)!important}html.mzn-theme-nowruz .mzn-page .mzn-panel,html.mzn-theme-nowruz .fin-card{border-color:rgba(81,151,102,.3)!important}html.mzn-theme-nowruz .global-nav .nav-tab.active{background:linear-gradient(135deg,#287b55,#a6bb76)!important}@keyframes mznSeasonSnow{from{background-position:0 -20px,23px 17px}to{background-position:0 400px,23px 437px}}html.mzn-theme-christmas body:before{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147482000;opacity:.2;background-image:radial-gradient(circle,#fff 1px,transparent 2px),radial-gradient(circle,#d6ead9 1px,transparent 2px);background-size:47px 53px,71px 83px;background-position:0 0,23px 37px;animation:mznSeasonSnow 18s linear infinite}html.mzn-theme-nowruz .mzn-page .mzn-panel-head h3:after{content:" ✿";color:#58a76f}@media(prefers-reduced-motion:reduce){html.mzn-theme-christmas body:before{animation:none!important}}.mzn-page,.fin-wrap{animation:mznPageIn .42s cubic-bezier(.2,.75,.25,1) both}.mzn-panel,.mzn-card,.mzn-hero-balance,.mzn-week-col,.mzn-list-row,.fin-inbox-item,.fin-card,.fin-row{animation:mznCardIn .48s cubic-bezier(.2,.75,.25,1) both}.mzn-panel:nth-child(2){animation-delay:.035s}.mzn-panel:nth-child(3){animation-delay:.07s}.mzn-panel:nth-child(4){animation-delay:.105s}.mzn-daily-quote{display:inline-block;margin-top:8px!important;padding:7px 11px;border:1px solid var(--bd);border-radius:12px;background:linear-gradient(110deg,var(--surf2),var(--surf));color:var(--pri)!important;font-weight:650;animation:mznQuoteIn .65s ease both}.mzn-page button,.fin-wrap button{transition:transform .22s cubic-bezier(.2,.75,.25,1),box-shadow .22s ease,background-color .22s ease,border-color .22s ease}.mzn-page button:active,.fin-wrap button:active{transform:scale(.96)}.mzn-page .btn:hover,.fin-wrap .btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(30,75,48,.13)}@keyframes mznPageIn{from{opacity:0;transform:translateY(12px) scale(.992);filter:blur(3px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}@keyframes mznCardIn{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:translateY(0)}}@keyframes mznQuoteIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.mzn-page,.mzn-panel,.mzn-card,.mzn-hero-balance,.mzn-week-col,.mzn-list-row,.mzn-daily-quote{animation:none!important}.mzn-page button,.fin-wrap button{transition:none!important}}';
    function addStyle(target, id) { if (!target || target.getElementById(id)) return; var style = target.createElement('style'); style.id = id; style.textContent = css; target.head.appendChild(style); }
    var parentDoc = document;
    try { if (window.parent && window.parent !== window) parentDoc = window.parent.document; } catch (e) {}
    addStyle(parentDoc, 'mizan-motion-parent-style');
    if (parentDoc !== document) addStyle(document, 'mizan-motion-iframe-style');
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

  var globalFinanceTimer=null;
  function tehranJalaliNow(){var parts=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date()),o={};parts.forEach(function(p){if(p.type!=='literal')o[p.type]=Number(p.value);});return{year:o.year,month:o.month,day:o.day};}
  function monthKey(y,m){return String(y)+'-'+String(m).padStart(2,'0');}
  async function sendMizanNotification(title,body,eventKey,type,metadata){
    try{var s=await session();if(!s.user)return false;var row={user_id:s.user.id,title:title,body:body,notification_type:type||'general',event_key:eventKey,metadata:metadata||{}};
      var saved=await s.client.from('mizan_notifications').upsert(row,{onConflict:'user_id,event_key',ignoreDuplicates:true}).select('id');if(saved.error)throw saved.error;
      var created=!!(saved.data&&saved.data.length),osKey='mizan-os-notified:'+eventKey,alreadyShown=false;try{alreadyShown=localStorage.getItem(osKey)==='1';}catch(e){}
      if(window.Notification&&Notification.permission==='granted'&&!alreadyShown){var opts={body:body,tag:eventKey,icon:'./icon.svg',badge:'./icon.svg',data:{url:'./'}};
        if(navigator.serviceWorker&&navigator.serviceWorker.ready){navigator.serviceWorker.ready.then(function(reg){return reg.showNotification(title,opts);}).catch(function(){try{new Notification(title,opts);}catch(e){}});}else{try{new Notification(title,opts);}catch(e){}}
        try{localStorage.setItem(osKey,'1');}catch(e){}
      }return true;
    }catch(e){console.warn('Persist notification failed',e);return false;}
  }
  function monthlyReport(y,m){
    var rows=(Records.getAll()||[]).filter(function(r){return Number(r.year)===Number(y)&&Number(r.mi)===Number(m);}),t={sales:0,hours:0,commission:0,workDays:0,expenses:0,noMissing:false};
    rows.forEach(function(r){var s=r.stats||{};t.sales+=Number(s.totalSales)||0;t.hours+=Number(s.totalHours)||0;t.commission+=Number(s.commission)||0;t.workDays+=Number(s.workDays)||0;t.expenses+=Number(s.totalExpenses)||0;});
    t.noMissing=rows.length>0&&t.workDays>0&&rows.every(function(r){try{return Payroll.missingDays(r.data,r.year,r.mi).length===0;}catch(e){return false;}});
    var done=[];if(t.sales>=100000000)done.push('فروش ۱۰۰ میلیون');if(t.sales>=200000000)done.push('فروش ۲۰۰ میلیون');if(t.hours>=310)done.push('۳۱۰ ساعت کار');if(t.commission>=3000000)done.push('پورسانت ۳ میلیون');if(t.workDays>=26)done.push('۲۶ روز کاری');if(t.noMissing)done.push('حضور کامل');if(t.sales>=50000000&&t.workDays>=20)done.push('فروش مستمر');if(t.sales>=50000000&&t.expenses>0&&t.expenses<=t.sales*.30)done.push('مدیریت هزینه');
    return{totals:t,reached:done};
  }
  async function checkMonthlyClose(){
    try{var now=tehranJalaliNow(),current=monthKey(now.year,now.month),stored=localStorage.getItem('mizan-current-jalali-month');
      if(!stored)localStorage.setItem('mizan-current-jalali-month',current);
      else if(stored!==current){localStorage.setItem('mizan-pending-month-close',stored);localStorage.setItem('mizan-current-jalali-month',current);}
      var clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()),hh=0;
      clock.forEach(function(p){if(p.type==='hour')hh=Number(p.value);});
      if(now.day===Jalali.daysInMonth(now.year,now.month)&&hh===23)localStorage.setItem('mizan-pending-month-close',current);
      var pending=localStorage.getItem('mizan-pending-month-close');if(!pending)return;
      var b=pending.split('-'),y=Number(b[0]),m=Number(b[1]);if(!y||!m)return;
      var r=monthlyReport(y,m),name=(Jalali.MONTHS[m-1]&&Jalali.MONTHS[m-1].fa)||'این ماه';
      var body=r.reached.length?'به این هدف‌ها رسیدی: '+r.reached.join('، ')+'؛ فروش '+money(r.totals.sales)+'، کارکرد '+r.totals.hours.toLocaleString('fa-IR')+' ساعت.':'این ماه هنوز به هدف‌های تعیین‌شده نرسیدی؛ ماه بعد دوباره شروع می‌کنیم.';
      if(await sendMizanNotification('پرونده حقوقی '+name+' بسته شد',body,'month-close:'+pending,'month_close',{month:pending,totals:r.totals,reached:r.reached}))localStorage.removeItem('mizan-pending-month-close');
    }catch(e){console.warn('Monthly close notification failed',e);}
  }
  async function checkGlobalFinanceDue(){
    try{var s=await session();if(!s.user)return;var j=tehranJalaliNow(),jdate=Jalali.faDigits(Jalali.fmt(j.year,j.month,j.day)),todayISO=jToISO(jdate),fromISO=jToISO(jAddDays(jdate,-7));
      var q=await Promise.all([s.client.from('installments').select('id,plan_id,installment_number,amount,paid_amount,due_date').gte('due_date',fromISO).lte('due_date',todayISO),s.client.from('installment_plans').select('id,title'),s.client.from('personal_debt').select('id,creditor_name,amount,paid_amount,due_date').gte('due_date',fromISO).lte('due_date',todayISO)]);
      q.forEach(function(x){if(x.error)throw x.error;});var now=Date.now(),tasks=[];
      (q[0].data||[]).forEach(function(x){if(!x.due_date||num(x.paid_amount)>=num(x.amount))return;var due=new Date(String(x.due_date)+'T09:00:00+03:30').getTime(),age=now-due;if(age<0||age>=7*86400000)return;var p=(q[1].data||[]).find(function(v){return v.id===x.plan_id;});tasks.push(sendMizanNotification('سررسید قسط '+x.installment_number+' · '+(p&&p.title||'برنامه اقساط'),'مانده قسط: '+money(Math.max(0,num(x.amount)-num(x.paid_amount))),'installment:'+x.id+':'+x.due_date,'installment',{installment_id:x.id,due_date:x.due_date,amount:x.amount,paid_amount:x.paid_amount}));});
      (q[2].data||[]).forEach(function(x){if(!x.due_date||num(x.paid_amount)>=num(x.amount))return;var due=new Date(String(x.due_date)+'T09:00:00+03:30').getTime(),age=now-due;if(age<0||age>=7*86400000)return;tasks.push(sendMizanNotification('سررسید بدهی · '+(x.creditor_name||'بدهی ثبت‌شده'),'مانده بدهی: '+money(Math.max(0,num(x.amount)-num(x.paid_amount))),'debt:'+x.id+':'+x.due_date,'debt',{debt_id:x.id,due_date:x.due_date,amount:x.amount,paid_amount:x.paid_amount}));});
      await Promise.all(tasks);
    }catch(e){console.warn('Global finance due check failed',e);}
  }
  function installMizanSchedulers(){
    checkMonthlyClose();checkGlobalFinanceDue();if(globalFinanceTimer)clearInterval(globalFinanceTimer);
    globalFinanceTimer=setInterval(function(){checkGlobalFinanceDue();checkMonthlyClose();},60000);
    document.addEventListener('visibilitychange',function(){if(!document.hidden){checkGlobalFinanceDue();checkMonthlyClose();}});
    setInterval(function(){try{var r=Achievements.checkAll();if(r.newOnes&&r.newOnes.length&&window.Toast)Toast.success('هدف ماهانه تکمیل شد: '+r.newOnes.map(function(x){return x.title;}).join('، '));}catch(e){}},60000);
  }

  window.MizanEnhancements = {
    dashboard: renderDashboard,
    market: renderMarket,
    documents: renderDocuments,
    reminders: renderReminders,
    calendar: renderCalendar,
    more: renderMore,
    compare: renderMonthlyCompare,
    behavior: renderBehaviorAlerts,
    weather: renderWeather,
    syncGoals: syncAllGoals
  };
  installGoalSync();
  installMotionStyles();
  installSeasonalThemes();
  installNumericKeypads();
  installNavigation();
  document.addEventListener('DOMContentLoaded', function () { setTimeout(syncAllGoals, 1800); installMizanSchedulers(); });
  document.addEventListener('click', function (e) {
    var nav = e.target && e.target.closest ? e.target.closest('.global-nav') : null;
    if (nav) nav.dataset.theme = Store.getTheme() || 'light';
  });
})();+Number(x.price).toLocaleString('en-US',{maximumFractionDigits:2})):money(x.price),btcSub=x.id==='bitcoin'?'<small>قیمت جهانی: 
      }).join('');
      var time=marketTime(publishedAt||items[0].updated_utc);
      status.innerHTML=(fromCache?'<span class="mzn-error-dot"></span>':'<span class="mzn-live-dot"></span>')+(fromCache?'نمایش آخرین دادهٔ ذخیره‌شده':'داده‌ها با موفقیت دریافت شدند')+' · زمان انتشار: '+h(time);
    }
    async function refresh(){
      var status=root.querySelector('#mzn-market-status'),grid=root.querySelector('#mzn-market-grid');
      if(!status||!grid||!root.isConnected)return;
      status.textContent='در حال دریافت قیمت‌ها...';
      var urls=[
        'https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/latest-toman.json',
        'https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/popular.json',
        'https://cdn.jsdelivr.net/gh/iran-market/iran-market.github.io@main/data/latest-toman.json'
      ],lastError=null;
      for(var n=0;n<urls.length;n++){
        try{
          var response=await fetch(urls[n],{cache:'no-store'});
          if(!response.ok)throw new Error('پاسخ سرویس بازار: '+response.status);
          var payload=await response.json(),items=normalizeMarketPayload(payload),bitcoin=await fetchBitcoin(items);
          if(bitcoin)items.push(bitcoin);
          marketCache=items;
          try{localStorage.setItem('mizan-market-cache-v2',JSON.stringify({items:items,publishedAt:payload.meta&&payload.meta.published_at,savedAt:new Date().toISOString()}));}catch(e){}
          renderItems(items,false,(payload.meta&&payload.meta.published_at)||(payload.data&&payload.data.generated_at));
          try{var s=await session();if(s.user)await saveMarketHistory(items,s.user,s.client);}catch(e){console.warn('market history save failed',e);}
          return;
        }catch(e){lastError=e;}
      }
      if(!marketCache){
        try{var cached=JSON.parse(localStorage.getItem('mizan-market-cache-v2')||'null');if(cached&&Array.isArray(cached.items)&&cached.items.length)marketCache=cached.items;}catch(e){}
      }
      if(marketCache&&marketCache.length)renderItems(marketCache,true,null);
      else{status.innerHTML='<span class="mzn-error-dot"></span> دریافت قیمت‌ها ممکن نشد: '+errorMsg(lastError);grid.innerHTML='<div class="mzn-panel">در حال حاضر دادهٔ معتبر بازار در دسترس نیست. اتصال اینترنت را بررسی و دوباره تلاش کن.</div>';}
    }
    root.querySelector('#mzn-market-refresh').onclick=refresh;
    setTimeout(refresh,0);
    marketTimer=setInterval(function(){if(!root.isConnected){clearInterval(marketTimer);marketTimer=null;return;}refresh();},30*60*1000);
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
          return '<div class="mzn-doc-row"><span class="mzn-doc-icon">' + (x.mime_type.indexOf('image/') === 0 ? Icons.image : Icons.fileText) + '</span><div class="mzn-doc-info"><b>' + h(x.file_name) + '</b><small>' + h(x.category) + ' · ' + h(new Date(x.created_at).toLocaleDateString('fa-IR-u-ca-persian',{timeZone:'Asia/Tehran'})) + ' · ' + h((x.file_size / 1024 / 1024).toFixed(2)) + ' MB</small>' + (x.note ? '<small>' + h(x.note) + '</small>' : '') + '</div><div class="mzn-doc-actions"><button type="button" data-open="' + h(x.id) + '" title="مشاهده">' + Icons.externalLink + '</button><button type="button" data-del="' + h(x.id) + '" title="حذف">' + Icons.trash + '</button></div></div>';
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
          return '<div class="mzn-rem-row ' + (x.completed ? 'is-done' : overdue ? 'is-overdue' : '') + '"><div class="mzn-rem-main"><b>' + h(x.title) + '</b><small>' + h(due) + (x.due_at ? ' · ' + h(formatTehranTime(x.due_at)) : '') + ' · ' + h(x.priority) + '</small>' + (x.note ? '<small>' + h(x.note) + '</small>' : '') + '</div><div class="mzn-doc-actions"><button type="button" data-done="' + h(x.id) + '" title="انجام شد">' + Icons.check + '</button><button type="button" data-remove="' + h(x.id) + '" title="حذف">' + Icons.trash + '</button></div></div>';
        }).join('');
        list.querySelectorAll('[data-done]').forEach(function (b) {
          b.onclick = async function () {
            var row = rows.find(function (x) { return x.id === b.dataset.done; });
            if (!row.completed && row.repeat_rule !== 'none' && row.due_at) {
              var parts = tehranDateTimeParts(row.due_at);
              var baseDate = row.due_date || (parts ? parts.year + '-' + parts.month + '-' + parts.day : '');
              var nextDate = shiftGregorianDate(baseDate, row.repeat_rule);
              var nextTime = parts ? parts.hour + ':' + parts.minute : '09:00';
              var nextDueAt = tehranDateTimeToISO(nextDate, nextTime);
              if (!nextDate || !nextDueAt) { notify('زمان تکرار یادآوری معتبر نیست.'); return; }
              var repeatInsert = await s.client.from('mizan_reminders').insert({ user_id: s.user.id, title: row.title, note: row.note, due_at: nextDueAt, due_date: nextDate, priority: row.priority, repeat_rule: row.repeat_rule });
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
        var dueAt = tehranDateTimeToISO(iso, time);
        if (!dueAt) throw new Error('زمان یادآوری معتبر نیست.');
        var ins = await s.client.from('mizan_reminders').insert({
          user_id: s.user.id, title: title, note: root.querySelector('#mzn-rem-note').value.trim(),
          due_date: iso, due_at: dueAt, priority: root.querySelector('#mzn-rem-priority').value,
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
      try {
        var s = await session(); if (!s.user) return;
        var now = Date.now(), from = new Date(now - 30*86400000).toISOString(), to = new Date(now + 60000).toISOString();
        var due = await s.client.from('mizan_reminders').select('id,title,due_at').eq('completed', false).gte('due_at', from).lte('due_at', to);
        if (due.error) throw due.error;
        await Promise.all((due.data || []).map(function (x) { return sendMizanNotification('یادآوری میزان', x.title, 'reminder:'+x.id, 'reminder', {reminder_id:x.id,due_at:x.due_at}); }));
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

  function monthStats(y,m){var data=Store.loadMonth(y,m-1)||{},cfg=Store.loadSettings()||{},s=Payroll.compute(data,cfg)||{};return{sales:num(s.totalSales),expenses:num(s.totalExpenses),commission:num(s.commission),netSalary:num(s.netSalary),hours:num(s.totalHours),workDays:num(s.workDays),gross:num(s.grossSalary)};}
  function prevJMonth(y,m){return m===1?{y:y-1,m:12}:{y:y,m:m-1};}
  function renderMonthlyCompare(){var t=Jalali.today(),p=prevJMonth(t[0],t[1]),a=monthStats(t[0],t[1]),b=monthStats(p.y,p.m),labels=[['حقوق خالص','netSalary'],['فروش','sales'],['هزینه‌ها','expenses'],['پورسانت','commission'],['ساعت کار','hours'],['روز کاری','workDays']],root=el('mzn-page mzn-compare',head('مقایسه ماهانه','عملکرد مالی ماه جاری در برابر ماه گذشته')+'<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>'+h(Jalali.MONTHS[t[1]-1].fa+' '+Jalali.faDigits(t[0]))+'</h3><p>در مقایسه با '+h(Jalali.MONTHS[p.m-1].fa+' '+Jalali.faDigits(p.y))+'</p></div><span class="mzn-pill">ماه به ماه</span></div><div class="mzn-compare-grid">'+labels.map(function(x){var av=a[x[1]],bv=b[x[1]],pct=bv?((av-bv)/bv*100):null,unit=x[1]==='hours'?' ساعت':x[1]==='workDays'?' روز':'',val=x[1]==='hours'||x[1]==='workDays'?num(av).toLocaleString('fa-IR')+unit:money(av),old=x[1]==='hours'||x[1]==='workDays'?num(bv).toLocaleString('fa-IR')+unit:money(bv),w=Math.max(3,Math.min(100,bv?av/Math.max(av,bv)*100:av?100:3));return'<article class="mzn-compare-item"><div class="mzn-compare-title">'+x[0]+'</div><strong>'+val+'</strong><small>ماه قبل: '+old+'</small><div class="mzn-compare-track"><i style="width:'+w+'%"></i></div><span class="mzn-compare-delta">'+(pct===null?'داده‌ای از ماه قبل نیست':(pct>0?'+':'')+pct.toFixed(1).replace('.', '٫')+'٪ نسبت به ماه قبل')+'</span></article>';}).join('')+'</div></div><div class="mzn-panel"><h3>جمع‌بندی</h3><p class="mzn-muted">'+(a.sales>b.sales?'فروش نسبت به ماه قبل بیشتر شده است. ':'فروش نسبت به ماه قبل کمتر یا برابر است. ')+(a.expenses>b.expenses?'هزینه‌ها افزایش داشته‌اند. ':'هزینه‌ها افزایش نداشته‌اند. ')+'مقایسه بر اساس داده‌های ثبت‌شده هر ماه است.</p></div>');return root;}
  function renderBehaviorAlerts(){var t=Jalali.today(),p=prevJMonth(t[0],t[1]),cur=monthStats(t[0],t[1]),old=monthStats(p.y,p.m),elapsed=Math.max(1,t[2]),prevDays=Jalali.daysInMonth(p.y,p.m),baseDays=Math.min(elapsed,prevDays),curExpenseRate=cur.expenses/elapsed,oldExpenseRate=old.expenses/Math.max(1,baseDays),curSalesRate=cur.sales/elapsed,oldSalesRate=old.sales/Math.max(1,baseDays),alerts=[];if(oldExpenseRate>0&&curExpenseRate>oldExpenseRate*1.25)alerts.push({type:'warning',title:'افزایش سرعت هزینه‌کرد',body:'میانگین هزینه روزانه '+Math.round((curExpenseRate/oldExpenseRate-1)*100)+'٪ بیشتر از بازه مشابه ماه قبل است.'});if(oldSalesRate>0&&curSalesRate<oldSalesRate*.75)alerts.push({type:'warning',title:'افت سرعت فروش',body:'میانگین فروش روزانه نسبت به بازه مشابه ماه قبل بیش از ۲۵٪ کاهش داشته است.'});if(cur.expenses>cur.sales&&cur.sales>0)alerts.push({type:'danger',title:'هزینه بیشتر از فروش',body:'هزینه ثبت‌شده این ماه از فروش ثبت‌شده بیشتر است؛ جزئیات ثبت‌ها را بررسی کن.'});if(!alerts.length)alerts.push({type:'success',title:'فعلاً رفتار غیرعادی دیده نشد',body:'با داده‌های ثبت‌شده تا امروز، هشدار مهمی شناسایی نشده است.'});var root=el('mzn-page mzn-behavior',head('هشدار رفتار مالی','بررسی خودکار روند هزینه و درآمد با داده‌های ثبت‌شده')+'<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>وضعیت این ماه</h3><p>مقایسه میانگین روزانه با همین تعداد روز از ماه قبل</p></div><span class="mzn-pill">'+Jalali.faDigits(t[2])+' روز گذشته</span></div>'+alerts.map(function(x){return'<div class="mzn-alert mzn-alert-'+x.type+'"><b>'+x.title+'</b><p>'+x.body+'</p></div>';}).join('')+'</div><div class="mzn-panel"><h3>مبنای تحلیل</h3><p class="mzn-muted">هشدارها از فروش و هزینه‌های ثبت‌شده ساخته می‌شوند؛ اگر داده‌ای ثبت نشده باشد، نتیجه قطعی نیست. این بخش توصیه مالی قطعی ارائه نمی‌کند.</p></div>');return root;}
  function weatherSeason(timezone){try{var parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone||'Asia/Tehran',calendar:'persian',month:'numeric'}).formatToParts(new Date()),part=parts.find(function(x){return x.type==='month';}),m=Number(part&&part.value);return m<=3?'spring':m<=6?'summer':m<=9?'autumn':'winter';}catch(err){return'winter';}}
  function weatherInfo(code){code=Number(code);if(code===0)return{kind:'clear',label:'آسمان صاف',icon:'☀️'};if(code<=2)return{kind:'partly',label:'نیمه‌ابری',icon:'🌤️'};if(code===3)return{kind:'cloudy',label:'ابری',icon:'☁️'};if(code===45||code===48)return{kind:'fog',label:'مه‌آلود',icon:'🌫️'};if(code>=51&&code<=57)return{kind:'rain',label:'نم‌نم باران',icon:'🌦️'};if(code>=61&&code<=67)return{kind:'rain',label:'بارندگی',icon:'🌧️'};if(code>=71&&code<=77)return{kind:'snow',label:'بارش برف',icon:'❄️'};if(code>=80&&code<=82)return{kind:'rain',label:'رگبار',icon:'🌧️'};if(code>=85&&code<=86)return{kind:'snow',label:'بارش برف',icon:'🌨️'};if(code>=95)return{kind:'thunder',label:'رعدوبرق',icon:'⛈️'};return{kind:'cloudy',label:'وضعیت متغیر',icon:'☁️'};}
  function clothingAdvice(temp,feels,wind,rain){var t=Number(feels);if(!Number.isFinite(t))t=Number(temp)||15;var out=[];if(t>=30)out.push('لباس نخی، خنک و رنگ روشن بپوش؛ در آفتاب کلاه و عینک آفتابی همراه داشته باش.');else if(t>=22)out.push('لباس سبک و تنفس‌پذیر مناسب است؛ یک لایه نازک برای فضای خنک همراه داشته باش.');else if(t>=16)out.push('لباس روزمره با یک سویشرت یا ژاکت سبک انتخاب خوبی است.');else if(t>=10)out.push('ژاکت یا کاپشن متوسط و لباس چندلایه بپوش.');else if(t>=5)out.push('کاپشن گرم و لایه میانی مثل پلیور لازم است.');else out.push('پالتو یا کاپشن ضخیم، لایه گرم و پوشش مناسب سر و گردن بپوش.');if(Number(wind)>=25)out.push('باد نسبتاً شدید است؛ لایه رویی بادگیر و شال سبک همراه داشته باش.');if(Number(rain)>=40)out.push('احتمال بارش قابل توجه است؛ چتر یا بارانی و کفش مقاوم به آب بردار.');else if(Number(rain)>=20)out.push('احتمال بارش کم تا متوسط وجود دارد؛ یک چتر کوچک احتیاطاً همراه داشته باش.');if(t>=27&&Number(rain)<20)out.push('آب آشامیدنی همراه داشته باش و در ساعات آفتابی مستقیم کمتر بمان.');return out;}
  function renderWeather(){var root=el('mzn-page mzn-weather',head('آب‌وهوای منطقه','دمای لحظه‌ای، روند ساعتی امروز و پیشنهاد پوشش بر اساس محل فعلی')+'<div class="mzn-panel mzn-weather-panel" id="mzn-weather-card"><div class="mzn-weather-empty"><span>🌤️</span><h3>آب‌وهوای محل فعلی</h3><p>برای دریافت وضعیت دقیق منطقه، اجازه موقعیت مکانی را بده. اطلاعات هواشناسی از Open-Meteo و بدون ذخیره مختصات در میزان دریافت می‌شود.</p><button class="btn btn-primary" id="mzn-weather-locate">تشخیص موقعیت من</button></div></div>');var box=root.querySelector('#mzn-weather-card'),locBtn=root.querySelector('#mzn-weather-locate'),last=null;
    function fetchWeather(lat,lon){last={lat:lat,lon:lon};box.innerHTML='<div class="mzn-weather-loading">در حال دریافت پیش‌بینی منطقه...</div>';var url='https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m&forecast_days=1&timezone=auto';fetch(url,{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('weather_http_'+r.status);return r.json();}).then(function(d){if(!box.isConnected)return;var c=d.current||{},hourly=d.hourly||{},info=weatherInfo(c.weather_code),today=String(c.time||'').slice(0,10),hours=(hourly.time||[]).map(function(time,i){return{time:time,index:i,hour:Number(String(time).slice(11,13)),temp:Number(hourly.temperature_2m[i]),feels:Number(hourly.apparent_temperature[i]),rain:Number(hourly.precipitation_probability[i]||0),code:Number(hourly.weather_code[i]),wind:Number(hourly.wind_speed_10m[i])};}).filter(function(x){return x.time.slice(0,10)===today&&x.hour>=6&&x.hour<=23;}),nowHour=Number(String(c.time||'').slice(11,13)),next=hours.filter(function(x){return x.hour>=nowHour&&x.hour<=nowHour+3;}),currentHourIndex=(hourly.time||[]).findIndex(function(x){return String(x).slice(0,13)===String(c.time||'').slice(0,13);}),currentRainProb=currentHourIndex>=0?Number(hourly.precipitation_probability[currentHourIndex]||0):0,rainSoon=Math.max(Number(c.precipitation||0)>0?100:0,currentRainProb,next.reduce(function(a,x){return Math.max(a,x.rain);},0)),advice=clothingAdvice(c.temperature_2m,c.apparent_temperature,c.wind_speed_10m,rainSoon),particleCount=info.kind==='snow'?20:info.kind==='rain'||info.kind==='thunder'?16:0,particles=Array.from({length:particleCount},function(_,i){return'<i style="left:'+((i*100/particleCount)+2).toFixed(1)+'%;animation-delay:-'+(i*(info.kind==='snow'?.31:.13)).toFixed(2)+'s"></i>';}).join(''),dayClass=Number(c.is_day)===1?'is-day':'is-night';box.className='mzn-panel mzn-weather-panel weather-'+info.kind+' season-'+weatherSeason(d.timezone)+' '+dayClass;box.innerHTML='<div class="mzn-weather-scene"><div class="mzn-weather-season-layer"></div><div class="mzn-weather-sun"></div><div class="mzn-weather-cloud cloud-one"></div><div class="mzn-weather-cloud cloud-two"></div><div class="mzn-weather-particles">'+particles+'</div><div class="mzn-weather-scene-copy"><span>'+(dayClass==='is-night'&&info.kind==='clear'?'🌙':info.icon)+'</span><b>'+info.label+'</b><small>'+(dayClass==='is-day'?'وضعیت روز':'وضعیت شب')+'</small></div></div><div class="mzn-weather-current"><div><small>دمای همین ساعت</small><strong>'+Math.round(Number(c.temperature_2m))+'°</strong><span>احساس واقعی '+Math.round(Number(c.apparent_temperature))+'°</span></div><div class="mzn-weather-current-meta"><b>'+info.label+'</b><span>رطوبت '+Math.round(Number(c.relative_humidity_2m))+'٪</span><span>باد '+Math.round(Number(c.wind_speed_10m))+' km/h</span><span>احتمال بارش '+Math.round(currentRainProb)+'٪</span><span>بارش فعلی '+Number(c.precipitation||0)+' mm</span></div></div><section class="mzn-weather-hourly"><div class="mzn-weather-section-head"><h3>دمای هوا از صبح تا شب</h3><small>امروز · ساعت محلی منطقه</small></div><div class="mzn-weather-hour-list">'+(hours.length?hours.map(function(x){var wi=weatherInfo(x.code);return'<article class="mzn-weather-hour"><time>'+String(x.hour).padStart(2,'0')+':00</time><span class="mzn-weather-hour-icon">'+wi.icon+'</span><b>'+Math.round(x.temp)+'°</b><small>بارش '+Math.round(x.rain)+'٪</small></article>';}).join(''):'<p class="mzn-muted">اطلاعات ساعتی امروز در دسترس نیست.</p>')+'</div></section><section class="mzn-weather-advice"><div class="mzn-weather-section-head"><h3>چی بپوشم؟</h3><span>پیشنهاد هوشمند پوشش</span></div><div class="mzn-weather-advice-icon">🧥</div><ul>'+advice.map(function(x){return'<li>'+x+'</li>';}).join('')+'</ul><small>بر اساس دمای '+Math.round(Number(c.temperature_2m))+'°، احساس دما، باد و بیشترین احتمال بارش چند ساعت آینده</small></section><div class="mzn-weather-footer"><span>منبع: Open-Meteo · '+new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})+'</span><button class="btn btn-ghost" id="mzn-weather-refresh">به‌روزرسانی</button></div>';var refresh=box.querySelector('#mzn-weather-refresh');if(refresh)refresh.onclick=function(){if(last)fetchWeather(last.lat,last.lon);};}).catch(function(err){if(!box.isConnected)return;box.className='mzn-panel mzn-weather-panel';box.innerHTML='<div class="mzn-weather-empty"><span>⚠️</span><h3>دریافت اطلاعات هواشناسی انجام نشد</h3><p>اتصال اینترنت یا سرویس هواشناسی را بررسی کن و دوباره تلاش کن.</p><button class="btn btn-primary" id="mzn-weather-retry">تلاش دوباره</button></div>';var retry=box.querySelector('#mzn-weather-retry');if(retry)retry.onclick=function(){if(last)fetchWeather(last.lat,last.lon);};console.warn('Mizan weather error',err);});}
    function locate(){if(!navigator.geolocation){box.innerHTML='<p class="mzn-muted">مرورگر موقعیت مکانی را پشتیبانی نمی‌کند.</p>';return;}box.innerHTML='<p class="mzn-muted">در حال تشخیص موقعیت...</p>';navigator.geolocation.getCurrentPosition(function(pos){fetchWeather(pos.coords.latitude,pos.coords.longitude);},function(err){box.innerHTML='<div class="mzn-weather-empty"><span>📍</span><h3>اجازه موقعیت مکانی داده نشد</h3><p>در تنظیمات Safari دسترسی Location را برای این سایت فعال کن و دوباره تلاش کن.</p><button class="btn btn-primary" id="mzn-weather-again">تلاش دوباره</button></div>';var again=box.querySelector('#mzn-weather-again');if(again)again.onclick=locate;},{enableHighAccuracy:false,timeout:15000,maximumAge:600000});}
    if(locBtn)locBtn.onclick=locate;locate();return root;}
  function installNumericKeypads(){function prepare(input){if(!input||input.dataset.mznNumericReady)return;if(input.type==='number'||input.dataset.numeric==='true'||input.classList.contains('money-input')){input.dataset.mznNumericReady='1';input.setAttribute('inputmode','decimal');input.setAttribute('pattern','[0-9]*');input.setAttribute('lang','en');input.setAttribute('dir','ltr');input.style.textAlign='left';}}document.querySelectorAll('input[type="number"],input[data-numeric="true"],input.money-input').forEach(prepare);new MutationObserver(function(records){records.forEach(function(r){r.addedNodes.forEach(function(n){if(n.nodeType!==1)return;if(n.matches&&n.matches('input'))prepare(n);if(n.querySelectorAll)n.querySelectorAll('input[type="number"],input[data-numeric="true"],input.money-input').forEach(prepare);});});}).observe(document.body,{childList:true,subtree:true});document.addEventListener('focusin',function(ev){prepare(ev.target);});}

  function installSeasonalThemes(){if(window.__mizanSeasonalInstalled)return;window.__mizanSeasonalInstalled=true;function parts(date,zone,opts){var out={};new Intl.DateTimeFormat('en-US',Object.assign({timeZone:zone},opts)).formatToParts(date).forEach(function(p){if(p.type!=='literal')out[p.type]=p.value;});return out;}function apply(){var now=new Date(),g=parts(now,'Asia/Tehran',{year:'numeric',month:'numeric',day:'numeric',hour:'numeric',hourCycle:'h23'}),month=Number(g.month),day=Number(g.day),hour=Number(g.hour),theme='';if(month===12&&((day===24&&hour>=18)||day===25||day===26||(day===27&&hour<18)))theme='christmas';try{var j=parts(now,'Asia/Tehran',{calendar:'persian',year:'numeric',month:'numeric',day:'numeric'});if(Number(j.month)===1&&Number(j.day)>=1&&Number(j.day)<=10)theme='nowruz';}catch(err){}var docs=[document];try{if(window.parent&&window.parent!==window&&window.parent.document!==document)docs.push(window.parent.document);}catch(err){}docs.forEach(function(doc){var root=doc.documentElement;if(!root)return;root.classList.remove('mzn-theme-christmas','mzn-theme-nowruz');if(theme)root.classList.add('mzn-theme-'+theme);var meta=doc.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',theme==='christmas'?'#173b32':theme==='nowruz'?'#2f8058':'#236b4d');});}apply();window.__mizanSeasonalTimer=window.setInterval(apply,60000);}
  function renderMore() {
    var items = [
      ['today', 'امروز و ثبت سریع', Icons.home, 'ساعت کار، فروش و ثبت روزانه'],
      ['months', 'ماه‌ها و گزارش حقوق', Icons.grid, 'گزارش ماهانه و سوابق'],
      ['reminders', 'یادآوری‌های قبلی', Icons.bell, 'یادآورهای فعلی سایت'],
      ['reminders-db', 'یادآور هوشمند مالی', Icons.bellRing, 'سررسیدهای ابری و اعلان‌ها'],
      ['calendar', 'تقویم مالی شمسی', Icons.calendar, 'نمایش تمام سررسیدها'],
      ['compare', 'مقایسه ماهانه', Icons.activity, 'مقایسه درآمد، هزینه و عملکرد ماه‌ها'],
      ['behavior', 'هشدار رفتار مالی', Icons.alert, 'تشخیص تغییرات غیرعادی درآمد و هزینه'],
      ['weather', 'آب‌وهوای منطقه', Icons.cloud, 'آب‌وهوای محل فعلی با اجازه موقعیت مکانی'],
      ['records', 'سوابق', Icons.activity, 'تاریخچه ثبت‌ها'],
      ['achievements', 'دستاوردها و اهداف', Icons.target, 'پیشرفت هدف و تبریک تکمیل'],
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


  function installMotionStyles() {
    var css = '.global-nav.nav-tabs{isolation:isolate}.global-nav .nav-tab{position:relative!important;overflow:hidden!important;transition:transform .24s cubic-bezier(.2,.75,.25,1),color .24s ease,background .24s ease,box-shadow .24s ease!important}.global-nav .nav-tab:active{transform:scale(.93)!important}.global-nav .nav-tab.active{transform:translateY(-2px)!important;box-shadow:0 8px 22px rgba(35,107,77,.25),inset 0 1px 0 rgba(255,255,255,.28)!important}.global-nav .nav-tab.active:after{content:"";position:absolute;bottom:3px;left:50%;width:15px;height:2px;border-radius:3px;background:rgba(255,255,255,.9);transform:translateX(-50%);animation:mznNavLine .3s ease both}.global-nav .nav-tab svg{transition:transform .28s cubic-bezier(.2,.8,.2,1)!important}.global-nav .nav-tab.active svg{transform:translateY(-1px) scale(1.08)}@keyframes mznNavLine{from{width:0;opacity:0}to{width:15px;opacity:1}}';
    css += 'html.mzn-theme-christmas body{background:radial-gradient(ellipse at 10% 0%,rgba(190,52,58,.16),transparent 34%),radial-gradient(ellipse at 90% 100%,rgba(43,119,82,.22),transparent 38%),var(--bg)!important}html.mzn-theme-christmas .mzn-page .mzn-panel,html.mzn-theme-christmas .fin-card{border-color:rgba(180,65,70,.28)!important}html.mzn-theme-christmas .global-nav .nav-tab.active{background:linear-gradient(135deg,#9e303d,#2d7652)!important}html.mzn-theme-nowruz body{background:radial-gradient(ellipse at 15% 0%,rgba(72,165,111,.2),transparent 34%),radial-gradient(ellipse at 90% 100%,rgba(231,193,107,.16),transparent 36%),var(--bg)!important}html.mzn-theme-nowruz .mzn-page .mzn-panel,html.mzn-theme-nowruz .fin-card{border-color:rgba(81,151,102,.3)!important}html.mzn-theme-nowruz .global-nav .nav-tab.active{background:linear-gradient(135deg,#287b55,#a6bb76)!important}@keyframes mznSeasonSnow{from{background-position:0 -20px,23px 17px}to{background-position:0 400px,23px 437px}}html.mzn-theme-christmas body:before{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147482000;opacity:.2;background-image:radial-gradient(circle,#fff 1px,transparent 2px),radial-gradient(circle,#d6ead9 1px,transparent 2px);background-size:47px 53px,71px 83px;background-position:0 0,23px 37px;animation:mznSeasonSnow 18s linear infinite}html.mzn-theme-nowruz .mzn-page .mzn-panel-head h3:after{content:" ✿";color:#58a76f}@media(prefers-reduced-motion:reduce){html.mzn-theme-christmas body:before{animation:none!important}}.mzn-page,.fin-wrap{animation:mznPageIn .42s cubic-bezier(.2,.75,.25,1) both}.mzn-panel,.mzn-card,.mzn-hero-balance,.mzn-week-col,.mzn-list-row,.fin-inbox-item,.fin-card,.fin-row{animation:mznCardIn .48s cubic-bezier(.2,.75,.25,1) both}.mzn-panel:nth-child(2){animation-delay:.035s}.mzn-panel:nth-child(3){animation-delay:.07s}.mzn-panel:nth-child(4){animation-delay:.105s}.mzn-daily-quote{display:inline-block;margin-top:8px!important;padding:7px 11px;border:1px solid var(--bd);border-radius:12px;background:linear-gradient(110deg,var(--surf2),var(--surf));color:var(--pri)!important;font-weight:650;animation:mznQuoteIn .65s ease both}.mzn-page button,.fin-wrap button{transition:transform .22s cubic-bezier(.2,.75,.25,1),box-shadow .22s ease,background-color .22s ease,border-color .22s ease}.mzn-page button:active,.fin-wrap button:active{transform:scale(.96)}.mzn-page .btn:hover,.fin-wrap .btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(30,75,48,.13)}@keyframes mznPageIn{from{opacity:0;transform:translateY(12px) scale(.992);filter:blur(3px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}@keyframes mznCardIn{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:translateY(0)}}@keyframes mznQuoteIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.mzn-page,.mzn-panel,.mzn-card,.mzn-hero-balance,.mzn-week-col,.mzn-list-row,.mzn-daily-quote{animation:none!important}.mzn-page button,.fin-wrap button{transition:none!important}}';
    function addStyle(target, id) { if (!target || target.getElementById(id)) return; var style = target.createElement('style'); style.id = id; style.textContent = css; target.head.appendChild(style); }
    var parentDoc = document;
    try { if (window.parent && window.parent !== window) parentDoc = window.parent.document; } catch (e) {}
    addStyle(parentDoc, 'mizan-motion-parent-style');
    if (parentDoc !== document) addStyle(document, 'mizan-motion-iframe-style');
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

  var globalFinanceTimer=null;
  function tehranJalaliNow(){var parts=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date()),o={};parts.forEach(function(p){if(p.type!=='literal')o[p.type]=Number(p.value);});return{year:o.year,month:o.month,day:o.day};}
  function monthKey(y,m){return String(y)+'-'+String(m).padStart(2,'0');}
  async function sendMizanNotification(title,body,eventKey,type,metadata){
    try{var s=await session();if(!s.user)return false;var row={user_id:s.user.id,title:title,body:body,notification_type:type||'general',event_key:eventKey,metadata:metadata||{}};
      var saved=await s.client.from('mizan_notifications').upsert(row,{onConflict:'user_id,event_key',ignoreDuplicates:true}).select('id');if(saved.error)throw saved.error;
      var created=!!(saved.data&&saved.data.length),osKey='mizan-os-notified:'+eventKey,alreadyShown=false;try{alreadyShown=localStorage.getItem(osKey)==='1';}catch(e){}
      if(window.Notification&&Notification.permission==='granted'&&!alreadyShown){var opts={body:body,tag:eventKey,icon:'./icon.svg',badge:'./icon.svg',data:{url:'./'}};
        if(navigator.serviceWorker&&navigator.serviceWorker.ready){navigator.serviceWorker.ready.then(function(reg){return reg.showNotification(title,opts);}).catch(function(){try{new Notification(title,opts);}catch(e){}});}else{try{new Notification(title,opts);}catch(e){}}
        try{localStorage.setItem(osKey,'1');}catch(e){}
      }return true;
    }catch(e){console.warn('Persist notification failed',e);return false;}
  }
  function monthlyReport(y,m){
    var rows=(Records.getAll()||[]).filter(function(r){return Number(r.year)===Number(y)&&Number(r.mi)===Number(m);}),t={sales:0,hours:0,commission:0,workDays:0,expenses:0,noMissing:false};
    rows.forEach(function(r){var s=r.stats||{};t.sales+=Number(s.totalSales)||0;t.hours+=Number(s.totalHours)||0;t.commission+=Number(s.commission)||0;t.workDays+=Number(s.workDays)||0;t.expenses+=Number(s.totalExpenses)||0;});
    t.noMissing=rows.length>0&&t.workDays>0&&rows.every(function(r){try{return Payroll.missingDays(r.data,r.year,r.mi).length===0;}catch(e){return false;}});
    var done=[];if(t.sales>=100000000)done.push('فروش ۱۰۰ میلیون');if(t.sales>=200000000)done.push('فروش ۲۰۰ میلیون');if(t.hours>=310)done.push('۳۱۰ ساعت کار');if(t.commission>=3000000)done.push('پورسانت ۳ میلیون');if(t.workDays>=26)done.push('۲۶ روز کاری');if(t.noMissing)done.push('حضور کامل');if(t.sales>=50000000&&t.workDays>=20)done.push('فروش مستمر');if(t.sales>=50000000&&t.expenses>0&&t.expenses<=t.sales*.30)done.push('مدیریت هزینه');
    return{totals:t,reached:done};
  }
  async function checkMonthlyClose(){
    try{var now=tehranJalaliNow(),current=monthKey(now.year,now.month),stored=localStorage.getItem('mizan-current-jalali-month');
      if(!stored)localStorage.setItem('mizan-current-jalali-month',current);
      else if(stored!==current){localStorage.setItem('mizan-pending-month-close',stored);localStorage.setItem('mizan-current-jalali-month',current);}
      var clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()),hh=0;
      clock.forEach(function(p){if(p.type==='hour')hh=Number(p.value);});
      if(now.day===Jalali.daysInMonth(now.year,now.month)&&hh===23)localStorage.setItem('mizan-pending-month-close',current);
      var pending=localStorage.getItem('mizan-pending-month-close');if(!pending)return;
      var b=pending.split('-'),y=Number(b[0]),m=Number(b[1]);if(!y||!m)return;
      var r=monthlyReport(y,m),name=(Jalali.MONTHS[m-1]&&Jalali.MONTHS[m-1].fa)||'این ماه';
      var body=r.reached.length?'به این هدف‌ها رسیدی: '+r.reached.join('، ')+'؛ فروش '+money(r.totals.sales)+'، کارکرد '+r.totals.hours.toLocaleString('fa-IR')+' ساعت.':'این ماه هنوز به هدف‌های تعیین‌شده نرسیدی؛ ماه بعد دوباره شروع می‌کنیم.';
      if(await sendMizanNotification('پرونده حقوقی '+name+' بسته شد',body,'month-close:'+pending,'month_close',{month:pending,totals:r.totals,reached:r.reached}))localStorage.removeItem('mizan-pending-month-close');
    }catch(e){console.warn('Monthly close notification failed',e);}
  }
  async function checkGlobalFinanceDue(){
    try{var s=await session();if(!s.user)return;var j=tehranJalaliNow(),jdate=Jalali.faDigits(Jalali.fmt(j.year,j.month,j.day)),todayISO=jToISO(jdate),fromISO=jToISO(jAddDays(jdate,-7));
      var q=await Promise.all([s.client.from('installments').select('id,plan_id,installment_number,amount,paid_amount,due_date').gte('due_date',fromISO).lte('due_date',todayISO),s.client.from('installment_plans').select('id,title'),s.client.from('personal_debt').select('id,creditor_name,amount,paid_amount,due_date').gte('due_date',fromISO).lte('due_date',todayISO)]);
      q.forEach(function(x){if(x.error)throw x.error;});var now=Date.now(),tasks=[];
      (q[0].data||[]).forEach(function(x){if(!x.due_date||num(x.paid_amount)>=num(x.amount))return;var due=new Date(String(x.due_date)+'T09:00:00+03:30').getTime(),age=now-due;if(age<0||age>=7*86400000)return;var p=(q[1].data||[]).find(function(v){return v.id===x.plan_id;});tasks.push(sendMizanNotification('سررسید قسط '+x.installment_number+' · '+(p&&p.title||'برنامه اقساط'),'مانده قسط: '+money(Math.max(0,num(x.amount)-num(x.paid_amount))),'installment:'+x.id+':'+x.due_date,'installment',{installment_id:x.id,due_date:x.due_date,amount:x.amount,paid_amount:x.paid_amount}));});
      (q[2].data||[]).forEach(function(x){if(!x.due_date||num(x.paid_amount)>=num(x.amount))return;var due=new Date(String(x.due_date)+'T09:00:00+03:30').getTime(),age=now-due;if(age<0||age>=7*86400000)return;tasks.push(sendMizanNotification('سررسید بدهی · '+(x.creditor_name||'بدهی ثبت‌شده'),'مانده بدهی: '+money(Math.max(0,num(x.amount)-num(x.paid_amount))),'debt:'+x.id+':'+x.due_date,'debt',{debt_id:x.id,due_date:x.due_date,amount:x.amount,paid_amount:x.paid_amount}));});
      await Promise.all(tasks);
    }catch(e){console.warn('Global finance due check failed',e);}
  }
  function installMizanSchedulers(){
    checkMonthlyClose();checkGlobalFinanceDue();if(globalFinanceTimer)clearInterval(globalFinanceTimer);
    globalFinanceTimer=setInterval(function(){checkGlobalFinanceDue();checkMonthlyClose();},60000);
    document.addEventListener('visibilitychange',function(){if(!document.hidden){checkGlobalFinanceDue();checkMonthlyClose();}});
    setInterval(function(){try{var r=Achievements.checkAll();if(r.newOnes&&r.newOnes.length&&window.Toast)Toast.success('هدف ماهانه تکمیل شد: '+r.newOnes.map(function(x){return x.title;}).join('، '));}catch(e){}},60000);
  }

  window.MizanEnhancements = {
    dashboard: renderDashboard,
    market: renderMarket,
    documents: renderDocuments,
    reminders: renderReminders,
    calendar: renderCalendar,
    more: renderMore,
    compare: renderMonthlyCompare,
    behavior: renderBehaviorAlerts,
    weather: renderWeather,
    syncGoals: syncAllGoals
  };
  installGoalSync();
  installMotionStyles();
  installSeasonalThemes();
  installNumericKeypads();
  installNavigation();
  document.addEventListener('DOMContentLoaded', function () { setTimeout(syncAllGoals, 1800); installMizanSchedulers(); });
  document.addEventListener('click', function (e) {
    var nav = e.target && e.target.closest ? e.target.closest('.global-nav') : null;
    if (nav) nav.dataset.theme = Store.getTheme() || 'light';
  });
})();+Number(x.usd||0).toLocaleString('en-US',{maximumFractionDigits:2})+(x.currency==='IRT'?' · تبدیل تقریبی با نرخ دلار بازار':' · تبدیل تومانی در دسترس نیست')+'</small>':'';
        return '<article class="mzn-market-card mzn-bitcoin-card"><div class="mzn-market-card-head"><span>'+(x.id==='bitcoin'?'₿ ':'')+h(labels[x.id]||x.name||x.id)+'</span><span class="mzn-trend '+trend+'">'+pct+'</span></div><strong>'+priceText+'</strong>'+btcSub+'<small>آخرین به‌روزرسانی: '+h(marketTime(x.updated_display||x.updated_utc||publishedAt))+'</small><em class="mzn-market-advice '+advice.cls+'">'+advice.text+'</em>'+(fromCache||x.stale?'<em class="mzn-stale">دادهٔ ذخیره‌شده یا قدیمی است.</em>':'')+'</article>';
      }).join('');
      var time=marketTime(publishedAt||items[0].updated_utc);
      status.innerHTML=(fromCache?'<span class="mzn-error-dot"></span>':'<span class="mzn-live-dot"></span>')+(fromCache?'نمایش آخرین دادهٔ ذخیره‌شده':'داده‌ها با موفقیت دریافت شدند')+' · زمان انتشار: '+h(time);
    }
    async function refresh(){
      var status=root.querySelector('#mzn-market-status'),grid=root.querySelector('#mzn-market-grid');
      if(!status||!grid||!root.isConnected)return;
      status.textContent='در حال دریافت قیمت‌ها...';
      var urls=[
        'https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/latest-toman.json',
        'https://raw.githubusercontent.com/iran-market/iran-market.github.io/main/data/popular.json',
        'https://cdn.jsdelivr.net/gh/iran-market/iran-market.github.io@main/data/latest-toman.json'
      ],lastError=null;
      for(var n=0;n<urls.length;n++){
        try{
          var response=await fetch(urls[n],{cache:'no-store'});
          if(!response.ok)throw new Error('پاسخ سرویس بازار: '+response.status);
          var payload=await response.json(),items=normalizeMarketPayload(payload),bitcoin=await fetchBitcoin(items);
          if(bitcoin)items.push(bitcoin);
          marketCache=items;
          try{localStorage.setItem('mizan-market-cache-v2',JSON.stringify({items:items,publishedAt:payload.meta&&payload.meta.published_at,savedAt:new Date().toISOString()}));}catch(e){}
          renderItems(items,false,(payload.meta&&payload.meta.published_at)||(payload.data&&payload.data.generated_at));
          try{var s=await session();if(s.user)await saveMarketHistory(items,s.user,s.client);}catch(e){console.warn('market history save failed',e);}
          return;
        }catch(e){lastError=e;}
      }
      if(!marketCache){
        try{var cached=JSON.parse(localStorage.getItem('mizan-market-cache-v2')||'null');if(cached&&Array.isArray(cached.items)&&cached.items.length)marketCache=cached.items;}catch(e){}
      }
      if(marketCache&&marketCache.length)renderItems(marketCache,true,null);
      else{status.innerHTML='<span class="mzn-error-dot"></span> دریافت قیمت‌ها ممکن نشد: '+errorMsg(lastError);grid.innerHTML='<div class="mzn-panel">در حال حاضر دادهٔ معتبر بازار در دسترس نیست. اتصال اینترنت را بررسی و دوباره تلاش کن.</div>';}
    }
    root.querySelector('#mzn-market-refresh').onclick=refresh;
    setTimeout(refresh,0);
    marketTimer=setInterval(function(){if(!root.isConnected){clearInterval(marketTimer);marketTimer=null;return;}refresh();},30*60*1000);
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
          return '<div class="mzn-doc-row"><span class="mzn-doc-icon">' + (x.mime_type.indexOf('image/') === 0 ? Icons.image : Icons.fileText) + '</span><div class="mzn-doc-info"><b>' + h(x.file_name) + '</b><small>' + h(x.category) + ' · ' + h(new Date(x.created_at).toLocaleDateString('fa-IR-u-ca-persian',{timeZone:'Asia/Tehran'})) + ' · ' + h((x.file_size / 1024 / 1024).toFixed(2)) + ' MB</small>' + (x.note ? '<small>' + h(x.note) + '</small>' : '') + '</div><div class="mzn-doc-actions"><button type="button" data-open="' + h(x.id) + '" title="مشاهده">' + Icons.externalLink + '</button><button type="button" data-del="' + h(x.id) + '" title="حذف">' + Icons.trash + '</button></div></div>';
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
          return '<div class="mzn-rem-row ' + (x.completed ? 'is-done' : overdue ? 'is-overdue' : '') + '"><div class="mzn-rem-main"><b>' + h(x.title) + '</b><small>' + h(due) + (x.due_at ? ' · ' + h(formatTehranTime(x.due_at)) : '') + ' · ' + h(x.priority) + '</small>' + (x.note ? '<small>' + h(x.note) + '</small>' : '') + '</div><div class="mzn-doc-actions"><button type="button" data-done="' + h(x.id) + '" title="انجام شد">' + Icons.check + '</button><button type="button" data-remove="' + h(x.id) + '" title="حذف">' + Icons.trash + '</button></div></div>';
        }).join('');
        list.querySelectorAll('[data-done]').forEach(function (b) {
          b.onclick = async function () {
            var row = rows.find(function (x) { return x.id === b.dataset.done; });
            if (!row.completed && row.repeat_rule !== 'none' && row.due_at) {
              var parts = tehranDateTimeParts(row.due_at);
              var baseDate = row.due_date || (parts ? parts.year + '-' + parts.month + '-' + parts.day : '');
              var nextDate = shiftGregorianDate(baseDate, row.repeat_rule);
              var nextTime = parts ? parts.hour + ':' + parts.minute : '09:00';
              var nextDueAt = tehranDateTimeToISO(nextDate, nextTime);
              if (!nextDate || !nextDueAt) { notify('زمان تکرار یادآوری معتبر نیست.'); return; }
              var repeatInsert = await s.client.from('mizan_reminders').insert({ user_id: s.user.id, title: row.title, note: row.note, due_at: nextDueAt, due_date: nextDate, priority: row.priority, repeat_rule: row.repeat_rule });
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
        var dueAt = tehranDateTimeToISO(iso, time);
        if (!dueAt) throw new Error('زمان یادآوری معتبر نیست.');
        var ins = await s.client.from('mizan_reminders').insert({
          user_id: s.user.id, title: title, note: root.querySelector('#mzn-rem-note').value.trim(),
          due_date: iso, due_at: dueAt, priority: root.querySelector('#mzn-rem-priority').value,
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
      try {
        var s = await session(); if (!s.user) return;
        var now = Date.now(), from = new Date(now - 30*86400000).toISOString(), to = new Date(now + 60000).toISOString();
        var due = await s.client.from('mizan_reminders').select('id,title,due_at').eq('completed', false).gte('due_at', from).lte('due_at', to);
        if (due.error) throw due.error;
        await Promise.all((due.data || []).map(function (x) { return sendMizanNotification('یادآوری میزان', x.title, 'reminder:'+x.id, 'reminder', {reminder_id:x.id,due_at:x.due_at}); }));
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

  function monthStats(y,m){var data=Store.loadMonth(y,m-1)||{},cfg=Store.loadSettings()||{},s=Payroll.compute(data,cfg)||{};return{sales:num(s.totalSales),expenses:num(s.totalExpenses),commission:num(s.commission),netSalary:num(s.netSalary),hours:num(s.totalHours),workDays:num(s.workDays),gross:num(s.grossSalary)};}
  function prevJMonth(y,m){return m===1?{y:y-1,m:12}:{y:y,m:m-1};}
  function renderMonthlyCompare(){var t=Jalali.today(),p=prevJMonth(t[0],t[1]),a=monthStats(t[0],t[1]),b=monthStats(p.y,p.m),labels=[['حقوق خالص','netSalary'],['فروش','sales'],['هزینه‌ها','expenses'],['پورسانت','commission'],['ساعت کار','hours'],['روز کاری','workDays']],root=el('mzn-page mzn-compare',head('مقایسه ماهانه','عملکرد مالی ماه جاری در برابر ماه گذشته')+'<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>'+h(Jalali.MONTHS[t[1]-1].fa+' '+Jalali.faDigits(t[0]))+'</h3><p>در مقایسه با '+h(Jalali.MONTHS[p.m-1].fa+' '+Jalali.faDigits(p.y))+'</p></div><span class="mzn-pill">ماه به ماه</span></div><div class="mzn-compare-grid">'+labels.map(function(x){var av=a[x[1]],bv=b[x[1]],pct=bv?((av-bv)/bv*100):null,unit=x[1]==='hours'?' ساعت':x[1]==='workDays'?' روز':'',val=x[1]==='hours'||x[1]==='workDays'?num(av).toLocaleString('fa-IR')+unit:money(av),old=x[1]==='hours'||x[1]==='workDays'?num(bv).toLocaleString('fa-IR')+unit:money(bv),w=Math.max(3,Math.min(100,bv?av/Math.max(av,bv)*100:av?100:3));return'<article class="mzn-compare-item"><div class="mzn-compare-title">'+x[0]+'</div><strong>'+val+'</strong><small>ماه قبل: '+old+'</small><div class="mzn-compare-track"><i style="width:'+w+'%"></i></div><span class="mzn-compare-delta">'+(pct===null?'داده‌ای از ماه قبل نیست':(pct>0?'+':'')+pct.toFixed(1).replace('.', '٫')+'٪ نسبت به ماه قبل')+'</span></article>';}).join('')+'</div></div><div class="mzn-panel"><h3>جمع‌بندی</h3><p class="mzn-muted">'+(a.sales>b.sales?'فروش نسبت به ماه قبل بیشتر شده است. ':'فروش نسبت به ماه قبل کمتر یا برابر است. ')+(a.expenses>b.expenses?'هزینه‌ها افزایش داشته‌اند. ':'هزینه‌ها افزایش نداشته‌اند. ')+'مقایسه بر اساس داده‌های ثبت‌شده هر ماه است.</p></div>');return root;}
  function renderBehaviorAlerts(){var t=Jalali.today(),p=prevJMonth(t[0],t[1]),cur=monthStats(t[0],t[1]),old=monthStats(p.y,p.m),elapsed=Math.max(1,t[2]),prevDays=Jalali.daysInMonth(p.y,p.m),baseDays=Math.min(elapsed,prevDays),curExpenseRate=cur.expenses/elapsed,oldExpenseRate=old.expenses/Math.max(1,baseDays),curSalesRate=cur.sales/elapsed,oldSalesRate=old.sales/Math.max(1,baseDays),alerts=[];if(oldExpenseRate>0&&curExpenseRate>oldExpenseRate*1.25)alerts.push({type:'warning',title:'افزایش سرعت هزینه‌کرد',body:'میانگین هزینه روزانه '+Math.round((curExpenseRate/oldExpenseRate-1)*100)+'٪ بیشتر از بازه مشابه ماه قبل است.'});if(oldSalesRate>0&&curSalesRate<oldSalesRate*.75)alerts.push({type:'warning',title:'افت سرعت فروش',body:'میانگین فروش روزانه نسبت به بازه مشابه ماه قبل بیش از ۲۵٪ کاهش داشته است.'});if(cur.expenses>cur.sales&&cur.sales>0)alerts.push({type:'danger',title:'هزینه بیشتر از فروش',body:'هزینه ثبت‌شده این ماه از فروش ثبت‌شده بیشتر است؛ جزئیات ثبت‌ها را بررسی کن.'});if(!alerts.length)alerts.push({type:'success',title:'فعلاً رفتار غیرعادی دیده نشد',body:'با داده‌های ثبت‌شده تا امروز، هشدار مهمی شناسایی نشده است.'});var root=el('mzn-page mzn-behavior',head('هشدار رفتار مالی','بررسی خودکار روند هزینه و درآمد با داده‌های ثبت‌شده')+'<div class="mzn-panel"><div class="mzn-panel-head"><div><h3>وضعیت این ماه</h3><p>مقایسه میانگین روزانه با همین تعداد روز از ماه قبل</p></div><span class="mzn-pill">'+Jalali.faDigits(t[2])+' روز گذشته</span></div>'+alerts.map(function(x){return'<div class="mzn-alert mzn-alert-'+x.type+'"><b>'+x.title+'</b><p>'+x.body+'</p></div>';}).join('')+'</div><div class="mzn-panel"><h3>مبنای تحلیل</h3><p class="mzn-muted">هشدارها از فروش و هزینه‌های ثبت‌شده ساخته می‌شوند؛ اگر داده‌ای ثبت نشده باشد، نتیجه قطعی نیست. این بخش توصیه مالی قطعی ارائه نمی‌کند.</p></div>');return root;}
  function weatherSeason(timezone){try{var parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone||'Asia/Tehran',calendar:'persian',month:'numeric'}).formatToParts(new Date()),part=parts.find(function(x){return x.type==='month';}),m=Number(part&&part.value);return m<=3?'spring':m<=6?'summer':m<=9?'autumn':'winter';}catch(err){return'winter';}}
  function weatherInfo(code){code=Number(code);if(code===0)return{kind:'clear',label:'آسمان صاف',icon:'☀️'};if(code<=2)return{kind:'partly',label:'نیمه‌ابری',icon:'🌤️'};if(code===3)return{kind:'cloudy',label:'ابری',icon:'☁️'};if(code===45||code===48)return{kind:'fog',label:'مه‌آلود',icon:'🌫️'};if(code>=51&&code<=57)return{kind:'rain',label:'نم‌نم باران',icon:'🌦️'};if(code>=61&&code<=67)return{kind:'rain',label:'بارندگی',icon:'🌧️'};if(code>=71&&code<=77)return{kind:'snow',label:'بارش برف',icon:'❄️'};if(code>=80&&code<=82)return{kind:'rain',label:'رگبار',icon:'🌧️'};if(code>=85&&code<=86)return{kind:'snow',label:'بارش برف',icon:'🌨️'};if(code>=95)return{kind:'thunder',label:'رعدوبرق',icon:'⛈️'};return{kind:'cloudy',label:'وضعیت متغیر',icon:'☁️'};}
  function clothingAdvice(temp,feels,wind,rain){var t=Number(feels);if(!Number.isFinite(t))t=Number(temp)||15;var out=[];if(t>=30)out.push('لباس نخی، خنک و رنگ روشن بپوش؛ در آفتاب کلاه و عینک آفتابی همراه داشته باش.');else if(t>=22)out.push('لباس سبک و تنفس‌پذیر مناسب است؛ یک لایه نازک برای فضای خنک همراه داشته باش.');else if(t>=16)out.push('لباس روزمره با یک سویشرت یا ژاکت سبک انتخاب خوبی است.');else if(t>=10)out.push('ژاکت یا کاپشن متوسط و لباس چندلایه بپوش.');else if(t>=5)out.push('کاپشن گرم و لایه میانی مثل پلیور لازم است.');else out.push('پالتو یا کاپشن ضخیم، لایه گرم و پوشش مناسب سر و گردن بپوش.');if(Number(wind)>=25)out.push('باد نسبتاً شدید است؛ لایه رویی بادگیر و شال سبک همراه داشته باش.');if(Number(rain)>=40)out.push('احتمال بارش قابل توجه است؛ چتر یا بارانی و کفش مقاوم به آب بردار.');else if(Number(rain)>=20)out.push('احتمال بارش کم تا متوسط وجود دارد؛ یک چتر کوچک احتیاطاً همراه داشته باش.');if(t>=27&&Number(rain)<20)out.push('آب آشامیدنی همراه داشته باش و در ساعات آفتابی مستقیم کمتر بمان.');return out;}
  function renderWeather(){var root=el('mzn-page mzn-weather',head('آب‌وهوای منطقه','دمای لحظه‌ای، روند ساعتی امروز و پیشنهاد پوشش بر اساس محل فعلی')+'<div class="mzn-panel mzn-weather-panel" id="mzn-weather-card"><div class="mzn-weather-empty"><span>🌤️</span><h3>آب‌وهوای محل فعلی</h3><p>برای دریافت وضعیت دقیق منطقه، اجازه موقعیت مکانی را بده. اطلاعات هواشناسی از Open-Meteo و بدون ذخیره مختصات در میزان دریافت می‌شود.</p><button class="btn btn-primary" id="mzn-weather-locate">تشخیص موقعیت من</button></div></div>');var box=root.querySelector('#mzn-weather-card'),locBtn=root.querySelector('#mzn-weather-locate'),last=null;
    function fetchWeather(lat,lon){last={lat:lat,lon:lon};box.innerHTML='<div class="mzn-weather-loading">در حال دریافت پیش‌بینی منطقه...</div>';var url='https://api.open-meteo.com/v1/forecast?latitude='+encodeURIComponent(lat)+'&longitude='+encodeURIComponent(lon)+'&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m&forecast_days=1&timezone=auto';fetch(url,{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('weather_http_'+r.status);return r.json();}).then(function(d){if(!box.isConnected)return;var c=d.current||{},hourly=d.hourly||{},info=weatherInfo(c.weather_code),today=String(c.time||'').slice(0,10),hours=(hourly.time||[]).map(function(time,i){return{time:time,index:i,hour:Number(String(time).slice(11,13)),temp:Number(hourly.temperature_2m[i]),feels:Number(hourly.apparent_temperature[i]),rain:Number(hourly.precipitation_probability[i]||0),code:Number(hourly.weather_code[i]),wind:Number(hourly.wind_speed_10m[i])};}).filter(function(x){return x.time.slice(0,10)===today&&x.hour>=6&&x.hour<=23;}),nowHour=Number(String(c.time||'').slice(11,13)),next=hours.filter(function(x){return x.hour>=nowHour&&x.hour<=nowHour+3;}),currentHourIndex=(hourly.time||[]).findIndex(function(x){return String(x).slice(0,13)===String(c.time||'').slice(0,13);}),currentRainProb=currentHourIndex>=0?Number(hourly.precipitation_probability[currentHourIndex]||0):0,rainSoon=Math.max(Number(c.precipitation||0)>0?100:0,currentRainProb,next.reduce(function(a,x){return Math.max(a,x.rain);},0)),advice=clothingAdvice(c.temperature_2m,c.apparent_temperature,c.wind_speed_10m,rainSoon),particleCount=info.kind==='snow'?20:info.kind==='rain'||info.kind==='thunder'?16:0,particles=Array.from({length:particleCount},function(_,i){return'<i style="left:'+((i*100/particleCount)+2).toFixed(1)+'%;animation-delay:-'+(i*(info.kind==='snow'?.31:.13)).toFixed(2)+'s"></i>';}).join(''),dayClass=Number(c.is_day)===1?'is-day':'is-night';box.className='mzn-panel mzn-weather-panel weather-'+info.kind+' season-'+weatherSeason(d.timezone)+' '+dayClass;box.innerHTML='<div class="mzn-weather-scene"><div class="mzn-weather-season-layer"></div><div class="mzn-weather-sun"></div><div class="mzn-weather-cloud cloud-one"></div><div class="mzn-weather-cloud cloud-two"></div><div class="mzn-weather-particles">'+particles+'</div><div class="mzn-weather-scene-copy"><span>'+(dayClass==='is-night'&&info.kind==='clear'?'🌙':info.icon)+'</span><b>'+info.label+'</b><small>'+(dayClass==='is-day'?'وضعیت روز':'وضعیت شب')+'</small></div></div><div class="mzn-weather-current"><div><small>دمای همین ساعت</small><strong>'+Math.round(Number(c.temperature_2m))+'°</strong><span>احساس واقعی '+Math.round(Number(c.apparent_temperature))+'°</span></div><div class="mzn-weather-current-meta"><b>'+info.label+'</b><span>رطوبت '+Math.round(Number(c.relative_humidity_2m))+'٪</span><span>باد '+Math.round(Number(c.wind_speed_10m))+' km/h</span><span>احتمال بارش '+Math.round(currentRainProb)+'٪</span><span>بارش فعلی '+Number(c.precipitation||0)+' mm</span></div></div><section class="mzn-weather-hourly"><div class="mzn-weather-section-head"><h3>دمای هوا از صبح تا شب</h3><small>امروز · ساعت محلی منطقه</small></div><div class="mzn-weather-hour-list">'+(hours.length?hours.map(function(x){var wi=weatherInfo(x.code);return'<article class="mzn-weather-hour"><time>'+String(x.hour).padStart(2,'0')+':00</time><span class="mzn-weather-hour-icon">'+wi.icon+'</span><b>'+Math.round(x.temp)+'°</b><small>بارش '+Math.round(x.rain)+'٪</small></article>';}).join(''):'<p class="mzn-muted">اطلاعات ساعتی امروز در دسترس نیست.</p>')+'</div></section><section class="mzn-weather-advice"><div class="mzn-weather-section-head"><h3>چی بپوشم؟</h3><span>پیشنهاد هوشمند پوشش</span></div><div class="mzn-weather-advice-icon">🧥</div><ul>'+advice.map(function(x){return'<li>'+x+'</li>';}).join('')+'</ul><small>بر اساس دمای '+Math.round(Number(c.temperature_2m))+'°، احساس دما، باد و بیشترین احتمال بارش چند ساعت آینده</small></section><div class="mzn-weather-footer"><span>منبع: Open-Meteo · '+new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'})+'</span><button class="btn btn-ghost" id="mzn-weather-refresh">به‌روزرسانی</button></div>';var refresh=box.querySelector('#mzn-weather-refresh');if(refresh)refresh.onclick=function(){if(last)fetchWeather(last.lat,last.lon);};}).catch(function(err){if(!box.isConnected)return;box.className='mzn-panel mzn-weather-panel';box.innerHTML='<div class="mzn-weather-empty"><span>⚠️</span><h3>دریافت اطلاعات هواشناسی انجام نشد</h3><p>اتصال اینترنت یا سرویس هواشناسی را بررسی کن و دوباره تلاش کن.</p><button class="btn btn-primary" id="mzn-weather-retry">تلاش دوباره</button></div>';var retry=box.querySelector('#mzn-weather-retry');if(retry)retry.onclick=function(){if(last)fetchWeather(last.lat,last.lon);};console.warn('Mizan weather error',err);});}
    function locate(){if(!navigator.geolocation){box.innerHTML='<p class="mzn-muted">مرورگر موقعیت مکانی را پشتیبانی نمی‌کند.</p>';return;}box.innerHTML='<p class="mzn-muted">در حال تشخیص موقعیت...</p>';navigator.geolocation.getCurrentPosition(function(pos){fetchWeather(pos.coords.latitude,pos.coords.longitude);},function(err){box.innerHTML='<div class="mzn-weather-empty"><span>📍</span><h3>اجازه موقعیت مکانی داده نشد</h3><p>در تنظیمات Safari دسترسی Location را برای این سایت فعال کن و دوباره تلاش کن.</p><button class="btn btn-primary" id="mzn-weather-again">تلاش دوباره</button></div>';var again=box.querySelector('#mzn-weather-again');if(again)again.onclick=locate;},{enableHighAccuracy:false,timeout:15000,maximumAge:600000});}
    if(locBtn)locBtn.onclick=locate;locate();return root;}
  function installNumericKeypads(){function prepare(input){if(!input||input.dataset.mznNumericReady)return;if(input.type==='number'||input.dataset.numeric==='true'||input.classList.contains('money-input')){input.dataset.mznNumericReady='1';input.setAttribute('inputmode','decimal');input.setAttribute('pattern','[0-9]*');input.setAttribute('lang','en');input.setAttribute('dir','ltr');input.style.textAlign='left';}}document.querySelectorAll('input[type="number"],input[data-numeric="true"],input.money-input').forEach(prepare);new MutationObserver(function(records){records.forEach(function(r){r.addedNodes.forEach(function(n){if(n.nodeType!==1)return;if(n.matches&&n.matches('input'))prepare(n);if(n.querySelectorAll)n.querySelectorAll('input[type="number"],input[data-numeric="true"],input.money-input').forEach(prepare);});});}).observe(document.body,{childList:true,subtree:true});document.addEventListener('focusin',function(ev){prepare(ev.target);});}

  function installSeasonalThemes(){if(window.__mizanSeasonalInstalled)return;window.__mizanSeasonalInstalled=true;function parts(date,zone,opts){var out={};new Intl.DateTimeFormat('en-US',Object.assign({timeZone:zone},opts)).formatToParts(date).forEach(function(p){if(p.type!=='literal')out[p.type]=p.value;});return out;}function apply(){var now=new Date(),g=parts(now,'Asia/Tehran',{year:'numeric',month:'numeric',day:'numeric',hour:'numeric',hourCycle:'h23'}),month=Number(g.month),day=Number(g.day),hour=Number(g.hour),theme='';if(month===12&&((day===24&&hour>=18)||day===25||day===26||(day===27&&hour<18)))theme='christmas';try{var j=parts(now,'Asia/Tehran',{calendar:'persian',year:'numeric',month:'numeric',day:'numeric'});if(Number(j.month)===1&&Number(j.day)>=1&&Number(j.day)<=10)theme='nowruz';}catch(err){}var docs=[document];try{if(window.parent&&window.parent!==window&&window.parent.document!==document)docs.push(window.parent.document);}catch(err){}docs.forEach(function(doc){var root=doc.documentElement;if(!root)return;root.classList.remove('mzn-theme-christmas','mzn-theme-nowruz');if(theme)root.classList.add('mzn-theme-'+theme);var meta=doc.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',theme==='christmas'?'#173b32':theme==='nowruz'?'#2f8058':'#236b4d');});}apply();window.__mizanSeasonalTimer=window.setInterval(apply,60000);}
  function renderMore() {
    var items = [
      ['today', 'امروز و ثبت سریع', Icons.home, 'ساعت کار، فروش و ثبت روزانه'],
      ['months', 'ماه‌ها و گزارش حقوق', Icons.grid, 'گزارش ماهانه و سوابق'],
      ['reminders', 'یادآوری‌های قبلی', Icons.bell, 'یادآورهای فعلی سایت'],
      ['reminders-db', 'یادآور هوشمند مالی', Icons.bellRing, 'سررسیدهای ابری و اعلان‌ها'],
      ['calendar', 'تقویم مالی شمسی', Icons.calendar, 'نمایش تمام سررسیدها'],
      ['compare', 'مقایسه ماهانه', Icons.activity, 'مقایسه درآمد، هزینه و عملکرد ماه‌ها'],
      ['behavior', 'هشدار رفتار مالی', Icons.alert, 'تشخیص تغییرات غیرعادی درآمد و هزینه'],
      ['weather', 'آب‌وهوای منطقه', Icons.cloud, 'آب‌وهوای محل فعلی با اجازه موقعیت مکانی'],
      ['records', 'سوابق', Icons.activity, 'تاریخچه ثبت‌ها'],
      ['achievements', 'دستاوردها و اهداف', Icons.target, 'پیشرفت هدف و تبریک تکمیل'],
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


  function installMotionStyles() {
    var css = '.global-nav.nav-tabs{isolation:isolate}.global-nav .nav-tab{position:relative!important;overflow:hidden!important;transition:transform .24s cubic-bezier(.2,.75,.25,1),color .24s ease,background .24s ease,box-shadow .24s ease!important}.global-nav .nav-tab:active{transform:scale(.93)!important}.global-nav .nav-tab.active{transform:translateY(-2px)!important;box-shadow:0 8px 22px rgba(35,107,77,.25),inset 0 1px 0 rgba(255,255,255,.28)!important}.global-nav .nav-tab.active:after{content:"";position:absolute;bottom:3px;left:50%;width:15px;height:2px;border-radius:3px;background:rgba(255,255,255,.9);transform:translateX(-50%);animation:mznNavLine .3s ease both}.global-nav .nav-tab svg{transition:transform .28s cubic-bezier(.2,.8,.2,1)!important}.global-nav .nav-tab.active svg{transform:translateY(-1px) scale(1.08)}@keyframes mznNavLine{from{width:0;opacity:0}to{width:15px;opacity:1}}';
    css += 'html.mzn-theme-christmas body{background:radial-gradient(ellipse at 10% 0%,rgba(190,52,58,.16),transparent 34%),radial-gradient(ellipse at 90% 100%,rgba(43,119,82,.22),transparent 38%),var(--bg)!important}html.mzn-theme-christmas .mzn-page .mzn-panel,html.mzn-theme-christmas .fin-card{border-color:rgba(180,65,70,.28)!important}html.mzn-theme-christmas .global-nav .nav-tab.active{background:linear-gradient(135deg,#9e303d,#2d7652)!important}html.mzn-theme-nowruz body{background:radial-gradient(ellipse at 15% 0%,rgba(72,165,111,.2),transparent 34%),radial-gradient(ellipse at 90% 100%,rgba(231,193,107,.16),transparent 36%),var(--bg)!important}html.mzn-theme-nowruz .mzn-page .mzn-panel,html.mzn-theme-nowruz .fin-card{border-color:rgba(81,151,102,.3)!important}html.mzn-theme-nowruz .global-nav .nav-tab.active{background:linear-gradient(135deg,#287b55,#a6bb76)!important}@keyframes mznSeasonSnow{from{background-position:0 -20px,23px 17px}to{background-position:0 400px,23px 437px}}html.mzn-theme-christmas body:before{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147482000;opacity:.2;background-image:radial-gradient(circle,#fff 1px,transparent 2px),radial-gradient(circle,#d6ead9 1px,transparent 2px);background-size:47px 53px,71px 83px;background-position:0 0,23px 37px;animation:mznSeasonSnow 18s linear infinite}html.mzn-theme-nowruz .mzn-page .mzn-panel-head h3:after{content:" ✿";color:#58a76f}@media(prefers-reduced-motion:reduce){html.mzn-theme-christmas body:before{animation:none!important}}.mzn-page,.fin-wrap{animation:mznPageIn .42s cubic-bezier(.2,.75,.25,1) both}.mzn-panel,.mzn-card,.mzn-hero-balance,.mzn-week-col,.mzn-list-row,.fin-inbox-item,.fin-card,.fin-row{animation:mznCardIn .48s cubic-bezier(.2,.75,.25,1) both}.mzn-panel:nth-child(2){animation-delay:.035s}.mzn-panel:nth-child(3){animation-delay:.07s}.mzn-panel:nth-child(4){animation-delay:.105s}.mzn-daily-quote{display:inline-block;margin-top:8px!important;padding:7px 11px;border:1px solid var(--bd);border-radius:12px;background:linear-gradient(110deg,var(--surf2),var(--surf));color:var(--pri)!important;font-weight:650;animation:mznQuoteIn .65s ease both}.mzn-page button,.fin-wrap button{transition:transform .22s cubic-bezier(.2,.75,.25,1),box-shadow .22s ease,background-color .22s ease,border-color .22s ease}.mzn-page button:active,.fin-wrap button:active{transform:scale(.96)}.mzn-page .btn:hover,.fin-wrap .btn:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(30,75,48,.13)}@keyframes mznPageIn{from{opacity:0;transform:translateY(12px) scale(.992);filter:blur(3px)}to{opacity:1;transform:translateY(0) scale(1);filter:blur(0)}}@keyframes mznCardIn{from{opacity:0;transform:translateY(13px)}to{opacity:1;transform:translateY(0)}}@keyframes mznQuoteIn{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.mzn-page,.mzn-panel,.mzn-card,.mzn-hero-balance,.mzn-week-col,.mzn-list-row,.mzn-daily-quote{animation:none!important}.mzn-page button,.fin-wrap button{transition:none!important}}';
    function addStyle(target, id) { if (!target || target.getElementById(id)) return; var style = target.createElement('style'); style.id = id; style.textContent = css; target.head.appendChild(style); }
    var parentDoc = document;
    try { if (window.parent && window.parent !== window) parentDoc = window.parent.document; } catch (e) {}
    addStyle(parentDoc, 'mizan-motion-parent-style');
    if (parentDoc !== document) addStyle(document, 'mizan-motion-iframe-style');
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

  var globalFinanceTimer=null;
  function tehranJalaliNow(){var parts=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(new Date()),o={};parts.forEach(function(p){if(p.type!=='literal')o[p.type]=Number(p.value);});return{year:o.year,month:o.month,day:o.day};}
  function monthKey(y,m){return String(y)+'-'+String(m).padStart(2,'0');}
  async function sendMizanNotification(title,body,eventKey,type,metadata){
    try{var s=await session();if(!s.user)return false;var row={user_id:s.user.id,title:title,body:body,notification_type:type||'general',event_key:eventKey,metadata:metadata||{}};
      var saved=await s.client.from('mizan_notifications').upsert(row,{onConflict:'user_id,event_key',ignoreDuplicates:true}).select('id');if(saved.error)throw saved.error;
      var created=!!(saved.data&&saved.data.length),osKey='mizan-os-notified:'+eventKey,alreadyShown=false;try{alreadyShown=localStorage.getItem(osKey)==='1';}catch(e){}
      if(window.Notification&&Notification.permission==='granted'&&!alreadyShown){var opts={body:body,tag:eventKey,icon:'./icon.svg',badge:'./icon.svg',data:{url:'./'}};
        if(navigator.serviceWorker&&navigator.serviceWorker.ready){navigator.serviceWorker.ready.then(function(reg){return reg.showNotification(title,opts);}).catch(function(){try{new Notification(title,opts);}catch(e){}});}else{try{new Notification(title,opts);}catch(e){}}
        try{localStorage.setItem(osKey,'1');}catch(e){}
      }return true;
    }catch(e){console.warn('Persist notification failed',e);return false;}
  }
  function monthlyReport(y,m){
    var rows=(Records.getAll()||[]).filter(function(r){return Number(r.year)===Number(y)&&Number(r.mi)===Number(m);}),t={sales:0,hours:0,commission:0,workDays:0,expenses:0,noMissing:false};
    rows.forEach(function(r){var s=r.stats||{};t.sales+=Number(s.totalSales)||0;t.hours+=Number(s.totalHours)||0;t.commission+=Number(s.commission)||0;t.workDays+=Number(s.workDays)||0;t.expenses+=Number(s.totalExpenses)||0;});
    t.noMissing=rows.length>0&&t.workDays>0&&rows.every(function(r){try{return Payroll.missingDays(r.data,r.year,r.mi).length===0;}catch(e){return false;}});
    var done=[];if(t.sales>=100000000)done.push('فروش ۱۰۰ میلیون');if(t.sales>=200000000)done.push('فروش ۲۰۰ میلیون');if(t.hours>=310)done.push('۳۱۰ ساعت کار');if(t.commission>=3000000)done.push('پورسانت ۳ میلیون');if(t.workDays>=26)done.push('۲۶ روز کاری');if(t.noMissing)done.push('حضور کامل');if(t.sales>=50000000&&t.workDays>=20)done.push('فروش مستمر');if(t.sales>=50000000&&t.expenses>0&&t.expenses<=t.sales*.30)done.push('مدیریت هزینه');
    return{totals:t,reached:done};
  }
  async function checkMonthlyClose(){
    try{var now=tehranJalaliNow(),current=monthKey(now.year,now.month),stored=localStorage.getItem('mizan-current-jalali-month');
      if(!stored)localStorage.setItem('mizan-current-jalali-month',current);
      else if(stored!==current){localStorage.setItem('mizan-pending-month-close',stored);localStorage.setItem('mizan-current-jalali-month',current);}
      var clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date()),hh=0;
      clock.forEach(function(p){if(p.type==='hour')hh=Number(p.value);});
      if(now.day===Jalali.daysInMonth(now.year,now.month)&&hh===23)localStorage.setItem('mizan-pending-month-close',current);
      var pending=localStorage.getItem('mizan-pending-month-close');if(!pending)return;
      var b=pending.split('-'),y=Number(b[0]),m=Number(b[1]);if(!y||!m)return;
      var r=monthlyReport(y,m),name=(Jalali.MONTHS[m-1]&&Jalali.MONTHS[m-1].fa)||'این ماه';
      var body=r.reached.length?'به این هدف‌ها رسیدی: '+r.reached.join('، ')+'؛ فروش '+money(r.totals.sales)+'، کارکرد '+r.totals.hours.toLocaleString('fa-IR')+' ساعت.':'این ماه هنوز به هدف‌های تعیین‌شده نرسیدی؛ ماه بعد دوباره شروع می‌کنیم.';
      if(await sendMizanNotification('پرونده حقوقی '+name+' بسته شد',body,'month-close:'+pending,'month_close',{month:pending,totals:r.totals,reached:r.reached}))localStorage.removeItem('mizan-pending-month-close');
    }catch(e){console.warn('Monthly close notification failed',e);}
  }
  async function checkGlobalFinanceDue(){
    try{var s=await session();if(!s.user)return;var j=tehranJalaliNow(),jdate=Jalali.faDigits(Jalali.fmt(j.year,j.month,j.day)),todayISO=jToISO(jdate),fromISO=jToISO(jAddDays(jdate,-7));
      var q=await Promise.all([s.client.from('installments').select('id,plan_id,installment_number,amount,paid_amount,due_date').gte('due_date',fromISO).lte('due_date',todayISO),s.client.from('installment_plans').select('id,title'),s.client.from('personal_debt').select('id,creditor_name,amount,paid_amount,due_date').gte('due_date',fromISO).lte('due_date',todayISO)]);
      q.forEach(function(x){if(x.error)throw x.error;});var now=Date.now(),tasks=[];
      (q[0].data||[]).forEach(function(x){if(!x.due_date||num(x.paid_amount)>=num(x.amount))return;var due=new Date(String(x.due_date)+'T09:00:00+03:30').getTime(),age=now-due;if(age<0||age>=7*86400000)return;var p=(q[1].data||[]).find(function(v){return v.id===x.plan_id;});tasks.push(sendMizanNotification('سررسید قسط '+x.installment_number+' · '+(p&&p.title||'برنامه اقساط'),'مانده قسط: '+money(Math.max(0,num(x.amount)-num(x.paid_amount))),'installment:'+x.id+':'+x.due_date,'installment',{installment_id:x.id,due_date:x.due_date,amount:x.amount,paid_amount:x.paid_amount}));});
      (q[2].data||[]).forEach(function(x){if(!x.due_date||num(x.paid_amount)>=num(x.amount))return;var due=new Date(String(x.due_date)+'T09:00:00+03:30').getTime(),age=now-due;if(age<0||age>=7*86400000)return;tasks.push(sendMizanNotification('سررسید بدهی · '+(x.creditor_name||'بدهی ثبت‌شده'),'مانده بدهی: '+money(Math.max(0,num(x.amount)-num(x.paid_amount))),'debt:'+x.id+':'+x.due_date,'debt',{debt_id:x.id,due_date:x.due_date,amount:x.amount,paid_amount:x.paid_amount}));});
      await Promise.all(tasks);
    }catch(e){console.warn('Global finance due check failed',e);}
  }
  function installMizanSchedulers(){
    checkMonthlyClose();checkGlobalFinanceDue();if(globalFinanceTimer)clearInterval(globalFinanceTimer);
    globalFinanceTimer=setInterval(function(){checkGlobalFinanceDue();checkMonthlyClose();},60000);
    document.addEventListener('visibilitychange',function(){if(!document.hidden){checkGlobalFinanceDue();checkMonthlyClose();}});
    setInterval(function(){try{var r=Achievements.checkAll();if(r.newOnes&&r.newOnes.length&&window.Toast)Toast.success('هدف ماهانه تکمیل شد: '+r.newOnes.map(function(x){return x.title;}).join('، '));}catch(e){}},60000);
  }

  window.MizanEnhancements = {
    dashboard: renderDashboard,
    market: renderMarket,
    documents: renderDocuments,
    reminders: renderReminders,
    calendar: renderCalendar,
    more: renderMore,
    compare: renderMonthlyCompare,
    behavior: renderBehaviorAlerts,
    weather: renderWeather,
    syncGoals: syncAllGoals
  };
  installGoalSync();
  installMotionStyles();
  installSeasonalThemes();
  installNumericKeypads();
  installNavigation();
  document.addEventListener('DOMContentLoaded', function () { setTimeout(syncAllGoals, 1800); installMizanSchedulers(); });
  document.addEventListener('click', function (e) {
    var nav = e.target && e.target.closest ? e.target.closest('.global-nav') : null;
    if (nav) nav.dataset.theme = Store.getTheme() || 'light';
  });
})();