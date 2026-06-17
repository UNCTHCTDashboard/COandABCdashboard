(function(){
  const D = window.UPPER_NILE_DATA;
  const money = v => '$' + Math.round(Number(v)||0).toLocaleString();
  const num = v => Math.round(Number(v)||0).toLocaleString();
  const pct = (a,b) => b ? Math.round((a/b)*100) : 0;
  const progressClass = v => v >= 76 ? 'un-progress-good' : (v >= 26 ? 'un-progress-mid' : 'un-progress-low');
  const progressBadge = v => `<span class="un-progress-badge ${progressClass(v)}">${v}%</span>`;
  const clamp = v => Math.min(100, Math.max(0, v));
  const byId = id => document.getElementById(id);
  const clean = v => (v ?? '').toString().trim();
  const codeNumber = code => Number((String(code).match(/\d+/) || [999])[0]);
  const nationalObjectiveLabel = code => {
    const n = codeNumber(code);
    return Number.isFinite(n) && n !== 999 ? `National Durable Solutions Objective ${n} (${code})` : code;
  };
  const roadmapObjectiveLabel = code => {
  const n = codeNumber(code);
  return Number.isFinite(n) && n !== 999
    ? `Upper Nile State Roadmap Objective ${n}<br><span class="unsrm-code">(${code})</span>`
    : code;
};
  const yearKey = r => clean(r['REPORTING YEAR'] || r['Strategy/Roadmap Year']);
  const countyKey = r => clean(r['COUNTY'] || r['County']);
  const objKey = r => {
    const code = clean(r['UNS Activity Indicator Code']);
    const match = code.match(/^UNSRM\s*(\d+)/i);
    if (match) return 'UNSRM ' + match[1];
    return clean(r['UNS RM Objective Code']);
  };
  const orgKey = r => clean(r['REPORTING ORGANISATION'] || r['Reporting Organisation name']);
  const targetKey = r => [countyKey(r), clean(r['Strategy/Roadmap Year'] || r['REPORTING YEAR']), clean(r['UNS Activity Indicator Code'])].join('|');
  const achievementKey = r => [countyKey(r), yearKey(r), clean(r['UNS Activity Indicator Code'])].join('|');
  const targetByKey = new Map();
  (D.targets || []).forEach(t => {
    const k = targetKey(t);
    if (!targetByKey.has(k)) targetByKey.set(k, {targetUnits:0, targetFinancial:0, unitCost:0});
    const g = targetByKey.get(k);
    g.targetUnits += Number(t['UNS Activity Indicator Target']) || 0;
    g.targetFinancial += Number(t['Total Requirement']) || 0;
    g.unitCost = g.targetUnits ? (g.targetFinancial / g.targetUnits) : (Number(t['Unit Cost']) || 0);
  });
  const hasMatchingTarget = r => targetByKey.has(achievementKey(r));
  const progressUnits = r => Number(r['Progress Units'] ?? r['ACHIEVEMENT']) || 0;
  const progressFinancial = r => {
    const explicit = Number(r['Progress Financial']);
    if (Number.isFinite(explicit) && explicit) return explicit;
    const t = targetByKey.get(achievementKey(r));
    return (Number(r['ACHIEVEMENT']) || 0) * (t ? (Number(t.unitCost) || 0) : 0);
  };
  function targetFinancialCalculation(rows){
    const keys = new Set(rows.map(targetKey));
    return [...keys].reduce((s,k)=>s + ((targetByKey.get(k)||{}).targetFinancial || 0), 0);
  }
  function targetUnitCalculation(rows){
    const keys = new Set(rows.map(targetKey));
    return [...keys].reduce((s,k)=>s + ((targetByKey.get(k)||{}).targetUnits || 0), 0);
  }
  const natKey = r => clean(r['National DS Strategy Objective Code']);

  const DEFAULT_YEAR = '2026 Tier I';
  const activityKey = r => clean(r['UNS Activity Indicator '] || r['UNS Activity Indicator']);
  const unitKey = r => clean(r['Unit of indicator measurment']);
  const state = {year:DEFAULT_YEAR, county:'All', org:'All', impl:'All', objective:'All', national:'All', activity:'All', unit:'All', selectedCounty:null, map:null, geoLayer:null, upperBounds:null, shapeSvgs:[]};

  function unique(arr){return [...new Set(arr.filter(v=>v!=='' && v!=null))].sort((a,b)=>String(a).localeCompare(String(b), undefined, {numeric:true}));}
  function fillSelect(id, values, label='All'){
    const el=byId(id); el.innerHTML='';
    const opts=[label,...values]; opts.forEach(v=>{const o=document.createElement('option'); o.value=v; o.textContent=v; el.appendChild(o);});
  }
  function initFilters(){
    const detectedYears = unique([...D.achievements.map(yearKey), ...D.targets.map(yearKey)]);
    const orderedYears = (D.yearOrder || []).filter(y => detectedYears.includes(y));
    const extraYears = detectedYears.filter(y => !orderedYears.includes(y));
    fillSelect('filter-year', [...orderedYears, ...extraYears]);
    if ([...orderedYears, ...extraYears].includes(DEFAULT_YEAR)) {
      byId('filter-year').value = DEFAULT_YEAR;
    }

    refreshFilterOptions();
    setFilterVisibilityForPanel();

    ['year','county','org','impl','objective','national','activity','unit'].forEach(k=>{
      const el = byId('filter-'+k);
      if(!el) return;
      el.addEventListener('change', e=>{
        state[k]=e.target.value;
        const panelTarget = currentPanelTarget ? currentPanelTarget() : '';
        if(panelTarget === 'partners' || panelTarget === 'enablers'){
          setFilterVisibilityForPanel(k);
        } else {
          refreshFilterOptions(k);
          setFilterVisibilityForPanel(k);
        }
        renderAll();
      });
    });

    byId('reset-filters').addEventListener('click', ()=>{
      state.year = DEFAULT_YEAR;
      state.county = state.org = state.impl = state.objective = state.national = state.activity = state.unit = 'All';
      refreshFilterOptions();
      setFilterVisibilityForPanel();
      renderAll();
      if(state.map&&state.upperBounds) state.map.fitBounds(state.upperBounds,{padding:[20,20]});
    });
  }

  function filterRowsForOptions(rows, type, ignoreKey){
    return rows.filter(r=>{
      const y=type==='targets'?clean(r['Strategy/Roadmap Year']):yearKey(r);
      const c=countyKey(r);
      const o=objKey(r);
      const org=orgKey(r);
      const act=activityKey(r);
      const unit=unitKey(r);

      if(type==='achievements' && !hasMatchingTarget(r)) return false;
      if(ignoreKey !== 'year' && state.year !== 'All' && y !== state.year) return false;
      if(ignoreKey !== 'county' && state.county !== 'All' && c !== state.county) return false;
      if(ignoreKey !== 'objective' && state.objective !== 'All' && o !== state.objective) return false;
      if(ignoreKey !== 'national' && state.national !== 'All' && !logframeMatchesNational(r, state.national)) return false;
      if(ignoreKey !== 'activity' && state.activity !== 'All' && act !== state.activity) return false;
      if(ignoreKey !== 'unit' && state.unit !== 'All' && unit !== state.unit) return false;
      if(type==='achievements' && ignoreKey !== 'org' && state.org !== 'All' && org !== state.org) return false;
      return true;
    });
  }

  function setSelectOptions(id, values, currentValue, label='All'){
    const el = byId(id);
    if(!el) return;
    const opts = [label, ...values];
    el.innerHTML = '';
    opts.forEach(v=>{
      const o=document.createElement('option');
      o.value=v;
      o.textContent=v;
      el.appendChild(o);
    });
    el.value = opts.includes(currentValue) ? currentValue : label;
    return el.value;
  }

  function refreshFilterOptions(changedKey){
    const yearValues = unique([...D.achievements.map(yearKey), ...D.targets.map(yearKey)]);
    const orderedYears = (D.yearOrder || []).filter(y => yearValues.includes(y));
    const extraYears = yearValues.filter(y => !orderedYears.includes(y));
    state.year = setSelectOptions('filter-year', [...orderedYears, ...extraYears], state.year) || state.year;

    const countyRows = [
      ...filterRowsForOptions(D.achievements,'achievements','county'),
      ...filterRowsForOptions(D.targets,'targets','county')
    ];
    state.county = setSelectOptions('filter-county', unique(countyRows.map(countyKey)), state.county) || state.county;

    const orgRows = filterRowsForOptions(D.achievements,'achievements','org');
    state.org = setSelectOptions('filter-org', unique(orgRows.map(orgKey)), state.org) || state.org;

    const objectiveRows = [
      ...filterRowsForOptions(D.achievements,'achievements','objective'),
      ...filterRowsForOptions(D.targets,'targets','objective')
    ];
    state.objective = setSelectOptions('filter-objective', unique(objectiveRows.map(objKey)), state.objective) || state.objective;

    const nationalRows = [
      ...filterRowsForOptions(D.achievements,'achievements','national'),
      ...filterRowsForOptions(D.targets,'targets','national')
    ];
    const nationalValues = unique(nationalRows.flatMap(r => {
      const activityCode = clean(r['UNS Activity Indicator Code']);
      const objectiveCode = objKey(r);
      return D.logframe
        .filter(l =>
          clean(l['UNS RM Objective Code']) === objectiveCode &&
          (!activityCode || clean(l['UNS Activity Indicator Code']) === activityCode)
        )
        .map(l => clean(l['National DS Strategy Objective Code']));
    }));
    state.national = setSelectOptions('filter-national', nationalValues, state.national) || state.national;

    const activityRowsFiltered = [
      ...filterRowsForOptions(D.achievements,'achievements','activity'),
      ...filterRowsForOptions(D.targets,'targets','activity')
    ];
    state.activity = setSelectOptions('filter-activity', unique(activityRowsFiltered.map(activityKey)), state.activity) || state.activity;

    const unitRowsFiltered = [
      ...filterRowsForOptions(D.achievements,'achievements','unit'),
      ...filterRowsForOptions(D.targets,'targets','unit')
    ];
    state.unit = setSelectOptions('filter-unit', unique(unitRowsFiltered.map(unitKey)), state.unit) || state.unit;
  }

  function logframeMatchesNational(r, nationalCode){
    if(nationalCode === 'All') return true;
    const activityCode = clean(r['UNS Activity Indicator Code']);
    const objectiveCode = objKey(r);
    return D.logframe.some(l =>
      clean(l['National DS Strategy Objective Code']) === nationalCode &&
      clean(l['UNS RM Objective Code']) === objectiveCode &&
      (!activityCode || clean(l['UNS Activity Indicator Code']) === activityCode)
    );
  }
  function objectiveForNational(nat){
    return unique(D.logframe.filter(l=>clean(l['National DS Strategy Objective Code'])===nat).map(l=>clean(l['UNS RM Objective Code'])));
  }
  function applyFilters(rows, type){
    return rows.filter(r=>{
      const y=type==='targets'?clean(r['Strategy/Roadmap Year']):yearKey(r);
      const c=countyKey(r);
      const o=objKey(r);
      const org=orgKey(r);
      const act=activityKey(r);
      const unit=unitKey(r);
      if(type==='achievements' && !hasMatchingTarget(r)) return false;
      if(state.year!=='All' && y!==state.year) return false;
      if(state.county!=='All' && c!==state.county) return false;
      if(state.objective!=='All' && o!==state.objective) return false;
      if(state.national!=='All' && !logframeMatchesNational(r, state.national)) return false;
      if(state.activity!=='All' && act!==state.activity) return false;
      if(state.unit!=='All' && unit!==state.unit) return false;
      if(type==='achievements' && state.org!=='All' && org!==state.org) return false;
      return true;
    });
  }
  function aggregate(){
    const achievements=applyFilters(D.achievements,'achievements');
    const targets=applyFilters(D.targets,'targets');
    const service=D.serviceMapping.filter(r=>{
      if(state.county!=='All' && countyKey(r)!==state.county) return false;
      if(state.objective!=='All' && !clean(r['Upper Nile State RM Objective']).includes((D.objectives.find(o=>o.code===state.objective)||{}).upperNileObjective?.slice(0,30) || '___')) return state.objective==='All';
      return true;
    });
    const enablers=applyFilters(D.enablers,'enablers');
    const byKey={};
    targets.forEach(t=>{
      const key=[countyKey(t), clean(t['Strategy/Roadmap Year']), clean(t['UNS Activity Indicator Code'])].join('|');
      if(!byKey[key]) byKey[key]={target:0, requirement:0, unitCost:0};
      byKey[key].target += Number(t['UNS Activity Indicator Target'])||0;
      byKey[key].requirement += Number(t['Total Requirement'])||0;
      byKey[key].unitCost = Number(t['Unit Cost'])||byKey[key].unitCost;
    });
    const achievementTotal = achievements.reduce((s,a)=>s+progressUnits(a),0);
    const estimated = achievements.reduce((s,a)=>s+progressFinancial(a),0);
    const targetTotal = targetUnitCalculation(targets);
    const requirement = targetFinancialCalculation(targets);
    return {achievements, targets, service, enablers, targetTotal, achievementTotal, estimated, requirement, gap: requirement-estimated};
  }
  function group(rows, keyFn, initFn, addFn){const m=new Map(); rows.forEach(r=>{const k=keyFn(r)||'Not specified'; if(!m.has(k)) m.set(k,initFn(k)); addFn(m.get(k),r);}); return [...m.values()];}
  function sumAchievementBy(codes, unitIncludes){
    const a=aggregate();
    return a.achievements.filter(r=>{
      const code=clean(r['UNS Activity Indicator Code']);
      const unit=clean(r['Unit of indicator measurment']).toLowerCase();
      const codeOk=Array.isArray(codes)?codes.includes(code):code===codes;
      const unitOk=!unitIncludes || unitIncludes.some(u=>unit.includes(u.toLowerCase()));
      return codeOk && unitOk;
    }).reduce((sum,r)=>sum+progressUnits(r),0);
  }
  function fmtCompact(v, moneyFlag = false) {
  const n = Number(v) || 0;
  const sign = n < 0 ? "-" : "";
  const x = Math.abs(n);

  let val;
  if (x >= 1000000) {
    val = (x / 1000000).toFixed(1) + "M";
  } else if (x >= 1000) {
    val = (x / 1000).toFixed(1) + "K";
  } else {
    val = x.toLocaleString();
  }

  return (moneyFlag ? sign + "$" : sign) + val;
}
  function formatGap(v){return v<0?'('+money(Math.abs(v))+')':money(v);}
  function codeNum(code){return Number((String(code).match(/\d+/)||[999])[0]);}


  function renderFinancialProgressMatrix(a){
    const objectiveRows = D.objectives.map(o => {
      const ach = a.achievements.filter(r => objKey(r) === o.code);
      const tar = a.targets.filter(r => objKey(r) === o.code);
      const est = ach.reduce((sum,r)=>sum+progressFinancial(r),0);
      const req = targetFinancialCalculation(tar);
      return {level:'objective', label:o.code, detail:o.upperNileObjective, est, req, progress:pct(est,req)};
    });
    let rows = objectiveRows;
    if (state.objective !== 'All') {
      const childRows = roadmapActivitySummary(a, state.objective).map(r => ({
        level:'unit', label:'↳ ' + (r.unit || 'Unit not specified'), detail:r.activity, est:r.estimated, req:r.requirement, progress:pct(r.estimated,r.requirement)
      }));
      rows = objectiveRows.filter(r=>r.label===state.objective).concat(childRows);
    }
    const headers = [
      {label:'UNS RM Objective Code', f:r=>`<strong class="${r.level==='unit'?'un-child-row':''}">${r.label}</strong>`},
      {label:'Progress towards financial targets', f:r=>`${r.progress}%`},
      {label:'Estimated funded', f:r=>fmtCompact(r.est,true)},
      {label:'Target financial', f:r=>fmtCompact(r.req,true)}
    ];
    const table = byId('financial-progress-table');
    if (table) table.innerHTML = tableHTML(headers, rows);
  }

  function rowsForCodes(rows, codes){
    const codeList = Array.isArray(codes) ? codes : [codes];
    return rows.filter(r => codeList.includes(clean(r['UNS Activity Indicator Code'])));
  }
  function metricForCodes(a, codes, label, icon, sub, description){
    const rows = rowsForCodes(a.achievements, codes);
    const value = rows.reduce((sum,r)=>sum+progressUnits(r),0);
    const counties = unique(rows.map(countyKey)).slice(0,10).join(', ') || 'No county reported';
    const orgs = unique(rows.map(orgKey)).slice(0,10).join(', ') || 'No reporting organisation reported';
    const activities = unique(rows.map(activityKey)).slice(0,5).join('; ') || sub || '';
    return {label, icon, value, sub, description:description || sub, counties, orgs, activities};
  }
  function buildFlagshipMetrics(a){
    return [
      metricForCodes(a, 'UNSRM 1.1.1', 'Houses constructed', '🏠', 'Family shelters built for displaced households', 'Support in building shelter on family plots for internally displaced persons (IDPs) and returnees.'),
      metricForCodes(a, 'UNSRM 2.1.1', 'Households reached with HLP', '🏡', 'Legal aid, counselling and land/property support', 'Housing, Land and Property support, including legal aid, legal counselling, conflict resolution, cash-based support for shelter, and recovery of title deeds.'),
      metricForCodes(a, 'UNSRM 3.2', 'Households trained for livelihoods', '🌱', 'Vocational training and market-based skills', 'Market-based vocational training, start-up support, and cooperative farming assistance.'),
      metricForCodes(a, 'UNSRM 3.3', 'Households supported for livelihoods', '🌾', 'Agricultural inputs, fishing kits and livelihood assistance', 'Provision of agricultural inputs, vegetable and fishing kits, and cash-based interventions to mitigate protection risks.'),
      metricForCodes(a, 'UNSRM 4.2.2', 'Hospitals supported', '🏥', 'State and county hospitals rehabilitated', 'Rehabilitation or reconstruction of state and county hospitals.'),
      metricForCodes(a, 'UNSRM 4.3', 'Schools supported', '🎓', 'Schools rehabilitated or equipped', 'Education services including expansion, rehabilitation, equipping, or support to prioritized school facilities.'),
      metricForCodes(a, 'UNSRM 4.1.2', 'Water plants rehabilitated', '💧', 'Water treatment infrastructure restored', 'Rehabilitation of water treatment plants to improve continuity of basic water services.'),
      metricForCodes(a, 'UNSRM 5.1.2', 'Peace structures supported', '☮️', 'Community peace and cohesion mechanisms strengthened', 'Establishment or enhancement of peaceful cohesion structures that support dispute resolution and social cohesion.')
    ];
  }

  function buildAdditionalAchievementMetrics(a){
    return [
      metricForCodes(a, 'UNSRM 1.1.4', 'Explosive ordnance area cleared', '⚠️', 'Residential and access-road areas cleared', 'Explosive ordnance area clearance to enable safer residential access and implementation of durable solutions activities.'),
      metricForCodes(a, 'UNSRM 4.1.1', 'Water points rehabilitated', '🚰', 'Damaged water systems rehabilitated', 'Provision of water, sanitation and hygiene support through rehabilitation of damaged water systems.'),
      metricForCodes(a, 'UNSRM 4.4.1', 'Courts supported', '⚖️', 'Access to justice mechanisms strengthened', 'Support to remedial justice mechanisms and local authorities for reporting and resolving safety or protection issues.'),
      metricForCodes(a, 'UNSRM 4.4.2', 'Police stations supported', '👮', 'Police service capacity enhanced', 'Support to police services and safety infrastructure in key return locations.'),
      metricForCodes(a, 'UNSRM 5.1.1', 'Protection structures strengthened', '🛡️', 'Community protection mechanisms enhanced', 'Establishment or enhancement of community-based protection structures.'),
      metricForCodes(a, 'UNSRM 5.1.3', 'Peace advocacy activities', '🕊️', 'Advocacy for peaceful dispute resolution', 'Advocacy activities supporting peaceful resolution of disputes and conflict.'),
      metricForCodes(a, 'UNSRM 2.1.2', 'HLP awareness activities', '📣', 'Outreach and awareness-raising activities', 'Outreach and awareness-raising activities on Housing, Land and Property issues.'),
      metricForCodes(a, 'UNSRM 2.1.3', 'Government HLP trainings', '🎓', 'Government staff trained on HLP issues', 'Training of government staff to support Housing, Land and Property issues.')
    ];
  }
  function buildEnablerOverviewMetrics(a){
    const rows = a.enablers || [];
    const counties = unique(rows.map(countyKey));
    const orgs = unique(rows.map(orgKey));
    const objectives = unique(rows.map(objKey));
    const recordsWithAchievement = rows.filter(r => (Number(r['ACHIEVEMENT']) || 0) > 0).length;
    const tooltip = (label) => `${label}\n\nCounties: ${counties.slice(0,10).join(', ') || 'No county reported'}\nReporting organisations: ${orgs.slice(0,10).join(', ') || 'No reporting organisation reported'}\nObjectives supported: ${objectives.join(', ') || 'No objective reported'}`;
    return [
      {label:'Counties with enablers', value:counties.length, icon:'📍', sub:'Counties with reported enabling activities', description:'Number of counties where enabling activities have been reported.', tooltip:tooltip('Counties with enablers')},
      {label:'Reporting organisations', value:orgs.length, icon:'🤝', sub:'Organisations reporting enabling activities', description:'Number of reporting organisations contributing enabling activities.', tooltip:tooltip('Reporting organisations')},
      {label:'UNSRM objectives supported', value:objectives.length, icon:'🎯', sub:'Roadmap objectives supported by enablers', description:'Number of Upper Nile Roadmap objectives supported by reported enabler activities.', tooltip:tooltip('UNSRM objectives supported')}
    ];
  }
  function buildImpactMetrics(a){
    return buildFlagshipMetrics(a);
  }
  function metricTooltip(m){
    if(m.tooltip) return m.tooltip;
    return `${m.description || m.sub}\n\nCounties: ${m.counties}\nReporting organisations: ${m.orgs}\nActivities: ${m.activities}`;
  }
  function kpiCardHTML(k){
    return `<div class="un-kpi un-impact-kpi" title="${metricTooltip(k).replace(/"/g,'&quot;')}"><div class="un-kpi-icon">${k.icon||''}</div><div class="un-kpi-label">${k.label}</div><div class="un-kpi-value">${k.value}</div><div class="un-kpi-sub">${k.sub}</div></div>`;
  }
  function enablerUnitDisplay(category, unit){
    const key = `${category}|${unit}`.toLowerCase();

    const map = {
      'peace and community cohesion|people': {
        label:'People reached through peace and cohesion activities',
        sub:'Community members reached through peace, protection, and cohesion activities.'
      },
      'peace and community cohesion|peace-building community engagement': {
        label:'Peacebuilding engagements conducted',
        sub:'Community engagement activities supporting peacebuilding and social cohesion.'
      },
      'peace and community cohesion|training': {
        label:'Trainings delivered',
        sub:'Capacity-building sessions supporting local peace and protection actors.'
      },
      'support service and livelihood|farm animals': {
        label:'Livestock and farm animals supported',
        sub:'Livelihood assets supported to strengthen household resilience.'
      },
      'support service and livelihood|people': {
        label:'People reached through livelihood/service support',
        sub:'Individuals reached through livelihood or service-related enabling activities.'
      },
      'support service and livelihood|socioeconomic evaluation': {
        label:'Socioeconomic evaluations completed',
        sub:'Assessments completed to inform area-based programming and targeting.'
      },
      'support service and livelihood|woman training center': {
        label:'Women’s training centre supported',
        sub:'Facility support linked to skills, livelihoods, or community resilience.'
      },
      'support service and livelihood|training': {
        label:'Trainings delivered',
        sub:'Capacity-building activities under livelihood and service support.'
      },
      'public services|patients': {
        label:'Patients supported through public services',
        sub:'People reached through health and public service enabling activities.'
      },
      'public services|people': {
        label:'People reached through public service support',
        sub:'Community members supported through public service activities.'
      },
      'public services|awarness-raising sessions': {
        label:'Awareness-raising sessions conducted',
        sub:'Sessions conducted to improve community awareness and access to services.'
      },
      'public services|awareness-raising sessions': {
        label:'Awareness-raising sessions conducted',
        sub:'Sessions conducted to improve community awareness and access to services.'
      },
      'public services|training': {
        label:'Trainings delivered',
        sub:'Capacity-building activities for public service actors or communities.'
      },
      'public services|mobile courts': {
        label:'Mobile courts supported',
        sub:'Mobile justice mechanisms supported to improve access to justice.'
      },
      'public services|high court': {
        label:'High court supported',
        sub:'Justice institution support under public service enabling activities.'
      },
      'public services|joint election operation center in malakal': {
        label:'Joint election operation centre supported',
        sub:'Institutional support to public administration and coordination services.'
      }
    };

    return map[key] || {
      label: unit || 'Not specified',
      sub: 'Reported enabling result under the selected filters.'
    };
  }

  function enablerGroupTooltip(category, unit, rows, display){
    const relevant = rows.filter(r => enablerCategoryKey(r) === category && (enablerUnitKey(r) || 'Not specified') === unit);
    const counties = unique(relevant.map(enablerCountyKey)).slice(0,10).join(', ') || 'No county reported';
    const orgs = unique(relevant.map(enablerOrgKey)).slice(0,10).join(', ') || 'No reporting organisation reported';
    return `${display.label}\n\n${display.sub}\n\nCounties: ${counties}\nReporting organisations: ${orgs}`;
  }

  function enablerGroupsOverviewHTML(a){
    const rows = applyEnablerFilters(D.enablers || []);
    const categoryOrder = ['Peace and Community Cohesion','Support Service and Livelihood','Public Services'];
    const categoryGroups = group(rows, enablerCategoryKey, k=>({category:k, units:new Map(), total:0}), (g,r)=>{
      const unit = enablerUnitKey(r) || 'Not specified';
      const value = enablerResultValue(r);
      g.total += value;
      g.units.set(unit, (g.units.get(unit)||0) + value);
    }).sort((a,b)=>{
      const ai = categoryOrder.indexOf(a.category);
      const bi = categoryOrder.indexOf(b.category);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return categoryGroups.map(g=>{
      const unitCards = [...g.units.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([unit,value])=>{
        const display = enablerUnitDisplay(g.category, unit);
        const tooltip = enablerGroupTooltip(g.category, unit, rows, display).replace(/"/g,'&quot;');
        return `
        <div class="un-enabler-unit-card un-enabler-unit-card-compact un-impact-kpi" title="${tooltip}">
          <span>${display.label}</span>
          <strong>${fmtCompact(value)}</strong>
          <p>${display.sub}</p>
        </div>
      `;
      }).join('');
      return `
        <div class="un-enabler-category un-enabler-category-compact">
          <h4>${g.category}</h4>
          <div class="un-enabler-unit-grid un-enabler-unit-grid-compact">${unitCards}</div>
        </div>
      `;
    }).join('');
  }

  function renderKpis(a){
    const impact = buildFlagshipMetrics(a).map(m => ({...m, value:fmtCompact(m.value)}));
    const additional = buildAdditionalAchievementMetrics(a).map(m => ({...m, value:fmtCompact(m.value)}));
    const enablers = buildEnablerOverviewMetrics(a).map(m => ({...m, value:fmtCompact(m.value)}));
    const funding=[
      {label:'Estimated funding invested', value:fmtCompact(a.estimated,true), sub:'Reported investment linked to delivered activities', icon:'💰', description:'Estimated funding already invested in activities reported under the current filters.', counties:'Filtered selection', orgs:'Filtered selection', activities:'All filtered roadmap activities'},
      {label:'Funding requirement', value:fmtCompact(a.requirement,true), sub:'Total requirement to deliver roadmap targets', icon:'📌', description:'Total funding requirement for the selected roadmap targets and filters.', counties:'Filtered selection', orgs:'Filtered selection', activities:'All filtered roadmap activities'},
      ...(state.objective !== 'All' ? [{label:'Financial progress', value:pct(a.estimated,a.requirement)+'%', sub:'Estimated funding compared with requirement', icon:'📈', description:'Share of estimated funding against the funding requirement for the selected objective.', counties:'Filtered selection', orgs:'Filtered selection', activities:'Selected objective'}] : [])
    ];
    const grid = byId('kpi-grid');
    grid.classList.remove('powerbi-kpis');
    grid.classList.add('un-kpi-dashboard','un-impact-kpis');
    grid.innerHTML = `
      <div class="un-kpi-block un-kpi-block-funding">
        <div class="un-kpi-section-title">Funding</div>
        <div class="un-kpi-block-grid un-kpi-funding-grid">${funding.map(kpiCardHTML).join('')}</div>
      </div>
      <div class="un-kpi-block un-kpi-block-achievements">
        <div class="un-kpi-section-title">Key achievements</div>
        <div class="un-kpi-block-grid un-kpi-achievement-grid">${impact.map(kpiCardHTML).join('')}</div>
      </div>
      <div class="un-kpi-block un-kpi-block-additional-achievements">
        <div class="un-kpi-section-title">Additional achievements</div>
        <div class="un-kpi-block-grid un-kpi-additional-grid">${additional.map(kpiCardHTML).join('')}</div>
      </div>
      <div class="un-kpi-block un-kpi-block-enablers">
        <div class="un-kpi-section-title">Enablers</div>
        <div class="un-kpi-block-grid un-kpi-enabler-grid">${enablers.map(kpiCardHTML).join('')}</div>
        <div class="un-enabler-overview-groups">${enablerGroupsOverviewHTML(a)}</div>
      </div>
    `;
  }
  function renderImpactGlance(a){
    const el = byId('impact-glance');
    if(!el) return;
    el.innerHTML = '';
  }
  function renderAlignment(){
    const groups = new Map();
    D.logframe.forEach(l => {
      const nationalCode = clean(l['National DS Strategy Objective Code']);
      const nationalObjective = clean(l['National DS Strategy Objective']);
      const roadmapCode = clean(l['UNS RM Objective Code']);
      const roadmapObjective = clean(l['Upper Nile State RM Objective']);
      if (!nationalCode) return;
      if (!groups.has(nationalCode)) {
        groups.set(nationalCode, { nationalCode, nationalObjective, linked: new Map() });
      }
      if (roadmapCode && !groups.get(nationalCode).linked.has(roadmapCode)) {
        groups.get(nationalCode).linked.set(roadmapCode, { roadmapCode, roadmapObjective });
      }
    });

    const codeNum = code => Number((String(code).match(/\d+/) || [999])[0]);
    const cards = [...groups.values()]
      .sort((a,b)=> codeNum(a.nationalCode) - codeNum(b.nationalCode))
      .map(g => ({
        ...g,
        linked: [...g.linked.values()].sort((a,b)=>codeNum(a.roadmapCode)-codeNum(b.roadmapCode))
      }));

    byId('alignment-cards').innerHTML = cards.map(g=>`
      <div class="un-align-card un-align-card-grouped" data-national="${g.nationalCode}" title="Click to filter by ${nationalObjectiveLabel(g.nationalCode)}">
        <div class="un-align-code">${nationalObjectiveLabel(g.nationalCode)}</div>
        <div class="un-align-national">${g.nationalObjective || 'National Durable Solutions Strategy objective'}</div>
        <div class="un-align-arrow">↓</div>
        <div class="un-align-linked-title">Linked Upper Nile roadmap objective${g.linked.length>1?'s':''}</div>
        <div class="un-align-linked-list">
          ${g.linked.map(o=>`<div class="un-align-linked-item"><span class="un-pill un-pill-long">${roadmapObjectiveLabel(o.roadmapCode)}</span><strong>${o.roadmapObjective}</strong></div>`).join('')}
        </div>
      </div>`).join('');

    document.querySelectorAll('.un-align-card').forEach(card=>card.addEventListener('click',()=>{
      state.national = card.dataset.national;
      state.objective = 'All';
      byId('filter-national').value = state.national;
      byId('filter-objective').value = 'All';
      renderAll();
      document.querySelector('[data-target="roadmap"]').click();
    }));
  }
  function objectiveLeadMetric(a, code){
    const map = {
      'UNSRM 1': ['UNSRM 1.1.1', 'Shelters supported'],
      'UNSRM 2': ['UNSRM 2.1.1', 'HLP households assisted'],
      'UNSRM 3': [['UNSRM 3.2','UNSRM 3.3'], 'Livelihood households reached'],
      'UNSRM 4': [['UNSRM 4.2.1','UNSRM 4.2.2','UNSRM 4.3','UNSRM 4.1.1','UNSRM 4.1.2'], 'Basic service assets supported'],
      'UNSRM 5': [['UNSRM 5.1.1','UNSRM 5.1.2'], 'Protection/peace structures']
    };
    const item = map[code];
    if(!item) return {value:0,label:'Reported achievements'};
    const rows = rowsForCodes(a.achievements, item[0]);
    return {value:rows.reduce((s,r)=>s+progressUnits(r),0), label:item[1]};
  }
  function objectiveComponentDisplay(code, activity, unit){
    const map = {
      'UNSRM 1.1.1': {icon:'🏠', label:'Shelters'},
      'UNSRM 1.1.2': {icon:'🏘️', label:'Settlement plans'},
      'UNSRM 1.1.3': {icon:'🧱', label:'Community infrastructure'},
      'UNSRM 1.1.4': {icon:'⚠️', label:'Explosive ordnance areas cleared'},
      'UNSRM 2.1.1': {icon:'🏡', label:'HLP households assisted'},
      'UNSRM 2.1.2': {icon:'📣', label:'HLP awareness activities'},
      'UNSRM 2.1.3': {icon:'🎓', label:'Government HLP trainings'},
      'UNSRM 3.1': {icon:'💼', label:'Livelihood opportunities'},
      'UNSRM 3.2': {icon:'🌱', label:'Households trained'},
      'UNSRM 3.3': {icon:'🌾', label:'Households supported'},
      'UNSRM 4.1.1': {icon:'🚰', label:'Water points'},
      'UNSRM 4.1.2': {icon:'💧', label:'Water plants'},
      'UNSRM 4.2.1': {icon:'🏥', label:'Health facilities'},
      'UNSRM 4.2.2': {icon:'🏥', label:'Hospitals'},
      'UNSRM 4.3': {icon:'🎓', label:'Schools'},
      'UNSRM 4.4.1': {icon:'⚖️', label:'Courts'},
      'UNSRM 4.4.2': {icon:'👮', label:'Police stations'},
      'UNSRM 5.1.1': {icon:'🛡️', label:'Protection structures'},
      'UNSRM 5.1.2': {icon:'☮️', label:'Peace structures'},
      'UNSRM 5.1.3': {icon:'🕊️', label:'Peace advocacy activities'}
    };
    if(map[code]) return map[code];
    const text = `${code} ${unit} ${activity}`.toLowerCase();
    if(text.includes('water')) return {icon:'💧', label:unit || activity || code};
    if(text.includes('school') || text.includes('education')) return {icon:'🎓', label:unit || activity || code};
    if(text.includes('health') || text.includes('hospital')) return {icon:'🏥', label:unit || activity || code};
    if(text.includes('court') || text.includes('justice')) return {icon:'⚖️', label:unit || activity || code};
    if(text.includes('police')) return {icon:'👮', label:unit || activity || code};
    if(text.includes('peace')) return {icon:'☮️', label:unit || activity || code};
    if(text.includes('training')) return {icon:'🎓', label:unit || activity || code};
    if(text.includes('house') || text.includes('shelter')) return {icon:'🏠', label:unit || activity || code};
    return {icon:'•', label:unit || activity || code || 'Reported component'};
  }

  function objectiveReportedComponents(achievementRows){
    const grouped = group(
      achievementRows.filter(r => progressUnits(r) > 0),
      r => clean(r['UNS Activity Indicator Code']) || activityKey(r) || 'Reported component',
      k => ({code:k, activity:'', unit:'', value:0}),
      (g,r)=>{
        g.value += progressUnits(r);
        if(!g.activity) g.activity = activityKey(r) || clean(r['UNS Roadmap Activities']) || clean(r['UNS Activity Indicator']) || g.code;
        if(!g.unit) g.unit = unitKey(r);
      }
    );
    return grouped
      .map(g=>({...g, display:objectiveComponentDisplay(g.code, g.activity, g.unit)}))
      .sort((a,b)=>b.value-a.value || String(a.code).localeCompare(String(b.code), undefined, {numeric:true}));
  }

  function objectiveComponentsHTML(components, code){
    if(!components.length){
      return `<div class="un-objective-components"><div class="un-objective-components-title">Reported components</div><div class="un-objective-component-empty">No reported components under the selected filters.</div></div>`;
    }
    const visibleCount = 4;
    const items = components.map((c,i)=>`
      <div class="un-objective-component ${i >= visibleCount ? 'un-objective-component-extra' : ''}">
        <span class="un-objective-component-icon">${c.display.icon}</span>
        <strong>${fmtCompact(c.value)}</strong>
        <span>${c.display.label}</span>
      </div>
    `).join('');
    const more = components.length > visibleCount
      ? `<button type="button" class="un-objective-more" data-expanded="false">+ ${components.length - visibleCount} more activity area${components.length - visibleCount > 1 ? 's' : ''} ▾</button>`
      : '';
    return `<div class="un-objective-components" data-objective-components="${code}"><div class="un-objective-components-title">Reported components</div>${items}${more}</div>`;
  }

  function renderObjectives(a){
    const rows=D.objectives.map(o=>{
      const ach=a.achievements.filter(r=>objKey(r)===o.code);
      const tar=a.targets.filter(r=>objKey(r)===o.code);
      const est=ach.reduce((s,r)=>s+progressFinancial(r),0);
      const req=targetFinancialCalculation(tar);
      const components = objectiveReportedComponents(ach);
      return {...o, est, req, financialProgress:pct(est,req), components};
    });
    byId('objective-cards').innerHTML=rows.map(r=>`
      <div class="un-objective-card un-objective-card-enhanced un-objective-card-components" data-objective="${r.code}">
        <div class="un-objective-code">${roadmapObjectiveLabel(r.code)}</div>
        <h4>${r.upperNileObjective}</h4>
        ${objectiveComponentsHTML(r.components, r.code)}
        <div class="un-objective-stats un-objective-stats-finance">
          <span>Financial progress<br><strong>${r.financialProgress}%</strong></span>
          <span>Funding invested<br><strong>${fmtCompact(r.est,true)}</strong></span>
          <span>Remaining gap<br><strong class="${r.req-r.est>0?'fund-gap':'fund-pos'}">${fmtCompact(r.req-r.est,true)}</strong></span>
        </div>
      </div>`).join('');

    document.querySelectorAll('.un-objective-more').forEach(btn=>btn.addEventListener('click',e=>{
      e.stopPropagation();
      const block = btn.closest('.un-objective-components');
      const expanded = btn.dataset.expanded === 'true';
      block.classList.toggle('expanded', !expanded);
      btn.dataset.expanded = String(!expanded);
      const hiddenCount = block.querySelectorAll('.un-objective-component-extra').length;
      btn.textContent = expanded ? `+ ${hiddenCount} more activity area${hiddenCount > 1 ? 's' : ''} ▾` : 'Show less ▲';
    }));

    document.querySelectorAll('.un-objective-card').forEach(card=>card.addEventListener('click',()=>{state.objective=card.dataset.objective; byId('filter-objective').value=state.objective; renderAll(); document.querySelector('[data-target="roadmap"]').click();}));
  }
  function tableHTML(headers, rows){
    if(!rows.length) return '<thead><tr><th>No records found</th></tr></thead><tbody><tr><td>Try changing filters.</td></tr></tbody>';
    return '<thead><tr>'+headers.map(h=>`<th>${h.label}</th>`).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+headers.map(h=>`<td>${h.f(r)}</td>`).join('')+'</tr>').join('')+'</tbody>';
  }
  function activityRows(a){
    const achByCode=group(a.achievements, r=>achievementKey(r), k=>({key:k, achievement:0, estimated:0, orgs:new Set()}), (g,r)=>{g.achievement+=progressUnits(r); g.estimated+=progressFinancial(r); if(orgKey(r))g.orgs.add(orgKey(r));});
    const achMap=new Map(achByCode.map(x=>[x.key,x]));
    const rows=a.targets.map(t=>{
      const key=targetKey(t); const x=achMap.get(key)||{achievement:0,estimated:0,orgs:new Set()};
      return {county:countyKey(t),year:clean(t['Strategy/Roadmap Year']),obj:objKey(t),code:clean(t['UNS Activity Indicator Code']),activity:clean(t['UNS Activity Indicator ']),unit:clean(t['Unit of indicator measurment']),target:Number(t['UNS Activity Indicator Target'])||0,requirement:Number(t['Total Requirement'])||0,achievement:x.achievement,estimated:x.estimated,orgs:[...x.orgs].join(', ')};
    });
    return rows.sort((a,b)=>b.estimated-a.estimated);
  }
 function renderActivityTable(a){
  const rows = activityRows(a)
    .map(r => {
      const requirement = Number(r.requirement) || 0;
      const estimated = Number(r.estimated) || 0;
      const gap = Math.max(0, requirement - estimated);
      const fundingGapPct = requirement > 0 ? Math.round((gap / requirement) * 100) : 0;

      return {
        ...r,
        progress: pct(r.achievement, r.target),
        gap,
        fundingGapPct
      };
    })
    .filter(r =>
      r.requirement > 0 &&
      r.achievement > 0 &&
      r.fundingGapPct >= 50 &&
      r.fundingGapPct <= 80
    )
    .sort((a,b) => b.gap - a.gap)
    .slice(0,12);

  const headers=[
    {label:'Year',f:r=>r.year},
    {label:'Objective',f:r=>`<span class="un-pill">${r.obj}</span>`},
    {label:'Activity',f:r=>r.activity},
    {label:'Achievement / Target',f:r=>`${num(r.achievement)} / ${num(r.target)} ${r.unit}`},
    {label:'Progress',f:r=>`<span class="${progressClass(r.progress)}">${r.progress}%</span>`},
    {label:'Estimated Funding Invested',f:r=>money(r.estimated)},
    {label:'Funding Requirement',f:r=>money(r.requirement)},
    {label:'Remaining Gap',f:r=>`<span class="fund-gap">${money(r.gap)}</span>`},
    {label:'Funding Gap %',f:r=>`${r.fundingGapPct}%`}
  ];

  byId('activity-table').innerHTML=tableHTML(headers, rows);
}

  function roadmapActivitySummary(a, objectiveCode){
    const tar=a.targets.filter(t=>objKey(t)===objectiveCode);
    const ach=a.achievements.filter(x=>objKey(x)===objectiveCode);
    const m=new Map();
    tar.forEach(t=>{
      const key=[clean(t['UNS Activity Indicator Code']), clean(t['Unit of indicator measurment'])].join('|');
      if(!m.has(key)) m.set(key,{code:clean(t['UNS Activity Indicator Code']),activity:clean(t['UNS Activity Indicator ']),unit:clean(t['Unit of indicator measurment']),achievement:0,target:0,estimated:0,requirement:0});
      const g=m.get(key); g.target+=Number(t['UNS Activity Indicator Target'])||0; g.requirement+=Number(t['Total Requirement'])||0;
    });
    ach.forEach(r=>{
      let key=[clean(r['UNS Activity Indicator Code']), clean(r['Unit of indicator measurment'])].join('|');
      if(!m.has(key)){
        const fuzzy=[...m.keys()].find(k=>k.split('|')[0]===clean(r['UNS Activity Indicator Code']));
        key=fuzzy||key;
      }
      if(!m.has(key)) m.set(key,{code:clean(r['UNS Activity Indicator Code']),activity:clean(r['UNS Activity Indicator']),unit:clean(r['Unit of indicator measurment']),achievement:0,target:0,estimated:0,requirement:0});
      const g=m.get(key); g.achievement+=progressUnits(r); g.estimated+=progressFinancial(r);
    });
    return [...m.values()].sort((a,b)=>String(a.code).localeCompare(String(b.code),undefined,{numeric:true}));
  }
  function comparisonBar(label, value, max, moneyFlag){
    const w=max?Math.min(100,(Math.abs(value)/max)*100):0;
    return `<div class="un-bar-row"><span>${label}</span><div class="un-bar-track"><div class="un-bar-fill ${label.toLowerCase().includes('target')||label.toLowerCase().includes('requirement')?'target':''}" style="width:${w}%"></div></div><strong>${moneyFlag?fmtCompact(value,true):fmtCompact(value)}</strong></div>`;
  }
  function gauge(title, value){
    const shown=Math.round(value||0); const fill=Math.min(100,Math.max(0,shown));
    return `<div class="un-gauge"><h4>${title}</h4><div class="un-gauge-ring" style="--value:${fill}%"></div><div class="un-gauge-value">${shown}%</div><div class="un-gauge-scale"><span>0%</span><span>100%</span></div></div>`;
  }
  function renderRoadmap(a){
    let allowedObjectives = D.objectives;

    // When a National DS Objective is selected from the overview cards, the
    // Roadmap Progress page should only show the Upper Nile UNSRM objectives
    // that are explicitly linked to that NDSO in the LogFrame. This prevents
    // unrelated UNSRMs from appearing after users click cards such as NDSO 1.
    if (state.national !== 'All') {
      const linkedCodes = new Set(objectiveForNational(state.national));
      allowedObjectives = allowedObjectives.filter(o => linkedCodes.has(o.code));
    }

    // If the user also selects a specific UNSRM objective, keep the intersection
    // of both filters. This preserves the exact NDSO + UNSRM filter context.
    if (state.objective !== 'All') {
      allowedObjectives = allowedObjectives.filter(o => o.code === state.objective);
    }

    const grouped = allowedObjectives
      .map(o=>({o, rows:roadmapActivitySummary(a,o.code)}))
      .filter(g => g.rows.length || state.national !== 'All' || state.objective !== 'All');

    if (!grouped.length) {
      byId('roadmap-objective-detail').innerHTML = '<div class="un-empty-state">No roadmap activities found for the selected filters.</div>';
      return;
    }

    byId('roadmap-objective-detail').innerHTML=grouped.map(g=>{
      const av=g.rows.reduce((s,r)=>s+r.achievement,0), tv=g.rows.reduce((s,r)=>s+r.target,0), est=g.rows.reduce((s,r)=>s+r.estimated,0), req=g.rows.reduce((s,r)=>s+r.requirement,0);
      const objectiveUnits = unique(g.rows.map(r => clean(r.unit)));
      const hasMixedUnits = objectiveUnits.length > 1;
      const maxUnit=Math.max(av,tv,1), maxMoney=Math.max(est,req,1);
      const objectiveTargetRows = a.targets.filter(r => objKey(r) === g.o.code);
      const objectiveAchievementRows = a.achievements.filter(r => objKey(r) === g.o.code);
      const objectiveCounties = unique([
        ...objectiveTargetRows.map(countyKey),
        ...objectiveAchievementRows.map(countyKey)
      ]);
      const objectiveReportingOrgs = unique(objectiveAchievementRows.map(orgKey));
      const objectiveActivities = g.rows.length;
      const headers=[
  {label:'Roadmap Activity',f:r=>r.activity},
  {label:'Activity Code',f:r=>r.code},
  {label:'Unit of Measure',f:r=>r.unit},
  {label:'Achieved',f:r=>num(r.achievement)},
  {label:'Target',f:r=>num(r.target)},
  {label:'Estimated Funding (USD)',f:r=>money(r.estimated)},
  {label:'Funding Required (USD)',f:r=>money(r.requirement)},
  {label:'Unit Progress (%)',f:r=>progressBadge(pct(r.achievement,r.target))},
  {label:'Funding Progress (%)',f:r=>progressBadge(pct(r.estimated,r.requirement))},
  {
  label:'Funding Gap (USD)',
  f:r=>`<span class="${r.requirement-r.estimated>0?'un-money-pos':'un-money-neg'}">
    ${fmtCompact(r.requirement-r.estimated, true)}
  </span>`
}
];
      const totalRow=`<tr class="un-total-row"><td>Total</td><td></td><td></td><td>${hasMixedUnits ? '<span class="un-total-dash">—</span>' : num(av)}</td><td>${hasMixedUnits ? '<span class="un-total-dash">—</span>' : num(tv)}</td><td>${money(est)}</td><td>${money(req)}</td><td>${hasMixedUnits ? '<span class="un-progress-badge un-progress-neutral">Mixed units</span>' : progressBadge(pct(av,tv))}</td><td>${progressBadge(pct(est,req))}</td><td><span class="${req-est>0?'un-money-pos':'un-money-neg'}">${fmtCompact(req-est, true)}</span></td></tr>`;
      return `<div class="un-roadmap-item">
        <div class="un-roadmap-top">
          <div>
            <h3>${roadmapObjectiveLabel(g.o.code)}: ${g.o.upperNileObjective}</h3>
            <p>${nationalObjectiveLabel(g.o.nationalCode)}: ${g.o.nationalObjective}</p>
            <div class="un-roadmap-meta">
              <span title="${objectiveCounties.length ? objectiveCounties.join(', ') : 'No counties reported'}">📍 <strong>Counties:</strong> ${objectiveCounties.length ? objectiveCounties.join(', ') : 'Not reported'}</span>
              <span title="${objectiveReportingOrgs.length ? objectiveReportingOrgs.join(', ') : 'No reporting organisations reported'}">🏢 <strong>Reporting organisations:</strong> ${objectiveReportingOrgs.length ? objectiveReportingOrgs.join(', ') : 'Not reported'}</span>
              <span>📋 <strong>Activities:</strong> ${objectiveActivities}</span>
            </div>
          </div>
          ${hasMixedUnits ? '' : `<div class="un-statbox"><strong>${pct(av,tv)}%</strong><span>Unit Progress</span></div>`}
          <div class="un-statbox"><strong>${pct(est,req)}%</strong><span>Funding Progress</span></div>
          <div class="un-statbox"><strong>${fmtCompact(req-est, true)}</strong><span>Funding Gap</span></div>
        </div>

        <div class="un-roadmap-visuals un-roadmap-visuals-compact ${hasMixedUnits ? 'un-roadmap-visuals-funding-only' : ''}">
          ${hasMixedUnits ? '' : `
          <div class="un-comparison">
            <h4>Progress Against Target</h4>
            ${comparisonBar('Achieved',av,maxUnit,false)}
            ${comparisonBar('Target',tv,maxUnit,false)}
          </div>`}
          <div class="un-comparison">
            <h4>Funding Progress</h4>
            ${comparisonBar('Estimated Funding',est,maxMoney,true)}
            ${comparisonBar('Funding Required',req,maxMoney,true)}
          </div>
        </div>

        
        <div class="un-table-wrap"><table class="un-table">${tableHTML(headers,g.rows).replace('</tbody>',totalRow+'</tbody>')}</table></div>
      </div>`
    }).join('');
  }

  function renderSelectedCountySnapshot(a){
    const selectedCounty = state.county !== 'All' ? state.county : null;
    const countyRows = selectedCounty
      ? a.targets.filter(r => countyKey(r) === selectedCounty)
      : a.targets;

    const countyAchievements = selectedCounty
      ? a.achievements.filter(r => countyKey(r) === selectedCounty)
      : a.achievements;

    const reportedAchievements = countyAchievements.filter(r => progressUnits(r) > 0);

    const estimated = countyAchievements.reduce((sum,r)=>sum+progressFinancial(r),0);
    const requirement = targetFinancialCalculation(countyRows);
    const fundingProgress = pct(estimated, requirement);
    const gap = requirement - estimated;

    const plannedActivityCodes = new Set();
    countyRows.forEach(r => {
      const code = clean(r['UNS Activity Indicator Code']);
      const targetUnits = Number(r['UNS Activity Indicator Target']) || 0;
      const targetRequirement = Number(r['Total Requirement']) || 0;
      if (code && (targetUnits > 0 || targetRequirement > 0)) plannedActivityCodes.add(code);
    });

    const progressReportedCodes = new Set();
    reportedAchievements.forEach(r => {
      const code = clean(r['UNS Activity Indicator Code']);
      if (code) progressReportedCodes.add(code);
    });

    const plannedActivities = plannedActivityCodes.size;
    const progressReportedActivities = progressReportedCodes.size;
    const reportingOrgs = unique(reportedAchievements.map(orgKey));
    const implementingOrgs = implementingOrgsForCounty(selectedCounty || 'All');
    const title = selectedCounty || 'All counties';

    const progressReportedActivityNames = unique(
      reportedAchievements
        .filter(r => clean(r['UNS Roadmap Activities']) || clean(r['UNS Activity Indicator']))
        .map(r => clean(r['UNS Roadmap Activities']) || clean(r['UNS Activity Indicator']))
    );

    const activeObjectives = unique(reportedAchievements.map(objKey));

    const el = byId('selected-county-snapshot');
    if(!el) return;
    el.innerHTML = `
      <div class="un-mini-metric"><strong>${title}</strong><span>Current selection</span></div>
      <div class="un-mini-metric"><strong>${fundingProgress}%</strong><span>Funding progress</span></div>
      <div class="un-mini-metric"><strong>${fmtCompact(estimated,true)}</strong><span>Estimated funding invested</span></div>
      <div class="un-mini-metric"><strong>${fmtCompact(gap,true)}</strong><span>Funding gap</span></div>
      <div class="un-mini-metric"><strong>${reportingOrgs.length}</strong><span>Reporting organisations</span></div>
      <div class="un-mini-metric"><strong>${implementingOrgs.length}</strong><span>Implementing organisations</span></div>
      <div class="un-mini-metric"><strong>${progressReportedActivities} of ${plannedActivities}</strong><span>Progress reported</span></div>
      <div class="un-county-note">${progressReportedActivities} of ${plannedActivities} planned activities have reported achievements and/or funding.</div>
      <div class="un-county-objectives-box">
        <div class="un-county-box-title">Upper Nile State Roadmap Objectives Active</div>
        <div class="un-county-objective-pills">
          ${activeObjectives.length ? activeObjectives.map(o=>`<span>${o}</span>`).join('') : '<em>Not reported</em>'}
        </div>
      </div>
      <div class="un-county-orgs-box">
        <div class="un-county-box-title">Reporting Organisations</div>
        <div class="un-county-org-pills">
          ${reportingOrgs.length ? reportingOrgs.map(o=>`<span>${o}</span>`).join('') : '<em>Not reported</em>'}
        </div>
      </div>
      <div class="un-county-impl-orgs-box">
        <div class="un-county-box-title">Implementing Organisations</div>
        <div class="un-county-impl-org-pills">
          ${implementingOrgs.length ? implementingOrgs.map(o=>`<span>${o}</span>`).join('') : '<em>Not reported in service mapping</em>'}
        </div>
      </div>
      <div class="un-county-activities-box">
        <div class="un-county-box-title">Activities with Reported Progress</div>
        ${progressReportedActivityNames.length ? `<ul>${progressReportedActivityNames.map(a=>`<li>${a}</li>`).join('')}</ul>` : '<p>Not reported</p>'}
      </div>
    `;
  }

  function renderCounty(a){
    renderSelectedCountySnapshot(a);

    const countyRows=group(a.targets, r=>countyKey(r), k=>({county:k,target:0,requirement:0,plannedActivities:new Set()}), (g,r)=>{
      g.target+=Number(r['UNS Activity Indicator Target'])||0;
      g.requirement+=Number(r['Total Requirement'])||0;
      const code = clean(r['UNS Activity Indicator Code']);
      const targetUnits = Number(r['UNS Activity Indicator Target']) || 0;
      const targetRequirement = Number(r['Total Requirement']) || 0;
      if(code && (targetUnits > 0 || targetRequirement > 0)) g.plannedActivities.add(code);
    });

    const achRows=group(a.achievements, r=>countyKey(r), k=>({county:k,achievement:0,estimated:0,orgs:new Set(),reportedActivities:new Set(),activityTypes:new Set()}), (g,r)=>{
      const reported = progressUnits(r) > 0 || progressFinancial(r) > 0;
      g.achievement+=progressUnits(r);
      g.estimated+=progressFinancial(r);
      if(reported && orgKey(r)) g.orgs.add(orgKey(r));
      if(reported && clean(r['UNS Activity Indicator Code'])) g.reportedActivities.add(clean(r['UNS Activity Indicator Code']));
      if(reported && unitKey(r)) g.activityTypes.add(unitKey(r));
    });

    const achMap=new Map(achRows.map(r=>[r.county,r]));
    const rows=countyRows.map(r=>{
      const ach = achMap.get(r.county)||{achievement:0,estimated:0,orgs:new Set(),reportedActivities:new Set(),activityTypes:new Set()};
      const requirement = r.requirement || 0;
      const estimated = ach.estimated || 0;
      const fundingProgress = pct(estimated, requirement);
      const gap = requirement - estimated;
      const plannedCount = r.plannedActivities.size;
      const reportedCount = ach.reportedActivities.size;
      const reportingCoverage = plannedCount ? Math.round((reportedCount / plannedCount) * 100) : 0;
      const implementingCount = implementingOrgsForCounty(r.county).length;
      return {...r,...ach,fundingProgress,gap,plannedCount,reportedCount,reportingCoverage,implementingCount};
    }).sort((a,b)=>b.estimated-a.estimated);

    byId('county-profile').innerHTML=rows.slice(0,8).map(r=>`
      <div class="un-county-card" data-county="${r.county}">
        <div class="un-county-card-top">
          <h3>${r.county}</h3>
          <span class="un-county-activity-pill">${r.reportedCount} of ${r.plannedCount} progress reported</span>
        </div>
        <div class="un-progress" title="Progress reported: ${r.reportedCount} of ${r.plannedCount} activities">
          <span style="width:${clamp(r.reportingCoverage)}%"></span>
        </div>
        <p>Progress reported: <strong>${r.reportedCount} of ${r.plannedCount} activities</strong></p>
        <p>Funding Progress: <strong>${r.fundingProgress}%</strong></p>
        <p>Estimated Funding Invested: <strong>${fmtCompact(r.estimated,true)}</strong></p>
        <p>Funding Gap: <strong class="${r.gap>0?'fund-gap':'fund-pos'}">${fmtCompact(r.gap,true)}</strong></p>
        <p>Reporting orgs: <strong>${r.orgs.size||0}</strong></p>
        <p>Implementing orgs: <strong>${r.implementingCount||0}</strong></p>
      </div>`).join('');

    document.querySelectorAll('.un-county-card[data-county]').forEach(card=>card.addEventListener('click',()=>{
      state.county = card.dataset.county;
      byId('filter-county').value = state.county;
      refreshFilterOptions && refreshFilterOptions('county');
      renderAll();
      setTimeout(()=>updateMap(),50);
    }));

    const rowsForTable = activityRows(a).map(r => {
      const hasReported = (Number(r.achievement) || 0) > 0 || (Number(r.estimated) || 0) > 0;
      return {...r, reportingStatus: hasReported ? 'Reported' : 'Planned / not yet reported'};
    });

    const headers=[
      {label:'County',f:r=>r.county},
      {label:'Year',f:r=>r.year},
      {label:'Objective',f:r=>r.obj},
      {label:'Activity',f:r=>r.activity},
      {label:'Status',f:r=>`<span class="${r.reportingStatus === 'Reported' ? 'un-status-reported' : 'un-status-planned'}">${r.reportingStatus}</span>`},
      {label:'Unit of Measure',f:r=>r.unit},
      {label:'Achieved',f:r=>num(r.achievement)},
      {label:'Target',f:r=>num(r.target)},
      {label:'Estimated Funding Invested',f:r=>money(r.estimated)},
      {label:'Funding Required',f:r=>money(r.requirement)},
      {label:'Funding Progress (%)',f:r=>progressBadge(pct(r.estimated,r.requirement))},
      {label:'Funding Gap',f:r=>`<span class="${r.requirement-r.estimated>0?'un-money-pos':'un-money-neg'}">${fmtCompact(r.requirement-r.estimated,true)}</span>`}
    ];
    byId('county-table').innerHTML=tableHTML(headers, rowsForTable.slice(0,100));
  }


  function serviceActivityKey(r){
    // Activity Indicator Code, for filtering only.
    return clean(r['UNS Activity Indicator '] || r['UNS Activity Indicator'] || r['Activity / Service']);
  }

  function serviceObjectiveIndicatorKey(r){
    return clean(r['UNS RM Objective Indicator'] || r['UNS RM Objective indicator'] || r['UNS RM Objective Indicator ']);
  }

  function serviceUnitKey(r){
    return clean(r['Unit of indicator measurment'] || r['Unit of indicator measurement'] || r['Unit of Measurment']);
  }

  function serviceImplementingOrgKey(r){
    return clean(r['Implementing Organisation Name'] || r['Implementing Organisation'] || r['Implementing Organization Name'] || r['Implementing Organization']);
  }

  function serviceObjectiveKey(r){
    const txt = serviceActivityKey(r);
    const m = txt.match(/UNSRM\s*\d+/i);
    if(m) return m[0].replace(/\s+/,' ').toUpperCase();
    const objText = clean(r['Upper Nile State RM Objective']);
    const found = (D.objectives || []).find(o => objText.includes(clean(o.upperNileObjective).slice(0,30)));
    return found ? found.code : 'Not specified';
  }

  function applyServiceFilters(rows){
    return (rows || []).filter(r=>{
      const c=countyKey(r);
      const reporting=clean(r['Reporting Organisation name']);
      const implementing=serviceImplementingOrgKey(r);
      const service=serviceActivityKey(r);
      const objective=serviceObjectiveKey(r);

      if(state.county !== 'All' && c !== state.county) return false;
      if(state.org !== 'All' && reporting !== state.org) return false;
      if(state.impl !== 'All' && implementing !== state.impl) return false;
      if(state.objective !== 'All' && objective !== state.objective) return false;
      if(state.activity !== 'All' && service !== state.activity) return false;
      return true;
    });
  }

  function partnerMapMetrics(countyName){
    const rows = applyServiceFilters(D.serviceMapping || []).filter(r => countyKey(r) === countyName);
    const reportingOrgs = unique(rows.map(r=>clean(r['Reporting Organisation name'])));
    const implementingOrgs = unique(rows.map(r=>serviceImplementingOrgKey(r)));
    const services = unique(rows.map(serviceActivityKey));
    const objectives = unique(rows.map(serviceObjectiveKey));
    const targets = rows.reduce((s,r)=>s+(Number(r.Target)||0),0);
    return {county:countyName, rows, reportingOrgs, implementingOrgs, services, objectives, targets};
  }

  function partnerFillColor(count){
    if(!count || count <= 0) return '#E5E7EB';
    if(count <= 2) return '#bfe8f7';
    if(count <= 4) return '#5bb4dc';
    if(count <= 6) return '#137fb5';
    return '#003f63';
  }

  function renderSelectedPartnerSnapshot(rows){
    const selectedCounty = state.county !== 'All' ? state.county : null;
    const filtered = selectedCounty ? rows.filter(r=>countyKey(r)===selectedCounty) : rows;
    const reportingOrgs = unique(filtered.map(r=>clean(r['Reporting Organisation name'])));
    const implementingOrgs = unique(filtered.map(r=>serviceImplementingOrgKey(r)));
    const counties = unique(filtered.map(countyKey));
    const objectives = unique(filtered.map(serviceObjectiveKey));
    const title = selectedCounty || 'All counties';

    const el = byId('selected-partner-snapshot');
    if(!el) return;

    el.innerHTML = `
      <div class="un-mini-metric"><strong>${title}</strong><span>Current selection</span></div>
      <div class="un-mini-metric"><strong>${reportingOrgs.length}</strong><span>Reporting organisations</span></div>
      <div class="un-mini-metric"><strong>${implementingOrgs.length}</strong><span>Implementing organisations</span></div>
      <div class="un-mini-metric"><strong>${counties.length}</strong><span>Counties covered</span></div>
      <div class="un-mini-metric"><strong>${objectives.length}</strong><span>Upper Nile State Roadmap objectives covered</span></div>

      <div class="un-county-objectives-box">
        <div class="un-county-box-title">Upper Nile State Roadmap Objectives Covered</div>
        <div class="un-county-objective-pills">
          ${objectives.length ? objectives.map(o=>`<span>${o}</span>`).join('') : '<em>Not reported</em>'}
        </div>
      </div>

      <div class="un-county-orgs-box">
        <div class="un-county-box-title">Reporting Organisations</div>
        <div class="un-county-org-pills">
          ${reportingOrgs.length ? reportingOrgs.map(o=>`<span>${o}</span>`).join('') : '<em>Not reported</em>'}
        </div>
      </div>

      <div class="un-county-impl-orgs-box">
        <div class="un-county-box-title">Implementing Organisations</div>
        <div class="un-county-impl-org-pills">
          ${implementingOrgs.length ? implementingOrgs.map(o=>`<span>${o}</span>`).join('') : '<em>Not reported</em>'}
        </div>
      </div>
    `;
  }

  function renderPartners(a){
    const service = applyServiceFilters(D.serviceMapping || []);

    renderSelectedPartnerSnapshot(service);

    const countyRows = group(service, r=>countyKey(r), k=>({
      county:k, reporting:new Set(), implementing:new Set(), objectiveIndicators:new Set(), objectives:new Set(), units:new Set()
    }), (g,r)=>{
      if(clean(r['Reporting Organisation name'])) g.reporting.add(clean(r['Reporting Organisation name']));
      if(serviceImplementingOrgKey(r)) g.implementing.add(serviceImplementingOrgKey(r));
      if(serviceObjectiveIndicatorKey(r)) g.objectiveIndicators.add(serviceObjectiveIndicatorKey(r));
      if(serviceObjectiveKey(r)) g.objectives.add(serviceObjectiveKey(r));
      if(serviceUnitKey(r)) g.units.add(serviceUnitKey(r));
    }).sort((a,b)=>b.implementing.size-a.implementing.size || b.objectiveIndicators.size-a.objectiveIndicators.size);

    const mainObjectiveIndicators = r => {
      const arr = [...r.objectiveIndicators].filter(Boolean);
      if(!arr.length) return 'Not reported';
      const shown = arr.slice(0,3).map(x=>`<span class="un-indicator-chip">${x}</span>`).join(' ');
      const more = arr.length > 3 ? `<span class="un-more-chip">+${arr.length-3} more</span>` : '';
      return shown + more;
    };

    const countyHeaders=[
      {label:'County',f:r=>`<strong>${r.county}</strong>`},
      {label:'Reporting Orgs',f:r=>r.reporting.size},
      {label:'Implementing Orgs',f:r=>r.implementing.size},
      {label:'UNSRM Objectives Covered',f:r=>[...r.objectives].map(o=>`<span class="un-pill">${o}</span>`).join(' ')},
      {label:'Main UNS RM Objective Indicators',f:r=>mainObjectiveIndicators(r)},
      {label:'Unit(s) of Measure',f:r=>[...r.units].map(u=>`<span class="un-unit-chip">${u}</span>`).join(' ') || 'Not reported'},
      {label:'Main Implementing Organisations',f:r=>[...r.implementing].slice(0,5).map(o=>`<span class="un-partner-chip">${o}</span>`).join(' ') || 'Not reported'}
    ];
    const pctable = byId('partner-county-table');
    if(pctable) pctable.innerHTML = tableHTML(countyHeaders, countyRows);

    const headers=[
      {label:'County',f:r=>countyKey(r)},
      {label:'UNSRM Objective',f:r=>`<span class="un-pill">${serviceObjectiveKey(r)}</span>`},
      {label:'UNS RM Objective Indicator',f:r=>serviceObjectiveIndicatorKey(r) || 'Not reported'},
      {label:'Unit of Measure',f:r=>serviceUnitKey(r) || 'Not reported'},
      {label:'Reporting Organisation',f:r=>clean(r['Reporting Organisation name'])},
      {label:'Implementing Organisation',f:r=>serviceImplementingOrgKey(r)},
      {label:'Target',f:r=>clean(r.Target)},
      {label:'Project End-date',f:r=>clean(r['Project End-date'])}
    ];
    byId('service-table').innerHTML=tableHTML(headers, service.slice(0,120));
  }


  function calendarYearFromState(){
    if(state.year === 'All') return 'All';
    const m = String(state.year).match(/20\d{2}/);
    return m ? m[0] : state.year;
  }

  function enablerYearKey(r){
    return clean(r['REPORTING YEAR'] || r['Reporting Year'] || r['Year']);
  }

  function enablerMonthKey(r){
    return clean(r['MONTH OF REPORT'] || r['Month of Report'] || r['Month']);
  }

  function enablerCountyKey(r){
    return clean(r.COUNTY || r.County || r.county);
  }

  function enablerOrgKey(r){
    return clean(r['REPORTING ORGANISATION'] || r['Reporting Organisation'] || r['Implemented by'] || r['Implemented By']);
  }

  function enablerObjectiveKey(r){
    const raw = clean(r['UNS Activity Indicator Code'] || r['UNS RM Objective'] || r.Objective || r['Calculate objective']);
    const m = raw.match(/UNSRM\s*\d+/i);
    if(m) return m[0].replace(/\s+/,' ').toUpperCase();
    const n = raw.match(/\bSO\s*([0-9]+)\b/i);
    if(n) return `UNSRM ${n[1]}`;
    return raw || 'Not specified';
  }

  function enablerCodeKey(r){
    return clean(r['UNS Activity Indicator Code'] || r['UNS Activity Indicator'] || r['Activity Indicator Code']);
  }

  function enablerActivityFilterKey(r){
    return clean(r['UNS Activity Indicator'] || r['UNS Activity Indicator '] || r['Activity Indicator'] || r.Description || r.DESCRIPTION || r['Activity Description'] || r['UNS Activity Indicator Code']);
  }

  function enablerUnitKey(r){
    return clean(r['Unit of Measurment'] || r['Unit of Measurement'] || r['Unit of Measurement '] || r['Unit of indicator measurment']);
  }

  function enablerResultValue(r){
    return Number(r.Results || r.Result || r.ACHIEVEMENT || r.Achievement || 0) || 0;
  }

  function enablerDescriptionKey(r){
    return clean(r.Description || r.DESCRIPTION || r['Activity Description']);
  }

  function enablerCategoryKey(r){
    const raw = clean(r.Category || r.CATEGORY || r['Enabler Category'] || r['Category ']);
    if(raw) return raw;

    const objective = enablerObjectiveKey(r);
    if(objective.includes('UNSRM 5') || objective === 'SO5') return 'Peace and Community Cohesion';
    if(objective.includes('UNSRM 3') || objective === 'SO3') return 'Support Service and Livelihood';
    if(objective.includes('UNSRM 4') || objective === 'SO4') return 'Public Services';

    return 'Other Enabling Activities';
  }

  function applyEnablerFilters(rows){
    const y = calendarYearFromState();
    return (rows || []).filter(r=>{
      if(y !== 'All' && enablerYearKey(r) !== y) return false;
      if(state.county !== 'All' && enablerCountyKey(r) !== state.county) return false;
      if(state.org !== 'All' && enablerOrgKey(r) !== state.org) return false;
      if(state.objective !== 'All' && enablerObjectiveKey(r) !== state.objective) return false;
      if(state.activity !== 'All' && enablerActivityFilterKey(r) !== state.activity) return false;
      if(state.unit !== 'All' && enablerUnitKey(r) !== state.unit) return false;
      return true;
    });
  }

  function enablerMapMetrics(countyName){
    const rows = applyEnablerFilters(D.enablers || []).filter(r=>enablerCountyKey(r) === countyName);
    const totalResults = rows.reduce((s,r)=>s+enablerResultValue(r),0);
    const orgs = unique(rows.map(enablerOrgKey));
    const objectives = unique(rows.map(enablerObjectiveKey));
    const units = unique(rows.map(enablerUnitKey));
    return {county:countyName, rows, records:rows.length, totalResults, orgs, objectives, units};
  }

  function enablerFillColor(count){
    if(!count || count <= 0) return '#E5E7EB';
    if(count <= 5) return '#bfe8f7';
    if(count <= 15) return '#5bb4dc';
    if(count <= 30) return '#137fb5';
    return '#003f63';
  }

  function renderSelectedEnablerSnapshot(rows){
    const selectedCounty = state.county !== 'All' ? state.county : null;
    const filtered = selectedCounty ? rows.filter(r=>enablerCountyKey(r)===selectedCounty) : rows;
    const title = selectedCounty || 'All counties';
    const orgs = unique(filtered.map(enablerOrgKey));
    const objectives = unique(filtered.map(enablerObjectiveKey));
    const descriptions = unique(filtered.map(enablerDescriptionKey));

    const el = byId('selected-enabler-snapshot');
    if(!el) return;

    el.innerHTML = `
      <div class="un-mini-metric"><strong>${title}</strong><span>Current selection</span></div>

      <div class="un-county-objectives-box">
        <div class="un-county-box-title">Upper Nile State Roadmap Objectives</div>
        <div class="un-county-objective-pills">
          ${objectives.length ? objectives.map(o=>`<span>${o}</span>`).join('') : '<em>Not reported</em>'}
        </div>
      </div>

      <div class="un-county-orgs-box">
        <div class="un-county-box-title">Reporting Entities</div>
        <div class="un-county-org-pills">
          ${orgs.length ? orgs.map(o=>`<span>${o}</span>`).join('') : '<em>Not reported</em>'}
        </div>
      </div>

      <div class="un-county-activities-box">
        <div class="un-county-box-title">Main Enabling Activities</div>
        ${descriptions.length ? `<ul>${descriptions.slice(0,12).map(d=>`<li>${d}</li>`).join('')}${descriptions.length>12?`<li><strong>+${descriptions.length-12} more activities</strong></li>`:''}</ul>` : '<p>Not reported</p>'}
      </div>
    `;
  }

  function renderEnablers(a){
    const rows = applyEnablerFilters(D.enablers || []);

    renderSelectedEnablerSnapshot(rows);

    const categoryOrder = ['Peace and Community Cohesion','Support Service and Livelihood','Public Services'];
    const categoryGroups = group(rows, enablerCategoryKey, k=>({category:k, units:new Map(), total:0}), (g,r)=>{
      const unit = enablerUnitKey(r) || 'Not specified';
      const value = enablerResultValue(r);
      g.total += value;
      g.units.set(unit, (g.units.get(unit)||0) + value);
    }).sort((a,b)=>{
      const ai = categoryOrder.indexOf(a.category);
      const bi = categoryOrder.indexOf(b.category);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const catEl = byId('enabler-category-groups');
    if(catEl){
      catEl.innerHTML = categoryGroups.map(g=>{
        const unitCards = [...g.units.entries()].sort((a,b)=>b[1]-a[1]).map(([unit,value])=>`
          <div class="un-enabler-unit-card">
            <span>${unit}</span>
            <strong>${fmtCompact(value)}</strong>
          </div>
        `).join('');
        return `
          <div class="un-enabler-category">
            <h4>${g.category}</h4>
            <div class="un-enabler-unit-grid">${unitCards}</div>
          </div>
        `;
      }).join('');
    }

    const headers=[
      {label:'Year',f:r=>enablerYearKey(r)},
      {label:'Month',f:r=>enablerMonthKey(r)},
      {label:'County',f:r=>enablerCountyKey(r)},
      {label:'Implemented by',f:r=>enablerOrgKey(r)},
      {label:'UNSRM Objective',f:r=>`<span class="un-pill">${enablerObjectiveKey(r)}</span>`},
      {label:'Result',f:r=>`${num(enablerResultValue(r))} ${enablerUnitKey(r)}`},
      {label:'Description',f:r=>enablerDescriptionKey(r)}
    ];
    byId('enabler-table').innerHTML = tableHTML(headers, rows.slice(0,150));
  }

  function renderInsights(a){
    const countyAgg=group(a.achievements, r=>countyKey(r), k=>({county:k,achievement:0,estimated:0}), (g,r)=>{g.achievement+=progressUnits(r); g.estimated+=progressFinancial(r);}).sort((x,y)=>y.estimated-x.estimated);
    const objAgg=D.objectives.map(o=>{const ach=a.achievements.filter(r=>objKey(r)===o.code); const tar=a.targets.filter(r=>objKey(r)===o.code); const av=ach.reduce((s,r)=>s+progressUnits(r),0); const tv=targetUnitCalculation(tar); const req=targetFinancialCalculation(tar); const est=ach.reduce((s,r)=>s+progressFinancial(r),0); return {...o,av,tv,req,est,progress:pct(av,tv),gap:req-est};});
    const high=[...objAgg].sort((a,b)=>b.progress-a.progress)[0];
    const gap=[...objAgg].sort((a,b)=>b.gap-a.gap)[0];
    const orgAgg=group(a.achievements, r=>orgKey(r), k=>({org:k,count:0,estimated:0}), (g,r)=>{g.count++; g.estimated+=progressFinancial(r);}).sort((x,y)=>y.count-x.count)[0];
    const over=activityRows(a).filter(r=>r.target && r.achievement>r.target).slice(0,1)[0];
    const zero=activityRows(a).filter(r=>r.target>0 && r.achievement===0 && r.requirement>0).slice(0,1)[0];
    const insights=[
      high ? `<strong>${high.code}</strong> currently has the highest progress under the selected filters at <strong>${high.progress}%</strong>.` : 'No objective progress available under the current filters.',
      gap ? `<strong>${gap.code}</strong> has the largest remaining funding gap under the selected filters: <strong>${money(gap.gap)}</strong>.` : 'No funding gap available under the current filters.',
      countyAgg[0] ? `<strong>${countyAgg[0].county}</strong> has the highest estimated funded value among counties under the current filters: <strong>${money(countyAgg[0].estimated)}</strong>.` : 'No county-level achievement records available under the current filters.',
      orgAgg ? `<strong>${orgAgg.org}</strong> is the most frequent reporting organisation in the current selection, with <strong>${orgAgg.count}</strong> reported records.` : 'No reporting organisation records available under the current filters.',
      over ? `<strong>${over.activity}</strong> in <strong>${over.county}</strong> has reported achievement above target under the current filters.` : 'No over-achieved activity was identified under the current filters.',
      zero ? `<strong>${zero.activity}</strong> in <strong>${zero.county}</strong> has a target and funding requirement but no reported achievement in the current selection.` : 'No zero-achievement activity with requirement was identified under the current filters.'
    ];
    const html=insights.map(x=>`<div class="un-insight">${x}</div>`).join('');
    if(byId('overview-insights')) byId('overview-insights').innerHTML=html; if(byId('full-insights')) byId('full-insights').innerHTML=html;
  }
  function filteredRowsForCounty(countyName){
    const countyBackup = state.county;
    state.county = countyName || 'All';
    const a = aggregate();
    state.county = countyBackup;
    return a;
  }

  function serviceRowsForCounty(countyName){
    return (D.serviceMapping || []).filter(r=>{
      if(countyName && countyName !== 'All' && countyKey(r) !== countyName) return false;
      if(state.year !== 'All'){
        const sy = clean(r['REPORTING YEAR'] || r['Reporting Year'] || r['Strategy/Roadmap Year']);
        // Service Mapping may not always have a reporting year. If missing, keep the row as operational context.
        if(sy && sy !== state.year) return false;
      }
      if(state.objective !== 'All'){
        const objectiveText = clean(r['Upper Nile State RM Objective']);
        const objectiveObj = D.objectives.find(o=>o.code===state.objective);
        const objectiveName = objectiveObj ? clean(objectiveObj.upperNileObjective) : '';
        if(objectiveName && !objectiveText.includes(objectiveName.slice(0,30))) return false;
      }
      if(state.activity !== 'All'){
        const activityText = clean(r['UNS Activity Indicator '] || r['UNS Activity Indicator'] || r['Activity / Service']);
        if(activityText && activityText !== state.activity) return false;
      }
      return true;
    });
  }

  function implementingOrgsForCounty(countyName){
    return unique(serviceRowsForCounty(countyName).map(r=>serviceImplementingOrgKey(r)));
  }
  function countyMapMetrics(countyName){
    const a = filteredRowsForCounty(countyName);

    const countyTargets = a.targets.filter(r => countyKey(r) === countyName);
    const countyAchievements = a.achievements.filter(r => countyKey(r) === countyName);
    const reportedAchievements = countyAchievements.filter(r => progressUnits(r) > 0);

    const achieved = countyAchievements.reduce((sum,r)=>sum+progressUnits(r),0);
    const target = targetUnitCalculation(countyTargets);
    const estimated = countyAchievements.reduce((sum,r)=>sum+progressFinancial(r),0);
    const requirement = targetFinancialCalculation(countyTargets);

    // Planned activities = activities with target or funding requirement in the county.
    const plannedActivityCodes = new Set();
    countyTargets.forEach(r => {
      const code = clean(r['UNS Activity Indicator Code']);
      const targetUnits = Number(r['UNS Activity Indicator Target']) || 0;
      const targetRequirement = Number(r['Total Requirement']) || 0;
      if (code && (targetUnits > 0 || targetRequirement > 0)) plannedActivityCodes.add(code);
    });

    // Reported activities = planned activities with reported achievement or estimated funding.
    const reportedActivityCodes = new Set();
    reportedAchievements.forEach(r => {
      const code = clean(r['UNS Activity Indicator Code']);
      if (code) reportedActivityCodes.add(code);
    });

    const plannedActivities = plannedActivityCodes.size;
    const reportedActivities = reportedActivityCodes.size;
    const reportingCoverage = plannedActivities ? Math.round((reportedActivities / plannedActivities) * 100) : 0;

    const activityTypes = unique(reportedAchievements.map(unitKey));
    const reportingOrgs = unique(reportedAchievements.map(orgKey));
    const activeObjectives = unique(reportedAchievements.map(objKey));
    const implementingOrgs = implementingOrgsForCounty(countyName);
    const gap = requirement - estimated;

    return {
      county: countyName,
      achieved,
      target,
      unitProgress: pct(achieved,target),
      estimated,
      requirement,
      gap,
      financialProgress: pct(estimated,requirement),
      plannedActivities,
      reportedActivities,
      reportingCoverage,
      activities: reportedActivities,
      activityTypes,
      reportingOrgs,
      activeObjectives,
      implementingOrgs
    };
  }

  function countyFillColor(activeActivities){
    // Overview / county map shading is based on implementation footprint:
    // number of roadmap activities with reported achievement values (> 0).
    if(!activeActivities || activeActivities <= 0) return '#E5E7EB';
    if(activeActivities <= 5) return '#bfe8f7';
    if(activeActivities <= 10) return '#5bb4dc';
    if(activeActivities <= 15) return '#137fb5';
    return '#003f63';
  }

  function countyAchievementMetric(countyAchievements, codes){
    const codeList = Array.isArray(codes) ? codes : [codes];
    return countyAchievements
      .filter(r => codeList.includes(clean(r['UNS Activity Indicator Code'])))
      .reduce((sum,r)=>sum+progressUnits(r),0);
  }

  function countyAchievementFallbackIcon(code, unit, activity){
    const text = `${code} ${unit} ${activity}`.toLowerCase();
    if(text.includes('awareness') || text.includes('outreach')) return '📣';
    if(text.includes('training')) return '🎓';
    if(text.includes('court') || text.includes('justice')) return '⚖️';
    if(text.includes('police')) return '👮';
    if(text.includes('water')) return '💧';
    if(text.includes('school') || text.includes('education')) return '🎓';
    if(text.includes('hospital') || text.includes('health')) return '🏥';
    if(text.includes('peace') || text.includes('cohesion')) return '☮️';
    if(text.includes('house') || text.includes('shelter')) return '🏠';
    if(text.includes('livelihood') || text.includes('agricultural') || text.includes('fishing')) return '🌾';
    return '•';
  }

  function countyFallbackAchievements(countyAchievements){
    const grouped = group(
      countyAchievements.filter(r => progressUnits(r) > 0),
      r => clean(r['UNS Activity Indicator Code']) || activityKey(r) || 'Reported activity',
      k => ({code:k, activity:'', unit:'', value:0}),
      (g,r)=>{
        g.value += progressUnits(r);
        if(!g.activity) g.activity = activityKey(r) || clean(r['UNS Roadmap Activities']) || clean(r['UNS Activity Indicator']) || g.code;
        if(!g.unit) g.unit = unitKey(r);
      }
    ).sort((a,b)=>b.value-a.value);

    return grouped.slice(0,5).map(g=>{
      const icon = countyAchievementFallbackIcon(g.code, g.unit, g.activity);
      const friendly = {
        'UNSRM 2.1.2':'HLP awareness activities',
        'UNSRM 2.1.3':'Government HLP trainings',
        'UNSRM 4.4.1':'Courts supported',
        'UNSRM 4.4.2':'Police stations supported',
        'UNSRM 5.1.1':'Protection structures strengthened',
        'UNSRM 5.1.3':'Peace advocacy activities'
      };
      const label = friendly[g.code] || g.activity || g.code;
      return `${icon} ${label}: <b>${fmtCompact(g.value)}</b>`;
    }).join('<br>');
  }

  function countyTooltipAchievements(countyAchievements){
    const metrics = [
      {icon:'🏠', label:'Houses constructed', value:countyAchievementMetric(countyAchievements,'UNSRM 1.1.1')},
      {icon:'🏡', label:'Households reached with HLP', value:countyAchievementMetric(countyAchievements,'UNSRM 2.1.1')},
      {icon:'🌱', label:'Households trained for livelihoods', value:countyAchievementMetric(countyAchievements,'UNSRM 3.2')},
      {icon:'🌾', label:'Households supported for livelihoods', value:countyAchievementMetric(countyAchievements,'UNSRM 3.3')},
      {icon:'🏥', label:'Hospitals supported', value:countyAchievementMetric(countyAchievements,'UNSRM 4.2.2')},
      {icon:'🎓', label:'Schools supported', value:countyAchievementMetric(countyAchievements,'UNSRM 4.3')},
      {icon:'🚰', label:'Water points rehabilitated', value:countyAchievementMetric(countyAchievements,'UNSRM 4.1.1')},
      {icon:'💧', label:'Water plants rehabilitated', value:countyAchievementMetric(countyAchievements,'UNSRM 4.1.2')},
      {icon:'☮️', label:'Peace structures supported', value:countyAchievementMetric(countyAchievements,'UNSRM 5.1.2')}
    ].filter(m => m.value > 0);

    if(metrics.length) return metrics.slice(0,7).map(m => `${m.icon} ${m.label}: <b>${fmtCompact(m.value)}</b>`).join('<br>');

    const fallback = countyFallbackAchievements(countyAchievements);
    return fallback || '<em>No achievement values reported yet</em>';
  }

  async function initMap(){
    const containers = [
      {id:'upper-nile-map', resetId:'map-reset'},
      {id:'upper-nile-county-map', resetId:'county-map-reset'},
      {id:'upper-nile-partner-map', resetId:'partner-map-reset'},
      {id:'upper-nile-enabler-map', resetId:'enabler-map-reset'}
    ].filter(x => byId(x.id));

    if(!containers.length || !window.d3 || !window.topojson) return;

    try{
      const topo=await fetch('data/ssd_admbnda_adm2_imwg_nbs_20180817.json').then(r=>r.json());
      const obj=topo.objects[Object.keys(topo.objects)[0]];
      const geo=topojson.feature(topo,obj);
      state.upperGeo={type:'FeatureCollection',features:geo.features.filter(f=>f.properties.ADM1_EN==='Upper Nile')};
      state.shapeSvgs = [];

      containers.forEach(cfg=>{
        const container = byId(cfg.id);
        container.innerHTML='<svg class="un-shape-map" role="img" aria-label="Upper Nile county implementation map"></svg><div class="un-map-tooltip"></div>';
        state.shapeSvgs.push({id:cfg.id, svg:d3.select(container).select('svg')});

        const resetBtn = byId(cfg.resetId);
        if(resetBtn){
          resetBtn.addEventListener('click',()=>{
            state.county='All';
            byId('filter-county').value='All';
            refreshFilterOptions && refreshFilterOptions();
            renderAll();
          });
        }
      });

      updateMap();
    }catch(e){
      containers.forEach(cfg=>{
        byId(cfg.id).innerHTML='<div style="padding:18px">Unable to load Upper Nile county shape map.</div>';
      });
      console.error(e);
    }
  }

  function positionMapTooltip(tooltip, event, container){
    if(!tooltip || !container) return;
    const pad = 12;
    const offset = 16;
    const containerWidth = container.clientWidth || 0;
    const containerHeight = container.clientHeight || 0;

    tooltip.style.left = (event.offsetX + offset) + 'px';
    tooltip.style.top = (event.offsetY + offset) + 'px';

    const rect = tooltip.getBoundingClientRect();
    const tooltipWidth = rect.width || 260;
    const tooltipHeight = rect.height || 160;

    let left = event.offsetX + offset;
    let top = event.offsetY + offset;

    if(containerWidth && left + tooltipWidth + pad > containerWidth){
      left = Math.max(pad, event.offsetX - tooltipWidth - offset);
    }
    if(containerHeight && top + tooltipHeight + pad > containerHeight){
      top = Math.max(pad, event.offsetY - tooltipHeight - offset);
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
  }

  function updateMap(){
    if(!state.upperGeo || !window.d3) return;

    const svgEntries = state.shapeSvgs && state.shapeSvgs.length
      ? state.shapeSvgs
      : (state.shapeSvg ? [{id:'upper-nile-map', svg:state.shapeSvg}] : []);

    svgEntries.forEach(entry=>{
      const container=byId(entry.id);
      if(!container) return;

      const width=Math.max(container.clientWidth || 620, 320);
      const defaultHeight = entry.id === 'upper-nile-county-map' ? 430 : 520;
      const height=Math.max(container.clientHeight || defaultHeight, 320);
      const svg=entry.svg.attr('viewBox',`0 0 ${width} ${height}`);
      const projection=d3.geoMercator();

      if(entry.id === 'upper-nile-county-map' || entry.id === 'upper-nile-partner-map' || entry.id === 'upper-nile-enabler-map'){
        projection.fitExtent([[18, 18], [width - 18, height - 18]], state.upperGeo);

        const zoomFactor = entry.id === 'upper-nile-partner-map' ? 1.28 : 1.18;
        const currentScale = projection.scale();
        const currentTranslate = projection.translate();

        projection
          .scale(currentScale * zoomFactor)
          .translate([
            width / 2 + (currentTranslate[0] - width / 2) * zoomFactor,
            height / 2 + (currentTranslate[1] - height / 2) * zoomFactor + 10
          ]);
      } else {
        projection.fitExtent([[18, 18], [width - 18, height - 18]], state.upperGeo);
      }

      const path=d3.geoPath(projection);
      const tooltip=container.querySelector('.un-map-tooltip');
      const selected=state.county;

      const paths=svg.selectAll('path.county-shape').data(state.upperGeo.features, d=>d.properties.ADM2_EN);
      paths.join(
        enter=>enter.append('path').attr('class','county-shape'),
        update=>update,
        exit=>exit.remove()
      )
      .attr('d',path)
      .attr('fill',d=>{
        const name=d.properties.ADM2_EN;
        const m=countyMapMetrics(name);
        if(entry.id === 'upper-nile-partner-map'){
          const pm = partnerMapMetrics(name);
          return partnerFillColor(pm.implementingOrgs.length);
        }
        if(entry.id === 'upper-nile-enabler-map'){
          const em = enablerMapMetrics(name);
          return enablerFillColor(em.records);
        }
        return countyFillColor(m.reportedActivities);
      })
      .attr('stroke',d=>{
        const name=d.properties.ADM2_EN;
        const isSelected = selected === name;
        if(isSelected) return '#042f46';
        if(entry.id === 'upper-nile-partner-map'){
          const pm = partnerMapMetrics(name);
          return pm.implementingOrgs.length === 0 ? '#f97316' : '#ffffff';
        }
        if(entry.id === 'upper-nile-map' || entry.id === 'upper-nile-county-map'){
          const m = countyMapMetrics(name);
          return m.reportedActivities === 0 ? '#f97316' : '#ffffff';
        }
        if(entry.id === 'upper-nile-enabler-map'){
          const em = enablerMapMetrics(name);
          return em.records === 0 ? '#f97316' : '#ffffff';
        }
        return '#ffffff';
      })
      .attr('stroke-width',d=>{
        const name=d.properties.ADM2_EN;
        if(selected === name) return 2.8;
        if(entry.id === 'upper-nile-partner-map'){
          const pm = partnerMapMetrics(name);
          return pm.implementingOrgs.length === 0 ? 2.6 : 1.1;
        }
        if(entry.id === 'upper-nile-map' || entry.id === 'upper-nile-county-map'){
          const m = countyMapMetrics(name);
          return m.reportedActivities === 0 ? 2.6 : 1.1;
        }
        if(entry.id === 'upper-nile-enabler-map'){
          const em = enablerMapMetrics(name);
          return em.records === 0 ? 2.6 : 1.1;
        }
        return 1.1;
      })
      .attr('stroke-dasharray',d=>{
        const name=d.properties.ADM2_EN;
        if(selected === name) return null;
        if(entry.id === 'upper-nile-partner-map'){
          const pm = partnerMapMetrics(name);
          return pm.implementingOrgs.length === 0 ? '6 4' : null;
        }
        if(entry.id === 'upper-nile-map' || entry.id === 'upper-nile-county-map'){
          const m = countyMapMetrics(name);
          return m.reportedActivities === 0 ? '6 4' : null;
        }
        if(entry.id === 'upper-nile-enabler-map'){
          const em = enablerMapMetrics(name);
          return em.records === 0 ? '6 4' : null;
        }
        return null;
      })
      .attr('opacity',d=>selected!=='All' && selected!==d.properties.ADM2_EN ? .35 : 1)
      .style('cursor','pointer')
      .on('mousemove',function(event,d){
        const name=d.properties.ADM2_EN;
        const m=countyMapMetrics(name);
        if(!tooltip) return;
        tooltip.style.display='block';
        if(entry.id === 'upper-nile-enabler-map'){
          const em = enablerMapMetrics(name);
          tooltip.innerHTML=`<strong>${name}</strong><br>Enabler records: <b>${em.records}</b><br>Reporting entities: <b>${em.orgs.length}</b><br><span class="un-tooltip-hint">Click to filter</span>`;
          positionMapTooltip(tooltip, event, container);
        } else if(entry.id === 'upper-nile-partner-map'){
          const pm = partnerMapMetrics(name);
          tooltip.innerHTML=`<strong>${name}</strong><br>Implementing organisations: <b>${pm.implementingOrgs.length}</b><br>Reporting organisations: <b>${pm.reportingOrgs.length}</b><br>Objectives: <b>${pm.objectives.length ? pm.objectives.join(', ') : 'Not reported'}</b><br><span class="un-tooltip-hint">Click to filter</span>`;
          positionMapTooltip(tooltip, event, container);
        } else {
          const countyAchievements = filteredRowsForCounty(name).achievements.filter(r => countyKey(r) === name && progressUnits(r) > 0);
          const achievementLines = countyTooltipAchievements(countyAchievements);
          tooltip.innerHTML=`<strong>📍 ${name}</strong><br><br><strong>Active implementation</strong><br>Active activities: <b>${m.reportedActivities}</b><br>Total roadmap activities: <b>${m.plannedActivities}</b><br><br><strong>Key achievements</strong><br>${achievementLines}<br><br><strong>Delivery footprint</strong><br>Reporting organisations: <b>${m.reportingOrgs.length}</b><br>Implementing organisations: <b>${m.implementingOrgs ? m.implementingOrgs.length : 0}</b><br><br><span class="un-tooltip-hint">Click to filter dashboard</span>`;
          positionMapTooltip(tooltip, event, container);
        }
      })
      .on('mouseleave',()=>{if(tooltip) tooltip.style.display='none';})
      .on('click',function(event,d){
        const name=d.properties.ADM2_EN;
        state.county=name;
        byId('filter-county').value=name;
        refreshFilterOptions && refreshFilterOptions('county');
        renderAll();
      });

      const labelData=state.upperGeo.features.map(f=>{
        const c=path.centroid(f);
        return {name:f.properties.ADM2_EN,x:c[0],y:c[1]};
      });
      svg.selectAll('text.county-label').data(labelData,d=>d.name).join('text')
        .attr('class','county-label')
        .attr('x',d=>d.x)
        .attr('y',d=>d.y)
        .text(d=>d.name)
        .attr('text-anchor','middle')
        .attr('dominant-baseline','middle');
    });
  }

  function renderPartnerSnapshot(a){
    const orgs=unique(a.achievements.map(orgKey)).length; const counties=unique([...a.achievements.map(countyKey),...a.targets.map(countyKey)]).length; const acts=unique(a.targets.map(r=>clean(r['UNS Activity Indicator Code']))).length; const impl=unique(a.service.map(r=>serviceImplementingOrgKey(r))).length;
    byId('partner-snapshot').innerHTML=`<div class="un-mini-metric"><strong>${orgs}</strong><span>Reporting orgs</span></div><div class="un-mini-metric"><strong>${impl}</strong><span>Implementing orgs</span></div><div class="un-mini-metric"><strong>${counties}</strong><span>Counties</span></div><div class="un-mini-metric"><strong>${acts}</strong><span>Activities</span></div>`;
  }
  function renderAll(){
    const a=aggregate(); renderKpis(a); renderImpactGlance(a); renderFinancialProgressMatrix(a); renderAlignment(); renderObjectives(a); renderActivityTable(a); renderRoadmap(a); renderCounty(a); renderPartners(a); renderEnablers(a); renderInsights(a); renderPartnerSnapshot(a); updateMap();
  }

  function currentPanelTarget(){
    const active = document.querySelector('.un-tab.active');
    return active ? active.dataset.target : 'intro';
  }

  function filterLabel(id){
    const el = byId(id);
    return el ? el.closest('label') : null;
  }

  function setFilterLabel(id, text){
    const label = filterLabel(id);
    if(!label) return;
    const select = byId(id);
    label.childNodes.forEach(n=>{
      if(n.nodeType === Node.TEXT_NODE) n.textContent = text;
    });
    if(select && !label.textContent.trim().startsWith(text)){
      label.insertBefore(document.createTextNode(text), select);
    }
  }

  function setContextOptions(id, values, stateKey){
    const cleanValues = unique((values || []).filter(Boolean));
    const current = state[stateKey] || 'All';
    fillSelect(id, cleanValues);
    const el = byId(id);
    if(!el) return;
    if(current !== 'All' && cleanValues.includes(current)){
      el.value = current;
    } else {
      el.value = 'All';
      state[stateKey] = 'All';
    }
  }

  function optionRowsForPanel(panel, ignoreKey){
    if(panel === 'partners'){
      return (D.serviceMapping || []).filter(r=>{
        const c=countyKey(r);
        const reporting=clean(r['Reporting Organisation name']);
        const implementing=serviceImplementingOrgKey(r);
        const objective=serviceObjectiveKey(r);
        if(ignoreKey !== 'county' && state.county !== 'All' && c !== state.county) return false;
        if(ignoreKey !== 'org' && state.org !== 'All' && reporting !== state.org) return false;
        if(ignoreKey !== 'impl' && state.impl !== 'All' && implementing !== state.impl) return false;
        if(ignoreKey !== 'objective' && state.objective !== 'All' && objective !== state.objective) return false;
        return true;
      });
    }
    if(panel === 'enablers'){
      return (D.enablers || []).filter(r=>{
        const y=enablerYearKey(r);
        const c=enablerCountyKey(r);
        const org=enablerOrgKey(r);
        const obj=enablerObjectiveKey(r);
        const act=enablerActivityFilterKey(r);
        const unit=enablerUnitKey(r);
        const selectedYear=calendarYearFromState();
        if(ignoreKey !== 'year' && selectedYear !== 'All' && y !== selectedYear) return false;
        if(ignoreKey !== 'county' && state.county !== 'All' && c !== state.county) return false;
        if(ignoreKey !== 'org' && state.org !== 'All' && org !== state.org) return false;
        if(ignoreKey !== 'objective' && state.objective !== 'All' && obj !== state.objective) return false;
        if(ignoreKey !== 'activity' && state.activity !== 'All' && act !== state.activity) return false;
        if(ignoreKey !== 'unit' && state.unit !== 'All' && unit !== state.unit) return false;
        return true;
      });
    }
    return [];
  }

  function setFilterVisibilityForPanel(changedKey){
    const target = currentPanelTarget();

    document.body.classList.remove(
      'un-panel-intro','un-panel-overview','un-panel-roadmap','un-panel-county',
      'un-panel-partners','un-panel-enablers','un-panel-insights'
    );
    document.body.classList.add('un-panel-' + target);

    const allIds = ['filter-year','filter-county','filter-org','filter-impl','filter-objective','filter-national','filter-activity','filter-unit'];
    const visibleByPanel = {
      intro: [],
      overview: ['filter-year','filter-county','filter-org','filter-objective','filter-national'],
      roadmap: ['filter-year','filter-county','filter-org','filter-objective','filter-national','filter-activity','filter-unit'],
      county: ['filter-year','filter-county','filter-org','filter-objective','filter-national','filter-activity','filter-unit'],
      partners: ['filter-county','filter-org','filter-impl','filter-objective'],
      enablers: ['filter-year','filter-county','filter-org','filter-objective','filter-activity','filter-unit']
    };

    const visible = new Set(visibleByPanel[target] || visibleByPanel.roadmap);

    allIds.forEach(id=>{
      const label = filterLabel(id);
      if(label) label.style.display = visible.has(id) ? '' : 'none';
    });

    // Hidden filters must not continue filtering the active page.
    if(!visible.has('filter-year')) state.year = 'All';
    if(!visible.has('filter-county')) state.county = 'All';
    if(!visible.has('filter-org')) state.org = 'All';
    if(!visible.has('filter-impl')) state.impl = 'All';
    if(!visible.has('filter-objective')) state.objective = 'All';
    if(!visible.has('filter-national')) state.national = 'All';
    if(!visible.has('filter-activity')) state.activity = 'All';
    if(!visible.has('filter-unit')) state.unit = 'All';

    ['year','county','org','impl','objective','national','activity','unit'].forEach(k=>{
      const el = byId('filter-' + k);
      if(el && !visible.has('filter-' + k)) el.value = 'All';
    });

    // Context-specific filter labels.
    setFilterLabel('filter-year', 'Reporting Year');
    setFilterLabel('filter-county', 'County');
    setFilterLabel('filter-org', 'Reporting Organisation');
    setFilterLabel('filter-impl', 'Implementing Organisation');
    setFilterLabel('filter-objective', 'UNSRM Objective');
    setFilterLabel('filter-national', 'National DS Objective');
    setFilterLabel('filter-activity', 'Activity');
    setFilterLabel('filter-unit', 'Unit of Measure');

    if(target === 'partners'){
      setContextOptions('filter-county', unique(optionRowsForPanel('partners','county').map(countyKey)), 'county');
      setContextOptions('filter-org', unique(optionRowsForPanel('partners','org').map(r=>clean(r['Reporting Organisation name']))), 'org');
      setContextOptions('filter-impl', unique(optionRowsForPanel('partners','impl').map(serviceImplementingOrgKey)), 'impl');
      setContextOptions('filter-objective', unique(optionRowsForPanel('partners','objective').map(serviceObjectiveKey)), 'objective');
    }

    if(target === 'enablers'){
      setFilterLabel('filter-activity', 'UNS Activity Indicator');
      setContextOptions('filter-year', unique(optionRowsForPanel('enablers','year').map(enablerYearKey)).sort(), 'year');
      setContextOptions('filter-county', unique(optionRowsForPanel('enablers','county').map(enablerCountyKey)), 'county');
      setContextOptions('filter-org', unique(optionRowsForPanel('enablers','org').map(enablerOrgKey)), 'org');
      setContextOptions('filter-objective', unique(optionRowsForPanel('enablers','objective').map(enablerObjectiveKey)), 'objective');
      setContextOptions('filter-activity', unique(optionRowsForPanel('enablers','activity').map(enablerActivityFilterKey)), 'activity');
      setContextOptions('filter-unit', unique(optionRowsForPanel('enablers','unit').map(enablerUnitKey)), 'unit');
    }

    const reset = byId('reset-filters');
    if(reset) reset.style.display = target === 'intro' ? 'none' : '';
  }

  function initTabs(){
    document.querySelectorAll('.un-tab').forEach(tab=>tab.addEventListener('click',()=>{
      document.querySelectorAll('.un-tab').forEach(t=>t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.un-panel').forEach(p=>p.classList.remove('active'));
      const panel = byId('panel-'+tab.dataset.target);
      if(panel) panel.classList.add('active');

      const fp=byId('global-filters');
      if(fp) fp.classList.toggle('un-filter-hidden', tab.dataset.target==='intro');

      setFilterVisibilityForPanel();
      renderAll();
      setTimeout(()=>{updateMap();},100);
    }));

    const active=document.querySelector('.un-tab.active');
    const fp=byId('global-filters');
    if(fp&&active) fp.classList.toggle('un-filter-hidden', active.dataset.target==='intro');
    setFilterVisibilityForPanel();
  }

  document.addEventListener('DOMContentLoaded',()=>{initTabs(); initFilters(); renderAll(); initMap();});
})();
