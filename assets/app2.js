/* Extra pages: study plan, progress dashboard, essay workspace, flashcards, formula sheet, test day. */
(function(){
  var L = window.LSL, $ = L.$, app = L.app, store = L.store, esc = L.esc, subj = L.subj;
  var estScore = L.estScore, readinessHTML = L.readinessHTML, weakSkills = L.weakSkills;
  var ids = ['math','rla','science','social'];

  /* ---------- shared stats ---------- */
  function stats(sid){
    var s = subj(sid), done = L.doneSet(), nd = 0;
    s.topics.forEach(function(t){ if (done[sid+'/'+t.id]) nd++; });
    var at = L.attempts().filter(function(a){ return a.s===sid; });
    var best = at.length ? Math.max.apply(null, at.map(function(a){ return a.pct; })) : null;
    var recent = at.slice(-3); var avg = recent.length ? Math.round(recent.reduce(function(x,a){ return x+a.pct; },0)/recent.length) : null;
    var cs = store.get('cards', {})[sid] || {}; var mastered = Object.keys(cs).filter(function(k){ return cs[k]==='got'; }).length;
    var total = (CARDS[sid]||[]).length;
    var est = estScore(avg);
    var ready = est===null ? 'Take a practice test' : est>=165 ? 'College ready' : est>=145 ? 'Passing range' : 'Not passing yet';
    var cls = est===null ? '' : est>=165 ? 'good' : est>=145 ? 'mid' : 'low';
    return {s:s, topicsDone:nd, topics:s.topics.length, best:best, avg:avg, attempts:at.length, mastered:mastered, cards:total, ready:ready, cls:cls};
  }

  /* ---------- study plan ---------- */
  function renderPlan(parts){
    var plan = store.get('plan', null);
    if (plan && parts[0] !== 'new') return showPlan(plan);
    var today = new Date(); var def = new Date(today.getTime() + 70*86400000).toISOString().slice(0,10);
    app.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Study plan</span><h1>Build your week-by-week plan</h1><p>Answer four quick questions and get a plan that tells you exactly which lessons, flashcards, and practice tests to do each week until your test date. It is saved on this device and you can rebuild it any time.</p></div>' +
      '<form id="plan-form" class="setup"><div class="card">' +
      '<div class="opt-group"><label class="lbl">When do you want to take your first test?</label><input type="date" id="p-date" value="'+def+'" min="'+today.toISOString().slice(0,10)+'" required><p class="small muted" style="margin-top:6px">A guess is fine. Eight to twelve weeks out is typical.</p></div>' +
      '<div class="opt-group"><label class="lbl">Hours you can study per week</label><div class="chip-row" id="p-hours"><button type="button" class="chip" data-v="2">2</button><button type="button" class="chip on" data-v="4">4</button><button type="button" class="chip" data-v="6">6</button><button type="button" class="chip" data-v="8">8+</button></div></div>' +
      '<div class="opt-group"><label class="lbl">Which subjects are you preparing for?</label><div class="chip-row" id="p-subj">'+ids.map(function(id){ return '<button type="button" class="chip on" data-v="'+id+'">'+subj(id).short+'</button>'; }).join('')+'</div></div>' +
      '<div class="opt-group"><label class="lbl">How confident are you in each? (1 = lost, 5 = nearly ready)</label><div style="display:grid;gap:10px" id="p-conf">'+ids.map(function(id){ var st = stats(id); var guess = st.avg===null ? 3 : st.avg>=80 ? 5 : st.avg>=65 ? 4 : st.avg>=50 ? 3 : st.avg>=35 ? 2 : 1; return '<label style="display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px"><span>'+subj(id).short+(st.avg!==null?' <span class="small muted">(recent practice '+st.avg+'%)</span>':'')+'</span><select data-id="'+id+'">'+[1,2,3,4,5].map(function(n){ return '<option value="'+n+'" '+(n===guess?'selected':'')+'>'+n+'</option>'; }).join('')+'</select></label>'; }).join('')+'</div></div>' +
      '<button class="btn btn-primary" type="submit">Build my plan</button></div>' +
      '<div class="card soft"><h3 style="font-size:1.3rem;margin-bottom:10px">How the plan works</h3><ul style="margin:0;padding-left:1.1rem;color:var(--ink-soft);display:grid;gap:8px"><li>Weaker subjects get more hours.</li><li>Each week has a short list: lessons to read, a flashcard deck, and one practice quiz.</li><li>The last two weeks before your test are review and full-length mocks.</li><li>Check items off as you go. The progress page tracks it.</li></ul><p class="small muted" style="margin-top:12px">Not sure where you stand? <a href="#/practice">Take a 10-question quiz in each subject first</a> and the plan will use those scores.</p></div></form></div>';
    ['p-hours'].forEach(function(g){ $('#'+g).addEventListener('click', function(e){ var b = e.target.closest('.chip'); if (!b) return; this.querySelectorAll('.chip').forEach(function(x){x.classList.remove('on');}); b.classList.add('on'); }); });
    $('#p-subj').addEventListener('click', function(e){ var b = e.target.closest('.chip'); if (!b) return; b.classList.toggle('on'); });
    $('#plan-form').addEventListener('submit', function(e){
      e.preventDefault();
      var date = $('#p-date').value; var hours = +$('#p-hours .chip.on').dataset.v;
      var chosen = [].map.call(document.querySelectorAll('#p-subj .chip.on'), function(b){ return b.dataset.v; });
      if (!chosen.length) { alert('Pick at least one subject.'); return; }
      var conf = {}; document.querySelectorAll('#p-conf select').forEach(function(s){ conf[s.dataset.id] = +s.value; });
      var p = buildPlan(date, hours, chosen, conf);
      store.set('plan', p); store.set('plan_done', {});
      if (location.hash === '#/plan') { showPlan(p); window.scrollTo(0,0); } else location.hash = '#/plan';
    });
  }
  function buildPlan(date, hours, chosen, conf){
    var weeks = Math.max(2, Math.min(24, Math.round((new Date(date) - new Date()) / (7*86400000))));
    var review = weeks >= 6 ? 2 : 1, study = weeks - review;
    // weight: lower confidence = more weight
    var w = {}, tot = 0; chosen.forEach(function(id){ w[id] = 6 - conf[id]; tot += w[id]; });
    // lessons per subject, ordered
    var queues = {}; chosen.forEach(function(id){ queues[id] = subj(id).topics.map(function(t){ return t; }); });
    // distribute lessons across study weeks proportional to weight and hours
    var lessonsPerWeek = Math.max(2, Math.round(hours * 0.8));
    var plan = {date:date, hours:hours, subjects:chosen, weeks:[]};
    for (var wk = 0; wk < study; wk++) {
      var items = [], budget = lessonsPerWeek;
      // allocate by weight, round robin weighted
      var order = chosen.slice().sort(function(a,b){ return w[b]-w[a]; });
      var guard = 0;
      while (budget > 0 && guard++ < 50) {
        var progressed = false;
        order.forEach(function(id){ if (budget <= 0) return; var share = Math.max(1, Math.round(lessonsPerWeek * w[id] / tot)); for (var k=0;k<share && budget>0;k++){ var t = queues[id].shift(); if (t) { items.push({type:'lesson', s:id, id:t.id, title:t.title}); budget--; progressed = true; } } });
        if (!progressed) break;
      }
      var focus = order.filter(function(id){ return items.some(function(i){ return i.s===id; }); });
      focus.forEach(function(id){ items.push({type:'cards', s:id, title:subj(id).short+' flashcards: 10 minutes'}); });
      var quizSubj = focus.length ? focus[wk % focus.length] : order[wk % order.length];
      items.push({type:'quiz', s:quizSubj, title:subj(quizSubj).short+' practice quiz (10 questions)'});
      plan.weeks.push({label:'Week '+(wk+1), focus:focus.map(function(id){ return subj(id).short; }).join(' + ') || 'Review', items:items});
    }
    // leftover lessons fold into last study week
    chosen.forEach(function(id){ while (queues[id].length) { var t = queues[id].shift(); plan.weeks[plan.weeks.length-1].items.unshift({type:'lesson', s:id, id:t.id, title:t.title}); } });
    for (var r = 0; r < review; r++) {
      var items2 = [];
      chosen.forEach(function(id){ items2.push({type:'mock', s:id, title:'Full-length timed mock: '+subj(id).short}); });
      items2.push({type:'cards', s:chosen[0], title:'Review every "not yet" flashcard, all subjects'});
      if (chosen.indexOf('rla')>=0) items2.push({type:'essay', title:'Write one timed practice essay'});
      items2.push({type:'read', href:'#/testday', title:r===review-1 ? 'Read the test day page and book your test' : 'Reread the lessons for anything under 75% on a mock'});
      plan.weeks.push({label:'Week '+(study+r+1), focus:r===review-1?'Final review':'Mocks and review', items:items2});
    }
    return plan;
  }
  function itemLink(it){
    if (it.type==='lesson') return '#/study/'+it.s+'/'+it.id;
    if (it.type==='cards') return '#/cards/'+it.s;
    if (it.type==='quiz' || it.type==='mock') return '#/practice/'+it.s;
    if (it.type==='essay') return '#/essay';
    return it.href || '#/';
  }
  function showPlan(plan){
    var done = store.get('plan_done', {});
    var weeksLeft = Math.max(0, Math.round((new Date(plan.date) - new Date()) / (7*86400000)));
    var totalItems = 0, doneItems = 0; plan.weeks.forEach(function(w,i){ w.items.forEach(function(it,j){ totalItems++; if (done[i+'-'+j]) doneItems++; }); });
    app.innerHTML = '<div class="wrap"><div class="page-head" style="padding-bottom:16px"><span class="eyebrow">Study plan</span><h1>Your plan</h1><p>Test date '+new Date(plan.date+'T12:00:00').toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})+' · '+weeksLeft+' week'+(weeksLeft===1?'':'s')+' left · '+plan.hours+' hours a week · '+plan.subjects.map(function(id){ return subj(id).short; }).join(', ')+'</p>' +
      '<div class="bar" style="max-width:420px;margin-top:14px"><i data-bar="'+(totalItems?doneItems/totalItems*100:0)+'" style="width:0"></i></div><p class="small muted">'+doneItems+' of '+totalItems+' items done · <a href="#/plan/new" class="btn-text">Rebuild the plan</a></p></div>' +
      '<div class="plan-weeks">' + plan.weeks.map(function(w,i){
        var wd = w.items.filter(function(it,j){ return done[i+'-'+j]; }).length;
        return '<section class="week'+(wd===w.items.length?' complete':'')+'"><header><h2>'+w.label+'</h2><span class="focus">'+w.focus+'</span><span class="wcount">'+wd+'/'+w.items.length+'</span></header><ul>' + w.items.map(function(it,j){ var k = i+'-'+j; return '<li class="'+(done[k]?'done':'')+'"><label><input type="checkbox" data-k="'+k+'" '+(done[k]?'checked':'')+'></label><a href="'+itemLink(it)+'"><span class="t '+it.type+'">'+({lesson:'Lesson',cards:'Cards',quiz:'Quiz',mock:'Mock',essay:'Essay',read:'Read'}[it.type])+'</span>'+esc(it.title)+'</a></li>'; }).join('') + '</ul></section>';
      }).join('') + '</div></div>';
    $('.plan-weeks').addEventListener('change', function(e){ var c = e.target; if (c.type!=='checkbox') return; var d = store.get('plan_done', {}); if (c.checked) d[c.dataset.k] = Date.now(); else delete d[c.dataset.k]; store.set('plan_done', d); showPlan(plan); });
  }

  /* ---------- progress ---------- */
  function renderProgress(){
    var plan = store.get('plan', null), pd = store.get('plan_done', {});
    var drafts = store.get('essays', {});
    var nDrafts = Object.keys(drafts).filter(function(k){ return drafts[k].text && drafts[k].text.length > 50; }).length;
    app.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Progress</span><h1>Where you stand</h1><p>Everything you have done on this device, in one place. The estimated score comes from your last three practice quizzes in each subject.</p><p class="small muted" style="margin-top:10px;max-width:46rem"><b>Read this before you trust the number.</b> It is a rough conversion from practice here onto the 100&ndash;200 GED scale, not an official score. Only the official GED Ready test, $7.99 a subject on GED.com, predicts your real result. Treat it as a direction, not a verdict.</p></div>' +
      L.streakHTML() +
      '<div class="prog-grid">' + ids.map(function(id){ var st = stats(id); return '<div class="prog '+st.s.cls+'"><div class="prog-head"><h3>'+st.s.name+'</h3><span class="ready '+st.cls+'">'+st.ready+'</span></div>' +
        '<div class="prog-row"><span>Lessons done</span><b>'+st.topicsDone+' / '+st.topics+'</b></div><div class="bar"><i data-bar="'+(st.topicsDone/st.topics*100)+'" style="width:0"></i></div>' +
        '<div class="prog-row"><span>Recent practice average</span><b>'+(st.avg===null?'—':st.avg+'%')+'</b></div><div class="bar"><i data-bar="'+(st.avg||0)+'" style="width:0;background:'+(st.avg>=80?'var(--pine)':'var(--cinnamon)')+'"></i></div>' +
        readinessHTML(id, st.avg) +
        '<div class="prog-row"><span>Best quiz · attempts</span><b>'+(st.best===null?'—':st.best+'%')+' · '+st.attempts+'</b></div>' +
        '<div class="prog-row"><span>Flashcards mastered</span><b>'+st.mastered+' / '+st.cards+'</b></div><div class="bar"><i data-bar="'+(st.cards?st.mastered/st.cards*100:0)+'" style="width:0;background:var(--pine)"></i></div>' +
        '<div class="prog-links"><a href="#/study/'+id+'">Lessons</a><a href="#/practice/'+id+'">Quiz</a><a href="#/cards/'+id+'">Cards</a></div></div>'; }).join('') + '</div>' +
      '<div class="setup" style="margin-top:28px"><div class="card"><h3 style="font-size:1.4rem;margin-bottom:8px">Study plan</h3>' + (plan ? '<p class="muted">Test date '+new Date(plan.date+'T12:00:00').toLocaleDateString()+' · '+Object.keys(pd).length+' of '+plan.weeks.reduce(function(n,w){ return n+w.items.length; },0)+' items done.</p><p style="margin-top:12px"><a class="btn btn-primary btn-sm" href="#/plan">Open my plan</a></p>' : '<p class="muted">No plan yet. It takes two minutes and tells you what to do each week.</p><p style="margin-top:12px"><a class="btn btn-primary btn-sm" href="#/plan">Build a plan</a></p>') + '</div>' +
      '<div class="card"><h3 style="font-size:1.4rem;margin-bottom:8px">Weak spots</h3>' + (function(){
        var tot = 0, subs = 0; ids.forEach(function(id){ var w = weakSkills(id); if (w.length) { subs++; tot += w.length; } });
        return tot ? '<p class="muted">'+tot+' skill'+(tot===1?'':'s')+' across '+subs+' subject'+(subs===1?'':'s')+' still tripping you up.</p><p style="margin-top:12px"><a class="btn btn-primary btn-sm" href="#/drill">Drill them</a></p>'
                   : '<p class="muted">Nothing logged yet. Every question you miss on a quiz lands here, grouped by skill.</p><p style="margin-top:12px"><a class="btn btn-ghost btn-sm" href="#/practice">Take a quiz</a></p>';
      })() + '</div>' +
      '<div class="card"><h3 style="font-size:1.4rem;margin-bottom:8px">Essays</h3><p class="muted">'+(nDrafts?nDrafts+' practice essay'+(nDrafts>1?'s':'')+' written on this device.':'No practice essays yet. The RLA test cannot be passed without one, so write at least two before test day.')+'</p><p style="margin-top:12px"><a class="btn btn-ghost btn-sm" href="#/essay">Open the essay workspace</a></p></div></div>' +
      '<a class="sync-banner" href="#/transfer"><b>Studying on more than one device?</b><span>Your progress lives in this browser only. Copy it to your phone or laptop with a transfer code. No account needed. &rarr;</span></a>' +
      '<p class="small muted" style="margin-top:24px">Progress is stored in this browser only. Clearing site data starts fresh. <button class="btn-text" id="reset">Reset everything</button></p></div>';
    $('#reset').addEventListener('click', function(){ if (confirm('Erase all progress, attempts, flashcards, essays, and the plan on this device?')) { ['done','attempts','cards','essays','plan','plan_done','weak','last','streak','inprogress'].forEach(function(k){ try { localStorage.removeItem('lsl_'+k); } catch(e){} }); renderProgress(); } });
  }

  /* ---------- essay workspace ---------- */
  var essayTimer = null;
  function renderEssay(parts){
    if (essayTimer) { clearInterval(essayTimer); essayTimer = null; }
    if (parts[0]) return essayWork(parts[0]);
    var drafts = store.get('essays', {});
    app.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Essay workspace</span><h1>Practice the extended response</h1><p>The real thing: two passages, a prompt, 45 minutes, and a box to write in. When you finish, score yourself against the same six things the graders look for. Drafts save on this device as you type.</p></div>' +
      '<div class="subject-grid">' + ESSAYS.map(function(e){ var d = drafts[e.id]; return '<a class="subject s-rla" href="#/essay/'+e.id+'"><h3>'+e.title+'</h3><div class="meta"><span>Two passages</span><span>45 minutes</span>'+(d&&d.text?'<span>Draft saved · '+wc(d.text)+' words</span>':'')+(d&&d.score!==undefined?'<span>Self-score '+d.score+'/6</span>':'')+'</div><p>'+e.prompt.split('.')[0]+'.</p><span class="count">'+(d&&d.text?'Continue →':'Start →')+'</span></a>'; }).join('') + '</div>' +
      '<div class="card soft" style="margin-top:36px"><h3 style="font-size:1.4rem;margin-bottom:8px">Before you write</h3><p class="muted">Read <a href="#/study/rla/extended-response">the essay lesson</a> once. It has the template and the pacing plan. Then come back and write with the timer on.</p></div></div>';
  }
  function wc(t){ return (t.trim().match(/\S+/g)||[]).length; }
  function essayWork(id){
    var e = ESSAYS.filter(function(x){ return x.id===id; })[0]; if (!e) return renderEssay([]);
    var drafts = store.get('essays', {}); var d = drafts[id] || {text:'', checks:[]};
    var left = 45*60, running = false;
    app.innerHTML = '<div class="wrap s-rla" style="padding-top:28px"><div class="crumbs"><span><a href="#/essay">Essay workspace</a></span><span>'+e.title+'</span></div>' +
      '<div class="quiz-top"><h1 style="font-size:1.9rem">'+e.title+'</h1><div style="display:flex;gap:10px;align-items:center"><span class="timer" id="etimer">45:00</span><button class="btn btn-ghost btn-sm" id="estart">Start timer</button></div></div>' +
      '<div class="essay-grid"><div class="essay-read"><div class="passage" style="max-height:none"><b>Prompt</b>'+e.prompt+'</div><div class="passage" style="max-height:360px"><b>'+e.a.title+'</b>'+esc(e.a.text).replace(/\n\n/g,'<br><br>')+'</div><div class="passage" style="max-height:360px"><b>'+e.b.title+'</b>'+esc(e.b.text).replace(/\n\n/g,'<br><br>')+'</div></div>' +
      '<div class="essay-write"><textarea id="etext" placeholder="Both passages address… Although Passage 2 argues…, Passage 1 is better supported because…">'+esc(d.text)+'</textarea><div class="essay-foot"><span id="ewc" class="small muted">'+wc(d.text)+' words · saved</span><button class="btn btn-primary btn-sm" id="escore">I’m done, score it</button></div>' +
      '<div class="card" id="rubric" '+(d.score!==undefined?'':'hidden')+'><h3 style="font-size:1.3rem;margin-bottom:6px">Score yourself</h3><p class="small muted" style="margin-bottom:12px">Be honest. Check each one your essay actually does.</p><div style="display:grid;gap:8px">'+e.rubric.map(function(r,i){ return '<label class="mark-done"><input type="checkbox" data-i="'+i+'" '+(d.checks&&d.checks.indexOf(i)>=0?'checked':'')+'> <span>'+r+'</span></label>'; }).join('')+'</div><div class="escore" id="esc-out">'+(d.score!==undefined?'Self-score: <b>'+d.score+' / 6</b>'+scoreNote(d.score):'')+'</div><div class="callout" style="margin-top:14px"><b>What strong essays usually do here:</b> '+e.note+'</div></div></div></div></div>';
    var ta = $('#etext'), out = $('#ewc');
    var saveT;
    ta.addEventListener('input', function(){ out.textContent = wc(ta.value)+' words · saving…'; clearTimeout(saveT); saveT = setTimeout(function(){ var ds = store.get('essays', {}); ds[id] = ds[id] || {}; ds[id].text = ta.value; ds[id].t = Date.now(); store.set('essays', ds); out.textContent = wc(ta.value)+' words · saved'; }, 600); });
    $('#estart').addEventListener('click', function(){ if (running) { clearInterval(essayTimer); essayTimer = null; running = false; this.textContent = 'Resume timer'; return; } running = true; this.textContent = 'Pause'; ta.focus(); essayTimer = setInterval(function(){ left--; var el = $('#etimer'); if (!el) { clearInterval(essayTimer); return; } var m = Math.floor(left/60), s = left%60; el.textContent = m+':'+(s<10?'0':'')+s; el.classList.toggle('warn', left < 5*60); if (left<=0) { clearInterval(essayTimer); essayTimer = null; el.textContent = 'Time'; alert('45 minutes are up. On the real test the screen locks now. Score what you have.'); $('#rubric').hidden = false; } }, 1000); });
    $('#escore').addEventListener('click', function(){ $('#rubric').hidden = false; $('#rubric').scrollIntoView({behavior:'smooth'}); });
    $('#rubric').addEventListener('change', function(){ var checks = [].map.call(document.querySelectorAll('#rubric input:checked'), function(c){ return +c.dataset.i; }); var ds = store.get('essays', {}); ds[id] = ds[id] || {}; ds[id].checks = checks; ds[id].score = checks.length; ds[id].text = ta.value; store.set('essays', ds); $('#esc-out').innerHTML = 'Self-score: <b>'+checks.length+' / 6</b>'+scoreNote(checks.length); });
  }
  function scoreNote(n){ return n>=5 ? ' · That is a passing-level essay. Do one more on a fresh prompt to make sure it was not luck.' : n>=3 ? ' · Solid start. The unchecked items are exactly what to practice next; the essay lesson has a template for each.' : ' · Not yet, and that is normal for a first try. Reread the essay lesson and rewrite this one using the template before trying a new prompt.'; }

  /* ---------- flashcards ---------- */
  function renderCards(parts){
    if (parts[0] && CARDS[parts[0]]) return cardDeck(parts[0]);
    app.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Flashcards</span><h1>Ten minutes on the bus</h1><p>The terms, formulas, and facts that come up most, one card at a time. Tap to flip, then mark it "got it" or "not yet." Cards you miss come back more often. Progress saves on this device.</p></div>' +
      '<div class="subject-grid">' + ids.map(function(id){ var st = stats(id); return L.subjectCard({cls:st.s.cls, icon:id, href:'#/cards/'+id, title:st.s.name, pct:st.cards?st.mastered/st.cards*100:0, ringLabel:'cards mastered',
        meta:[st.mastered+' of '+st.cards+' mastered'], body:(id==='math'?'Formulas, fraction rules, and calculator traps.':id==='rla'?'Grammar rules, question types, and the essay template.':id==='science'?'Variables, cells, forces, and earth basics.':'Amendments, branches, eras, and economics terms.'), bigN:st.cards, bigLabel:'cards', go:'Open deck'}); }).join('') + '</div></div>';
  }
  function cardDeck(sid){
    var s = subj(sid), deck = CARDS[sid], st = store.get('cards', {}); st[sid] = st[sid] || {};
    var mode = 'all', order = [], i = 0, flipped = false;
    function build(){ order = deck.map(function(_,k){ return k; }).filter(function(k){ return mode==='all' || st[sid][k]!=='got'; }); for (var a = order.length-1; a>0; a--) { var b = Math.floor(Math.random()*(a+1)); var t = order[a]; order[a] = order[b]; order[b] = t; } i = 0; flipped = false; }
    build();
    function draw(){
      var mastered = Object.keys(st[sid]).filter(function(k){ return st[sid][k]==='got'; }).length;
      if (!order.length) { app.innerHTML = '<div class="wrap '+s.cls+'"><div class="page-head"><div class="crumbs"><span><a href="#/cards">Flashcards</a></span><span>'+s.short+'</span></div><h1>All caught up</h1><p>Every '+s.short+' card is marked "got it." Review the whole deck again in a few days so it sticks.</p><p style="margin-top:14px"><button class="btn btn-primary" id="again">Review all cards</button> <a class="btn btn-ghost" href="#/practice/'+sid+'">Take a quiz instead</a></p></div></div>'; $('#again').addEventListener('click', function(){ mode='all'; build(); draw(); }); return; }
      var k = order[i], c = deck[k];
      app.innerHTML = '<div class="wrap '+s.cls+'" style="padding-top:28px"><div class="crumbs"><span><a href="#/cards">Flashcards</a></span><span>'+s.short+'</span></div>' +
        '<div class="quiz-top"><span class="count">'+s.short+' · Card '+(i+1)+' of '+order.length+' · '+mastered+' of '+deck.length+' mastered</span><div class="chip-row"><button class="chip'+(mode==='all'?' on':'')+'" data-m="all">All cards</button><button class="chip'+(mode==='missed'?' on':'')+'" data-m="missed">Not yet only</button></div></div>' +
        '<div class="fc'+(flipped?' flipped':'')+'" id="fc" tabindex="0" role="button" aria-label="Flip card"><div class="fc-in"><div class="fc-face fc-front"><span class="lbl">Term</span><div class="fc-text">'+c[0]+'</div><span class="hint">Tap to flip</span></div><div class="fc-face fc-back"><span class="lbl">Answer</span><div class="fc-text">'+c[1]+'</div></div></div></div>' +
        '<div class="fc-actions"><button class="btn btn-ghost" id="miss">Not yet</button><button class="btn btn-primary" id="got">Got it</button></div>' +
        '<p class="small muted" style="text-align:center;margin-top:14px">Keyboard: space to flip, 1 for not yet, 2 for got it.</p></div>';
      $('#fc').addEventListener('click', function(){ flipped = !flipped; this.classList.toggle('flipped', flipped); });
      $('#got').addEventListener('click', function(){ mark('got'); }); $('#miss').addEventListener('click', function(){ mark('miss'); });
      $('.chip-row').addEventListener('click', function(e){ var b = e.target.closest('.chip'); if (!b) return; mode = b.dataset.m; build(); draw(); });
    }
    function mark(v){ st[sid][order[i]] = v; var all = store.get('cards', {}); all[sid] = st[sid]; store.set('cards', all); i++; flipped = false; if (i >= order.length) { if (mode==='missed') { build(); } else { i = 0; build(); } } draw(); }
    function key(e){ if (!$('#fc')) { document.removeEventListener('keydown', key); return; } if (e.key===' ') { e.preventDefault(); $('#fc').click(); } if (e.key==='1') mark('miss'); if (e.key==='2') mark('got'); }
    document.addEventListener('keydown', key);
    draw();
  }

  /* ---------- formula sheet ---------- */
  function renderFormulas(){
    app.innerHTML = '<div class="wrap print-page"><div class="page-head" style="padding-bottom:16px"><span class="eyebrow">Formula sheet</span><h1>What you get, and what you must know</h1><p>The left column is given to you on screen during the math test. The right column is not, and shows up anyway. Print this page and tape it somewhere you will see it. <button class="btn btn-primary btn-sm no-print" onclick="window.print()">Print</button></p></div>' +
      '<div class="formulas"><div class="card"><h2>On the test’s formula sheet</h2>' +
      ftable([['Area of a rectangle','A = lw'],['Area of a triangle','A = ½bh'],['Area of a parallelogram','A = bh'],['Area of a trapezoid','A = ½(b₁ + b₂)h'],['Area of a circle','A = πr²'],['Circumference','C = 2πr = πd'],['Perimeter of a rectangle','P = 2l + 2w'],['Volume of a box','V = lwh'],['Volume of a cylinder','V = πr²h'],['Volume of a cone','V = ⅓πr²h'],['Volume of a sphere','V = (4/3)πr³'],['Pythagorean theorem','a² + b² = c²'],['Slope of a line','m = (y₂ − y₁) ÷ (x₂ − x₁)'],['Slope-intercept form','y = mx + b'],['Point-slope form','y − y₁ = m(x − x₁)'],['Quadratic formula','x = (−b ± √(b² − 4ac)) ÷ 2a'],['Simple interest','I = prt'],['Distance','d = rt'],['Mean','sum of values ÷ number of values'],['Total cost','(number of units) × (price per unit)']]) +
      '</div><div class="card soft"><h2>Not on the sheet. Know these cold.</h2>' +
      ftable([['Percent of a number','decimal × number. 15% of 60 = 0.15 × 60'],['Percent change','(new − old) ÷ old × 100'],['Add fractions','common denominator, add tops'],['Divide fractions','flip the second, multiply'],['Decimal ↔ percent','move the decimal two places'],['Common equivalents','½ = 0.5, ¼ = 0.25, ¾ = 0.75, ⅓ ≈ 0.33, ⅛ = 0.125'],['Order of operations','( ) → exponents → × ÷ → + −'],['Negative rules','(−)(−) = +, (−)(+) = −, subtracting a negative adds'],['Exponents','x² = x·x, x⁰ = 1, √(a²) = a'],['Solve for x','undo + − first, then × ÷; do both sides'],['Inequality flip','÷ or × by a negative flips the sign'],['Median','sort, take the middle (average two middles if even)'],['Mode','most frequent'],['Range','largest − smallest'],['Probability','favorable ÷ total; "and" → multiply'],['Angles in a triangle','add to 180°'],['Unit rate','"per" means divide'],['Rounding up','people, buses, boxes: always round UP'],['Diameter','2 × radius'],['Right-triangle triples','3-4-5, 6-8-10, 5-12-13']]) +
      '</div></div><p class="small muted no-print" style="margin-top:20px">π ≈ 3.14. The on-screen calculator has a π key. <a href="#/study/math/calculator">Lesson on the calculator and the sheet →</a></p></div>';
  }
  function ftable(rows){ return '<table class="ftable">'+rows.map(function(r){ return '<tr><td>'+r[0]+'</td><td><code>'+r[1]+'</code></td></tr>'; }).join('')+'</table>'; }

  /* ---------- test day ---------- */
  function renderTestDay(){
    app.innerHTML = '<div class="wrap"><div class="page-head"><span class="eyebrow">Test day</span><h1>What it costs, and what to expect</h1><p>Read this a week before your test and again the night before. Prices and rules come from GED.com and do change, so confirm them in your own account before you pay.</p></div>' +
      '<div class="lesson"><div class="lesson-body">' +
      '<h2>What it costs in Minnesota</h2>' +
      '<table><tr><th>Item</th><th>Price</th><th>Notes</th></tr>' +
      '<tr><td>One subject test</td><td>$36</td><td>Same price at a test center or online</td></tr>' +
      '<tr><td>All four subjects</td><td>$144</td><td>You pay per subject, as you book each one</td></tr>' +
      '<tr><td>Minnesota discount</td><td>&minus;$10 each</td><td>Promo code <b>MNGED10</b> at checkout, up to 4 subject tests, while state funding lasts. That makes a subject $26.</td></tr>' +
      '<tr><td>Retake at a test center</td><td>$10</td><td>Discounted retake after your first attempt in that subject</td></tr>' +
      '<tr><td>Retake online</td><td>$36</td><td>Online retakes are not discounted</td></tr>' +
      '<tr><td>GED Ready practice test</td><td>$7.99</td><td>Per subject. The only test that predicts your real score.</td></tr>' +
      '</table>' +
      '<div class="callout"><b>If money is the barrier, say so out loud.</b> Promo codes run until the state funding is spent, so check <a href="https://ged.com/policies/minnesota/" target="_blank" rel="noopener">the Minnesota page on GED.com</a> before every booking. Free adult education programs can also help with fees: call the <b>Adult Literacy Hotline at 800-222-1990</b> or <b>Minneapolis Adult Education at 612-668-1863</b> and ask directly what they cover. People ask them this every day.</div>' +
      '<h2>Who can test</h2><ul><li>Minnesota&rsquo;s minimum age is <b>19</b>.</li><li>At <b>17</b>, if you are out of school, you can test with an age waiver form.</li><li>For an online test with a waiver, a parent or guardian has to join the check-in to give consent.</li></ul>' +
      '<h2>Online or in person</h2><p>Both cost the same and both count the same. Pick by what your life allows.</p>' +
      '<table><tr><th></th><th>Online (OnVUE)</th><th>Test center</th></tr>' +
      '<tr><td>Where</td><td>Your own quiet room</td><td>A center near you, searched by zip on GED.com</td></tr>' +
      '<tr><td>Needs</td><td>A webcam, a steady connection, a room nobody enters</td><td>Getting there and back</td></tr>' +
      '<tr><td>Before you can book</td><td>A green <b>Likely to Pass</b> on GED Ready for that subject</td><td>Nothing extra</td></tr>' +
      '<tr><td>Retake price</td><td>$36</td><td>$10</td></tr>' +
      '</table>' +
      '<h2>If you test online, do this first</h2><ul>' +
      '<li><b>Run the system test</b> from your GED.com account on the same computer, in the same room, on the same wifi you will use. It checks your camera, microphone, and connection. Do it days early, not an hour before.</li>' +
      '<li><b>Clear the room and the desk.</b> No papers, no phone, no second monitor, no drinks unless they are in a clear container. You will be asked to pan your camera around the room.</li>' +
      '<li><b>Be alone.</b> Nobody can walk in, not a partner, not a child. If someone appears on camera the test can be stopped with no refund. Arrange childcare the way you would for an in-person test.</li>' +
      '<li><b>Have your photo ID.</b> Government issued, unexpired, and the name must match your GED account exactly.</li>' +
      '<li><b>Check in 30 minutes early.</b> You photograph yourself, your ID, and your room, then wait for a live proctor.</li>' +
      '<li><b>Use the on-screen whiteboard.</b> Online testers get a digital one instead of an erasable board. Try it with your mouse beforehand so it is not new.</li>' +
      '</ul>' +
      '<h2>If you test at a center</h2><ul><li>Bring your government photo ID and your confirmation. No ID, no test, no refund.</li><li>Everything else goes in a locker: phone, bag, watch, notes.</li><li>You get an erasable board and marker. Ask for a second one if you fill it.</li><li>You may bring your own TI-30XS calculator, though an on-screen one is provided.</li></ul>' +
      '<h2>Pacing, whichever way you test</h2><table><tr><th>Subject</th><th>Time</th><th>Questions</th><th>Per question</th></tr><tr><td>Math</td><td>115 min</td><td>~46</td><td>~2.5 min</td></tr><tr><td>RLA</td><td>150 min</td><td>~50 + essay</td><td>~1.5 min, plus 45 for the essay</td></tr><tr><td>Science</td><td>90 min</td><td>~34</td><td>~2.5 min</td></tr><tr><td>Social Studies</td><td>70 min</td><td>~35</td><td>~2 min</td></tr></table>' +
      '<p>Flag anything that passes three minutes, guess, and move on. There is no penalty for a wrong answer, so never leave a blank.</p>' +
      '<h2>After</h2><ul><li>Most scores post to your GED.com account within a few hours. The essay takes longer.</li><li><b>145 or higher</b> finishes that subject for good. Book the next one while you still have momentum.</li><li><b>Below 145</b> is not the end. Your score report names the skills to work on, and the first two retakes at a center are $10. <a href="#/drill">Drill those skills here</a>, then go again.</li></ul>' +
      '<div class="callout"><b>The morning of:</b> eat something with protein, start 30 minutes earlier than feels necessary, and remember you have already seen every kind of question on this test. The room is new. The questions are not.</div>' +
      '</div><aside class="lesson-side"><div class="side-card"><h4>Quick links</h4><a href="https://ged.com" target="_blank" rel="noopener">GED.com: book and see scores</a><a href="https://ged.com/policies/minnesota/" target="_blank" rel="noopener">Minnesota rules and current prices</a><a href="#/formulas">Printable formula sheet</a><a href="#/drill">Drill your weak spots</a></div>' +
      '<div class="side-card"><h4>Fee help</h4><p class="small muted" style="margin-bottom:8px">Ask these two directly what they can cover.</p><a href="tel:8002221990">Adult Literacy Hotline &middot; 800-222-1990</a><a href="tel:6126681863">Minneapolis Adult Ed &middot; 612-668-1863</a></div>' +
      '<div class="side-card"><h4>Want a hand booking?</h4><p class="small muted" style="margin-bottom:10px">One 60-minute session covers setting up your account, picking a date, and a plan for the morning.</p><a href="#/quote" class="btn btn-primary btn-sm" style="display:inline-flex;border:0">Ask Aisha</a></div></aside></div></div>';
  }
  window.EXTRA = {plan:renderPlan, progress:renderProgress, essay:renderEssay, cards:renderCards, formulas:renderFormulas, testday:renderTestDay};
  window.LSL.stats = stats;
  // app.js routed before this file loaded; route again so deep links to these pages work on first load
  var first = location.hash.replace(/^#\/?/, '').split('/')[0];
  if (window.EXTRA[first]) window.dispatchEvent(new HashChangeEvent('hashchange'));
})();
