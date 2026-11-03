/* Ivory Study study app: hash router, study guides, practice tests, resources, help chat. */
(function(){
  var $ = function(sel, el){ return (el||document).querySelector(sel); };
  var app = document.getElementById('app');
  var CONTACT = 'aishaawadir@gmail.com';

  /* ---------- storage ---------- */
  var store = {
    get: function(k, d){ try { var v = localStorage.getItem('lsl_'+k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
    set: function(k, v){ try { localStorage.setItem('lsl_'+k, JSON.stringify(v)); } catch(e){} }
  };
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function subj(id){ for (var i=0;i<SUBJECTS.length;i++) if (SUBJECTS[i].id===id) return SUBJECTS[i]; return null; }
  function topicOf(s, tid){ for (var i=0;i<s.topics.length;i++) if (s.topics[i].id===tid) return [s.topics[i], i]; return [null,-1]; }
  function doneSet(){ return store.get('done', {}); }
  var ICONS = {
    math:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="4" y="2.5" width="16" height="19" rx="3"/><rect x="7.5" y="6" width="9" height="3.6" rx="1"/><circle cx="8.6" cy="13.6" r=".95" fill="currentColor" stroke="none"/><circle cx="12" cy="13.6" r=".95" fill="currentColor" stroke="none"/><circle cx="15.4" cy="13.6" r=".95" fill="currentColor" stroke="none"/><circle cx="8.6" cy="17.6" r=".95" fill="currentColor" stroke="none"/><circle cx="12" cy="17.6" r=".95" fill="currentColor" stroke="none"/><circle cx="15.4" cy="17.6" r=".95" fill="currentColor" stroke="none"/></svg>',
    rla:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.6C10.5 5.1 8.5 4.4 4 4.4v13.3c4.5 0 6.5.7 8 2.2 1.5-1.5 3.5-2.2 8-2.2V4.4c-4.5 0-6.5.7-8 2.2z"/><path d="M12 6.6v13.3"/></svg>',
    science:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.4 3h5.2"/><path d="M10.6 3v6.3L5.4 18a2 2 0 0 0 1.7 3h9.8a2 2 0 0 0 1.7-3l-5.2-8.7V3"/><path d="M7.7 14.6h8.6"/></svg>',
    social:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.6 12 4l9 5.6"/><path d="M5.6 9.6V18M9.9 9.6V18M14.1 9.6V18M18.4 9.6V18"/><path d="M3 21h18"/></svg>'
  };
  function ring(pct, label){ var p = Math.max(0, Math.min(100, Math.round(pct||0))); return '<span class="sring" data-ring="'+p+'" style="--p:0" role="img" aria-label="'+label+' '+p+' percent"><i>0%</i></span>'; }

  /* ---------- animate rings and bars when they scroll into view ---------- */
  function animateTo(el, to, ms, apply){
    if (REDUCED || ms <= 0) { apply(to); return; }
    if (document.hidden) {           /* rAF is paused in a background tab: wait, do not snap */
      apply(0);
      document.addEventListener('visibilitychange', function once(){
        document.removeEventListener('visibilitychange', once);
        if (document.contains(el)) animateTo(el, to, ms, apply);
      });
      return;
    }
    var t0 = null, done = false;
    function step(ts){
      if (t0 === null) t0 = ts;
      var x = Math.min(1, (ts - t0) / ms);
      apply(to * (1 - Math.pow(1 - x, 3)));
      if (x >= 1) { done = true; return; }
      if (document.contains(el)) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    setTimeout(function(){ if (!done && document.contains(el)) apply(to); }, ms + 700);
  }
  var ringObserver = ('IntersectionObserver' in window) ? new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (!e.isIntersecting) return;
      var el = e.target; ringObserver.unobserve(el); el.dataset.played = '1';
      if (el.hasAttribute('data-ring')) {
        var target = +el.dataset.ring, out = el.querySelector('i') || el.querySelector('div');
        animateTo(el, target, 900, function(v){
          el.style.setProperty('--p', v.toFixed(1));
          if (out) { var txt = Math.round(v) + '%'; if (out.firstChild && out.firstChild.nodeType === 3) out.firstChild.nodeValue = txt; else out.textContent = txt; }
        });
      } else if (el.hasAttribute('data-bar')) {
        animateTo(el, +el.dataset.bar, 800, function(v){ el.style.width = v.toFixed(1) + '%'; });
      }
    });
  }, {threshold:.35, rootMargin:'0px 0px -40px 0px'}) : null;
  function scanAnimated(){
    if (!ringObserver) return;
    document.querySelectorAll('[data-ring]:not([data-played]),[data-bar]:not([data-played])').forEach(function(el){ ringObserver.observe(el); });
  }
  if (window.MutationObserver) {
    var mo = new MutationObserver(function(){ scanAnimated(); });
    mo.observe(app, {childList:true, subtree:true});
  }

  /* ---------- test-date countdown ---------- */
  function countdownHTML(){
    var plan = store.get('plan', null);
    if (!plan || !plan.date) return '<a class="countdown empty" href="#/plan"><span class="cd-label">No test date yet</span><span class="cd-sub">Pick one and get a week-by-week plan →</span></a>';
    var d = new Date(plan.date + 'T12:00:00');
    var days = Math.ceil((d - new Date()) / 86400000);
    var pretty = d.toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'});
    if (days < 0) return '<a class="countdown past" href="#/plan"><span class="cd-label">Your test date has passed</span><span class="cd-sub">Set a new one →</span></a>';
    if (days === 0) return '<a class="countdown today" href="#/testday"><span class="cd-label">Test day is today</span><span class="cd-sub">Read the test day checklist →</span></a>';
    return '<a class="countdown" href="#/plan"><span class="cd-num" data-count="'+days+'">0</span><span class="cd-text"><b>day'+(days===1?'':'s')+' until your test</b><span class="cd-sub">'+pretty+' · open your plan →</span></span></a>';
  }
  function startCountdown(){
    var el = $('.cd-num'); if (!el) return;
    var n = +el.dataset.count;
    if (REDUCED) { el.textContent = n; return; }
    animateTo(el, n, 1100, function(v){ el.textContent = Math.round(v); });
  }

  /* ---------- confetti ---------- */
  function confetti(){
    if (REDUCED) return;
    var cv = document.createElement('canvas');
    cv.className = 'confetti-cv'; document.body.appendChild(cv);
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = innerWidth || document.documentElement.clientWidth || 360;
    var H = innerHeight || document.documentElement.clientHeight || 640;
    function size(){ W = innerWidth || W; H = innerHeight || H; cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W+'px'; cv.style.height = H+'px'; ctx && ctx.setTransform(dpr,0,0,dpr,0,0); }
    var ctx = null; size(); ctx = cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0);
    window.addEventListener('resize', size);
    var colors = ['#D4607C','#E9CDB0','#7FA68F','#FBE3E9','#F0A0B5','#FFFFFF'];
    var bits = [], N = 110;
    for (var i = 0; i < N; i++) bits.push({
      x: W * (0.2 + Math.random() * 0.6), y: -20 - Math.random() * H * 0.4,
      w: 6 + Math.random() * 7, h: 9 + Math.random() * 10,
      vx: (Math.random() - 0.5) * 2.4, vy: 2 + Math.random() * 3.2,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.22,
      c: colors[(Math.random() * colors.length) | 0], sway: Math.random() * Math.PI * 2
    });
    var t0 = performance.now();
    function frame(ts){
      var age = ts - t0;
      if (age > 4200 || !document.body.contains(cv)) { window.removeEventListener('resize', size); cv.remove(); return; }
      var fade = age > 3000 ? Math.max(0, 1 - (age - 3000) / 1200) : 1;
      ctx.clearRect(0, 0, W, H);
      ctx.globalAlpha = fade;
      bits.forEach(function(b){
        b.sway += 0.03; b.x += b.vx + Math.sin(b.sway) * 0.7; b.y += b.vy; b.vy += 0.045; b.rot += b.vr;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        ctx.fillStyle = b.c; ctx.fillRect(-b.w/2, -b.h/2, b.w, b.h); ctx.restore();
      });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    setTimeout(function(){ window.removeEventListener('resize', size); if (cv.parentNode) cv.remove(); }, 4600);
  }
  function subjectCard(o){
    return '<a class="subject '+o.cls+'" href="'+o.href+'">' +
      '<div class="sub-top"><span class="sub-icon">'+(ICONS[o.icon]||'')+'</span>'+ring(o.pct, o.ringLabel||'progress')+'</div>' +
      '<h3>'+o.title+'</h3>' +
      '<div class="meta">'+(o.meta||[]).map(function(m){ return '<span>'+m+'</span>'; }).join('')+'</div>' +
      '<p>'+o.body+'</p>' +
      '<div class="sub-foot"><span class="sub-big"><b>'+o.bigN+'</b><span>'+o.bigLabel+'</span></span><span class="sub-go">'+o.go+' →</span></div></a>';
  }
  window.LSL = {$:$, app:app, store:store, esc:esc, subj:subj, topicOf:topicOf, doneSet:doneSet, attempts:function(){ return store.get('attempts', []); }, subjectCard:subjectCard, ring:ring, ICONS:ICONS};

  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- router ---------- */
  function route(){
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    var page = parts[0] || 'home';
    document.querySelectorAll('.nav-links a').forEach(function(a){
      var key = a.getAttribute('data-route');
      var alias = {cards:'study', formulas:'study', testday:'study', essay:'practice', progress:'progress'};
      a.classList.toggle('active', key === page || key === alias[page]);
    });
    if (quiz.timer) { clearInterval(quiz.timer); quiz.timer = null; }
    if (page === 'home' || page === 'quote') renderHome(page === 'quote');
    else if (page === 'study') { if (parts.length === 1) renderStudy(); else if (parts.length === 2) renderSubject(parts[1]); else renderTopic(parts[1], parts[2]); }
    else if (page === 'practice') { if (parts.length === 1) renderPractice(); else renderQuizSetup(parts[1]); }
    else if (page === 'resources') renderResources();
    else if (page === 'help') renderHelp();
    else if (window.EXTRA && window.EXTRA[page]) window.EXTRA[page](parts.slice(1));
    else renderHome(false);
    if (page !== 'quote') window.scrollTo(0,0);
  }
  window.addEventListener('hashchange', route);

  /* ---------- home ---------- */
  function renderHome(scrollQuote){
    app.innerHTML = [
    '<section class="hero wrap">',
      '<div>',
        '<span class="eyebrow">GED® tutoring and free study tools · Minneapolis</span>',
        '<h1>Your GED, <em>one calm step at a time.</em></h1>',
        '<p class="lede">Free study guides, practice tests, and the resources that actually helped me pass, plus one-on-one tutoring for adults in Minneapolis and St. Paul when you want someone beside you.</p>',
        '<div class="hero-actions"><a class="btn btn-primary" href="#/study">Start studying free</a><a class="btn btn-ghost" href="#/quote">Get a tutoring quote</a></div>',
        countdownHTML(),
        '<div class="tiny-facts"><span>No account needed</span><span>Progress saved on this device</span><span>First 30 minutes of tutoring free</span></div>',
      '</div>',
      '<div class="stage-wrap"><div class="stage" id="stage" aria-hidden="true"><div class="ring" id="ring"></div></div><div class="stage-cap"><span class="stage-week" id="stage-week">Week 1</span><span class="stage-line" id="stage-line">Three practice tests. All under 145.</span><button class="btn-text stage-replay" id="stage-replay" hidden>Replay ↻</button></div></div>',
    '</section>',
    '<section class="wrap" style="padding-top:0">',
      '<div class="feature-grid">',
        feature('#/study','Study guides','Learn the skills','Plain-language lessons for all four subjects, each with a worked example and a problem to try.','Open the guides'),
        feature('#/practice','Practice tests','Check yourself','Timed or untimed quizzes with instant scoring, explanations for every answer, and a skill breakdown.','Take a practice test'),
        feature('#/resources','Resources','The short list','The free videos, tests, and local classes that actually helped, with notes on what to watch out for.','See the list'),
        feature('#/help','Need help?','Ask anything','Quick answers about the test, registration, and where to start, or send a question straight to Aisha.','Open the chat'),
        feature('#/plan','Study plan','Know what to do this week','Four questions in, a week-by-week plan out: which lessons, cards, and quizzes, until your test date.','Build a plan'),
        feature('#/essay','Essay workspace','Write the real thing','Two passages, a 45-minute timer, a place to write, and a self-score against the graders’ rubric.','Practice the essay'),
        feature('#/cards','Flashcards','Ten minutes on the bus','Formulas, grammar rules, and facts, one card at a time. Misses come back more often.','Open a deck'),
        feature('#/progress','Progress','See where you stand','Lessons done, practice averages, cards mastered, and a readiness read for each subject.','Check progress'),
      '</div>',
    '</section>',
    window.RESULTS_HTML || '',
    servicesHTML(),
    howHTML(),
    aboutHTML(),
    quoteHTML()
    ].join('');
    bindQuote();
    startCountdown();
    initStage();
    if (scrollQuote) { var q = $('#quote'); if (q) q.scrollIntoView(); }
  }

  /* ---------- 3D opening: papers circle, settle, flip ---------- */
  var stageRun = 0;
  function initStage(){
    var stage = $('#stage'), ring = $('#ring'); if (!stage || !ring) return;
    var tmp = document.createElement('div'); tmp.innerHTML = window.RESULTS_HTML || '';
    var svgs = [].map.call(tmp.querySelectorAll('.ba-photo svg'), function(x){ return x.outerHTML; });
    if (svgs.length < 6) { stage.parentNode.innerHTML = '<div class="sign"><h2>Ivory Study</h2><p>GED prep from someone who has sat in your seat.</p></div>'; return; }
    var pairs = [[svgs[0],svgs[1],'Math','132','152','Passed'],[svgs[2],svgs[3],'Science + Social','141','166','College Ready'],[svgs[4],svgs[5],'Language Arts','139','158','Passed']];
    ring.innerHTML = pairs.map(function(pr,i){ return '<div class="pcard" data-i="'+i+'"><div class="face front">'+pr[0]+'<span class="ptag">Before</span></div><div class="face back">'+pr[1]+'<span class="ptag after">After</span><span class="pscore">'+pr[3]+' → '+pr[4]+'<small>'+pr[5]+'</small></span></div></div>'; }).join('');
    var cards = [].slice.call(ring.children);
    var week = $('#stage-week'), line = $('#stage-line'), replay = $('#stage-replay');
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var run = ++stageRun;
    function fanPos(i){ return 'translateX(calc(('+(i-1)+') * var(--fan))) rotate('+((i-1)*5)+'deg)'; }
    function finalState(){ cards.forEach(function(c,i){ c.classList.add('settle','flip'); c.style.transform = fanPos(i)+' rotateY(180deg)'; }); week.textContent = 'Week 10'; line.textContent = 'Math 132 → 152 · Science 141 → 166 · Language Arts 139 → 158'; replay.hidden = false; }
    function startDrift(cards, ring, stage){
      if (REDUCED) return;
      cards.forEach(function(c,i){ c.style.setProperty('--dur', (5.5 + i*1.3).toFixed(1)+'s'); c.style.setProperty('--delay', (i*0.7).toFixed(1)+'s'); c.classList.add('drift'); });
      var wrap = stage.parentNode, tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
      function loop(){
        cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
        ring.style.transform = 'rotateX('+cy.toFixed(2)+'deg) rotateY('+cx.toFixed(2)+'deg)';
        if (Math.abs(tx-cx) > 0.05 || Math.abs(ty-cy) > 0.05) raf = requestAnimationFrame(loop); else raf = null;
      }
      function onMove(e){
        if (!document.contains(stage)) { window.removeEventListener('pointermove', onMove); window.removeEventListener('scroll', onScroll); return; }
        var r = stage.getBoundingClientRect();
        tx = ((e.clientX - (r.left + r.width/2)) / r.width) * 16;
        ty = -((e.clientY - (r.top + r.height/2)) / r.height) * 12;
        if (!raf) raf = requestAnimationFrame(loop);
      }
      function onScroll(){
        if (!document.contains(stage)) { window.removeEventListener('scroll', onScroll); window.removeEventListener('pointermove', onMove); return; }
        var off = Math.max(-26, Math.min(26, window.scrollY * -0.05));
        wrap.style.setProperty('--drift-y', off.toFixed(1)+'px');
      }
      window.addEventListener('pointermove', onMove, {passive:true});
      window.addEventListener('scroll', onScroll, {passive:true});
      onScroll();
    }
    if (reduced) { finalState(); return; }
    cards.forEach(function(c){ c.classList.remove('settle','flip'); c.style.transform = ''; });
    replay.hidden = true; week.textContent = 'Week 1'; line.textContent = 'Three practice tests. All under 145.';
    var T = 4200, turns = 2.4, t0 = null;
    function ease(x){ return 1 - Math.pow(1 - x, 3); }
    function frame(ts){
      if (run !== stageRun || !document.body.contains(ring)) return;
      if (t0 === null) t0 = ts;
      var x = Math.min(1, (ts - t0) / T), a = turns * 360 * ease(x);
      cards.forEach(function(c,i){ var deg = a + i*120; c.style.transform = 'rotateY('+deg+'deg) translateZ(var(--orbit)) rotateY('+(-deg)+'deg)'; });
      if (x < 1) requestAnimationFrame(frame);
    }
    var start = Date.now();
    function at(ms, fn){ setTimeout(function(){ if (run === stageRun && document.body.contains(ring)) fn(); }, ms); }
    at(T + 300, function(){ week.textContent = 'Week 2'; line.textContent = 'One week of focused practice. Same three students.'; cards.forEach(function(c,i){ c.classList.add('settle'); c.style.transform = fanPos(i); }); });
    [3,5,8,10].forEach(function(wk,k){ at(T + 1700 + k*450, function(){ week.textContent = 'Week '+wk; }); });
    cards.forEach(function(c,i){ at(T + 2300 + i*420, function(){ c.classList.add('flip'); c.style.transform = fanPos(i)+' rotateY(180deg)'; }); });
    at(T + 3900, function(){ line.textContent = 'Math 132 → 152 · Science 141 → 166 · Language Arts 139 → 158'; replay.hidden = false; startDrift(cards, ring, stage); });
    requestAnimationFrame(frame);
    replay.onclick = function(){ initStage(); };
  }
  function feature(href, k, h, p, go){ return '<a class="feature" href="'+href+'"><span class="k">'+k+'</span><h3>'+h+'</h3><p>'+p+'</p><span class="go">'+go+' →</span></a>'; }

  function servicesHTML(){
    var svc = [
      ['GED subject 1 of 4','Mathematical Reasoning','Fractions, percents, algebra, graphs, and the TI-30XS calculator. The subject most people put off, and the one we spend the most time on.','$25','/ hour, from'],
      ['GED subject 2 of 4','Reasoning Through Language Arts','Reading passages, grammar, and the extended response essay. We practice the exact “better supported” essay the test asks for.','$22','/ hour, from'],
      ['GED subject 3 of 4','Science','Life, physical, and earth science through charts and short passages. More about reading data than memorizing facts.','$20','/ hour, from'],
      ['GED subject 4 of 4','Social Studies','Civics, U.S. history, economics, and geography, with a focus on reading documents, maps, and graphs.','$20','/ hour, from'],
      ['En español','GED in Spanish','The GED is offered in Spanish. Prep for any of the four subjects, taught in Spanish, with the Spanish-language formula sheet and vocabulary.','$25','/ hour, from'],
      ['Single session','Test-day prep &amp; registration help','Setting up your GED account, scheduling at a Minneapolis test center or online, what to bring, and a calm plan for the morning of.','$20','/ session, flat']
    ];
    return '<section id="services" class="services"><div class="wrap"><div class="section-head"><div><h2>Tutoring: subjects &amp; starting prices</h2><p>The study tools on this site are free. When you want a person, everyone gets a quote. Price depends on the subject, where you’re starting, and how soon your test date is. The first 30 minutes are always free.</p></div><span class="price-note">From $20 an hour</span></div><div class="svc-grid">' +
      svc.map(function(s){ return '<article class="svc"><span class="grades">'+s[0]+'</span><h3>'+s[1]+'</h3><p>'+s[2]+'</p><div class="price"><strong>'+s[3]+'</strong><span>'+s[4]+'</span></div></article>'; }).join('') +
      '</div><p class="fine">Starting prices are for a 60-minute in-person or online session. Pairs studying the same subject split the hour at 15% off each. Test fees are paid to the testing service separately and are not included.</p></div></section>';
  }
  function howHTML(){
    return '<section id="how" class="wrap"><div class="section-head"><h2>How tutoring works</h2><p>Three steps, and most people start within a week.</p></div><div class="steps">' +
      '<div class="step"><div class="num">1</div><h3>Tell me where you’re starting</h3><p>Never taken a practice test, scored under 145, or retaking one subject. Two minutes with the form below.</p></div>' +
      '<div class="step"><div class="num">2</div><h3>Free 30-minute meet</h3><p>We talk through your schedule and goals, you try a short diagnostic, and I send you a quote and a subject-by-subject plan the same day.</p></div>' +
      '<div class="step"><div class="num">3</div><h3>Study, practice, test</h3><p>Weekly sessions, a short study plan between them, a practice test before each real one, and help booking test day.</p></div>' +
      '</div></section>';
  }
  function aboutHTML(){
    return '<section id="about" class="wrap"><div class="about"><div class="about-card">'+(window.ABOUT_SVG||'')+'</div><div><h2>Hi, I’m Aisha. I passed the GED too.</h2>' +
      '<p>Not long ago I was the one studying for this test, bouncing between websites, apps, and videos until I found the few that actually worked. I started Ivory Study so the next person doesn’t have to search that hard, and so they have someone patient sitting next to them while they do it.</p>' +
      '<p>Sessions are one-on-one unless you bring a study partner. I know the current test from the inside, I use the official practice tests to track your progress, and I build your plan around your actual week, not an ideal one.</p>' +
      '<div class="pills"><span class="pill">Passed the GED myself</span><span class="pill">Knows the current test</span><span class="pill">Minneapolis based</span><span class="pill">Fluent in Spanish</span></div></div></div></section>';
  }
  function quoteHTML(){
    return '<section id="quote" class="wrap"><div class="quote"><div><h2>Get a quote</h2><p class="intro">Tell me where you’re starting and I’ll send a price and a few open times within one business day.</p><ul><li>No commitment, no card needed</li><li>First 30 minutes are free</li><li>Pause anytime for work, family, or life</li></ul></div>' +
      '<form id="quote-form"><div class="row"><label>Your name <input name="parent" type="text" placeholder="Jordan" required></label><label>Email or phone <input name="contact" type="text" placeholder="jordan@email.com" required></label></div>' +
      '<div class="row"><label>Where are you starting?<select name="grade" id="grade" required><option value="">Choose one</option><option value="new">Haven’t taken a practice test yet</option><option value="under">Practice score under 145</option><option value="retake">Retaking one subject</option><option value="college">Passed, aiming for College Ready (165+)</option></select></label>' +
      '<label>Subject<select name="subject" id="subject" required><option value="">Choose a subject</option><option value="math">Mathematical Reasoning</option><option value="rla">Reasoning Through Language Arts</option><option value="science">Science</option><option value="social">Social Studies</option><option value="all">All four subjects</option><option value="spanish">GED in Spanish</option><option value="testday">Test-day prep &amp; registration</option></select></label></div>' +
      '<label>Anything I should know? <textarea name="notes" placeholder="I work nights, so weekday mornings are best. Math is the one I’m dreading."></textarea></label>' +
      '<div class="form-foot"><div class="estimate" id="estimate">Pick a starting point and subject for a starting price</div><button class="btn btn-primary" type="submit">Send my quote request</button></div>' +
      '<small>Submitting opens your email app with your answers filled in, addressed to Aisha. Nothing is stored on this page.</small></form></div></section>';
  }
  function bindQuote(){
    var grade = $('#grade'), subject = $('#subject'), est = $('#estimate'), form = $('#quote-form');
    if (!form) return;
    function price(g, s){
      if (!g || !s) return null;
      var base = {math:25, rla:22, science:20, social:20, spanish:25, testday:20, all:20}[s];
      if (s === 'testday') return '$20 flat for the session';
      if (s === 'all') return 'From $20 / hour, bundle quoted';
      if (g === 'college') base += 3;
      return 'Starting around $' + base + ' / hour';
    }
    function update(){ est.textContent = price(grade.value, subject.value) || 'Pick a starting point and subject for a starting price'; }
    grade.addEventListener('change', update); subject.addEventListener('change', update);
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var d = new FormData(form);
      var gt = grade.options[grade.selectedIndex].text, st = subject.options[subject.selectedIndex].text;
      var body = 'Name: '+d.get('parent')+'\nContact: '+d.get('contact')+'\nStarting point: '+gt+'\nSubject: '+st+'\n\nNotes:\n'+(d.get('notes')||'(not filled in)');
      location.href = 'mailto:'+CONTACT+'?subject='+encodeURIComponent('GED quote request · '+st)+'&body='+encodeURIComponent(body);
      est.textContent = 'Opening your email app…';
    });
  }

  /* ---------- study ---------- */
  function progressFor(s){ var d = doneSet(); var n = 0; s.topics.forEach(function(t){ if (d[s.id+'/'+t.id]) n++; }); return n; }
  function renderStudy(){
    app.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Study guides</span><h1>Pick a subject</h1><p>Each guide walks through the skills on that test in plain language, with a worked example and a problem to try. Check off topics as you go; your progress is saved on this device.</p></div>' +
      '<div class="subject-grid">' + SUBJECTS.map(function(s){
        var n = progressFor(s);
        return subjectCard({cls:s.cls, icon:s.id, href:'#/study/'+s.id, title:s.name, pct:n/s.topics.length*100, ringLabel:'lessons done',
          meta:[s.time, s.items], body:s.overview.split('. ')[0]+'.', bigN:s.topics.length, bigLabel:'lessons · '+n+' done', go:'Open'});
      }).join('') + '</div>' +
      '<div class="tool-row"><a class="tool" href="#/cards"><b>Flashcards</b><span>Terms and formulas, one at a time</span></a><a class="tool" href="#/formulas"><b>Formula sheet</b><span>What you get and what to memorize</span></a><a class="tool" href="#/essay"><b>Essay workspace</b><span>Timed extended response practice</span></a><a class="tool" href="#/testday"><b>Test day</b><span>What to bring, what to expect</span></a></div>' +
      '<div class="card soft" style="margin-top:36px"><h3 style="font-size:1.4rem;margin-bottom:8px">Not sure where to start?</h3><p class="muted">Take a 10-question practice test in each subject first. Then study the subject with the lowest score. Most people start with math, and that is fine too.</p><p style="margin-top:12px"><a class="btn btn-primary btn-sm" href="#/practice">Take a practice test</a></p></div></div>';
  }
  function renderSubject(id){
    var s = subj(id); if (!s) return renderStudy();
    var d = doneSet();
    app.innerHTML = '<div class="wrap '+s.cls+'"><div class="page-head"><div class="crumbs"><span><a href="#/study">Study guides</a></span><span>'+s.name+'</span></div><h1>'+s.name+'</h1><p>'+s.overview+'</p></div>' +
      '<div class="facts">' + s.facts.map(function(f){ return '<div class="fact"><b>'+f[0]+'</b><span>'+f[1]+'</span></div>'; }).join('') + '</div>' +
      '<p class="small muted" style="margin-bottom:14px">'+s.tools+'.</p>' +
      '<div class="topic-list">' + s.topics.map(function(t){
        var done = d[s.id+'/'+t.id];
        return '<a class="topic" href="#/study/'+s.id+'/'+t.id+'"><span class="n"></span><div><h3>'+t.title+'</h3><p>'+t.summary+'</p>'+(done?'<span class="done">✓ Done</span>':'')+'</div><span class="arrow">→</span></a>';
      }).join('') + '</div>' +
      '<div class="lesson-nav"><a class="btn btn-ghost" href="#/study">All subjects</a><a class="btn btn-primary" href="#/practice/'+s.id+'">Practice '+s.short+' →</a></div></div>';
  }
  function renderTopic(sid, tid){
    var s = subj(sid); if (!s) return renderStudy();
    var r = topicOf(s, tid), t = r[0], i = r[1]; if (!t) return renderSubject(sid);
    var prev = s.topics[i-1], next = s.topics[i+1];
    var key = s.id+'/'+t.id, done = !!doneSet()[key];
    app.innerHTML = '<div class="wrap '+s.cls+'"><div class="page-head" style="padding-bottom:10px"><div class="crumbs"><span><a href="#/study">Study guides</a></span><span><a href="#/study/'+s.id+'">'+s.short+'</a></span><span>'+t.title+'</span></div><h1>'+t.title+'</h1><p>'+t.summary+'</p></div>' +
      '<div class="lesson"><div class="lesson-body">' + t.learn.join('') +
        '<div class="example"><div class="lbl">Worked example</div><div class="prob">'+t.example.problem+'</div><ol>'+t.example.steps.map(function(x){return '<li>'+x+'</li>';}).join('')+'</ol><div class="ans">Answer: '+t.example.answer+'</div></div>' +
        '<div class="tryit" id="tryit"><div class="lbl">Try it yourself</div><div class="q">'+t.tryIt.q+'</div><button class="btn btn-ghost btn-sm" id="reveal">Show the answer</button><div class="reveal"><b>'+t.tryIt.answer+'</b><p class="muted" style="margin-top:6px">'+t.tryIt.explain+'</p></div></div>' +
        '<div class="lesson-nav"><label class="mark-done"><input type="checkbox" id="done" '+(done?'checked':'')+'> Mark this topic done</label><div style="display:flex;gap:10px;flex-wrap:wrap">'+(prev?'<a class="btn btn-ghost btn-sm" href="#/study/'+s.id+'/'+prev.id+'">← '+prev.title+'</a>':'')+(next?'<a class="btn btn-primary btn-sm" href="#/study/'+s.id+'/'+next.id+'">'+next.title+' →</a>':'<a class="btn btn-primary btn-sm" href="#/practice/'+s.id+'">Practice '+s.short+' →</a>')+'</div></div>' +
      '</div><aside class="lesson-side"><div class="side-card"><h4>'+s.short+' topics</h4>'+s.topics.map(function(x){ return '<a href="#/study/'+s.id+'/'+x.id+'" class="'+(x.id===t.id?'cur':'')+'">'+x.title+'</a>'; }).join('')+'</div>' +
      '<div class="side-card"><h4>Stuck?</h4><a href="#/help">Ask in the help chat →</a><a href="#/resources">Watch a video on this →</a></div></aside></div></div>';
    $('#reveal').addEventListener('click', function(){ $('#tryit').classList.add('open'); });
    $('#done').addEventListener('change', function(e){ var d = doneSet(); if (e.target.checked) d[key] = Date.now(); else delete d[key]; store.set('done', d); });
  }

  /* ---------- practice ---------- */
  var quiz = {timer:null};
  function attempts(){ return store.get('attempts', []); }
  function renderPractice(){
    var at = attempts().slice().reverse();
    app.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Practice tests</span><h1>Check yourself</h1><p>Original practice questions written in the style of the GED, with an explanation for every answer. Scores are a percentage, not an official GED score. As a rough guide, when you are consistently above 75% here, you are ready to try the official GED Ready practice test.</p></div>' +
      '<div class="subject-grid">' + SUBJECTS.map(function(s){
        var n = QUESTIONS[s.id].length, best = null;
        attempts().forEach(function(a){ if (a.s===s.id && (best===null || a.pct>best)) best = a.pct; });
        return subjectCard({cls:s.cls, icon:s.id, href:'#/practice/'+s.id, title:s.name, pct:best||0, ringLabel:'best score',
          meta:[best!==null?'Best score '+best+'%':'Not attempted yet'], body:s.overview.split('. ')[0]+'.', bigN:n, bigLabel:'questions', go:'Start a '+s.short+' quiz'});
      }).join('') + '</div>' +
      progressPanel(at) +
      (at.length ? '<h2 style="font-size:1.8rem;margin:44px 0 14px">Your recent attempts</h2><div class="history">' + at.slice(0,8).map(function(a){ var s = subj(a.s); return '<div class="hist"><div><b>'+(s?s.name:a.s)+'</b><div class="small muted">'+new Date(a.t).toLocaleDateString()+' · '+a.n+' questions'+(a.timed?' · timed':'')+'</div></div><div class="pct '+(a.pct>=75?'good':a.pct<60?'low':'')+'">'+a.pct+'%</div></div>'; }).join('') + '</div>' : '') +
      '</div>';
  }
  function progressPanel(at){
    var any = at.length > 0;
    return '<section class="pstrip"><div class="pstrip-head"><h2>Your scores</h2><p>' +
      (any ? 'Best score in each subject so far. Averaging 80% or better means it is time for the official GED Ready practice test.'
           : 'Nothing here yet. Take one 10-question quiz in each subject to find your starting point. It takes about 15 minutes and nothing is graded but you.') +
      '</p></div><div class="pstrip-rings">' + SUBJECTS.map(function(s){
        var best = null; at.forEach(function(a){ if (a.s===s.id && (best===null || a.pct>best)) best = a.pct; });
        var n = 0; at.forEach(function(a){ if (a.s===s.id) n++; });
        return '<a class="pring '+s.cls+'" href="#/practice/'+s.id+'">'+ring(best||0, s.short+' best score')+'<b>'+s.short+'</b><span>'+(best===null?'Start here':n+' attempt'+(n===1?'':'s'))+'</span></a>';
      }).join('') + '</div>' + (any ? '' : '<a class="btn btn-primary btn-sm" href="#/practice/math">Start with a math quiz</a>') + '</section>';
  }
  function renderQuizSetup(sid){
    var s = subj(sid); if (!s) return renderPractice();
    var total = QUESTIONS[s.id].length;
    app.innerHTML = '<div class="wrap '+s.cls+'"><div class="page-head" style="padding-bottom:16px"><div class="crumbs"><span><a href="#/practice">Practice tests</a></span><span>'+s.name+'</span></div><h1>'+s.name+' practice</h1><p>'+total+' questions in the bank. Choose how many and whether to use a timer. The timer gives you about the same time per question as the real test.</p></div>' +
      '<div class="setup"><div class="card"><div class="opt-group"><label class="lbl">How many questions</label><div class="chip-row" id="count"><button class="chip on" data-n="10">10 questions</button><button class="chip" data-n="25">25 questions</button><button class="chip" data-n="'+total+'">All '+total+'</button></div></div>' +
      '<div class="opt-group"><label class="lbl">Timer</label><div class="chip-row" id="timed"><button class="chip on" data-t="0">No timer</button><button class="chip" data-t="1">Timed</button></div></div>' +
      '<div class="opt-group"><label class="lbl">Order</label><div class="chip-row" id="shuffle"><button class="chip on" data-s="1">Shuffle</button><button class="chip" data-s="0">In order</button></div></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-primary" id="start">Start the quiz</button><button class="btn btn-ghost" id="mock">Full-length timed mock</button></div></div>' +
      '<div class="card soft"><h3 style="font-size:1.3rem;margin-bottom:10px">Before you start</h3><ul style="margin:0;padding-left:1.1rem;color:var(--ink-soft);display:grid;gap:6px"><li>Have scratch paper. On the real test you get an erasable board.</li><li>Use a calculator for math after question 5, like the real thing.</li><li>Guess if you are unsure. There is no penalty, here or on the GED.</li><li>Read every explanation afterward, especially the ones you got right by luck.</li></ul>' +
      '<p style="margin-top:14px"><a href="#/study/'+s.id+'" class="btn-text">Study '+s.short+' first →</a></p></div></div></div>';
    var opts = {n:10, timed:0, shuffle:1};
    ['count','timed','shuffle'].forEach(function(g){ $('#'+g).addEventListener('click', function(e){ var b = e.target.closest('.chip'); if (!b) return; this.querySelectorAll('.chip').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); if (g==='count') opts.n = +b.dataset.n; if (g==='timed') opts.timed = +b.dataset.t; if (g==='shuffle') opts.shuffle = +b.dataset.s; }); });
    $('#start').addEventListener('click', function(){ startQuiz(s, opts); });
    $('#mock').addEventListener('click', function(){ startQuiz(s, {n:total, timed:1, shuffle:1}); });
  }
  function startQuiz(s, opts){
    var bank = QUESTIONS[s.id].map(function(q,i){ q._i = i; return q; });
    var qs = bank.slice();
    if (opts.shuffle) {
      // keep passage groups together
      var groups = {}, order = [];
      qs.forEach(function(q){ var k = q.p || ('solo'+q._i); if (!groups[k]) { groups[k] = []; order.push(k); } groups[k].push(q); });
      for (var i = order.length-1; i>0; i--) { var j = Math.floor(Math.random()*(i+1)); var t = order[i]; order[i] = order[j]; order[j] = t; }
      qs = []; order.forEach(function(k){ qs = qs.concat(groups[k]); });
    }
    qs = qs.slice(0, opts.n);
    var perQ = {math:150, rla:100, science:160, social:120}[s.id] || 120;
    quiz.state = {s:s, qs:qs, i:0, ans:{}, flags:{}, timed:opts.timed, left:perQ*qs.length, started:Date.now()};
    if (opts.timed) quiz.timer = setInterval(function(){ var st = quiz.state; if (!st) return; st.left--; var el = $('#timer'); if (el) { el.textContent = fmt(st.left); el.classList.toggle('warn', st.left < 120); } if (st.left <= 0) finishQuiz(); }, 1000);
    renderQuestion();
  }
  function fmt(sec){ var m = Math.floor(sec/60), s = sec%60; return m+':'+(s<10?'0':'')+s; }
  function renderQuestion(){
    var st = quiz.state, s = st.s, q = st.qs[st.i], n = st.qs.length;
    var answered = Object.keys(st.ans).length;
    app.innerHTML = '<div class="wrap '+s.cls+'" style="padding-top:28px">' +
      '<div class="quiz-top"><span class="count">'+s.short+' · Question '+(st.i+1)+' of '+n+'</span><div style="display:flex;gap:10px;align-items:center">'+(st.timed?'<span class="timer" id="timer">'+fmt(st.left)+'</span>':'')+'<button class="btn btn-ghost btn-sm" id="quit">Quit</button></div></div>' +
      '<div class="bar"><i style="width:'+(answered/n*100)+'%"></i></div>' +
      '<div class="q-card">' + (q.p && PASSAGES[q.p] ? '<div class="passage"><b>'+PASSAGES[q.p].title+'</b>'+esc(PASSAGES[q.p].text).replace(/\n\n/g,'<br><br>').replace(/\n/g,'<br>')+'</div>' : '') +
      '<div class="q-skill">'+q.skill+'</div><div class="q-text">'+q.q+'</div>' +
      '<div class="choices">' + q.c.map(function(c,k){ return '<button class="choice'+(st.ans[st.i]===k?' sel':'')+'" data-k="'+k+'"><span class="L">'+'ABCD'[k]+'</span><span>'+c+'</span></button>'; }).join('') + '</div>' +
      '<div class="q-foot"><button class="btn-text flag'+(st.flags[st.i]?' on':'')+'" id="flag">'+(st.flags[st.i]?'⚑ Flagged':'⚐ Flag for review')+'</button><div style="display:flex;gap:10px">'+(st.i>0?'<button class="btn btn-ghost btn-sm" id="prev">← Back</button>':'')+(st.i<n-1?'<button class="btn btn-primary btn-sm" id="next">Next →</button>':'<button class="btn btn-primary btn-sm" id="finish">Finish and score</button>')+'</div></div>' +
      '</div>' +
      '<div class="dots">' + st.qs.map(function(_,k){ return '<button class="dot'+(st.ans[k]!==undefined?' a':'')+(st.flags[k]?' f':'')+(k===st.i?' cur':'')+'" data-j="'+k+'">'+(k+1)+'</button>'; }).join('') + '</div>' +
      (st.i===n-1 && answered<n ? '<p class="small muted" style="margin-top:12px">You have '+(n-answered)+' unanswered question'+(n-answered>1?'s':'')+'. You can still finish; blanks count as wrong.</p>' : '') +
      '</div>';
    $('.choices').addEventListener('click', function(e){ var b = e.target.closest('.choice'); if (!b) return; st.ans[st.i] = +b.dataset.k; renderQuestion(); });
    $('#flag').addEventListener('click', function(){ st.flags[st.i] = !st.flags[st.i]; renderQuestion(); });
    if ($('#prev')) $('#prev').addEventListener('click', function(){ st.i--; renderQuestion(); });
    if ($('#next')) $('#next').addEventListener('click', function(){ st.i++; renderQuestion(); });
    if ($('#finish')) $('#finish').addEventListener('click', finishQuiz);
    $('#quit').addEventListener('click', function(){ if (confirm('Quit this quiz? Your answers will not be saved.')) { quiz.state = null; location.hash = '#/practice/'+s.id; } });
    $('.dots').addEventListener('click', function(e){ var b = e.target.closest('.dot'); if (!b) return; st.i = +b.dataset.j; renderQuestion(); });
  }
  function finishQuiz(){
    if (quiz.timer) { clearInterval(quiz.timer); quiz.timer = null; }
    var st = quiz.state; if (!st) return;
    var s = st.s, n = st.qs.length, right = 0, skills = {};
    st.qs.forEach(function(q,k){ var ok = st.ans[k] === q.a; if (ok) right++; skills[q.skill] = skills[q.skill] || {r:0,t:0}; skills[q.skill].t++; if (ok) skills[q.skill].r++; });
    var pct = Math.round(right/n*100);
    var at = attempts(); at.push({s:s.id, n:n, r:right, pct:pct, t:Date.now(), timed:!!st.timed}); store.set('attempts', at.slice(-40));
    var msg = pct>=85 ? 'Strong. If this holds up over a few quizzes, you are ready for the official GED Ready practice test in '+s.short+'.' : pct>=75 ? 'On track. Review the misses below, then try the full set. Above 75% consistently means you are close.' : pct>=60 ? 'Getting there. Focus your studying on the skills with the lowest bars below, then come back.' : 'A starting point, not a verdict. Work through the '+s.short+' study guide topic by topic, then try again. Most people start right here.';
    var weakest = Object.keys(skills).sort(function(a,b){ return (skills[a].r/skills[a].t) - (skills[b].r/skills[b].t); })[0];
    app.innerHTML = '<div class="wrap '+s.cls+'" style="padding-top:36px"><div class="crumbs"><span><a href="#/practice">Practice tests</a></span><span>'+s.name+'</span><span>Results</span></div>' +
      '<div class="score-hero"><div class="score-ring'+(pct>=75?' good':'')+(pct>=75?' glow':'')+'" data-ring="'+pct+'" style="--p:0"><div>0%<small>'+right+' of '+n+'</small></div></div><div><h1 style="font-size:2.2rem;margin-bottom:8px">'+s.name+'</h1><p>'+msg+'</p>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px"><a class="btn btn-primary btn-sm" href="#/practice/'+s.id+'">Try again</a>'+(weakest?'<a class="btn btn-ghost btn-sm" href="#/study/'+s.id+'">Study '+s.short+' →</a>':'')+'<a class="btn btn-ghost btn-sm" href="#/help">Ask for help</a></div></div></div>' +
      '<div class="skills">' + Object.keys(skills).map(function(k){ var v = skills[k], p = Math.round(v.r/v.t*100); return '<div class="skill"><span>'+k+'</span><span class="muted">'+v.r+' / '+v.t+'</span><div class="bar"><i data-bar="'+p+'" style="width:0;background:'+(p>=75?'var(--pine)':'var(--cinnamon)')+'"></i></div></div>'; }).join('') + '</div>' +
      '<h2 style="font-size:1.8rem;margin:36px 0 4px">Review every question</h2><p class="muted">Read the explanations for the ones you missed, and for any you guessed.</p>' +
      '<div class="review">' + st.qs.map(function(q,k){ var ya = st.ans[k], ok = ya===q.a; return '<div class="rev '+(ok?'ok':'bad')+'"><div class="q-skill">'+(k+1)+' · '+q.skill+(st.flags[k]?' · flagged':'')+'</div><div class="q-text">'+q.q+'</div><div class="ya">Your answer: <b>'+(ya===undefined?'(blank)':'ABCD'[ya]+'. '+q.c[ya])+'</b>'+(ok?' ✓':'')+'</div>'+(!ok?'<div class="ya">Correct answer: <b>'+'ABCD'[q.a]+'. '+q.c[q.a]+'</b></div>':'')+'<div class="ex">'+q.e+'</div></div>'; }).join('') + '</div>' +
      '<div class="lesson-nav"><a class="btn btn-ghost" href="#/practice">All practice tests</a><a class="btn btn-primary" href="#/practice/'+s.id+'">Take another '+s.short+' quiz</a></div></div>';
    quiz.state = null;
    window.scrollTo(0,0);
    scanAnimated();
    if (pct >= 75) setTimeout(confetti, 420);
  }

  /* ---------- resources ---------- */
  function renderResources(){
    var filt = 'all';
    function draw(){
      var list = RESOURCES.filter(function(r){ return filt==='all' || (filt==='local' ? r.type==='Free classes' : r.subj.indexOf(filt)>=0); });
      $('#res-list').innerHTML = list.map(function(r){
        return '<article class="res'+(r.pick?' pick':'')+'"><div class="tags">'+(r.pick?'<span class="tag pick">Aisha’s pick</span>':'')+'<span class="tag">'+r.free+'</span><span class="tag">'+r.type+'</span></div>' +
          '<h3><a href="'+r.url+'" target="_blank" rel="noopener">'+r.name+'</a></h3><p>'+r.desc+(r.site?' Also: <a href="'+r.site+'" target="_blank" rel="noopener">'+r.site.replace(/^https?:\/\/(www\.)?/,'').replace(/\/$/,'')+'</a>.':'')+'</p>' +
          (r.why?'<p class="why">'+r.why+'</p>':'') + (r.note?'<p class="note"><b>Note:</b> '+r.note+'</p>':'') + '</article>';
      }).join('');
    }
    app.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Resources</span><h1>Free study materials that actually helped</h1><p>When I was studying for my own GED, I went through dozens of websites, apps, and videos before I found the ones that worked. Nobody should have to do that search twice. This is my short list. Where a site tries to sell you something, I tell you up front.</p></div>' +
      '<div class="res-filters" id="filters"><button class="chip on" data-f="all">Everything</button><button class="chip" data-f="math">Math</button><button class="chip" data-f="rla">Language Arts</button><button class="chip" data-f="science">Science</button><button class="chip" data-f="social">Social Studies</button><button class="chip" data-f="local">Free classes in Minnesota</button></div>' +
      '<div class="res-grid" id="res-list"></div>' +
      '<div class="card soft" style="margin-top:36px"><h3 style="font-size:1.4rem;margin-bottom:8px">Know something that should be here?</h3><p class="muted">If a free resource got you through a subject, tell me and I will check it out and add it. <a href="#/help">Send it through the help chat</a>.</p></div></div>';
    draw();
    $('#filters').addEventListener('click', function(e){ var b = e.target.closest('.chip'); if (!b) return; this.querySelectorAll('.chip').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); filt = b.dataset.f; draw(); });
  }

  /* ---------- help chat ---------- */
  var FAQ = [
    {k:['pass','passing','score','145','165','175','points','scale'], a:'GED scores run from 100 to 200 on each of the four subjects. <b>145</b> is passing. <b>165</b> is College Ready, and <b>175</b> can earn college credit. You need 145 or higher on all four subjects to earn your GED, but you take and pass them one at a time, in any order.'},
    {k:['subject','subjects','tests','four','parts','what is on','whats on','cover'], a:'There are four separate tests: <b>Mathematical Reasoning</b> (115 min), <b>Reasoning Through Language Arts</b> (150 min, includes an essay), <b>Science</b> (90 min), and <b>Social Studies</b> (70 min). You can schedule them on different days. Most people start with the one they find easiest to build confidence, or with math because it takes the most study time. <a href="#/study">See the study guides for each.</a>'},
    {k:['register','registration','sign up','signup','account','schedule','book','appointment','where do i take','test center','online test','onvue','at home'], a:'Everything goes through <a href="https://ged.com" target="_blank" rel="noopener">GED.com</a>. Create a free account, pick a subject, and choose a test center in the Minneapolis area or the online proctored option (you need a quiet room, a webcam, and a passing GED Ready practice score to test online). I can walk you through the whole thing in a single $20 session if you want a hand. <a href="#/quote">Ask for that here.</a>'},
    {k:['cost','price','fee','how much','expensive','pay','money','afford'], a:'Two different costs. <b>The test itself</b> is paid to the testing service per subject; in Minnesota it has been around $30 to $40 a subject, but check <a href="https://ged.com/policies/minnesota/" target="_blank" rel="noopener">the Minnesota page on GED.com</a> for the current price. <b>Tutoring with me</b> starts at $20 an hour, the first 30 minutes are free, and the study tools on this site cost nothing.'},
    {k:['age','old','young','16','17','18','19','minor','under'], a:'In Minnesota you can take the GED at 19 or older. If you are 16 to 18 you need an age waiver, usually arranged through an adult education program. Free Minneapolis Adult Education classes are for ages 18 and up. Call the <b>Adult Literacy Hotline at 800-222-1990</b> and they will tell you exactly what applies to you.'},
    {k:['calculator','ti-30','ti30','formula','formula sheet'], a:'You get an on-screen <b>TI-30XS</b> calculator for the math test after the first five questions, and for all of science and social studies. A <b>formula sheet</b> is also provided for math. You do not need to memorize area, volume, or the quadratic formula. <a href="#/study/math/calculator">Here is the lesson on both.</a>'},
    {k:['how long','how many hours','weeks','months','study time','how much time','timeline','plan'], a:'It depends on your starting score. A rough guide: if a practice test puts you in the 130s, plan 6 to 10 weeks of 4 to 5 hours a week for that subject. In the 140s, 2 to 4 weeks. Start with <a href="#/practice">a 10-question practice test</a> here to see where you are, then study the weakest subject first.'},
    {k:['essay','extended response','writing','write'], a:'The RLA essay gives you two passages that disagree and asks which one is <b>better supported</b>. You are judging the evidence, not giving your opinion. You have 45 minutes. <a href="#/study/rla/extended-response">The essay lesson has a template and a pacing plan.</a>'},
    {k:['spanish','español','espanol','language'], a:'Yes, the GED is offered in Spanish, and I tutor in Spanish for any of the four subjects. The Adult Literacy Hotline can also refer you to classes in Spanish, Somali, Hmong, and 200 other languages: call 800-222-1990 or text 612-424-1211.'},
    {k:['accommodation','disability','adhd','dyslexia','extra time','anxiety'], a:'You can request accommodations like extra time, extra breaks, or a separate room through your GED.com account before you schedule. It takes documentation and can take a few weeks to approve, so start early. The test maker has a page on it at <a href="https://ged.com/about_test/accommodations/" target="_blank" rel="noopener">GED.com accommodations</a>.'},
    {k:['free class','free classes','adult education','adult ed','in person','classroom','minneapolis public'], a:'<b>Minneapolis Adult Education</b> runs free GED classes, day and evening, in person and online, for ages 18 and up. Call 612-668-1863 or visit <a href="https://ce.mpschools.org/adults/adult-ed/ged-adult-diploma" target="_blank" rel="noopener">their page</a>. Statewide, the <b>Adult Literacy Hotline</b> (800-222-1990) finds free classes near you. Tutoring works well alongside a class.'},
    {k:['tutor','tutoring','session','meet','aisha','quote','hire','lesson with you'], a:'Tutoring is one-on-one, in person around Minneapolis and St. Paul or online, from $20 an hour. The first 30 minutes are free and there is no commitment. <a href="#/quote">Fill in the quick quote form</a> and I will reply within a business day with a price and some open times.'},
    {k:['retake','failed','fail','didn\'t pass','didnt pass','again'], a:'Not passing a subject is common and not the end. You can retake it; the first two retakes have a short waiting period and the third requires a 60-day wait, so use that time well. Your score report shows which skills were weakest. <a href="#/practice">Practice those here</a> and <a href="#/quote">tell me which subject</a> if you want a focused plan.'},
    {k:['practice test','ged ready','diagnostic','where do i start','where to start','start','begin','first'], a:'Start by finding your real starting point. Take <a href="#/practice">a 10-question quiz here</a> in each subject, or the full free test at <a href="https://www.passged.com/free-test" target="_blank" rel="noopener">PassGED</a>. Then study the lowest subject first. The official <b>GED Ready</b> practice test costs money, so save it for when you are close to passing.'},
    {k:['plan','study plan','schedule my studying','how should i study','what should i do each week'], a:'Build a plan. <a href="#/plan">The study plan page</a> asks four questions and gives you a week-by-week list of lessons, flashcards, and quizzes until your test date. It saves on this device and shows up on your <a href="#/progress">progress page</a>.'},
    {k:['flashcard','flashcards','cards','memorize','vocabulary','vocab'], a:'<a href="#/cards">Flashcards are here</a>, one deck per subject. Mark each card got it or not yet, and the misses come back more often. Ten minutes a day is plenty.'},
    {k:['what to bring','test day','day of the test','id','identification','locker','bring'], a:'Bring a government photo ID that matches your GED account name exactly, plus your confirmation. Everything else goes in a locker. <a href="#/testday">The test day page</a> covers the whole day, including breaks, scratch paper, and when scores post.'},
    {k:['progress','how am i doing','am i ready','ready'], a:'<a href="#/progress">Your progress page</a> shows lessons done, practice averages, and a readiness read for each subject. As a rule of thumb: averaging 80% or better on the quizzes here means it is time to take the official GED Ready practice test.'},
    {k:['hi','hello','hey','salaam','salam','hola'], a:'Hi! I am the study helper on Ivory Study. Ask me about the GED test, registering, costs, or where to start. If I cannot answer, I will point you to the quote form so Aisha can reply.'},
    {k:['thank','thanks'], a:'You are welcome. Go get it. And if you want a person in your corner, <a href="#/quote">the quote form is right here</a>.'}
  ];
  var chat = {log:[]};
  function topicMatch(text){
    var t = text.toLowerCase(), best = null, bestScore = 0;
    SUBJECTS.forEach(function(s){ s.topics.forEach(function(tp){ var words = (tp.title+' '+tp.summary).toLowerCase().split(/[^a-z]+/).filter(function(w){ return w.length>3; }); var sc = 0; words.forEach(function(w){ if (t.indexOf(w)>=0) sc++; }); if (sc>bestScore) { bestScore = sc; best = {s:s, t:tp}; } }); });
    return bestScore>=1 ? best : null;
  }
  function answer(text){
    var t = ' '+text.toLowerCase()+' ';
    var best = null, bestScore = 0;
    FAQ.forEach(function(f){ var sc = 0; f.k.forEach(function(k){ var re = new RegExp('\\b'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b'); if (re.test(t)) sc += k.length; }); if (sc>bestScore) { bestScore = sc; best = f; } });
    if (best && bestScore>=3) return best.a;
    var tm = topicMatch(text);
    if (tm) return 'That sounds like <b>'+tm.t.title+'</b> in '+tm.s.short+'. <a href="#/study/'+tm.s.id+'/'+tm.t.id+'">Here is the lesson</a>, with a worked example and a problem to try. If it still does not click, send it to Aisha with the button below.';
    return 'I do not have a ready answer for that one. Two options: <ul><li><a href="#/quote">Send this question to Aisha through the quote form</a>. She reads every message and usually replies within a business day.</li><li>Ask an AI helper like <a href="https://grok.com" target="_blank" rel="noopener">Grok</a> for an explanation, then check the answer against the study guide.</li></ul>';
  }
  function renderHelp(){
    app.innerHTML = '<div class="wrap"><div class="page-head" style="padding-bottom:20px"><span class="eyebrow">Need help?</span><h1>Ask anything about the GED</h1><p>Quick answers about the test, registration, cost, and where to start. For anything the helper cannot answer, send it straight to Aisha.</p></div>' +
      '<div class="help"><div class="chat"><div class="chat-head"><div class="av">A</div><div><b>Study helper</b><span>Instant answers · messages to Aisha answered within a business day</span></div></div>' +
      '<div class="chat-log" id="log"></div>' +
      '<div class="chips" id="chips">'+['What score do I need to pass?','How do I register?','How much does the test cost?','Where should I start?','Tell me about the essay','I need help with fractions'].map(function(c){ return '<button class="chip">'+c+'</button>'; }).join('')+'</div>' +
      '<form class="chat-input" id="chat-form"><input id="chat-in" type="text" placeholder="Type a question…" autocomplete="off"><button class="btn btn-primary btn-sm" type="submit">Send</button></form></div>' +
      '<aside class="help-side"><div class="side-card"><h4>Talk to Aisha</h4><p>Real person, real reply. Use the quote form to send a question or ask for a free 30-minute meet.</p><a class="btn btn-primary btn-sm" id="email-aisha" href="#/quote" style="display:inline-flex;border:0">Ask Aisha</a></div>' +
      '<div class="side-card"><h4>Free classes and hotlines</h4><a href="tel:8002221990">Adult Literacy Hotline · 800-222-1990</a><a href="sms:6124241211">Text the hotline · 612-424-1211</a><a href="tel:6126681863">Minneapolis Adult Ed · 612-668-1863</a></div>' +
      '<div class="side-card"><h4>About this helper</h4><p class="small">The study helper answers common questions from a fixed list written by Aisha. It is not a live person and does not use AI. Nothing you type here is stored or sent anywhere unless you choose to email it.</p></div></aside></div></div>';
    chat.log = [{who:'bot', html:'Hi! Ask me about the GED test, registering, costs, or where to start. Tap a question below or type your own.'}];
    drawLog();
    $('#chips').addEventListener('click', function(e){ var b = e.target.closest('.chip'); if (!b) return; send(b.textContent); });
    function submitChat(){ var v = $('#chat-in').value.trim(); if (!v) return; $('#chat-in').value = ''; send(v); }
    $('#chat-form').addEventListener('submit', function(e){ e.preventDefault(); submitChat(); });
    $('#chat-in').addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); submitChat(); } });
    $('#log').addEventListener('click', function(e){ var a = e.target.closest('a[data-act="email"]'); if (!a) return; e.preventDefault(); emailTranscript(); });
  }
  function send(text){
    chat.log.push({who:'user', html:esc(text)});
    drawLog();
    setTimeout(function(){ chat.log.push({who:'bot', html:answer(text)}); drawLog(); }, 350);
  }
  function drawLog(){
    var log = $('#log'); if (!log) return;
    log.innerHTML = chat.log.map(function(m){ return '<div class="msg '+m.who+'">'+m.html+'</div>'; }).join('');
    log.scrollTop = log.scrollHeight;
  }
  function emailTranscript(){
    var qs = chat.log.filter(function(m){ return m.who==='user'; }).map(function(m){ return m.html.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"'); });
    var body = 'Hi Aisha,\n\nI asked the study helper this and it could not answer:\n\n' + qs.map(function(q){ return '- ' + q; }).join('\n') + '\n\nMy name:\nBest way to reach me:\n';
    location.href = 'mailto:'+CONTACT+'?subject='+encodeURIComponent('Question from the website')+'&body='+encodeURIComponent(body);
  }

  route();
})();
