(function(){
  const DATA = window.ABC_DATA || {targets:[], achievements:[], serviceMapping:[], enablers:[], objectiveLabels:{}};
  const fmt = new Intl.NumberFormat('en-US');
  const moneyFmt = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
  const shortFmt = new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1});
  const qs = s => document.querySelector(s);
  const qsa = s => Array.from(document.querySelectorAll(s));
  const clean = v => String(v ?? '').trim();
  const num = v => Number(String(v ?? 0).replace(/[^0-9.-]/g,'')) || 0;
  const norm = v => clean(v).toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');

  let state = {year:'All', county:'All', org:'All', objective:'All', metric:'financial'};
  let map, geoLayer, geojson, selectedLayer;

  const OBJECTIVE_COLORS = {
    'UNSRM 1':'#00A8EF', 'UNSRM 2':'#34D399', 'UNSRM 3':'#F4C542', 'UNSRM 4':'#A66CFF', 'UNSRM 5':'#F472B6'
  };
  const OBJECTIVE_SHORT = {
    'UNSRM 1':'Safe settlements', 'UNSRM 2':'HLP / Land', 'UNSRM 3':'Livelihoods', 'UNSRM 4':'Services infrastructure', 'UNSRM 5':'Peace & cohesion'
  };

  function getTargetYear(row){ return clean(row['Strategy/Roadmap Year']); }
  function getAchYear(row){ return clean(row['REPORTING YEAR']); }
  function getCode(row){ return clean(row['UNS Activity Indicator Code']); }
  function getObj(row){ return clean(row['UNS RM Objective Code']); }
  function getCounty(row){ return clean(row['County'] || row['COUNTY']); }
  function getActivity(row){ return clean(row['UNS Activity Indicator '] || row['UNS Activity Indicator'] || row['UNS RM Objective Indicator']); }
  function getUnit(row){ return clean(row['Unit of indicator measurment'] || row['UNS RM Objective Indicator Unit of Measurment']); }
  function matchesTarget(row){
    return (state.year==='All'||getTargetYear(row)===state.year) &&
      (state.county==='All'||getCounty(row)===state.county) &&
      (state.objective==='All'||getObj(row)===state.objective);
  }
  function matchesAch(row){
    return (state.year==='All'||getAchYear(row)===state.year) &&
      (state.county==='All'||getCounty(row)===state.county) &&
      (state.org==='All'||clean(row['REPORTING ORGANISATION'])===state.org) &&
      (state.objective==='All'||getObj(row)===state.objective);
  }
  function matchesService(row){
    const objective = clean(row['Upper Nile State RM Objective']);
    const code = clean(row['UNS Activity Indicator ']);
    const objMatch = state.objective==='All' || objective.includes(state.objective.replace('UNSRM ','OBJECTIVE ')) || code.startsWith(state.objective);
    return (state.county==='All'||getCounty(row)===state.county) && objMatch;
  }
  function matchesEnabler(row){
    return (state.year==='All'||getAchYear(row)===state.year) &&
      (state.org==='All'||clean(row['REPORTING ORGANISATION'])===state.org) &&
      (state.objective==='All'||getObj(row)===state.objective);
  }
  function keyParts(row, yearMode){ return [yearMode==='target'?getTargetYear(row):getAchYear(row), getCounty(row), getObj(row), getCode(row), getUnit(row)].map(clean).join('|'); }
  function unitCostMap(){
    const m = new Map();
    DATA.targets.forEach(r=>{ const k=keyParts(r,'target'); if(!m.has(k)) m.set(k,num(r['Unit Cost'])); });
    return m;
  }
  function aggregate(){
    const uc = unitCostMap();
    const tRows = DATA.targets.filter(matchesTarget);
    const aRows = DATA.achievements.filter(matchesAch);
    const byKey = new Map();
    tRows.forEach(r=>{
      const key=keyParts(r,'target');
      if(!byKey.has(key)) byKey.set(key,{year:getTargetYear(r), county:getCounty(r), obj:getObj(r), code:getCode(r), activity:getActivity(r), unit:getUnit(r), target:0, requirement:0, achievement:0, funded:0, orgs:new Set()});
      const rec=byKey.get(key);
      rec.target += num(r['UNS Activity Indicator Target']);
      rec.requirement += num(r['Total Requirement']);
    });
    aRows.forEach(r=>{
      const key=keyParts(r,'ach');
      if(!byKey.has(key)) byKey.set(key,{year:getAchYear(r), county:getCounty(r), obj:getObj(r), code:getCode(r), activity:getActivity(r), unit:getUnit(r), target:0, requirement:0, achievement:0, funded:0, orgs:new Set()});
      const rec=byKey.get(key);
      const a=num(r['ACHIEVEMENT']);
      rec.achievement += a;
      rec.orgs.add(clean(r['REPORTING ORGANISATION']));
      rec.funded += a * (uc.get(key) || 0);
    });
    return Array.from(byKey.values()).filter(r=>r.target||r.requirement||r.achievement||r.funded);
  }
  function totals(rows){
    const t = rows.reduce((a,r)=>{a.achievement+=r.achievement; a.target+=r.target; a.funded+=r.funded; a.requirement+=r.requirement; return a;},{achievement:0,target:0,funded:0,requirement:0});
    t.targetProgress = t.target ? t.achievement/t.target : 0;
    t.financialProgress = t.requirement ? t.funded/t.requirement : 0;
    t.gap = t.requirement - t.funded;
    return t;
  }
  function percent(v){ return Number.isFinite(v) ? Math.round(v*100)+'%' : '—'; }
  function capPercent(v){ return Math.max(0, Math.min(100, Math.round(v*100))); }
  function progressBar(value, max=1){ const p=capPercent(max?value/max:value); return `<div class="abc-progress"><span style="width:${p}%"></span></div>`; }

  function fillSelect(id, values, allLabel='All'){
    const el=qs(id); if(!el) return;
    const cur=el.value || 'All';
    el.innerHTML = [`<option value="All">${allLabel}</option>`].concat(values.filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),undefined,{numeric:true})).map(v=>`<option value="${String(v).replace(/"/g,'&quot;')}">${v}</option>`)).join('');
    if(values.includes(cur)) el.value=cur;
  }
  function initFilters(){
    const years = Array.from(new Set([...DATA.targets.map(getTargetYear), ...DATA.achievements.map(getAchYear)].filter(Boolean)));
    const counties = Array.from(new Set([...DATA.targets.map(getCounty), ...DATA.achievements.map(getCounty), ...DATA.serviceMapping.map(getCounty)].filter(Boolean)));
    const orgs = Array.from(new Set([...DATA.achievements.map(r=>clean(r['REPORTING ORGANISATION'])), ...DATA.enablers.map(r=>clean(r['REPORTING ORGANISATION']))].filter(Boolean)));
    const objs = Array.from(new Set([...DATA.targets.map(getObj), ...DATA.achievements.map(getObj), ...DATA.enablers.map(getObj)].filter(Boolean)));
    fillSelect('#abcYear', years, 'All years'); fillSelect('#abcCounty', counties, 'All counties'); fillSelect('#abcOrg', orgs, 'All organisations'); fillSelect('#abcObjective', objs, 'All objectives');
    [['#abcYear','year'],['#abcCounty','county'],['#abcOrg','org'],['#abcObjective','objective'],['#abcMetric','metric']].forEach(([id,k])=>{ const el=qs(id); if(el) el.addEventListener('change',()=>{state[k]=el.value; render();}); });
    const reset=qs('#abcReset'); if(reset) reset.addEventListener('click',()=>{state={year:'All',county:'All',org:'All',objective:'All',metric:'financial'}; qsa('select').forEach(s=>s.value='All'); qs('#abcMetric').value='financial'; render();});
  }
  function setText(id, value){ const el=qs(id); if(el) el.textContent=value; }
  function renderKpis(rows){
    const t=totals(rows);
    setText('#kpiFundingNeeded', shortFmt.format(t.requirement));
    setText('#kpiFundingInvested', shortFmt.format(t.funded));
    setText('#kpiFundingGap', shortFmt.format(t.gap));
    setText('#kpiTargetProgress', percent(t.targetProgress));
    setText('#kpiFinancialProgress', percent(t.financialProgress));
    const counties = new Set(rows.map(r=>r.county).filter(Boolean)).size;
    const partners = new Set(DATA.achievements.filter(matchesAch).map(r=>clean(r['REPORTING ORGANISATION'])).filter(Boolean)).size;
    setText('#kpiCounties', counties || '—'); setText('#kpiPartners', partners || '—');
    // Theme cards approximating Power BI KPI logic based on activity/unit keywords
    const getTheme = (patterns)=> rows.filter(r=>patterns.some(p=>(r.activity+' '+r.unit+' '+r.code).toLowerCase().includes(p))).reduce((a,r)=>a+r.achievement,0);
    setText('#kpiHLP', shortFmt.format(getTheme(['hlp','legal aid','title deed','counselling'])));
    setText('#kpiHouses', shortFmt.format(getTheme(['house','shelter'])));
    setText('#kpiLivelihood', shortFmt.format(getTheme(['livelihood','agricultural','vocational','cooperative','fishing','food support','start'])));
    setText('#kpiSchools', shortFmt.format(getTheme(['school','education'])));
    setText('#kpiHospitals', shortFmt.format(getTheme(['hospital','health facility','health care'])));
    setText('#kpiWater', shortFmt.format(getTheme(['water plant','water point','water system','wash'])));
    setText('#kpiPeace', shortFmt.format(getTheme(['peace','cohesion','protection structure','dispute'])));
  }
  function renderObjectiveCards(rows){
    const el=qs('#abcObjectiveCards'); if(!el) return;
    const objCodes = Array.from(new Set(DATA.targets.map(getObj).filter(Boolean))).sort();
    el.innerHTML = objCodes.map(code=>{
      const subset=rows.filter(r=>r.obj===code); const t=totals(subset);
      const label=OBJECTIVE_SHORT[code] || code;
      const full=DATA.objectiveLabels[code] || '';
      const color=OBJECTIVE_COLORS[code] || '#00A8EF';
      return `<button class="abc-objective-card ${state.objective===code?'active':''}" data-objective="${code}" style="--obj:${color}">
        <div class="abc-objective-top"><strong>${code}</strong><span>${percent(t.financialProgress)}</span></div>
        <h3>${label}</h3><p>${full}</p>
        ${progressBar(t.financialProgress)}
        <div class="abc-objective-meta"><span>Target: ${percent(t.targetProgress)}</span><span>Gap: ${shortFmt.format(t.gap)}</span></div>
      </button>`;
    }).join('');
    qsa('.abc-objective-card').forEach(btn=>btn.addEventListener('click',()=>{state.objective = state.objective===btn.dataset.objective ? 'All' : btn.dataset.objective; qs('#abcObjective').value=state.objective; render();}));
  }
  function renderActivityTable(rows){
    const el=qs('#abcActivityTable'); if(!el) return;
    const grouped=new Map();
    rows.forEach(r=>{
      const k=[r.obj,r.code,r.activity,r.unit].join('|');
      if(!grouped.has(k)) grouped.set(k,{obj:r.obj,code:r.code,activity:r.activity,unit:r.unit,achievement:0,target:0,funded:0,requirement:0,gap:0});
      const g=grouped.get(k); g.achievement+=r.achievement; g.target+=r.target; g.funded+=r.funded; g.requirement+=r.requirement;
    });
    const items=Array.from(grouped.values()).map(r=>({...r,gap:r.requirement-r.funded,tprog:r.target?r.achievement/r.target:0,fprog:r.requirement?r.funded/r.requirement:0})).sort((a,b)=>a.obj.localeCompare(b.obj)||a.code.localeCompare(b.code,undefined,{numeric:true}));
    el.innerHTML = `<table class="data-table abc-table"><thead><tr><th>Activity</th><th>Code</th><th>Unit</th><th>Achieved</th><th>Target</th><th>Est. funded</th><th>Requirement</th><th>Target %</th><th>Financial %</th><th>Gap</th></tr></thead><tbody>${items.map(r=>`<tr><td>${r.activity}</td><td>${r.code}</td><td>${r.unit}</td><td>${fmt.format(r.achievement)}</td><td>${fmt.format(r.target)}</td><td>${moneyFmt.format(r.funded)}</td><td>${moneyFmt.format(r.requirement)}</td><td>${percent(r.tprog)}</td><td>${percent(r.fprog)}</td><td class="${r.gap<0?'abc-negative':'abc-gap'}">${moneyFmt.format(r.gap)}</td></tr>`).join('') || '<tr><td colspan="10">No activity records found for this selection.</td></tr>'}</tbody></table>`;
  }
  function renderCountyList(rows){
    const el=qs('#abcCountyList'); if(!el) return;
    const m=new Map();
    rows.forEach(r=>{ if(!m.has(r.county)) m.set(r.county,[]); m.get(r.county).push(r); });
    const items=Array.from(m.entries()).map(([county,rs])=>({county,...totals(rs)})).sort((a,b)=>b.requirement-a.requirement).slice(0,8);
    el.innerHTML=items.map((r,i)=>`<div class="ranked-list-item"><div class="ranked-left"><span class="rank-badge">${i+1}</span><span class="rank-name">${r.county}</span></div><span class="rank-value">${shortFmt.format(r.requirement)} · ${percent(r.financialProgress)}</span></div>`).join('') || '<div class="top-empty">No county data.</div>';
  }
  function renderPartners(){
    const el=qs('#abcPartnersTable'); if(!el) return;
    const rows=DATA.serviceMapping.filter(matchesService);
    const orgTypes=new Map(); rows.forEach(r=>{ const k=clean(r['Reporting Organisation Type'])||'Unspecified'; orgTypes.set(k,(orgTypes.get(k)||0)+1); });
    qs('#abcPartnerTypeList').innerHTML=Array.from(orgTypes.entries()).sort((a,b)=>b[1]-a[1]).map(([k,v],i)=>`<div class="ranked-list-item"><div class="ranked-left"><span class="rank-badge">${i+1}</span><span class="rank-name">${k}</span></div><span class="rank-value">${v}</span></div>`).join('') || '<div class="top-empty">No service mapping records.</div>';
    el.innerHTML=`<table class="data-table abc-table"><thead><tr><th>County</th><th>Reporting org</th><th>Type</th><th>Implementing org</th><th>Activity / Code</th><th>Target</th><th>End date</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${clean(r.County)}</td><td>${clean(r['Reporting Organisation name'])}</td><td>${clean(r['Reporting Organisation Type'])}</td><td>${clean(r['Implementing Organisation Name'])}</td><td>${clean(r['UNS RM Objective Indicator'])}<br><small>${clean(r['UNS Activity Indicator '])}</small></td><td>${fmt.format(num(r.Target))} ${clean(r['Unit of indicator measurment'])}</td><td>${clean(r['Project End-date'])}</td></tr>`).join('') || '<tr><td colspan="7">No service mapping records found.</td></tr>'}</tbody></table>`;
  }
  function renderEnablers(){
    const el=qs('#abcEnablersTable'); if(!el) return;
    const rows=DATA.enablers.filter(matchesEnabler);
    const byUnit=new Map(); rows.forEach(r=>{ const k=getUnit(r)||'Other'; byUnit.set(k,(byUnit.get(k)||0)+num(r.ACHIEVEMENT)); });
    qs('#abcEnablerCards').innerHTML=Array.from(byUnit.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([k,v])=>`<div class="abc-mini-kpi"><span>${k}</span><strong>${shortFmt.format(v)}</strong></div>`).join('') || '<div class="top-empty">No enabler records.</div>';
    el.innerHTML=`<table class="data-table abc-table"><thead><tr><th>Implemented by</th><th>Year</th><th>Month</th><th>Result</th><th>Unit</th><th>Description</th></tr></thead><tbody>${rows.sort((a,b)=>num(b.ACHIEVEMENT)-num(a.ACHIEVEMENT)).map(r=>`<tr><td>${clean(r['REPORTING ORGANISATION'])}</td><td>${getAchYear(r)}</td><td>${clean(r['MONTH OF REPORT'])}</td><td>${fmt.format(num(r.ACHIEVEMENT))}</td><td>${getUnit(r)}</td><td>${clean(r['Activity Description'])}</td></tr>`).join('') || '<tr><td colspan="6">No enabler records found.</td></tr>'}</tbody></table>`;
  }

  function initTabs(){
    qsa('.abc-module-tab').forEach(btn=>btn.addEventListener('click',()=>activateTab(btn.dataset.tab)));
    qsa('[data-tab-jump]').forEach(el=>el.addEventListener('click',()=>activateTab(el.dataset.tabJump)));
  }
  function activateTab(tabId){
    if(!tabId) return;
    qsa('.abc-module-tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tabId));
    qsa('.abc-tab-panel').forEach(p=>p.classList.toggle('active', p.id===tabId));
    setTimeout(()=>{ if(map) map.invalidateSize(); }, 150);
  }
  function renderCountyProfile(rows){
    const el=qs('#abcCountyProfile'); if(!el) return;
    const county = state.county;
    if(!county || county==='All'){
      const all=totals(rows);
      el.innerHTML=`<div class="abc-empty-panel">Select a county from the filter or click a county on the Upper Nile map to view county-specific priorities, partners, gaps and activities.<br><br>Current state-wide requirement: <strong>${moneyFmt.format(all.requirement)}</strong> · estimated invested: <strong>${moneyFmt.format(all.funded)}</strong>.</div>`;
      return;
    }
    const countyRows = rows.filter(r=>norm(r.county)===norm(county));
    const t=totals(countyRows);
    const byObj=new Map(); countyRows.forEach(r=>{ if(!byObj.has(r.obj)) byObj.set(r.obj,[]); byObj.get(r.obj).push(r); });
    const objRows=Array.from(byObj.entries()).map(([obj,rs])=>({obj,label:OBJECTIVE_SHORT[obj]||obj,...totals(rs)})).sort((a,b)=>a.obj.localeCompare(b.obj));
    const activityRows=countyRows.map(r=>({...r,gap:r.requirement-r.funded,tprog:r.target?r.achievement/r.target:0,fprog:r.requirement?r.funded/r.requirement:0})).sort((a,b)=>b.gap-a.gap).slice(0,8);
    const partners = DATA.serviceMapping.filter(r=>state.county==='All'||norm(getCounty(r))===norm(county));
    const partnerNames = Array.from(new Set(partners.map(r=>clean(r['Reporting Organisation name'])||clean(r['Implementing Organisation Name'])).filter(Boolean))).sort();
    el.innerHTML=`
      <div class="abc-profile-card wide"><h3>${county} County Profile</h3><div class="abc-profile-stats">
        <div class="abc-profile-stat"><span>Funding requirement</span><strong>${moneyFmt.format(t.requirement)}</strong></div>
        <div class="abc-profile-stat"><span>Estimated invested</span><strong>${moneyFmt.format(t.funded)}</strong></div>
        <div class="abc-profile-stat"><span>Funding gap</span><strong>${moneyFmt.format(t.gap)}</strong></div>
        <div class="abc-profile-stat"><span>Target progress</span><strong>${percent(t.targetProgress)}</strong></div>
        <div class="abc-profile-stat"><span>Financial progress</span><strong>${percent(t.financialProgress)}</strong></div>
        <div class="abc-profile-stat"><span>Active objectives</span><strong>${objRows.length}</strong></div>
      </div></div>
      <div class="abc-profile-card"><h3>Active roadmap objectives</h3><div class="abc-gap-list">${objRows.map(o=>`<div class="abc-gap-row"><strong>${o.obj}: ${o.label}</strong><span>${percent(o.financialProgress)}</span></div>`).join('')||'No objective records.'}</div></div>
      <div class="abc-profile-card"><h3>Key partners / services</h3><div class="abc-gap-list">${partnerNames.slice(0,10).map(p=>`<div class="abc-gap-row"><strong>${p}</strong><span>service mapping</span></div>`).join('')||'<div class="top-empty">No service mapping records found for this county.</div>'}</div></div>
      <div class="abc-profile-card wide"><h3>Priority gaps and activities</h3><table class="abc-table-mini"><thead><tr><th>Activity</th><th>Code</th><th>Achieved</th><th>Target</th><th>Gap</th></tr></thead><tbody>${activityRows.map(r=>`<tr><td>${r.activity}</td><td>${r.code}</td><td>${fmt.format(r.achievement)}</td><td>${fmt.format(r.target)}</td><td>${moneyFmt.format(r.gap)}</td></tr>`).join('')||'<tr><td colspan="5">No activity records found.</td></tr>'}</tbody></table></div>`;
  }

  function renderInsights(rows){
    const el=qs('#abcInsights'); if(!el) return;
    const t=totals(rows);
    const byObj=new Map(); rows.forEach(r=>{ if(!byObj.has(r.obj)) byObj.set(r.obj,[]); byObj.get(r.obj).push(r); });
    const objStats=Array.from(byObj.entries()).map(([obj,rs])=>({obj,...totals(rs)}));
    const best=objStats.filter(x=>x.requirement).sort((a,b)=>b.financialProgress-a.financialProgress)[0];
    const gap=objStats.sort((a,b)=>b.gap-a.gap)[0];
    const over=rows.filter(r=>r.target && r.achievement/r.target>1).length;
    el.innerHTML=`<div class="simple-insight-item"><strong>Overall progress:</strong> ${percent(t.targetProgress)} against units and <span class="insight-blue">${percent(t.financialProgress)}</span> against financial requirements.</div>
    <div class="simple-insight-item"><strong>Highest financial progress:</strong> ${best?best.obj+' ('+percent(best.financialProgress)+')':'—'}.</div>
    <div class="simple-insight-item"><strong>Largest remaining gap:</strong> ${gap?gap.obj+' with '+moneyFmt.format(gap.gap):'—'}.</div>
    <div class="simple-insight-item"><strong>Overachievement flags:</strong> ${over} activity rows have achievements above target. These should be retained as evidence of progress, not capped.</div>`;
  }
  function metricForCounty(rows, county){
    const t=totals(rows.filter(r=>norm(r.county)===norm(county)));
    if(state.metric==='target') return t.targetProgress;
    if(state.metric==='gap') return t.gap;
    return t.financialProgress;
  }
  function colorMetric(v){
    if(state.metric==='gap'){
      if(!v) return '#eef5f7';
      if(v>20000000) return '#003b73'; if(v>10000000) return '#0b69b3'; if(v>3000000) return '#3fa0cf'; if(v>0) return '#9ed1df'; return '#34d399';
    }
    if(!v) return '#eef5f7';
    if(v>=1) return '#003b73'; if(v>=.65) return '#0b69b3'; if(v>=.35) return '#3fa0cf'; if(v>0) return '#9ed1df'; return '#eef5f7';
  }
  function featureCounty(feature){ const p=feature.properties||{}; return clean(p.ADM2_EN||p.County||p.county||p.NAME_2||p.ADM2_NAME||p.name||p.NAME); }
  function featureState(feature){ const p=feature.properties||{}; return clean(p.ADM1_EN||p.State||p.state||p.NAME_1||p.ADM1_NAME||p.admin1Name); }
  function mapStyle(feature){
    const county=featureCounty(feature), st=featureState(feature);
    const isUN = norm(st)==='uppernile' || DATA.targets.some(r=>norm(getCounty(r))===norm(county));
    const rows=aggregate(); const val=metricForCounty(rows, county);
    return {color:isUN?'rgba(68,95,110,.75)':'rgba(120,145,158,.25)', weight:isUN?.8:.35, fillColor:isUN?colorMetric(val):'#f0f3f5', fillOpacity:isUN?.92:.35, opacity:1};
  }
  function mapTooltip(feature){
    const county=featureCounty(feature); const rows=aggregate().filter(r=>norm(r.county)===norm(county)); const t=totals(rows);
    return `<div class="abc-map-tip"><strong>${county}</strong><span>${featureState(feature)||'Upper Nile'}</span><div>Target progress: <b>${percent(t.targetProgress)}</b></div><div>Financial progress: <b>${percent(t.financialProgress)}</b></div><div>Funding gap: <b>${moneyFmt.format(t.gap)}</b></div></div>`;
  }
  async function initMap(){
    const el=qs('#abc-map'); if(!el || typeof L==='undefined') return;
    map=L.map('abc-map',{zoomControl:true,attributionControl:false,scrollWheelZoom:true,zoomSnap:.25,zoomDelta:.25}).setView([9.8,32.7],7.2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',{maxZoom:10}).addTo(map);
    const paths=['data/SouthSudan.json','./data/SouthSudan.json','assets/SouthSudan.json','./assets/SouthSudan.json'];
    for(const p of paths){ try{ const r=await fetch(p,{cache:'no-store'}); if(r.ok){geojson=await r.json(); break;} }catch(e){} }
    if(!geojson){ el.innerHTML='<div class="overview-map-fallback">County GeoJSON not found. Please keep data/SouthSudan.json in the project.</div>'; return; }
    geoLayer=L.geoJSON(geojson,{style:mapStyle,onEachFeature:(feature,layer)=>{
      layer.bindTooltip(mapTooltip(feature),{className:'owid-county-tooltip',sticky:true,opacity:1});
      layer.on('mouseover',e=>{e.target.setStyle({weight:2.4,color:'#111827',fillOpacity:1}); if(!L.Browser.ie&&!L.Browser.opera&&!L.Browser.edge)e.target.bringToFront();});
      layer.on('mouseout',e=>{geoLayer.resetStyle(e.target);});
      layer.on('click',e=>{const county=featureCounty(feature); if(DATA.targets.some(r=>norm(getCounty(r))===norm(county))){state.county=county; qs('#abcCounty').value=county; render();}});
    }}).addTo(map);
    try{ map.fitBounds(geoLayer.getBounds(),{padding:[20,20],maxZoom:7.4}); setTimeout(()=>map.panBy([-260,-30],{animate:false}),80); }catch(e){}
  }
  function refreshMap(){ if(geoLayer){geoLayer.eachLayer(l=>{geoLayer.resetStyle(l); l.setTooltipContent(mapTooltip(l.feature));});} }
  function render(){ const rows=aggregate(); renderKpis(rows); renderObjectiveCards(rows); renderActivityTable(rows); renderCountyList(rows); renderPartners(); renderEnablers(); renderCountyProfile(rows); renderInsights(rows); refreshMap(); }
  document.addEventListener('DOMContentLoaded',()=>{ initTabs(); initFilters(); initMap().then(render); render(); });
})();
