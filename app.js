let DEFAULT_CONTENT={};
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',projects:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 5V3h8v2M3 10h18M9 15h6"/>',evaluation:'<path d="M9 4H5v17h14V4h-4M9 3h6v4H9zM8 12h8M8 16h5"/>',skills:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3zM19 2v4M17 4h4"/>',issues:'<path d="M12 3 2 21h20L12 3zM12 9v5M12 17h.01"/>',pipeline:'<circle cx="5" cy="6" r="3"/><circle cx="19" cy="18" r="3"/><path d="M5 9v6a3 3 0 0 0 3 3h8M8 6h5a6 6 0 0 1 6 6v3"/>',plan:'<path d="M4 3v18M4 5h13l-3 4 3 4H4"/>'};
const navIds=['overview','projects','evaluation','skills','issues','pipeline','plan'];
const issueOrder=['方案中','待修复','待验证','已验证'];
const storageKey='aiqa-demo-v1';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
let cached;try{cached=JSON.parse(localStorage.getItem(storageKey))}catch{}
let content=DEFAULT_CONTENT;
let state={scores:Object.assign(Object.create(null),object(cached?.scores)?cached.scores:{}),runs:Array.isArray(cached?.runs)?cached.runs:[],issueChanges:Object.assign(Object.create(null),object(cached?.issueChanges)?cached.issueChanges:{})};
let view='overview',issueFilter='全部',caseFilter='全部',query='',period='本月',selectedScore=0,toastTimer;
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state))}catch{toast('当前浏览器无法保存记录，关闭页面后演示状态可能丢失')}}
function issueList(){return content.issues.map(issue=>{
  const change=state.issueChanges[issue.id];
  return change?.base===issue.status&&issueOrder.indexOf(change.status)>issueOrder.indexOf(issue.status)?{...issue,status:change.status}:issue;
})}
function loadContent(){
  fetch(new URL('./content.json',location.href),{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('加载失败');return r.json()}).then(data=>{
    if(!object(data))throw new Error('内容响应无效');
    DEFAULT_CONTENT=data;
    content=data;
    for(const id of Object.keys(state.scores))if(!content.cases.some(c=>c.id===id))delete state.scores[id];
    state.runs=state.runs.filter(r=>r&&content.skills.some(s=>s.id===r.skill));
    for(const [id,change] of Object.entries(state.issueChanges))if(!content.issues.some(i=>i.id===id&&i.status===change?.base))delete state.issueChanges[id];
    render();persist();
  }).catch(()=>{render();toast('演示内容加载失败，请刷新页面重试')});
}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000)}
function badge(t){let c=['待修复','方案中','待评分','试点中'].includes(t)?'amber':t==='待验证'?'blue':t==='待开始'?'gray':'';return `<span class="badge ${c}">${esc(t)}</span>`}
function head(k,t,sub,action=''){return `<div class="pagehead"><div><div class="eyebrow">${esc(k)}</div><h1>${esc(t)}</h1><p class="subtitle">${esc(sub)}</p></div>${action}</div>`}
function metric(label,value,unit,foot,delta='',numberMarkup=esc(value)){return `<div class="metric"><div class="metric-top">${esc(label)}<span class="mini">◈</span></div><div class="value num">${numberMarkup}<em>${esc(unit)}</em></div><div class="metric-foot">${delta?`<span class="delta">${esc(delta)}</span>`:''}${esc(foot)}</div></div>`}

function evaluationMetric(key, label, fallback, unit, foot) {
  const setting = content.evaluationMetrics?.[key];
  const value = Number.isInteger(setting?.value) && setting.value >= 0 && setting.value <= 999999
    ? setting.value : fallback;
  const raw = typeof setting?.url === 'string' ? setting.url.trim() : '';
  let href = '';
  if (raw.length <= 2048 && /^https?:\/\/[^/]/i.test(raw) && !/[\s\\\x00-\x1f\x7f]/.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname && !url.username && !url.password) href = url.href;
    } catch { /* Invalid URLs render as plain text. */ }
  }
  const number = href
    ? `<a class="evaluation-metric-number" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(`${label}：${value}${unit}，在新标签页打开`)}">${esc(value)}</a>`
    : `<span class="evaluation-metric-number">${esc(value)}</span>`;
  return metric(label, value, unit, foot, '', number);
}
function tracks(){return `<div class="tracks">${content.tracks.map(x=>`<article class="track"><div class="track-top"><div class="track-symbol">${esc(x.symbol)}</div>${badge('进行中')}</div><h3>${esc(x.name)}</h3><p>${esc(x.description)}</p><div class="progress" aria-label="演示进度 ${Number(x.progress)||0}%"><b style="width:${Math.max(0,Math.min(100,Number(x.progress)||0))}%"></b></div><div class="track-meta"><span>${esc(x.count)}</span><span>${Number(x.progress)||0}%</span></div><div class="track-bottom"><span>${esc(x.focus)}</span><a href="#${esc(x.view)}"><strong>查看专项</strong></a></div></article>`).join('')}</div>`}
function overview(){let weekly=period==='本周',values=weekly?content.overview.weekly:content.overview.monthly;let saved=values.savedHours;return head('QUALITY INTELLIGENCE',content.overview.heading,content.overview.subtitle,`<select aria-label="统计周期" id="period"><option ${!weekly?'selected':''}>本月</option><option ${weekly?'selected':''}>本周</option></select>`)+`${overviewHero()}<div class="metrics">${metric('核心任务成功率',values.success,'%', '固定场景对照','较基线 +8.4个百分点')}${metric('净节省人时',saved,'小时','已扣除审核、返工与基建投入')}${metric('有效使用覆盖率',values.coverage,'%', '已验收使用 / 目标交付')}${metric('体验问题复发率',values.recurrence,'%', '同类问题','较基线 −4.1个百分点')}</div><div class="grid2"><section class="panel"><div class="panel-head"><div><h2>体验与人效，同步改善</h2><p>趋势为模拟数据，不代表实际经营结果</p></div><span class="chip">近6周</span></div><div class="chart"><div class="chart-axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span></div><div class="plot">${trendChart()}</div></div><div class="bottombar"><div class="legend"><span><i></i>核心任务成功率</span><span><i class="light"></i>有效使用覆盖率</span></div><button class="btn link" data-action="metric-help">查看口径</button></div></section><section class="panel"><div class="panel-head"><h2>最近动态</h2><span class="chip">演示记录</span></div>${activity('✓','登录态问题完成回归验证','产品体验 · EXP-104','10:42')}${activity('✧','接口契约检查已接入试运行','测试基建 · BIC公共能力','10:18')}${activity('◎',`${Object.keys(state.scores).length+12} 道评测题已完成专家评分`,'AI评测 · Navos核心场景','09:56')}${activity('◈',state.runs.length?'新增 '+state.runs.length+' 次本地模拟执行':'发射台用例生成进入试点','测试基建 · 采用效果待验证','09:30')}</section></div><div class="section-head"><h2>三条工作线，一个结果</h2><a class="btn link" href="#projects">查看全部专项</a></div>${tracks()}<div class="banner"><strong>本周关注</strong><span>固定专家评分窗口，确认试点验收责任，优先打通执行记录与效果反馈。</span></div><div class="panel"><div class="panel-head"><h2>高优体验问题</h2><a class="btn link" href="#issues">进入问题池</a></div>${issueTable(issueList().slice(1,4))}</div>`}
function originalHero(){
  return `<section class="hero"><div><div class="eyebrow">ONE GOAL · THREE WORKSTREAMS</div><h2>${esc(content.overview.heroHeading)}</h2><p>${esc(content.overview.heroDescription)}</p><span class="hero-tag">当前阶段 / 试点验证与流程接入</span></div><div class="hero-side"><strong>3 / 1</strong><small>三条工作线 · 一个质量闭环</small></div></section>`;
}

function textHero(slide){
  const kicker = typeof slide.kicker === 'string' ? slide.kicker.trim() : '';
  const title = typeof slide.title === 'string' ? slide.title.trim() : '';
  const description = typeof slide.description === 'string' ? slide.description.trim() : '';
  const label = typeof slide.label === 'string' ? slide.label.trim() : '';
  const value = typeof slide.value === 'string' ? slide.value.trim() : '';
  const caption = typeof slide.caption === 'string' ? slide.caption.trim() : '';
  return `<section class="hero hero-text"><div>${kicker ? `<div class="eyebrow">${esc(kicker)}</div>` : ''}<h2>${esc(title || '正在准备横幅…')}</h2>${description ? `<p>${esc(description)}</p>` : ''}${label ? `<span class="hero-tag">${esc(label)}</span>` : ''}</div>${value || caption ? `<div class="hero-side">${value ? `<strong>${esc(value)}</strong>` : ''}${caption ? `<small>${esc(caption)}</small>` : ''}</div>` : ''}</section>`;
}

let carouselCleanup;
function carouselSlides(){
  const slides = content.carousel?.slides;
  if (!Array.isArray(slides)) return [];
  return slides.filter(slide => slide?.type === 'original'
    || (slide?.type === 'text' && typeof slide.title === 'string' && slide.title.trim().length > 0
      && ['kicker', 'description', 'label', 'value', 'caption'].every(key => typeof slide[key] === 'string'))
    || (slide?.type === 'image' && typeof slide.src === 'string'
      && /^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(slide.src)));
}

function overviewHero(){
  const slides = carouselSlides();
  if (!slides.length || (slides.length === 1 && slides[0].type === 'original')) return originalHero();
  const hasControls = slides.length > 1;
  return `<section class="overview-carousel${slides.some(slide => slide.type === 'text') ? ' overview-carousel--text' : ''}" aria-label="首页横幅"${hasControls ? ' aria-roledescription="轮播" tabindex="0"' : ''}>
    <div class="overview-carousel-stage"></div>
    ${hasControls ? `<div class="overview-carousel-controls">
      <button class="carousel-step previous" type="button" data-step="-1" aria-label="上一张"><span aria-hidden="true">‹</span></button>
      <div class="carousel-dots" role="group" aria-label="选择横幅">${slides.map((_, index) => `<button type="button" data-slide="${index}" aria-label="第 ${index + 1} 张"></button>`).join('')}</div>
      <button class="carousel-step next" type="button" data-step="1" aria-label="下一张"><span aria-hidden="true">›</span></button>
      <span class="carousel-count" aria-hidden="true"></span>
      <button class="carousel-pause" type="button"></button>
    </div><span class="carousel-announcement" role="status"></span>` : ''}
  </section>`;
}

function mountOverviewCarousel(){
  const root = $('.overview-carousel');
  if (!root) return;
  const slides = carouselSlides();
  const stage = root.querySelector('.overview-carousel-stage');
  const controls = root.querySelector('.overview-carousel-controls');
  const dots = [...root.querySelectorAll('[data-slide]')];
  const count = root.querySelector('.carousel-count');
  const status = root.querySelector('.carousel-announcement');
  const pause = root.querySelector('.carousel-pause');
  const seconds = content.carousel?.seconds;
  const duration = (Number.isInteger(seconds) && seconds >= 1 && seconds <= 60 ? seconds : 3) * 1000;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = motion.matches;
  let hovered = false;
  let focused = false;
  let index = 0;
  let timer;
  let touchStart;
  const cards = slides.map((slide, position) => {
    const card = document.createElement('div');
    card.className = 'overview-carousel-slide';
    card.hidden = true;
    if (slide.type === 'original') card.innerHTML = originalHero();
    else if (slide.type === 'text') {
      card.innerHTML = textHero(slide);
      card.setAttribute('aria-label', `${position + 1}：${slide.title}`);
    } else {
      const image = new Image();
      image.alt = slide.alt || `第 ${position + 1} 张横幅`;
      image.decoding = 'async';
      if (slide.fit === 'cover') image.className = 'cover';
      image.addEventListener('error', () => { card.innerHTML = originalHero(); }, { once: true });
      image.src = slide.src;
      card.append(image);
    }
    stage.append(card);
    return card;
  });
  function show(next, announce = false){
    index = (next + slides.length) % slides.length;
    cards.forEach((card, position) => { card.hidden = position !== index; });
    dots.forEach((dot, position) => {
      if (position === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    if (count) count.textContent = `${index + 1} / ${slides.length}`;
    if (announce && status) status.textContent = `第 ${index + 1} 张，共 ${slides.length} 张`;
  }
  show(0);
  if (!controls) return;
  function schedule(){
    clearTimeout(timer);
    if (paused || hovered || focused || document.hidden) return;
    timer = setTimeout(() => { show(index + 1); schedule(); }, duration);
  }
  function go(next){ show(next, true); schedule(); }
  function updatePause(){
    pause.textContent = paused ? '播放' : '暂停';
    pause.setAttribute('aria-label', paused ? '播放轮播' : '暂停轮播');
    schedule();
  }
  controls.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button === pause) {
      paused = !paused;
      if (!paused) focused = false;
      updatePause();
    }
    else if (button.hasAttribute('data-step')) go(index + Number(button.dataset.step));
    else if (button.hasAttribute('data-slide')) go(Number(button.dataset.slide));
  });
  root.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') { hovered = true; schedule(); }
  });
  root.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') { hovered = false; schedule(); }
  });
  root.addEventListener('focusin', event => {
    focused = event.target.matches(':focus-visible');
    schedule();
  });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) { focused = false; schedule(); } });
  root.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    go(index + (event.key === 'ArrowLeft' ? -1 : 1));
  });
  stage.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    touchStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointerup', event => {
    if (touchStart?.id !== event.pointerId) return;
    const x = event.clientX - touchStart.x;
    const y = event.clientY - touchStart.y;
    touchStart = undefined;
    if (Math.abs(x) > 32 && Math.abs(x) > Math.abs(y) * 1.5) go(index + (x < 0 ? 1 : -1));
  });
  stage.addEventListener('pointercancel', () => { touchStart = undefined; });
  function motionChanged(event){ paused = event.matches; updatePause(); }
  motion.addEventListener('change', motionChanged);
  document.addEventListener('visibilitychange', schedule);
  carouselCleanup = () => {
    clearTimeout(timer);
    motion.removeEventListener('change', motionChanged);
    document.removeEventListener('visibilitychange', schedule);
  };
  updatePause();
}

function trendChart(){
  const {success,coverage,labels}=content.overview.trend;
  const points=values=>values.map((value,i)=>[600*i/Math.max(1,values.length-1),170-1.6*Math.max(0,Math.min(100,value))]);
  const path=series=>series.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join('');
  const task=points(success),usage=points(coverage);
  const end=(series,color)=>series.length?`<circle cx="${series.at(-1)[0]}" cy="${series.at(-1)[1]}" r="4" fill="${color}"/>`:'';
  return `<svg viewBox="0 0 600 150" preserveAspectRatio="none" role="img" aria-label="核心任务成功率和有效使用覆盖率模拟趋势"><defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4b8159" stop-opacity=".12"/><stop offset="100%" stop-color="#4b8159" stop-opacity="0"/></linearGradient></defs><path d="M0 10H600M0 50H600M0 90H600M0 130H600" stroke="#edf1e9" fill="none"/>${task.length?`<path d="${path(task)}L${task.at(-1)[0]} 145H0Z" fill="url(#shade)"/>`:''}<path d="${path(task)}" stroke="#377559" stroke-width="3" fill="none"/><path d="${path(usage)}" stroke="#b5ca8f" stroke-width="3" fill="none"/>${end(task,'#377559')}${end(usage,'#b5ca8f')}</svg><div class="xaxis">${labels.map(label=>`<span>${esc(label)}</span>`).join('')}</div>`;
}
function activity(i,t,d,time){return `<div class="activity"><span class="activity-icon">${esc(i)}</span><div><strong>${esc(t)}</strong><p>${esc(d)}</p></div><time>${esc(time)}</time></div>`}
function projects(){return head('PROGRAM MANAGEMENT',content.projects?.title||DEFAULT_CONTENT.projects.title,content.projects?.subtitle||DEFAULT_CONTENT.projects.subtitle)+tracks()+`<div class="panel"><div class="panel-head"><h2>关键交付与协作</h2><span class="chip">建议工作节奏</span></div><div class="table-wrap"><table><thead><tr><th>工作线</th><th>当前交付</th><th>协作责任</th><th>主要阻塞</th><th>验收证据</th></tr></thead><tbody>${(content.projects?.deliveries||DEFAULT_CONTENT.projects.deliveries).map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div><div class="grid2" style="margin-top:24px"><div class="panel"><h2>责任边界</h2><div class="meta-row"><span>PMC</span>统筹、跨团队协调、闭环追踪</div><div class="meta-row"><span>公共基建团队</span>工具有效性、维护与复用</div><div class="meta-row"><span>业务线研发</span>项目质量、缺陷修复与发布决策</div><div class="meta-row"><span>产品与专家</span>业务标准、方案与效果验收</div></div><div class="panel"><h2>共同验收标准</h2><p class="definition" style="margin-top:16px">评测和工具产出只是中间成果。<br><strong>体验是否改善、总投入是否下降、质量是否可控</strong>，共同决定专项价值。<br><br>此页进度为演示设定，不构成真实排期承诺。</p></div></div>`}
function evaluation(){let list=content.cases.filter(c=>caseFilter==='全部'||c.dimension===caseFilter);return head('EVALUATION CENTER','用同一把尺，验证每次进步。','业务效果与可靠性双维评测，保留标准、版本和专家判断。',`<button class="btn primary" data-action="eval-version">版本对照</button>`)+`<div class="metrics">${evaluationMetric('scenarios','核心评测场景',19,'道','素材 / 洞察 / 诊断')}${evaluationMetric('scored','专家已评分',12+Object.keys(state.scores).length,'道',content.evaluationMetrics?.scored ? '后台设置 · 模拟评分仅记录在本机' : '当前列表可提交模拟评分')}${evaluationMetric('versions','已评测产品版本',4,'个','同一评测集进行对照')}${metric('当前效果均分','4.12','/ 5','示例汇总，不随本地评分回算')}</div><div class="panel table-panel"><div class="toolbar"><div class="filters">${['全部','业务效果','可靠性'].map(x=>`<button class="filter ${caseFilter===x?'active':''}" data-casefilter="${x}">${x}</button>`).join('')}</div><span class="chip">Navos v2.4 · 评测集 v1.2</span></div><div class="table-wrap"><table><thead><tr><th>评测任务</th><th>维度</th><th>模型辅助评分</th><th>专家状态</th><th>操作</th></tr></thead><tbody>${list.map(c=>`<tr><td><strong>${esc(c.name)}</strong><small>${esc(c.id)} · ${esc(c.category)}</small></td><td>${esc(c.dimension)}</td><td>${esc(Number(c.score).toFixed(1))} / 5<small>参考分，需专家校准</small></td><td>${badge(state.scores[c.id]?'已评分':c.status)}${state.scores[c.id]?`<small>专家评分 ${esc(state.scores[c.id].score)} / 5</small>`:''}</td><td><button class="btn small" data-action="score" data-id="${esc(c.id)}">${state.scores[c.id]?'查看 / 修改':'专家评分'}</button></td></tr>`).join('')}</tbody></table></div></div><div class="banner" style="margin-top:22px"><strong>评测原则</strong><span>固定场景、产品版本、评分标准；评分分歧需复核，改进必须回归验证。</span></div>`}
function skillsPage(){return head('CAPABILITY LIBRARY','让质量能力，被真正用起来。','整合研发实践与测试自动化，追踪调用、采用与持续迭代。',`<button class="btn" data-action="asset-map">资产接入说明</button>`)+`<div class="banner"><strong>能力生命周期</strong><span>登记与验证 → 流程接入 → 执行追踪 → 反馈归因 → 回归后发布新版本</span></div><div class="skillgrid">${content.skills.map(s=>`<article class="panel skill"><div class="skill-head"><span class="track-symbol">✧</span>${badge(s.status)}</div><h3 style="margin-top:14px">${esc(s.name)}</h3><div class="origin">${esc(s.origin)} · ${esc(s.version)}</div><p>${esc(s.text)}</p><div class="numbers"><span><strong>${Number(s.calls)+state.runs.filter(r=>r.skill===s.id).length}</strong>调用次数</span><span><strong>${Number(s.rate)}%</strong>产物可用率</span><span><strong>${Number(s.time)}h</strong>示例节省人时</span></div><div class="skill-bottom"><span>${esc(s.kind)}</span><button class="btn small" data-action="run-skill" data-id="${esc(s.id)}">模拟调用</button></div></article>`).join('')}</div><div class="panel table-panel"><div class="panel-head"><h2>执行记录</h2><span class="chip">本地模拟记录 ${state.runs.length} 条</span></div>${runTable()}</div>`}
function runTable(){let runs=[...state.runs].reverse();return `<div class="table-wrap"><table><thead><tr><th>执行 / 能力</th><th>项目与环节</th><th>执行结果</th><th>采用反馈</th><th>动作</th></tr></thead><tbody>${runs.length?runs.map(r=>`<tr><td><strong>${esc(r.name)}</strong><small>${esc(r.id)} · ${esc(r.version)}</small></td><td>${esc(r.project)}<small>${esc(r.stage)}</small></td><td>${badge('执行成功')}<small>模拟耗时 12秒</small></td><td>${r.accepted?'已采用 · 人工修订已记录':'待确认采用'}</td><td><button class="btn small" data-action="run-detail" data-id="${esc(r.id)}">查看 / 反馈</button></td></tr>`).join(''):`<tr><td colspan="5" class="empty">点击上方“模拟调用”，体验从执行记录到采用反馈的完整过程。</td></tr>`}</tbody></table></div>`}
function issueTable(list){return `<div class="table-wrap"><table><thead><tr><th>问题</th><th>类型 / 优先级</th><th>责任方</th><th>状态</th><th>操作</th></tr></thead><tbody>${list.length?list.map(i=>`<tr><td><strong>${esc(i.title)}</strong><small>${esc(i.id)} · ${esc(i.project)}</small></td><td>${esc(i.type)}<small>${esc(i.priority)}</small></td><td>${esc(i.owner)}</td><td>${badge(i.status)}</td><td><button class="btn small" data-action="issue-detail" data-id="${esc(i.id)}">查看闭环</button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">没有符合筛选条件的问题。</td></tr>'}</tbody></table></div>`}
function issues(){const list=issueList().filter(i=>(issueFilter==='全部'||i.status===issueFilter)&&i.title.includes(query));return head('EXPERIENCE IMPROVEMENT','从线上问题，到用户可感知的改善。','PMC追踪闭环，产品、研发及规则负责人承接方案与实施。')+`<div class="metrics">${metric('演示问题总数',6,'项','覆盖功能、流程与规则')}${metric('已上线验证',issueList().filter(i=>i.status==='已验证').length,'项','修复完成与效果验证分开记录')}${metric('待验证',issueList().filter(i=>i.status==='待验证').length,'项','上线后需回归及持续观察')}${metric('高优问题',4,'项','P1优先处理')}</div><div class="panel table-panel"><div class="toolbar"><div class="filters">${['全部','方案中','待修复','待验证','已验证'].map(x=>`<button class="filter ${issueFilter===x?'active':''}" data-issuefilter="${x}">${x}</button>`).join('')}</div><input id="issue-search" placeholder="搜索体验问题" aria-label="搜索体验问题" value="${esc(query)}"></div><div id="issue-rows">${issueTable(list)}</div></div><div class="banner" style="margin-top:22px"><strong>闭环标准</strong><span>方案明确 → 责任承接 → 排期上线 → 验证效果 → 同类问题进入回归与监控。</span></div>`}
let pipelineRunning=false,pipelineStep=0,pipelineLogs=[];
function pipeline(){return head('DELIVERY PIPELINE',content.pipeline.title||'质量验证，融入每次交付。',content.pipeline.subtitle||'演示从代码提交到回归报告的执行链路。未连接真实CI/CD.',`<button id="run-pipeline" class="btn primary" data-action="run-pipeline" ${pipelineRunning?'disabled':''}>${pipelineRunning?'模拟执行中…':'运行演示流水线'}</button>`)+`<div class="grid2"><div class="panel"><div class="panel-head"><h2>Navos · 回归验证流水线</h2>${badge(pipelineRunning?'执行中':pipelineLogs.length&&pipelineStep===content.pipeline.steps.length?'已完成':'试运行')}</div><div class="check-list"><span>项目：${esc(content.pipeline.project)}</span><span>分支：${esc(content.pipeline.branch)}</span><span>模式：${esc(content.pipeline.mode)}</span></div><div class="pipeline"><div class="steps">${content.pipeline.steps.map((s,i)=>`<div class="step ${i<pipelineStep?'done':i===pipelineStep&&pipelineRunning?'running':''}"><i>${i<pipelineStep?'✓':i+1}</i>${esc(s)}</div>`).join('')}</div></div><div class="definition"><strong>自动化执行 ≠ 自动发布</strong><br>先观察稳定性和误报，再决定哪些检查可以阻断发布；关键质量判断保留责任人确认。</div></div><div class="panel"><h2>逐步接入</h2><div class="meta-row"><span>已验证自动化</span>接口 / UI / 回归</div><div class="meta-row"><span>按需评测</span>Agent效果 / 可靠性</div><div class="meta-row"><span>执行记录</span>关联需求、版本与缺陷</div><div class="meta-row"><span>异常处理</span>通知责任人、人工复核</div></div></div><div class="panel"><div class="panel-head"><h2>执行日志</h2><span class="chip">模拟任务 · 无真实代码执行</span></div><div class="log" role="log" aria-label="模拟流水线执行日志">${pipelineLogs.length?esc(pipelineLogs.join('\n')):'等待运行。点击“运行演示流水线”查看完整过程。'}</div></div>`}
function plan(){return head('PRINCIPLES & ROADMAP','一个目标，一套持续改进机制。','评测发现差距，产品研发改进，基建固化验证，平台沉淀证据。')+`<div class="architecture"><div class="arch-goal">更好的产品体验 · 更低的总人力投入 · 质量可控</div><div class="arch-three"><div class="arch-node"><strong>AI评测</strong><small>明确标准 · 发现差距</small></div><div class="arch-node"><strong>AI测试基建</strong><small>整合资产 · 融入研发</small></div><div class="arch-node"><strong>体验改善</strong><small>推动落地 · 验证效果</small></div></div><div class="arch-connector" aria-hidden="true">↓ ↓ ↓</div><div class="arch-platform"><strong>AIQA平台</strong><p>专项进展 / 专家评测 / 能力与执行记录 / 问题闭环 / 指标看板</p></div><div class="arch-base"><div>研发交付流程<br><small>需求 · AI辅助编码 · 自动化 · CI/CD</small></div><div>数据与反馈<br><small>版本 · 评分 · 采用 · 缺陷 · 线上表现</small></div></div></div><div class="section-head"><h2>分阶段验证，再扩大投入</h2><span>资源到位后建议节奏</span></div><div class="roadmap">${content.roadmap.map(p=>`<article class="phase"><div class="week">${esc(p.week)}</div><h3>${esc(p.title)}</h3><ul>${p.tasks.map(t=>`<li>${esc(t)}</li>`).join('')}</ul><div class="accept">验收：${esc(p.acceptance)}</div></article>`).join('')}</div><div class="grid2" style="margin-top:24px"><div class="panel"><h2>需要的支持</h2><div class="meta-row"><span>技术与资源</span>技术负责人及MAC / BIC / 测试投入</div><div class="meta-row"><span>业务线承接</span>真实任务、使用与验收责任</div><div class="meta-row"><span>专家与研发</span>固定评分窗口及高优需求排期</div><div class="meta-row"><span>平台与系统</span>开发维护资源及必要接入权限</div></div><div class="panel"><h2>价值核算</h2><p class="definition" style="margin-top:16px">净节省人时 = 同等交付原方式人时 − 业务线实际投入 − 公共基建投入。<br><br>审核、返工和维护均纳入；质量达标才认定有效收益。释放产能与实际成本下降分开统计。</p><button class="btn small" style="margin-top:15px" data-action="metric-help">查看指标口径</button></div></div>`}
function render(){view=location.hash.slice(1)||'overview';if(!navIds.includes(view))view='overview';const navLabel=i=>content.copy.nav[i]??DEFAULT_CONTENT.copy.nav[i];$('#nav').innerHTML=navIds.map((id,i)=>`<a href="#${id}" ${view===id?'class="active" aria-current="page"':''}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]}</svg>${esc(navLabel(i))}${id==='issues'?'<span class="navcount">'+issueList().filter(i=>i.status!=='已验证').length+'</span>':''}</a>`).join('');$('#breadcrumb').textContent=navLabel(navIds.indexOf(view));document.title=content.copy.title;$('meta[name="description"]')?.setAttribute('content',content.copy.description);if($('#site-footer'))$('#site-footer').textContent=content.copy.footer;carouselCleanup?.();carouselCleanup=undefined;$('#main').innerHTML=({overview,projects,evaluation,skills:skillsPage,issues,pipeline,plan}[view])();if(view==='overview')mountOverviewCarousel();}
function modal(title,html){$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=html;if(!$('#dialog').open)$('#dialog').showModal()}
function metricHelp(){modal('指标口径 · 模拟数据',`<p>所有数字均为演示数据，不代表真实成果。当前演示采用以下建议口径：</p><div class="meta-row"><span>核心任务成功率</span>达标任务数 / 同一评测集任务数</div><div class="meta-row"><span>净节省人时</span>基线投入 − 业务线投入 − 基建投入</div><div class="meta-row"><span>有效使用覆盖率</span>已验收使用的交付 / 目标范围交付</div><div class="meta-row"><span>体验问题复发率</span>观察期内复发问题 / 已闭环问题</div><p style="margin-top:16px">示例：原方式1,000小时 − 业务线550小时 − 基建150小时 = 净节省300小时。仅在质量达标、范围及复杂度可比时确认收益。</p><p>实际目标及分母、观察周期，需业务线与经营团队确认。</p>`)}
function scoreModal(id){let c=content.cases.find(x=>x.id===id);if(!c)return;let saved=state.scores[id];selectedScore=saved?.score||0;modal('专家评分 · '+esc(c.id),`<span class="chip">Navos v2.4 · 评测集 v1.2 · 模拟任务</span><h3 style="margin-top:14px">${esc(c.name)}</h3><label>任务要求</label><p>${esc(c.task)}</p><div class="case-output"><h3>示例产物</h3><p>${esc(c.output)}</p></div><label>评分标准</label><p>${esc(c.criteria)} 1分不满足，3分基本满足，5分可直接采用。</p><label>综合评分</label><div class="score-row">${[1,2,3,4,5].map(n=>`<button class="score ${selectedScore===n?'chosen':''}" aria-pressed="${selectedScore===n}" data-score="${n}">${n}</button>`).join('')}</div><label for="review-note">评语</label><textarea id="review-note" placeholder="说明主要依据、问题及改进建议">${esc(saved?.note||'')}</textarea><div id="score-error" class="error" role="alert"></div><div class="dialog-actions"><button class="btn primary" data-action="save-score" data-id="${esc(id)}">保存模拟评分</button></div>`)}
function issueModal(id){let i=issueList().find(x=>x.id===id);if(!i)return;let order=issueOrder;modal(i.id+' · 问题闭环',`<h3>${esc(i.title)}</h3><div class="meta-row"><span>分类 / 优先级</span>${esc(i.type)} / ${esc(i.priority)}</div><div class="meta-row"><span>责任方</span>${esc(i.owner)}</div><div class="meta-row"><span>关联版本</span>${esc(i.version)}</div><div class="meta-row"><span>当前状态</span>${badge(i.status)}</div><p style="margin-top:15px">${esc(i.detail)}</p><div class="steps">${order.map((s,n)=>`<div class="step ${n<=order.indexOf(i.status)?'done':''}"><i>${n+1}</i>${s}</div>`).join('')}</div><p>模拟推进仅改变当前浏览器中的演示状态。正式闭环需要上线记录、验证结果及责任人确认。</p><div class="dialog-actions">${i.status==='已验证'?'<button class="btn" data-action="regression">查看回归证据</button>':`<button class="btn primary" data-action="advance-issue" data-id="${esc(i.id)}">模拟推进至${esc(order[order.indexOf(i.status)+1]||'已验证')}</button>`}</div>`)}
document.addEventListener('click',e=>{let el=e.target.closest('button');if(!el)return;if(el.dataset.casefilter){caseFilter=el.dataset.casefilter;render()}if(el.dataset.issuefilter){issueFilter=el.dataset.issuefilter;render()}if(el.dataset.score){selectedScore=Number(el.dataset.score);document.querySelectorAll('[data-score]').forEach(b=>{b.classList.toggle('chosen',Number(b.dataset.score)===selectedScore);b.setAttribute('aria-pressed',String(Number(b.dataset.score)===selectedScore))})}let a=el.dataset.action,id=el.dataset.id;if(a==='metric-help')metricHelp();if(a==='score')scoreModal(id);if(a==='save-score'){if(!selectedScore){$('#score-error').textContent='请选择1—5分。';return}state.scores[id]={score:selectedScore,note:$('#review-note').value};persist();$('#dialog').close();render();toast('模拟评分已保存至当前浏览器')}if(a==='eval-version')modal('产品版本对照',`<p>同一评测集 v1.2、同一评分标准下的模拟结果。</p><table><thead><tr><th>版本</th><th>任务成功率</th><th>效果均分</th><th>状态</th></tr></thead><tbody>${content.versions.map(v=>`<tr><td>${esc(v.version)}</td><td>${esc(v.success)}</td><td>${esc(v.score)}</td><td>${esc(v.status)}</td></tr>`).join('')}</tbody></table><p style="margin-top:15px">真实对照需保留配置、运行产物与专家评分，不能直接比较不同口径的均分。</p>`);if(a==='issue-detail')issueModal(id);if(a==='advance-issue'){const current=issueList().find(x=>x.id===id),source=content.issues.find(x=>x.id===id);const next=issueOrder[issueOrder.indexOf(current?.status)+1];if(!source||!next||!issueOrder.includes(source.status))return;state.issueChanges[id]={base:source.status,status:next};persist();render();issueModal(id);toast('演示状态已更新')}if(a==='regression')modal('回归验证证据 · 演示',`<div class="meta-row"><span>任务</span>REG-104 · 登录态回归</div><div class="meta-row"><span>能力</span>UI智能回归 v0.9.2</div><div class="meta-row"><span>验证范围</span>登录 / 刷新 / 重新打开</div><div class="meta-row"><span>示例结论</span>测试通过，继续观察复发</div><p style="margin-top:16px">正式记录应关联运行日志、截图、代码版本及验收人。以上为关系演示，无真实测试证据附件。</p>`);if(a==='asset-map')modal('资产整合与接入',`<p>盘点MAC、BIC研发实践，以及测试团队已有自动化能力；本页能力名称、版本及效果均为示例。</p><div class="meta-row"><span>登记</span>维护人、版本、适用范围与依赖</div><div class="meta-row"><span>验证</span>固定样例、人工对照与风险覆盖</div><div class="meta-row"><span>接入</span>AI辅助编码入口 / 按需执行 / CI/CD</div><div class="meta-row"><span>迭代</span>反馈归因 → 回归 → 版本发布</div>`);if(a==='run-skill'){const s=content.skills.find(x=>x.id===id);if(!s)return;modal('模拟调用 · '+s.name,`<p>不会调用真实AI服务或执行测试，仅生成本地演示记录。</p><label for="run-project">项目</label><select id="run-project"><option>Navos</option><option>发射台</option><option>MAC示例项目</option><option>BIC示例项目</option></select><div class="meta-row"><span>能力版本</span>${esc(s.version)}</div><div class="meta-row"><span>执行环节</span>${esc(s.kind)}</div><div class="dialog-actions"><button class="btn primary" data-action="confirm-run" data-id="${esc(id)}">生成模拟执行记录</button></div>`)}if(a==='confirm-run'){const s=content.skills.find(x=>x.id===id);if(!s)return;let run={id:'RUN-'+Date.now().toString().slice(-8),skill:id,name:s.name,version:s.version,project:$('#run-project').value,stage:s.kind,accepted:false};state.runs.push(run);persist();$('#dialog').close();render();toast('模拟执行成功，可在执行记录中提交采用反馈')}if(a==='run-detail'){let r=state.runs.find(x=>x.id===id);modal('执行记录 · '+r.id,`<div class="meta-row"><span>能力与版本</span>${esc(r.name)} ${esc(r.version)}</div><div class="meta-row"><span>项目 / 环节</span>${esc(r.project)} / ${esc(r.stage)}</div><div class="meta-row"><span>执行状态</span>成功（模拟）</div><div class="case-output"><h3>示例输出</h3><p>已生成结构化验证结果，包含主流程、异常分支及待人工复核项。</p></div><p>执行成功不代表效果达标。正式记录需补充采用情况、人工修改及实际收益。</p><div class="dialog-actions"><button class="btn primary" data-action="accept-run" data-id="${esc(r.id)}">${r.accepted?'已采用，查看反馈':'提交采用反馈'}</button></div>`)}if(a==='accept-run'){let r=state.runs.find(x=>x.id===id);modal('采用反馈 · '+r.id,`<label for="edit-min">人工修订耗时（分钟）</label><input id="edit-min" type="number" min="0" max="9999" value="${esc(r.minutes??5)}"><label for="adopt-note">效果说明</label><textarea id="adopt-note" placeholder="记录产物可用性、风险覆盖及改进建议">${esc(r.note||'')}</textarea><p>反馈保存在当前浏览器，不影响示例看板汇总。</p><div class="dialog-actions"><button class="btn primary" data-action="save-adoption" data-id="${esc(r.id)}">保存采用反馈</button></div>`)}if(a==='save-adoption'){let min=Number($('#edit-min').value);if(!Number.isFinite(min)||min<0||min>9999){toast('请填写0—9999之间的分钟数');return}let r=state.runs.find(x=>x.id===id);r.accepted=true;r.minutes=min;r.note=$('#adopt-note').value;persist();$('#dialog').close();render();toast('采用反馈已保存，正式系统可据此持续迭代能力')}if(a==='run-pipeline')runPipeline()});
document.addEventListener('change',e=>{if(e.target.id==='period'){period=e.target.value;render()}});
document.addEventListener('input',e=>{if(e.target.id==='issue-search'){query=e.target.value;let list=issueList().filter(i=>(issueFilter==='全部'||i.status===issueFilter)&&i.title.includes(query));$('#issue-rows').innerHTML=issueTable(list)}});
function runPipeline(){if(pipelineRunning)return;const {steps,logs}=content.pipeline;pipelineRunning=steps.length>0;pipelineStep=0;pipelineLogs=['[DEMO] 模拟执行开始；不访问真实代码或服务。'];render();if(!pipelineRunning)return;const timer=setInterval(()=>{pipelineLogs.push('[STEP '+(pipelineStep+1)+'] '+(logs[pipelineStep]??steps[pipelineStep]));pipelineStep++;if(pipelineStep===steps.length){clearInterval(timer);pipelineRunning=false;if(view!=='pipeline')toast('演示流水线已完成，未执行真实发布')}if(view==='pipeline')render()},700)}
$('#close-dialog').onclick=()=>$('#dialog').close();$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){let r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#dialog').close()}});$('#help').onclick=()=>modal('关于这个Demo',`<p>这是AIQA平台交互原型。${esc(content.copy.demoNotice)}</p><p>可体验：三线专项、专家评分、测试能力调用及采用反馈、体验问题状态推进、流水线模拟与规划架构。</p><p>评分、调用和问题状态仅保存在当前浏览器，不跨设备同步。尚未接入飞书、AI服务、代码仓库及真实CI/CD。</p><button class="btn" id="reset-demo">恢复初始演示数据</button>`);document.addEventListener('click',e=>{if(e.target.id==='reset-demo'){state={scores:Object.create(null),runs:[],issueChanges:Object.create(null)};persist();$('#dialog').close();render();toast('已恢复初始演示数据')}});window.addEventListener('hashchange',()=>{query='';if(Object.keys(DEFAULT_CONTENT).length)render();window.scrollTo(0,0)});loadContent();
