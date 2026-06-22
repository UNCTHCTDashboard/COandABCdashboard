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

  function plainText(html){
    return clean(String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '));
  }

  function objectiveOptionTooltip(code){
    const c = clean(code);
    if(!c || c === 'All') return 'Show all Upper Nile State Roadmap objectives';
    const obj = (D.objectives || []).find(o => clean(o.code) === c);
    if(!obj) return c;
    return `${plainText(roadmapObjectiveLabel(c))}: ${clean(obj.upperNileObjective)}`;
  }

  function nationalOptionTooltip(code){
    const c = clean(code);
    if(!c || c === 'All') return 'Show all National Durable Solutions objectives';
    const obj = (D.objectives || []).find(o => clean(o.nationalCode) === c);
    const fromLogframe = (D.logframe || []).find(l => clean(l['National DS Strategy Objective Code']) === c);
    const fullText = clean((obj && obj.nationalObjective) || (fromLogframe && fromLogframe['National DS Strategy Objective']) || '');
    return fullText ? `${nationalObjectiveLabel(c)}: ${fullText}` : nationalObjectiveLabel(c);
  }

  function applyFilterOptionTooltips(id){
    const el = byId(id);
    if(!el) return;
    let tooltipFn = null;
    if(id === 'filter-objective') tooltipFn = objectiveOptionTooltip;
    if(id === 'filter-national') tooltipFn = nationalOptionTooltip;
    if(!tooltipFn) return;

    [...el.options].forEach(o => {
      const tip = tooltipFn(o.value);
      o.title = tip;
    });
    const selected = el.options[el.selectedIndex];
    el.title = selected ? selected.title : '';
  }

  function applyAllFilterOptionTooltips(){
    applyFilterOptionTooltips('filter-objective');
    applyFilterOptionTooltips('filter-national');
  }
  const yearKey = r => clean(r['REPORTING YEAR'] || r['Strategy/Roadmap Year']);
  const countyKey = r => clean(r['COUNTY'] || r['County']);

  // Shared county-name normalisation for all Upper Nile pages/maps.
  // Some source rows use combined operational labels (for example "Ulang/Nasir"),
  // while the GeoJSON map uses individual county names. These helpers let one
  // record contribute to every matching map county without changing the source labels.
  function countySlug(name){
    return clean(name)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function countyParts(name){
    const raw = clean(name);
    if(!raw || raw === 'All') return raw === 'All' ? ['All'] : [];
    const v = countySlug(raw);
    const splitMap = {
      'canal/pigi': ['Canal/Pigi'],
      'canal\/pigi': ['Canal/Pigi'],
      'canal - pigi': ['Canal/Pigi'],
      'canal': ['Canal/Pigi'],
      'pigi': ['Canal/Pigi'],
      'panyikang/baliet/akoka': ['Panyikang','Baliet'],
      'panyikang/baliet/ako': ['Panyikang','Baliet'],
      'panyikang/baliet/akoka county': ['Panyikang','Baliet'],
      'panyikang/baliet/ako ka': ['Panyikang','Baliet'],
      'baliet/akoka': ['Baliet'],
      'baliet/ako': ['Baliet'],
      'ulang/nasir': ['Ulang','Luakpiny/Nasir'],
      'luakpiny/nasir': ['Luakpiny/Nasir'],
      'luakpiny-nasir': ['Luakpiny/Nasir'],
      'nasir': ['Luakpiny/Nasir'],
      'panyikang': ['Panyikang'],
      'baliet': ['Baliet'],
      'fashoda': ['Fashoda'],
      'malakal': ['Malakal'],
      'renk': ['Renk'],
      'maban': ['Maban'],
      'melut': ['Melut'],
      'manyo': ['Manyo'],
      'longochuk': ['Longochuk'],
      'maiwut': ['Maiwut'],
      'fangak': ['Fangak'],
      'akoka': ['Panyikang','Baliet']
    };
    if(splitMap[v]) return splitMap[v];
    return raw.split('/').map(x=>clean(x)).filter(Boolean).map(x=>{
      const xSlug = countySlug(x);
      return (splitMap[xSlug] && splitMap[xSlug][0]) || x;
    });
  }

  function countyMatches(dataCounty, selectedCounty){
    if(!selectedCounty || selectedCounty === 'All') return true;
    const dataParts = countyParts(dataCounty);
    const selectedParts = countyParts(selectedCounty);
    return dataParts.some(c => selectedParts.includes(c));
  }

  function countySelectionIncludesMapCounty(mapCounty){
    return state.county === 'All' || countyMatches(mapCounty, state.county);
  }

  function countyListFromRows(rows, keyFn=countyKey){
    return unique((rows || []).flatMap(r => countyParts(keyFn(r))));
  }
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
    applyFilterOptionTooltips(id);
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
        applyFilterOptionTooltips('filter-' + k);
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
      applyAllFilterOptionTooltips();
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
      if(ignoreKey !== 'county' && state.county !== 'All' && !countyMatches(c, state.county)) return false;
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
    applyFilterOptionTooltips(id);
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
    state.county = setSelectOptions('filter-county', countyListFromRows(countyRows), state.county) || state.county;

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
      if(state.county!=='All' && !countyMatches(c, state.county)) return false;
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
      if(state.county!=='All' && !countyMatches(countyKey(r), state.county)) return false;
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
    const counties = countyListFromRows(rows);
    const orgs = uniqueEnablerOrgs(rows);
    const objectives = unique(rows.map(enablerObjectiveKey));
    const recordsWithAchievement = rows.filter(r => (Number(r['ACHIEVEMENT']) || 0) > 0).length;
    const tooltip = (label) => `${label}\n\nCounties: ${counties.slice(0,10).join(', ') || 'No county reported'}\nReporting organisations: ${orgs.slice(0,10).join(', ') || 'No reporting organisation reported'}\nObjectives supported: ${objectives.join(', ') || 'No objective reported'}`;
    return [
      {label:'Counties with enablers', value:counties.length, icon:'📍', sub:'Counties with reported enabling activities', description:'Number of counties where enabling activities have been reported.', tooltip:tooltip('Counties with enablers')},
      {label:'Reporting organisations', value:orgs.length, icon:'🤝', sub:'Distinct reporting entities with enabling activities', description:'Number of reporting organisations contributing enabling activities.', tooltip:tooltip('Reporting organisations')},
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
    const orgs = uniqueEnablerOrgs(relevant).slice(0,10).join(', ') || 'No reporting organisation reported';
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
      {label:'Estimated Funding Invested', value:fmtCompact(a.estimated,true), sub:'Reported investment linked to delivered activities', icon:'💰', description:'Estimated funding already invested in activities reported under the current filters.', counties:'Filtered selection', orgs:'Filtered selection', activities:'All filtered roadmap activities'},
      {label:'Total Funding Requirement', value:fmtCompact(a.requirement,true), sub:'Estimated budget required to deliver all roadmap targets', icon:'📌', description:'Total funding requirement for the selected roadmap targets and filters.', counties:'Filtered selection', orgs:'Filtered selection', activities:'All filtered roadmap activities'},
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
          <span>Remaining funding gap<br><strong class="${r.req-r.est>0?'fund-gap':'fund-pos'}">${fmtCompact(r.req-r.est,true)}</strong></span>
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
    {label:'Total Funding Requirement',f:r=>money(r.requirement)},
    {label:'Remaining Funding Gap',f:r=>`<span class="fund-gap">${money(r.gap)}</span>`},
    {label:'Remaining Funding Gap %',f:r=>`${r.fundingGapPct}%`}
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
  function objectiveInsightItems(g, rows, est, req, hasMixedUnits){
    const activityProgress = rows.map(r=>({
      ...r,
      unitPct:pct(r.achievement,r.target),
      fundPct:pct(r.estimated,r.requirement),
      gap:(r.requirement||0)-(r.estimated||0)
    }));
    const notStarted = activityProgress.filter(r=>(r.achievement||0)===0 && (r.target||0)>0).length;
    const bestUnit = activityProgress
      .filter(r=>r.target>0 && r.achievement>0)
      .sort((a,b)=>b.unitPct-a.unitPct)[0];
    const largestGap = activityProgress
      .filter(r=>r.gap>0)
      .sort((a,b)=>b.gap-a.gap)[0];
    const items=[];
    if(req>0){
      const fp=pct(est,req);
      if(fp<35) items.push(`🔴 Funding remains low at <strong>${fp}%</strong> against the required resources.`);
      else if(fp<75) items.push(`🟡 Funding is partially mobilized at <strong>${fp}%</strong> of requirement.`);
      else items.push(`🟢 Funding is well advanced at <strong>${fp}%</strong> of requirement.`);
    }
    if(notStarted>0) items.push(`⚠️ <strong>${notStarted}</strong> activity area${notStarted>1?'s':''} show zero reported unit progress.`);
    if(bestUnit) items.push(`✅ Strongest reported activity: <strong>${bestUnit.code}</strong> at <strong>${bestUnit.unitPct}%</strong> unit progress.`);
    if(largestGap) items.push(`💰 Largest activity remaining funding gap: <strong>${largestGap.code}</strong> (${fmtCompact(largestGap.gap,true)}).`);
    if(hasMixedUnits) items.push(`ℹ️ Unit progress is shown by activity because this objective combines different units of measure.`);
    return items.slice(0,5);
  }

  function compactListHTML(items, type){
    const limit = 4;
    const shown = items.slice(0, limit);
    const hidden = items.slice(limit);
    const more = hidden.length;
    if(!items.length) return '<span class="un-roadmap-chip muted">Not reported</span>';
    const visibleChips = shown.map(x=>`<span class="un-roadmap-chip">${x}</span>`).join('');
    const hiddenChips = hidden.map(x=>`<span class="un-roadmap-chip un-roadmap-chip-extra">${x}</span>`).join('');
    const moreBtn = more > 0
      ? `<button type="button" class="un-roadmap-more-chip" data-expanded="false" data-more-count="${more}">+ ${more} more</button>`
      : '';
    return `${visibleChips}${hiddenChips}${moreBtn}`;
  }

  function bindRoadmapMoreChips(){
    document.querySelectorAll('.un-roadmap-more-chip').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.preventDefault();
        e.stopPropagation();
        const wrap = btn.closest('.un-roadmap-chip-wrap');
        if(!wrap) return;
        const expanded = btn.dataset.expanded === 'true';
        wrap.classList.toggle('expanded', !expanded);
        btn.dataset.expanded = String(!expanded);
        const count = Number(btn.dataset.moreCount) || wrap.querySelectorAll('.un-roadmap-chip-extra').length;
        btn.textContent = expanded ? `+ ${count} more` : 'Show less';
      });
    });
  }

  function roadmapStatusLabel(fp){
    if(fp >= 100) return {text:'Fully funded / exceeded', cls:'good'};
    if(fp >= 60) return {text:'Partially funded', cls:'mid'};
    if(fp > 0) return {text:'Funding constrained', cls:'low'};
    return {text:'No funding reported', cls:'low'};
  }

  function renderRoadmapSnapshot(grouped, a){
    const objectives = grouped.length;
    const activities = grouped.reduce((s,g)=>s+g.rows.length,0);
    const est = grouped.reduce((s,g)=>s+g.rows.reduce((x,r)=>x+r.estimated,0),0);
    const req = grouped.reduce((s,g)=>s+g.rows.reduce((x,r)=>x+r.requirement,0),0);
    const gap = req-est;
    const counties = unique([
      ...countyListFromRows(a.targets),
      ...countyListFromRows(a.achievements)
    ]).length;
    const orgs = unique(a.achievements.map(orgKey)).length;
    const notStarted = grouped.reduce((s,g)=>s+g.rows.filter(r=>(r.achievement||0)===0 && (r.target||0)>0).length,0);
    const objGaps = grouped.map(g=>{
      const est = g.rows.reduce((s,r)=>s+r.estimated,0);
      const req = g.rows.reduce((s,r)=>s+r.requirement,0);
      return {code:g.o.code, title:g.o.upperNileObjective, gap:req-est, fp:pct(est,req)};
    }).sort((a,b)=>b.gap-a.gap);
    const largestGap = objGaps.find(x=>x.gap>0);
    const bestFunded = [...objGaps].sort((a,b)=>b.fp-a.fp)[0];
    const insightItems = [];
    if(largestGap) insightItems.push(`🔴 Largest remaining funding gap: <strong>${largestGap.code}</strong> (${fmtCompact(largestGap.gap,true)}).`);
    if(bestFunded) insightItems.push(`🟢 Highest funding progress: <strong>${bestFunded.code}</strong> (${bestFunded.fp}%).`);
    if(notStarted>0) insightItems.push(`⚠️ <strong>${notStarted}</strong> activity area${notStarted>1?'s':''} have zero reported unit progress.`);
    insightItems.push(`📍 Roadmap coverage spans <strong>${counties}</strong> count${counties===1?'y':'ies'} and <strong>${orgs}</strong> reporting organisation${orgs===1?'':'s'}.`);

    return `<div class="un-roadmap-snapshot">
      <div class="un-roadmap-snapshot-left">
        <div class="un-kicker">Roadmap snapshot</div>
        <h3>Filtered Upper Nile Roadmap Progress</h3>
        <p>Summary updates with the selected year, county, reporting organisation, objective and activity filters.</p>
      </div>
      <div class="un-roadmap-snapshot-kpis">
        <div><strong>${objectives}</strong><span>Objectives</span></div>
        <div><strong>${activities}</strong><span>Activity areas</span></div>
        <div><strong>${pct(est,req)}%</strong><span>Funding progress</span></div>
        <div><strong>${fmtCompact(gap,true)}</strong><span>Remaining funding gap</span></div>
      </div>
      <div class="un-roadmap-keyfindings">
        <div class="un-roadmap-keyfindings-title">Key insights</div>
        ${insightItems.map(i=>`<div class="un-roadmap-keyfinding">${i}</div>`).join('')}
      </div>
    </div>`;
  }


  function injectRoadmapTableTabsCSS(){
    if(document.getElementById('un-roadmap-table-tabs-css')) return;
    const style = document.createElement('style');
    style.id = 'un-roadmap-table-tabs-css';
    style.textContent = `
      .un-roadmap-details > summary{
        font-size:.94rem;
        font-weight:950;
        color:var(--un-blue);
        padding:12px 0 8px;
        cursor:pointer;
      }
      .un-roadmap-table-tabs{
        margin-top:10px;
        border:1px solid var(--un-line);
        border-radius:16px;
        overflow:hidden;
        background:#ffffff;
      }
      .un-roadmap-table-tabbar{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        background:#f3f8fc;
        border-bottom:1px solid var(--un-line);
        padding:10px 12px;
      }
      .un-roadmap-table-tab{
        border:1px solid #cfe0ec;
        background:#ffffff;
        color:#16435f;
        padding:9px 14px;
        font-weight:950;
        font-size:.84rem;
        cursor:pointer;
        border-radius:999px;
        box-shadow:0 2px 8px rgba(16,39,66,.04);
      }
      .un-roadmap-table-tab.active{
        background:var(--un-blue);
        color:#ffffff;
        border-color:var(--un-blue);
        box-shadow:0 8px 18px rgba(17,61,88,.18), inset 0 -3px 0 var(--un-teal);
      }
      .un-roadmap-table-tabpanel{display:none;padding:12px;}
      .un-roadmap-table-tabpanel.active{display:block;}
      .un-roadmap-table-note{
        background:#f7fbfd;
        border:1px solid var(--un-line);
        border-radius:12px;
        padding:9px 12px;
        color:var(--un-muted);
        font-size:.82rem;
        margin-bottom:10px;
      }
      .un-roadmap-table-tabs .un-table{
        table-layout:fixed;
        width:100%;
        min-width:1180px;
      }
      .un-roadmap-table-tabs .un-table th,
      .un-roadmap-table-tabs .un-table td{
        line-height:1.45;
        vertical-align:middle;
        word-break:normal;
        overflow-wrap:normal;
      }
      .un-roadmap-table-tabs .un-table th{
        white-space:normal;
      }
      .un-roadmap-table-tabs .un-table td:nth-child(n+2){
        white-space:nowrap;
      }
      .un-roadmap-table-tabs .un-table td:first-child{
        white-space:normal;
      }
      .un-roadmap-table-tabs .un-table th[data-sort-key]{
        cursor:pointer;
        user-select:none;
        position:relative;
        padding-right:20px;
      }
      .un-roadmap-table-tabs .un-table th[data-sort-key]::after{
        content:'↕';
        position:absolute;
        right:7px;
        top:50%;
        transform:translateY(-50%);
        font-size:.72rem;
        opacity:.65;
      }
      .un-roadmap-table-tabs .un-table th.sort-asc::after{content:'↑';opacity:1;}
      .un-roadmap-table-tabs .un-table th.sort-desc::after{content:'↓';opacity:1;}
      .un-roadmap-activity-progress-table{min-width:1240px!important;}
      .un-roadmap-activity-progress-table th:first-child,
      .un-roadmap-activity-progress-table td:first-child{width:32%;}
      .un-roadmap-activity-progress-table th:nth-child(2),
      .un-roadmap-activity-progress-table td:nth-child(2){width:12%;}
      .un-roadmap-activity-progress-table th:nth-child(3),
      .un-roadmap-activity-progress-table td:nth-child(3){width:10%;}
      .un-roadmap-activity-progress-table th:nth-child(4),
      .un-roadmap-activity-progress-table td:nth-child(4){width:10%;}
      .un-roadmap-activity-progress-table th:nth-child(5),
      .un-roadmap-activity-progress-table td:nth-child(5){width:20%;}
      .un-roadmap-activity-progress-table th:nth-child(6),
      .un-roadmap-activity-progress-table td:nth-child(6){width:16%;}
      .un-roadmap-detail-table{min-width:1580px!important;}
      .un-roadmap-detail-table th:first-child,
      .un-roadmap-detail-table td:first-child{width:26%;}
      .un-roadmap-detail-table th:nth-child(2),
      .un-roadmap-detail-table td:nth-child(2){width:9%;}
      .un-roadmap-detail-table th:nth-child(3),
      .un-roadmap-detail-table td:nth-child(3){width:10%;}
      .un-roadmap-detail-table th:nth-child(4),
      .un-roadmap-detail-table td:nth-child(4){width:7%;}
      .un-roadmap-detail-table th:nth-child(5),
      .un-roadmap-detail-table td:nth-child(5){width:7%;}
      .un-roadmap-detail-table th:nth-child(6),
      .un-roadmap-detail-table td:nth-child(6){width:10%;}
      .un-roadmap-detail-table th:nth-child(7),
      .un-roadmap-detail-table td:nth-child(7){width:10%;}
      .un-roadmap-detail-table th:nth-child(8),
      .un-roadmap-detail-table td:nth-child(8){width:8%;}
      .un-roadmap-detail-table th:nth-child(9),
      .un-roadmap-detail-table td:nth-child(9){width:8%;}
      .un-roadmap-detail-table th:nth-child(10),
      .un-roadmap-detail-table td:nth-child(10){width:8%;}
      .un-roadmap-detail-table .un-total-row td:first-child,
      .un-roadmap-detail-table .un-total-row td:nth-child(8){white-space:normal;}
      .un-progress-cell{
        display:grid;
        grid-template-columns:minmax(80px,1fr) auto;
        align-items:center;
        gap:10px;
        min-width:0;
        width:100%;
      }
      .un-row-progress-track{
        height:8px;
        background:#e8eef4;
        border-radius:999px;
        overflow:hidden;
      }
      .un-row-progress-fill{
        height:100%;
        border-radius:999px;
        background:linear-gradient(90deg,var(--un-cyan),var(--un-teal));
      }
      .un-row-progress-fill.low{background:#d25d5d;}
      .un-row-progress-fill.mid{background:#f3b23c;}
      .un-row-progress-fill.good{background:#1aa67a;}
      .un-row-progress-pct{
        min-width:42px;
        text-align:right;
        font-weight:950;
        color:var(--un-blue);
      }
      .un-roadmap-detail-table .un-progress-cell{
        grid-template-columns:minmax(56px,1fr) 34px;
        gap:6px;
      }
      .un-roadmap-detail-table .un-row-progress-pct{
        min-width:32px;
        font-size:.78rem;
      }
      .un-roadmap-detail-table .un-row-progress-track{height:7px;}
      .un-entity-list{
        display:flex;
        flex-wrap:wrap;
        gap:5px;
        align-items:center;
      }
      .un-entity-pill{
        display:inline-flex;
        align-items:center;
        background:#f2f8fb;
        border:1px solid #cfe0ec;
        border-radius:999px;
        padding:3px 7px;
        font-size:.74rem;
        font-weight:850;
        color:#24435d;
        max-width:190px;
      }
      .un-entity-pill-extra{display:none;}
      .un-entity-list.expanded .un-entity-pill-extra{display:inline-flex;}
      .un-entity-more{
        border:0;
        background:#dff6ee;
        color:#00664f;
        border-radius:999px;
        padding:4px 8px;
        font-size:.72rem;
        font-weight:950;
        cursor:pointer;
      }
      .un-county-activity-group{
        border:1px solid var(--un-line);
        border-radius:15px;
        overflow:hidden;
        margin-bottom:12px;
        background:#ffffff;
      }
      .un-county-activity-title{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        background:#f7fbfd;
        border-bottom:1px solid var(--un-line);
        padding:11px 13px;
      }
      .un-county-activity-title strong{
        color:var(--un-blue);
        font-size:.92rem;
      }
      .un-county-activity-title span{
        color:#425b74;
        background:#e9f4f8;
        border:1px solid #cfe0ec;
        border-radius:999px;
        padding:4px 8px;
        font-size:.75rem;
        font-weight:900;
      }
      .un-roadmap-county-progress-table{min-width:1120px!important;}
      .un-roadmap-county-progress-table th:first-child,
      .un-roadmap-county-progress-table td:first-child{width:12%;}
      .un-roadmap-county-progress-table th:nth-child(2),
      .un-roadmap-county-progress-table td:nth-child(2){width:10%;}
      .un-roadmap-county-progress-table th:nth-child(3),
      .un-roadmap-county-progress-table td:nth-child(3){width:10%;}
      .un-roadmap-county-progress-table th:nth-child(4),
      .un-roadmap-county-progress-table td:nth-child(4){width:20%;}
      .un-roadmap-county-progress-table th:nth-child(5),
      .un-roadmap-county-progress-table td:nth-child(5){width:22%;}
      .un-roadmap-county-progress-table th:nth-child(6),
      .un-roadmap-county-progress-table td:nth-child(6){width:22%;}
      .un-funding-gap-high{color:#a04545;font-weight:950;}
      .un-funding-gap-mid{color:#a26005;font-weight:950;}
      .un-funding-gap-low{color:#0f7a5b;font-weight:950;}
      .un-roadmap-objective-badge{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:8px 14px;
        border-radius:999px;
        background:linear-gradient(135deg,#d9fff2,#baf4e3);
        border:1px solid #8be1c5;
        color:#00664f;
        font-weight:950;
        font-size:.9rem;
        letter-spacing:.03em;
        box-shadow:0 8px 20px rgba(26,166,122,.18);
        margin-bottom:10px;
      }
      @media(max-width:700px){
        .un-roadmap-table-tabbar{display:grid;grid-template-columns:1fr;padding:8px;gap:6px;}
        .un-roadmap-table-tab{border-radius:12px;margin:0;}
        .un-progress-cell{min-width:150px;}
      }
    `;
    document.head.appendChild(style);
  }

  function bindRoadmapTableTabs(){
    document.querySelectorAll('.un-roadmap-table-tab').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.preventDefault();
        e.stopPropagation();
        const wrap = btn.closest('.un-roadmap-table-tabs');
        if(!wrap) return;
        const tab = btn.dataset.roadmapTableTab;
        wrap.querySelectorAll('.un-roadmap-table-tab').forEach(x=>x.classList.toggle('active', x === btn));
        wrap.querySelectorAll('.un-roadmap-table-tabpanel').forEach(panel=>{
          panel.classList.toggle('active', panel.dataset.roadmapTablePanel === tab);
        });
      });
    });

    document.querySelectorAll('.un-entity-more').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.preventDefault();
        e.stopPropagation();
        const list = btn.closest('.un-entity-list');
        if(!list) return;
        const expanded = list.classList.toggle('expanded');
        const count = Number(btn.dataset.moreCount) || list.querySelectorAll('.un-entity-pill-extra').length;
        btn.textContent = expanded ? 'Show less' : `+${count} more`;
      });
    });

    bindSortableRoadmapTables();
  }

  function sortValue(v){
    if(typeof v === 'number') return v;
    const n = Number(String(v || '').replace(/[$,%]/g,'').replace(/,/g,''));
    return Number.isFinite(n) && String(v).match(/[0-9]/) ? n : String(v || '').toLowerCase();
  }

  function bindSortableRoadmapTables(){
    document.querySelectorAll('.un-roadmap-sortable-table').forEach(table=>{
      table.querySelectorAll('th[data-sort-key]').forEach(th=>{
        th.addEventListener('click',()=>{
          const key = th.dataset.sortKey;
          const tbody = table.querySelector('tbody');
          if(!tbody) return;
          const current = th.classList.contains('sort-asc') ? 'asc' : (th.classList.contains('sort-desc') ? 'desc' : '');
          const next = current === 'asc' ? 'desc' : 'asc';
          table.querySelectorAll('th').forEach(x=>x.classList.remove('sort-asc','sort-desc'));
          th.classList.add(next === 'asc' ? 'sort-asc' : 'sort-desc');
          const rows = [...tbody.querySelectorAll('tr')].filter(r=>!r.classList.contains('un-total-row'));
          rows.sort((a,b)=>{
            const av = sortValue(a.dataset[key]);
            const bv = sortValue(b.dataset[key]);
            if(typeof av === 'number' && typeof bv === 'number') return next === 'asc' ? av-bv : bv-av;
            return next === 'asc' ? String(av).localeCompare(String(bv), undefined, {numeric:true}) : String(bv).localeCompare(String(av), undefined, {numeric:true});
          });
          rows.forEach(r=>tbody.appendChild(r));
          const total = tbody.querySelector('tr.un-total-row');
          if(total) tbody.appendChild(total);
        });
      });
    });
  }

  function implementingPartnersForActivity(activityCode, objectiveCode, county){
    const code = clean(activityCode);
    const rows = (D.serviceMapping || []).filter(r=>{
      const serviceCode = clean(r['UNS Activity Indicator Code'] || r['UNS Activity Indicator '] || r['UNS Activity Indicator'] || r['Activity / Service']);
      if(code && serviceCode && serviceCode !== code) return false;
      if(objectiveCode && serviceObjectiveKey(r) !== objectiveCode) return false;
      if(county && county !== 'All' && !countyMatches(countyKey(r), county)) return false;
      if(state.county !== 'All' && !countyMatches(countyKey(r), state.county)) return false;
      if(state.org !== 'All' && clean(r['Reporting Organisation name']) !== state.org) return false;
      if(state.impl !== 'All' && serviceImplementingOrgKey(r) !== state.impl) return false;
      return true;
    });
    return unique(rows.map(serviceImplementingOrgKey));
  }

  function compactEntityListHTML(items, limit = 2){
    const arr = unique((items || []).filter(Boolean));
    if(!arr.length) return '<span class="un-entity-muted">Not reported</span>';
    const shown = arr.slice(0, limit).map(x=>`<span class="un-entity-pill">${x}</span>`).join('');
    const hidden = arr.slice(limit).map(x=>`<span class="un-entity-pill un-entity-pill-extra">${x}</span>`).join('');
    const more = arr.length > limit ? `<button type="button" class="un-entity-more" data-more-count="${arr.length-limit}">+${arr.length-limit} more</button>` : '';
    return `<div class="un-entity-list" title="${arr.join(', ').replace(/"/g,'&quot;')}">${shown}${hidden}${more}</div>`;
  }

  function progressBarHTML(value){
    const v = Math.round(Number(value) || 0);
    const cls = v >= 76 ? 'good' : (v >= 26 ? 'mid' : 'low');
    return `<div class="un-progress-cell"><div class="un-row-progress-track"><div class="un-row-progress-fill ${cls}" style="width:${clamp(v)}%"></div></div><span class="un-row-progress-pct">${v}%</span></div>`;
  }

  function fundingGapClass(v){
    const x = Number(v) || 0;
    if(x <= 0) return 'un-funding-gap-low';
    if(x >= 10000000) return 'un-funding-gap-high';
    if(x >= 1000000) return 'un-funding-gap-mid';
    return 'un-funding-gap-low';
  }

  function tableHTMLSortable(headers, rows, rowDataFn){
    if(!rows.length) return '<thead><tr><th>No records found</th></tr></thead><tbody><tr><td>Try changing filters.</td></tr></tbody>';
    const head = '<thead><tr>' + headers.map(h=>`<th${h.sortKey ? ` data-sort-key="${h.sortKey}"` : ''}>${h.label}</th>`).join('') + '</tr></thead>';
    const body = '<tbody>' + rows.map(r=>{
      const data = rowDataFn ? rowDataFn(r) : {};
      const attrs = Object.entries(data).map(([k,v])=>`data-${k}="${String(v).replace(/"/g,'&quot;')}"`).join(' ');
      return `<tr ${attrs}>` + headers.map(h=>`<td>${h.f(r)}</td>`).join('') + '</tr>';
    }).join('') + '</tbody>';
    return head + body;
  }

  function countyProgressRows(a, objectiveCode){
    const m = new Map();
    a.targets.filter(r=>objKey(r)===objectiveCode).forEach(t=>{
      const key = [countyKey(t), clean(t['UNS Activity Indicator Code'])].join('|');
      if(!m.has(key)) m.set(key, {county:countyKey(t), code:clean(t['UNS Activity Indicator Code']), activity:clean(t['UNS Activity Indicator '] || t['UNS Activity Indicator']), unit:clean(t['Unit of indicator measurment']), achieved:0, target:0, orgs:new Set(), impls:new Set()});
      const g = m.get(key);
      g.target += Number(t['UNS Activity Indicator Target']) || 0;
      if(!g.activity) g.activity = clean(t['UNS Activity Indicator '] || t['UNS Activity Indicator']);
      if(!g.unit) g.unit = clean(t['Unit of indicator measurment']);
    });
    a.achievements.filter(r=>objKey(r)===objectiveCode).forEach(r=>{
      const key = [countyKey(r), clean(r['UNS Activity Indicator Code'])].join('|');
      if(!m.has(key)) m.set(key, {county:countyKey(r), code:clean(r['UNS Activity Indicator Code']), activity:activityKey(r), unit:unitKey(r), achieved:0, target:0, orgs:new Set(), impls:new Set()});
      const g = m.get(key);
      g.achieved += progressUnits(r);
      if(orgKey(r)) g.orgs.add(orgKey(r));
      implementingPartnersForActivity(clean(r['UNS Activity Indicator Code']), objectiveCode, countyKey(r)).forEach(o=>g.impls.add(o));
      if(!g.activity) g.activity = activityKey(r);
      if(!g.unit) g.unit = unitKey(r);
    });
    return [...m.values()]
      .filter(r => (Number(r.achieved)||0) > 0)
      .sort((a,b)=>String(a.activity).localeCompare(String(b.activity), undefined, {numeric:true}) || String(a.county).localeCompare(String(b.county), undefined, {numeric:true}));
  }

  function countyProgressGroupedHTML(a, objectiveCode){
    const rows = countyProgressRows(a, objectiveCode);
    if(!rows.length) return '<div class="un-table-wrap"><table class="un-table"><thead><tr><th>No records found</th></tr></thead><tbody><tr><td>Try changing filters.</td></tr></tbody></table></div>';
    const groups = group(rows, r=>r.code, k=>({code:k, activity:'', unit:'', rows:[]}), (g,r)=>{
      if(!g.activity) g.activity = r.activity;
      if(!g.unit) g.unit = r.unit;
      g.rows.push(r);
    });
    const countyHeaders = [
      {label:'County', sortKey:'county', f:r=>r.county},
      {label:'Achieved', sortKey:'achieved', f:r=>num(r.achieved)},
      {label:'Target', sortKey:'target', f:r=>num(r.target)},
      {label:'Unit Progress', sortKey:'progress', f:r=>progressBarHTML(pct(r.achieved,r.target))},
      {label:'Reporting Organisation', sortKey:'orgs', f:r=>compactEntityListHTML([...r.orgs], 2)},
      {label:'Implementing Partners', sortKey:'impls', f:r=>compactEntityListHTML([...r.impls], 2)}
    ];
    return groups.map(g=>`
      <div class="un-county-activity-group">
        <div class="un-county-activity-title"><strong>${g.activity}</strong><span>Unit of measure: ${g.unit || 'Not reported'}</span></div>
        <div class="un-table-wrap"><table class="un-table un-roadmap-sortable-table un-roadmap-county-progress-table">
          ${tableHTMLSortable(countyHeaders, g.rows, r=>({county:r.county, achieved:r.achieved, target:r.target, progress:pct(r.achieved,r.target), orgs:[...r.orgs].join(', '), impls:[...r.impls].join(', ')}))}
        </table></div>
      </div>`).join('');
  }

  function roadmapTabbedTablesHTML(a, objectiveCode, rows, headers, totalRow){
    const inProgressRows = rows.filter(r => (Number(r.achievement)||0) > 0);
    const activityHeaders = [
      {label:'Roadmap Activity', sortKey:'activity', f:r=>r.activity},
      {label:'Unit of Measure', sortKey:'unit', f:r=>r.unit || 'Not reported'},
      {label:'Achieved', sortKey:'achievement', f:r=>num(r.achievement)},
      {label:'Target', sortKey:'target', f:r=>num(r.target)},
      {label:'Unit Progress', sortKey:'progress', f:r=>progressBarHTML(pct(r.achievement,r.target))},
      {label:'Implementing Partners', sortKey:'impls', f:r=>compactEntityListHTML(implementingPartnersForActivity(r.code, objectiveCode, state.county), 2)}
    ];
    const detailHeaders = headers.map(h=>{
      const label = h.label === 'Funding Gap (USD)' ? 'Remaining Funding Gap (USD)' : h.label;
      const sortKey = label.includes('Roadmap Activity') ? 'activity' :
        label.includes('Activity Code') ? 'code' :
        label.includes('Unit of Measure') ? 'unit' :
        label === 'Achieved' ? 'achievement' :
        label === 'Target' ? 'target' :
        label.includes('Estimated Funding') ? 'estimated' :
        label.includes('Total Funding') ? 'requirement' :
        label.includes('Unit Progress') ? 'unitProgress' :
        label.includes('Funding Progress') ? 'fundingProgress' :
        label.includes('Remaining Funding Gap') ? 'gap' : '';
      return {...h, label, sortKey};
    });
    const detailRows = rows.map(r=>({...r, gap:(r.requirement||0)-(r.estimated||0)}));
    const detailTable = tableHTMLSortable(detailHeaders, detailRows, r=>({
      activity:r.activity, code:r.code, unit:r.unit, achievement:r.achievement, target:r.target, estimated:r.estimated,
      requirement:r.requirement, unitProgress:pct(r.achievement,r.target), fundingProgress:pct(r.estimated,r.requirement), gap:r.gap
    })).replace('</tbody>',totalRow+'</tbody>');

    return `<details class="un-roadmap-details" open>
      <summary>Activity Details</summary>
      <div class="un-roadmap-table-tabs">
        <div class="un-roadmap-table-tabbar" role="tablist">
          <button type="button" class="un-roadmap-table-tab active" data-roadmap-table-tab="activity">📊 Activity Progress</button>
          <button type="button" class="un-roadmap-table-tab" data-roadmap-table-tab="county">🗺️ County Progress</button>
          <button type="button" class="un-roadmap-table-tab" data-roadmap-table-tab="detail">💰 Funding Details</button>
        </div>
        <div class="un-roadmap-table-tabpanel active" data-roadmap-table-panel="activity">
          <div class="un-roadmap-table-note">Showing only roadmap activities with reported achievements under the selected filters. Click column headers to sort.</div>
          <div class="un-table-wrap"><table class="un-table un-roadmap-sortable-table un-roadmap-activity-progress-table">
            ${tableHTMLSortable(activityHeaders,inProgressRows, r=>({activity:r.activity, unit:r.unit, achievement:r.achievement, target:r.target, progress:pct(r.achievement,r.target), impls:implementingPartnersForActivity(r.code, objectiveCode, state.county).join(', ')}))}
          </table></div>
        </div>
        <div class="un-roadmap-table-tabpanel" data-roadmap-table-panel="county">
          <div class="un-roadmap-table-note">County-level progress is grouped by roadmap activity and matched using county, reporting year and activity indicator code. Click column headers to sort within each activity group.</div>
          ${countyProgressGroupedHTML(a, objectiveCode)}
        </div>
        <div class="un-roadmap-table-tabpanel" data-roadmap-table-panel="detail">
          <div class="un-roadmap-table-note">Funding details show the full technical activity table, including estimated funding invested, total funding requirement, funding progress and remaining funding gap.</div>
          <div class="un-table-wrap"><table class="un-table un-roadmap-sortable-table un-roadmap-detail-table">${detailTable}</table></div>
        </div>
      </div>
    </details>`;
  }

  function renderRoadmap(a){
    let allowedObjectives = D.objectives;

    if (state.national !== 'All') {
      const linkedCodes = new Set(objectiveForNational(state.national));
      allowedObjectives = allowedObjectives.filter(o => linkedCodes.has(o.code));
    }

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

    const cards = grouped.map(g=>{
      const av=g.rows.reduce((s,r)=>s+r.achievement,0), tv=g.rows.reduce((s,r)=>s+r.target,0), est=g.rows.reduce((s,r)=>s+r.estimated,0), req=g.rows.reduce((s,r)=>s+r.requirement,0);
      const objectiveUnits = unique(g.rows.map(r => clean(r.unit)));
      const hasMixedUnits = objectiveUnits.length > 1;
      const maxMoney=Math.max(est,req,1);
      const objectiveTargetRows = a.targets.filter(r => objKey(r) === g.o.code);
      const objectiveAchievementRows = a.achievements.filter(r => objKey(r) === g.o.code);
      const objectiveCounties = unique([
        ...countyListFromRows(objectiveTargetRows),
        ...countyListFromRows(objectiveAchievementRows)
      ]);
      const objectiveReportingOrgs = unique(objectiveAchievementRows.map(orgKey));
      const objectiveActivities = g.rows.length;
      const fp = pct(est,req);
      const status = roadmapStatusLabel(fp);
      const insights = objectiveInsightItems(g, g.rows, est, req, hasMixedUnits);
      const headers=[
        {label:'Roadmap Activity',f:r=>r.activity},
        {label:'Activity Code',f:r=>r.code},
        {label:'Unit of Measure',f:r=>r.unit},
        {label:'Achieved',f:r=>num(r.achievement)},
        {label:'Target',f:r=>num(r.target)},
        {label:'Estimated Funding Invested (USD)',f:r=>money(r.estimated)},
        {label:'Total Funding Requirement (USD)',f:r=>money(r.requirement)},
        {label:'Unit Progress (%)',f:r=>progressBarHTML(pct(r.achievement,r.target))},
        {label:'Funding Progress (%)',f:r=>progressBarHTML(pct(r.estimated,r.requirement))},
        {label:'Remaining Funding Gap (USD)',f:r=>`<span class="${fundingGapClass(r.requirement-r.estimated)}">${fmtCompact(r.requirement-r.estimated, true)}</span>`}
      ];
      const totalRow=`<tr class="un-total-row"><td>Total</td><td></td><td></td><td>${hasMixedUnits ? '<span class="un-total-dash">—</span>' : num(av)}</td><td>${hasMixedUnits ? '<span class="un-total-dash">—</span>' : num(tv)}</td><td>${money(est)}</td><td>${money(req)}</td><td>${hasMixedUnits ? '<span class="un-progress-badge un-progress-neutral">Mixed units</span>' : progressBarHTML(pct(av,tv))}</td><td>${progressBarHTML(fp)}</td><td><span class="${fundingGapClass(req-est)}">${fmtCompact(req-est, true)}</span></td></tr>`;

      return `<div class="un-roadmap-item un-roadmap-story-card">
        <div class="un-roadmap-story-grid">
          <aside class="un-roadmap-visual-panel">
            <div class="un-roadmap-objective-badge">${g.o.code}</div>
            <div class="un-roadmap-big-number">${fp}%</div>
            <div class="un-roadmap-big-label">Funding progress</div>
            <div class="un-roadmap-single-progress"><span style="width:${clamp(fp)}%"></span></div>
            <div class="un-roadmap-funding-lines">
              <div><span>Estimated Funding Invested</span><strong>${fmtCompact(est,true)}</strong></div>
              <div><span>Total funding requirement</span><strong>${fmtCompact(req,true)}</strong></div>
              <div><span>Remaining funding gap</span><strong class="${req-est>0?'un-money-pos':'un-money-neg'}">${fmtCompact(req-est,true)}</strong></div>
            </div>
            <div class="un-roadmap-status ${status.cls}">${status.text}</div>
          </aside>

          <section class="un-roadmap-context-panel">
            <div class="un-roadmap-context-header">
              <div class="un-roadmap-title-block">
                <div class="un-roadmap-title-eyebrow">
                  <span>Upper Nile State Roadmap Objective ${codeNumber(g.o.code)}</span>
                  <strong>${g.o.code}</strong>
                </div>
                <h3>${g.o.upperNileObjective}</h3>
                <div class="un-roadmap-ndso-line">
                  <span>${nationalObjectiveLabel(g.o.nationalCode)}</span>
                  <p>${g.o.nationalObjective}</p>
                </div>
              </div>
              <div class="un-roadmap-context-kpis">
                ${hasMixedUnits ? '' : `<div><strong>${pct(av,tv)}%</strong><span>Unit progress</span></div>`}
                <div><strong>${objectiveActivities}</strong><span>Activities</span></div>
                <div><strong>${objectiveCounties.length}</strong><span>Counties</span></div>
                <div><strong>${objectiveReportingOrgs.length}</strong><span>Orgs</span></div>
              </div>
            </div>

            <div class="un-roadmap-chip-section">
              <div><strong>📍 Counties</strong><div class="un-roadmap-chip-wrap">${compactListHTML(objectiveCounties,'counties')}</div></div>
              <div><strong>🏢 Reporting organisations</strong><div class="un-roadmap-chip-wrap">${compactListHTML(objectiveReportingOrgs,'orgs')}</div></div>
            </div>

            <div class="un-roadmap-insight-panel">
              <div class="un-roadmap-insight-title">Key findings</div>
              ${insights.map(i=>`<div class="un-roadmap-insight-item">${i}</div>`).join('')}
            </div>
          </section>
        </div>


        ${roadmapTabbedTablesHTML(a, g.o.code, g.rows, headers, totalRow)}
      </div>`;
    }).join('');

    byId('roadmap-objective-detail').innerHTML = renderRoadmapSnapshot(grouped, a) + cards;
    injectRoadmapTableTabsCSS();
    bindRoadmapMoreChips();
    bindRoadmapTableTabs();
  }

  function renderSelectedCountySnapshot(a){
    const selectedCounty = state.county !== 'All' ? state.county : null;
    const countyRows = selectedCounty
      ? a.targets.filter(r => countyMatches(countyKey(r), selectedCounty))
      : a.targets;

    const countyAchievements = selectedCounty
      ? a.achievements.filter(r => countyMatches(countyKey(r), selectedCounty))
      : a.achievements;

    const reportedAchievements = countyAchievements.filter(r => progressUnits(r) > 0 || progressFinancial(r) > 0);

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
    const reportingCoverage = plannedActivities ? Math.round((progressReportedActivities / plannedActivities) * 100) : 0;

    const progressReportedActivityNames = unique(
      reportedAchievements
        .filter(r => clean(r['UNS Roadmap Activities']) || clean(r['UNS Activity Indicator']))
        .map(r => clean(r['UNS Roadmap Activities']) || clean(r['UNS Activity Indicator']))
    );

    const activeObjectives = unique(reportedAchievements.map(objKey));

    const el = byId('selected-county-snapshot');
    if(!el) return;
    el.innerHTML = `
      <div class="un-county-snapshot-section un-county-selection-block">
        <div class="un-county-selection-title">
          <strong>${title}</strong>
          <span>Current selection</span>
        </div>
        <div class="un-county-selection-progress" title="Progress reported: ${progressReportedActivities} of ${plannedActivities} planned activities">
          <div><span style="width:${clamp(reportingCoverage)}%"></span></div>
          <strong>${progressReportedActivities} of ${plannedActivities}</strong>
        </div>
        <p>${progressReportedActivities} of ${plannedActivities} planned activities have reported achievements and/or funding.</p>
      </div>

      <div class="un-county-snapshot-section un-county-snapshot-grid">
        <div class="un-mini-metric"><strong>${fundingProgress}%</strong><span>Funding progress</span></div>
        <div class="un-mini-metric"><strong>${fmtCompact(estimated,true)}</strong><span>Estimated funding invested</span></div>
        <div class="un-mini-metric"><strong>${fmtCompact(gap,true)}</strong><span>Remaining funding gap</span></div>
        <div class="un-mini-metric"><strong>${progressReportedActivities} of ${plannedActivities}</strong><span>Progress reported</span></div>
      </div>

      <div class="un-county-snapshot-section un-county-partners-grid">
        <div class="un-mini-metric"><strong>${reportingOrgs.length}</strong><span>Reporting organisations</span></div>
        <div class="un-mini-metric"><strong>${implementingOrgs.length}</strong><span>Implementing organisations</span></div>
      </div>

      <div class="un-county-snapshot-tabs" role="tablist">
        <button type="button" class="un-county-snapshot-tab active" data-county-snapshot-tab="objectives">Objectives</button>
        <button type="button" class="un-county-snapshot-tab" data-county-snapshot-tab="organisations">Organisations</button>
        <button type="button" class="un-county-snapshot-tab" data-county-snapshot-tab="activities">Activities</button>
      </div>

      <div class="un-county-snapshot-tabpanel active" data-county-snapshot-panel="objectives">
        <div class="un-county-objectives-box">
          <div class="un-county-box-title">Upper Nile State Roadmap Objectives Active</div>
          <div class="un-county-objective-pills">
            ${activeObjectives.length ? activeObjectives.map(o=>`<span>${o}</span>`).join('') : '<em>Not reported</em>'}
          </div>
        </div>
      </div>

      <div class="un-county-snapshot-tabpanel" data-county-snapshot-panel="organisations">
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
      </div>

      <div class="un-county-snapshot-tabpanel" data-county-snapshot-panel="activities">
        <div class="un-county-activities-box">
          <div class="un-county-box-title">Activities with Reported Progress</div>
          ${progressReportedActivityNames.length ? `<ul>${progressReportedActivityNames.map(a=>`<li>${a}</li>`).join('')}</ul>` : '<p>Not reported</p>'}
        </div>
      </div>
    `;
    bindCountySnapshotTabs();
    relocateCountyMapGuide();
  }

  function bindCountySnapshotTabs(){
    const snapshot = byId('selected-county-snapshot');
    if(!snapshot) return;
    snapshot.querySelectorAll('.un-county-snapshot-tab').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const tab = btn.dataset.countySnapshotTab;
        snapshot.querySelectorAll('.un-county-snapshot-tab').forEach(x=>x.classList.toggle('active', x === btn));
        snapshot.querySelectorAll('.un-county-snapshot-tabpanel').forEach(panel=>{
          panel.classList.toggle('active', panel.dataset.countySnapshotPanel === tab);
        });
      });
    });
  }

  function relocateCountyMapGuide(){
    const panel = byId('panel-county');
    const map = byId('upper-nile-county-map');
    if(!panel || !map) return;

    const legends = [...panel.querySelectorAll('.un-map-legend')];
    const legend = legends.find(l => /No active activities reported|Map guide/i.test(l.textContent || ''));
    const mapCard = map.closest('.un-card');

    if(legend && mapCard && !mapCard.contains(legend)){
      mapCard.appendChild(legend);
      legend.classList.add('un-county-map-guide-relocated');
    }
  }

  function countyActivityStatus(r){
    return (Number(r.achievement) || 0) > 0 || (Number(r.estimated) || 0) > 0 ? 'Reported' : 'Planned / not yet reported';
  }

  function renderCountyActivityExplorer(rowsForTable){
    const table = byId('county-table');
    if(!table) return;
    const wrap = table.closest('.un-table-wrap');
    if(!wrap) return;

    const old = byId('county-activity-explorer');
    if(old) old.remove();

    const explorer = document.createElement('div');
    explorer.id = 'county-activity-explorer';
    explorer.className = 'un-county-activity-explorer';
    explorer.innerHTML = `
      <div class="un-county-activity-header">
        <div>
          <p>Switch between reported activities and planned activities not yet reported.</p>
        </div>
        <div class="un-county-activity-tabs" role="tablist">
          <button type="button" class="un-county-activity-tab active" data-county-activity-tab="reported">Reported Activities</button>
          <button type="button" class="un-county-activity-tab" data-county-activity-tab="planned">Planned / Not Yet Reported</button>
        </div>
      </div>
      <label class="un-county-table-search">
        <span>Search within this table</span>
        <div>
          <input id="county-activity-search" type="search" placeholder="Search county, year, activity, unit, organisation, or funding..." autocomplete="off">
          <button type="button" id="county-activity-search-clear">Clear</button>
        </div>
      </label>
    `;
    wrap.parentNode.insertBefore(explorer, wrap);

    let activeTab = 'reported';
    let searchQuery = '';

    const reportedHeaders = [
      {label:'County',f:r=>r.county},
      {label:'Year',f:r=>r.year},
      {label:'Activity',f:r=>r.activity},
      {label:'Unit of Measure',f:r=>r.unit},
      {label:'Achieved',f:r=>num(r.achievement)},
      {label:'Target',f:r=>num(r.target)},
      {label:'Estimated Funding Invested',f:r=>money(r.estimated)},
      {label:'Total Funding Requirement',f:r=>money(r.requirement)},
      {label:'Funding Progress (%)',f:r=>progressBadge(pct(r.estimated,r.requirement))},
      {label:'Remaining Funding Gap',f:r=>`<span class="${r.requirement-r.estimated>0?'un-money-pos':'un-money-neg'}">${fmtCompact(r.requirement-r.estimated,true)}</span>`}
    ];

    const plannedHeaders = [
      {label:'County',f:r=>r.county},
      {label:'Year',f:r=>r.year},
      {label:'Activity',f:r=>r.activity},
      {label:'Unit of Measure',f:r=>r.unit},
      {label:'Target',f:r=>num(r.target)},
      {label:'Total Funding Requirement',f:r=>money(r.requirement)},
      {label:'Remaining Funding Gap',f:r=>`<span class="${r.requirement-r.estimated>0?'un-money-pos':'un-money-neg'}">${fmtCompact(r.requirement-r.estimated,true)}</span>`}
    ];

    function rowSearchText(r){
      return [
        r.county, r.year, r.obj, r.activity, r.unit, r.reportingStatus,
        r.achievement, r.target, r.estimated, r.requirement,
        money(r.estimated), money(r.requirement), fmtCompact(r.requirement-r.estimated,true)
      ].map(v=>clean(v)).join(' ').toLowerCase();
    }

    function rowsForTab(tab){
      if(tab === 'planned'){
        return rowsForTable
          .filter(r => r.reportingStatus !== 'Reported')
          .sort((a,b)=> (b.requirement-a.requirement) || String(a.county).localeCompare(String(b.county), undefined, {numeric:true}));
      }
      return rowsForTable
        .filter(r => r.reportingStatus === 'Reported')
        .sort((a,b)=> (b.estimated-a.estimated) || String(a.county).localeCompare(String(b.county), undefined, {numeric:true}));
    }

    function renderTab(tab){
      activeTab = tab;
      const allRows = rowsForTab(tab);
      const filteredRows = searchQuery
        ? allRows.filter(r => rowSearchText(r).includes(searchQuery))
        : allRows;
      const rows = filteredRows.slice(0,100);
      table.className = `un-table un-county-activity-table un-county-activity-table-${tab}`;
      table.innerHTML = tableHTML(tab === 'planned' ? plannedHeaders : reportedHeaders, rows);
    }

    explorer.querySelectorAll('.un-county-activity-tab').forEach(btn=>{
      btn.addEventListener('click',()=>{
        explorer.querySelectorAll('.un-county-activity-tab').forEach(x=>x.classList.toggle('active', x === btn));
        renderTab(btn.dataset.countyActivityTab);
      });
    });

    const searchInput = explorer.querySelector('#county-activity-search');
    const clearBtn = explorer.querySelector('#county-activity-search-clear');
    if(searchInput){
      searchInput.addEventListener('input',()=>{
        searchQuery = searchInput.value.trim().toLowerCase();
        renderTab(activeTab);
      });
    }
    if(clearBtn){
      clearBtn.addEventListener('click',()=>{
        searchQuery = '';
        if(searchInput) searchInput.value = '';
        renderTab(activeTab);
      });
    }

    renderTab('reported');
  }

  function countyCoverageActivityIcon(activity, unit, code){
    const text = `${activity || ''} ${unit || ''} ${code || ''}`.toLowerCase();
    if(text.includes('shelter') || text.includes('house')) return '🏠';
    if(text.includes('explosive') || text.includes('ordnance') || text.includes('clearance')) return '⚠️';
    if(text.includes('hlp') || text.includes('land') || text.includes('plot')) return '🏡';
    if(text.includes('agricultural') || text.includes('fishing') || text.includes('livelihood')) return '🌾';
    if(text.includes('training')) return '🎓';
    if(text.includes('hospital') || text.includes('health')) return '🏥';
    if(text.includes('school') || text.includes('education')) return '🏫';
    if(text.includes('water')) return '💧';
    if(text.includes('police')) return '👮';
    if(text.includes('court') || text.includes('justice')) return '⚖️';
    if(text.includes('peace') || text.includes('cohesion')) return '☮️';
    if(text.includes('protection')) return '🛡️';
    return '•';
  }

  function countyCoverageActivityRows(a, county, mode='reported'){
    const sourceRows = activityRows(a).filter(r => {
      if(r.county !== county) return false;
      const reported = (Number(r.achievement) || 0) > 0 || (Number(r.estimated) || 0) > 0;
      return mode === 'pending' ? !reported : reported;
    });
    const m = new Map();
    sourceRows.forEach(r=>{
      const key = [r.code, r.activity, r.unit].join('|');
      if(!m.has(key)){
        m.set(key, {code:r.code, activity:r.activity, unit:r.unit, achievement:0, target:0});
      }
      const g = m.get(key);
      g.achievement += Number(r.achievement) || 0;
      g.target += Number(r.target) || 0;
    });
    return [...m.values()].sort((a,b)=>{
      if(mode === 'pending') return String(a.activity).localeCompare(String(b.activity), undefined, {numeric:true});
      return pct(b.achievement,b.target)-pct(a.achievement,a.target) || String(a.activity).localeCompare(String(b.activity), undefined, {numeric:true});
    });
  }

  function countyCoverageVisualHTML(rows, a){
    if(!rows.length){
      return '<div class="un-card"><h3>Roadmap Activity Reporting Coverage by County</h3><p>No county coverage records found for the selected filters.</p></div>';
    }

    function activityCards(county, mode){
      const activityRows = countyCoverageActivityRows(a, county, mode);
      if(!activityRows.length){
        return mode === 'pending'
          ? '<div class="un-county-coverage-empty">No planned activities without reported progress under the selected filters.</div>'
          : '<div class="un-county-coverage-empty">No activities with reported achievements under the selected filters.</div>';
      }
      return activityRows.map(act=>{
        const p = pct(act.achievement, act.target);
        const cls = p >= 76 ? 'good' : (p >= 26 ? 'mid' : 'low');
        const icon = countyCoverageActivityIcon(act.activity, act.unit, act.code);
        const mini = mode === 'pending'
          ? `<div class="un-county-coverage-pending-note">No achievement/funding reported</div>`
          : `<div class="un-county-coverage-mini">
              <div class="un-county-coverage-mini-bar"><span class="${cls}" style="width:${clamp(p)}%"></span></div>
              <strong>${p}%</strong>
            </div>`;
        return `<div class="un-county-coverage-activity">
          <div class="un-county-coverage-icon">${icon}</div>
          <div class="un-county-coverage-activity-main">
            <div class="un-county-coverage-activity-name">${act.activity}</div>
            <div class="un-county-coverage-activity-meta">${mode === 'pending' ? `Target: ${num(act.target)} ${act.unit || ''}` : `Achieved: ${num(act.achievement)} / Target: ${num(act.target)} ${act.unit || ''}`}</div>
          </div>
          ${mini}
        </div>`;
      }).join('');
    }

    function listForMode(mode){
      const defaultCounty = (state.county && state.county !== 'All') ? state.county : (rows[0] ? rows[0].county : '');
      return rows.map(r=>{
        const pendingCount = Math.max(0, (r.plannedCount || 0) - (r.reportedCount || 0));
        const count = mode === 'pending' ? pendingCount : r.reportedCount;
        const coverage = r.plannedCount ? Math.round((count / r.plannedCount) * 100) : 0;
        const expanded = r.county === defaultCounty;
        const title = mode === 'pending'
          ? `Planned activities without reported progress: ${pendingCount} of ${r.plannedCount}`
          : `Activity reporting coverage: ${r.reportedCount} of ${r.plannedCount} planned activities have reported achievements and/or funding`;
        const label = mode === 'pending' ? 'No reported progress' : 'Activity reporting coverage';
        const detailTitle = mode === 'pending'
          ? `${r.county} – ${pendingCount} planned activities without reported progress`
          : `${r.county} – ${r.reportedCount} activities reporting progress`;

        return `<div class="un-county-coverage-row ${expanded ? 'expanded' : ''}" data-county-coverage-row="${r.county}">
          <button type="button" class="un-county-coverage-main" aria-expanded="${expanded ? 'true' : 'false'}" title="${title}">
            <span class="un-county-coverage-chevron">${expanded ? '▼' : '▶'}</span>
            <span class="un-county-coverage-name">${r.county}</span>
            <span class="un-county-coverage-bar" aria-label="${label} ${coverage}%"><span style="width:${clamp(coverage)}%"></span></span>
            <span class="un-county-coverage-count"><strong>${count} / ${r.plannedCount}</strong><small>${label}</small></span>
            <span class="un-county-coverage-pct ${mode === 'pending' ? 'pending' : ''}">${coverage}%</span>
          </button>
          <div class="un-county-coverage-detail ${mode === 'pending' ? 'pending' : ''}">
            <div class="un-county-coverage-detail-title">${detailTitle}</div>
            <div class="un-county-coverage-activities">${activityCards(r.county, mode)}</div>
          </div>
        </div>`;
      }).join('');
    }

    return `<div class="un-county-coverage-visual">
      <div class="un-county-coverage-header">
        <div>
          <h3>Roadmap Activity Reporting Coverage by County</h3>
          <p>The bars compare activities reported against total planned activities. Use the tabs to see reported activities or planned activities without reported progress. Activity names are shown exactly as reported in the roadmap data.</p>
        </div>
        <span>Click a county to view activities</span>
      </div>
      <div class="un-county-coverage-tabs" role="tablist">
        <button type="button" class="un-county-coverage-tab active" data-county-coverage-tab="reported">Reported Progress</button>
        <button type="button" class="un-county-coverage-tab" data-county-coverage-tab="pending">No Reported Progress</button>
      </div>
      <div class="un-county-coverage-tabpanel active" data-county-coverage-panel="reported">
        <div class="un-county-coverage-list">${listForMode('reported')}</div>
      </div>
      <div class="un-county-coverage-tabpanel" data-county-coverage-panel="pending">
        <div class="un-county-coverage-list">${listForMode('pending')}</div>
      </div>
    </div>`;
  }

  function bindCountyCoverageVisual(){
    document.querySelectorAll('.un-county-coverage-tab').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const visual = btn.closest('.un-county-coverage-visual');
        if(!visual) return;
        const tab = btn.dataset.countyCoverageTab;
        visual.querySelectorAll('.un-county-coverage-tab').forEach(x=>x.classList.toggle('active', x === btn));
        visual.querySelectorAll('.un-county-coverage-tabpanel').forEach(panel=>{
          panel.classList.toggle('active', panel.dataset.countyCoveragePanel === tab);
        });
      });
    });

    document.querySelectorAll('.un-county-coverage-main').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const row = btn.closest('.un-county-coverage-row');
        const wrap = btn.closest('.un-county-coverage-list');
        if(!row || !wrap) return;
        const isExpanded = row.classList.contains('expanded');
        wrap.querySelectorAll('.un-county-coverage-row').forEach(r=>{
          r.classList.remove('expanded');
          const b = r.querySelector('.un-county-coverage-main');
          const c = r.querySelector('.un-county-coverage-chevron');
          if(b) b.setAttribute('aria-expanded','false');
          if(c) c.textContent = '▶';
        });
        if(!isExpanded){
          row.classList.add('expanded');
          btn.setAttribute('aria-expanded','true');
          const c = row.querySelector('.un-county-coverage-chevron');
          if(c) c.textContent = '▼';
        }
      });
    });
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

    const coverageRows = rows.slice(0,8).sort((a,b)=>
      (b.reportedCount - a.reportedCount) || (b.reportingCoverage - a.reportingCoverage) || String(a.county).localeCompare(String(b.county), undefined, {numeric:true})
    );
    const countyProfileEl = byId('county-profile');
    if (countyProfileEl) {
      // County View only: replace the old 4-column county-card grid with one full-width coverage visual.
      // This avoids affecting the Roadmap Progress page or any other tab.
      countyProfileEl.className = 'un-county-coverage-holder';
      countyProfileEl.innerHTML = countyCoverageVisualHTML(coverageRows, a);
    }
    bindCountyCoverageVisual();

    const rowsForTable = activityRows(a).map(r => ({...r, reportingStatus: countyActivityStatus(r)}));
    renderCountyActivityExplorer(rowsForTable);
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

      if(state.county !== 'All' && !countyMatches(c, state.county)) return false;
      if(state.org !== 'All' && reporting !== state.org) return false;
      if(state.impl !== 'All' && implementing !== state.impl) return false;
      if(state.objective !== 'All' && objective !== state.objective) return false;
      if(state.activity !== 'All' && service !== state.activity) return false;
      return true;
    });
  }

  function partnerMapMetrics(countyName){
    const rows = applyServiceFilters(D.serviceMapping || []).filter(r => countyMatches(countyKey(r), countyName));
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


  function renderPartnerFootprint(service){
    const panel = byId('panel-partners');
    if(!panel) return;
    const layout = panel.querySelector('.un-partner-map-layout');
    const old = byId('partner-footprint-row');
    if(old) old.remove();

    const reportingOrgs = unique(service.map(r=>clean(r['Reporting Organisation name'])));
    const implementingOrgs = unique(service.map(r=>serviceImplementingOrgKey(r)));
    const counties = countyListFromRows(service);
    const objectives = unique(service.map(serviceObjectiveKey));

    const row = document.createElement('div');
    row.id = 'partner-footprint-row';
    row.className = 'un-partner-footprint-row';
    row.innerHTML = `
      <div class="un-partner-footprint-card"><strong>${reportingOrgs.length}</strong><span>Reporting organisations</span></div>
      <div class="un-partner-footprint-card"><strong>${implementingOrgs.length}</strong><span>Implementing organisations</span></div>
      <div class="un-partner-footprint-card"><strong>${counties.length}</strong><span>Counties covered</span></div>
      <div class="un-partner-footprint-card"><strong>${objectives.length}</strong><span>UNSRM objectives</span></div>
    `;
    if(layout) panel.insertBefore(row, layout);
  }

  function bindPartnerSnapshotTabs(){
    const snapshot = byId('selected-partner-snapshot');
    if(!snapshot) return;
    snapshot.querySelectorAll('[data-partner-snapshot-tab]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const tab = btn.dataset.partnerSnapshotTab;
        snapshot.querySelectorAll('[data-partner-snapshot-tab]').forEach(x=>x.classList.toggle('active', x === btn));
        snapshot.querySelectorAll('[data-partner-snapshot-panel]').forEach(panel=>{
          panel.classList.toggle('active', panel.dataset.partnerSnapshotPanel === tab);
        });
      });
    });
  }

  function relocatePartnerMapGuide(){
    const panel = byId('panel-partners');
    const map = byId('upper-nile-partner-map');
    if(!panel || !map) return;
    const legends = [...panel.querySelectorAll('.un-map-legend')];
    const legend = legends.find(l => /Map guide|implementing organisations/i.test(l.textContent || ''));
    const mapCard = map.closest('.un-card');
    if(legend && mapCard && !mapCard.contains(legend)){
      mapCard.appendChild(legend);
      legend.classList.add('un-partner-map-guide-relocated');
    }
  }

  function renderSelectedPartnerSnapshot(rows){
    const selectedCounty = state.county !== 'All' ? state.county : null;
    const filtered = selectedCounty ? rows.filter(r=>countyMatches(countyKey(r), selectedCounty)) : rows;
    const reportingOrgs = unique(filtered.map(r=>clean(r['Reporting Organisation name'])));
    const implementingOrgs = unique(filtered.map(r=>serviceImplementingOrgKey(r)));
    const objectives = unique(filtered.map(serviceObjectiveKey));
    const activities = unique(filtered.map(serviceObjectiveIndicatorKey).filter(Boolean));
    const title = selectedCounty || 'All counties';

    const el = byId('selected-partner-snapshot');
    if(!el) return;

    el.innerHTML = `
      <div class="un-partner-snapshot-selection">
        <strong>${title}</strong>
        <span>Current selection</span>
      </div>

      <div class="un-county-snapshot-tabs un-partner-snapshot-tabs" role="tablist">
        <button type="button" class="un-county-snapshot-tab active" data-partner-snapshot-tab="organisations">Organisations</button>
        <button type="button" class="un-county-snapshot-tab" data-partner-snapshot-tab="objectives">Objectives</button>
        <button type="button" class="un-county-snapshot-tab" data-partner-snapshot-tab="activities">Activities</button>
      </div>

      <div class="un-county-snapshot-tabpanel active" data-partner-snapshot-panel="organisations">
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
      </div>

      <div class="un-county-snapshot-tabpanel" data-partner-snapshot-panel="objectives">
        <div class="un-county-objectives-box">
          <div class="un-county-box-title">Upper Nile State Roadmap Objectives Covered</div>
          <div class="un-county-objective-pills">
            ${objectives.length ? objectives.map(o=>`<span>${o}</span>`).join('') : '<em>Not reported</em>'}
          </div>
        </div>
      </div>

      <div class="un-county-snapshot-tabpanel" data-partner-snapshot-panel="activities">
        <div class="un-county-activities-box">
          <div class="un-county-box-title">Mapped Activities</div>
          ${activities.length ? `<ul>${activities.map(a=>`<li>${a}</li>`).join('')}</ul>` : '<p>Not reported</p>'}
        </div>
      </div>
    `;
    bindPartnerSnapshotTabs();
    relocatePartnerMapGuide();
  }


  function partnerFootprintVisualHTML(service){
    const rows = group(service, r=>serviceImplementingOrgKey(r) || 'Not reported', k=>({
      implementing:k,
      reporting:new Set(),
      counties:new Set(),
      objectives:new Set(),
      activities:new Set(),
      records:0
    }), (g,r)=>{
      g.records += 1;
      if(clean(r['Reporting Organisation name'])) g.reporting.add(clean(r['Reporting Organisation name']));
      countyParts(countyKey(r)).forEach(c => g.counties.add(c));
      if(serviceObjectiveKey(r)) g.objectives.add(serviceObjectiveKey(r));
      if(serviceObjectiveIndicatorKey(r)) g.activities.add(serviceObjectiveIndicatorKey(r));
    }).sort((a,b)=>
      b.counties.size-a.counties.size ||
      b.activities.size-a.activities.size ||
      b.reporting.size-a.reporting.size ||
      String(a.implementing).localeCompare(String(b.implementing), undefined, {numeric:true})
    );

    const chips = (items, cls, empty='Not reported') => {
      const arr = unique([...items].filter(Boolean));
      return arr.length ? arr.map(x=>`<span class="${cls}">${x}</span>`).join('') : `<em>${empty}</em>`;
    };

    const activityList = (items, limit=3) => {
      const arr = unique([...items].filter(Boolean));
      if(!arr.length) return '<p class="un-partner-footprint-empty">Not reported</p>';
      const shown = arr.slice(0,limit).map(x=>`<li>${x}</li>`).join('');
      const hidden = arr.slice(limit).map(x=>`<li class="un-partner-footprint-extra">${x}</li>`).join('');
      const more = arr.length > limit ? `<button type="button" class="un-partner-footprint-more" data-more-count="${arr.length-limit}">+${arr.length-limit} more activities</button>` : '';
      return `<ul>${shown}${hidden}</ul>${more}`;
    };

    return `
      <div class="un-card-header">
        <div>
          <h3>Implementing Partner Footprint</h3>
          <p>Shows where each implementing organisation is working, who reports with them, and which roadmap objectives and services they support.</p>
        </div>
      </div>
      <div class="un-partner-footprint-visual">
        ${rows.length ? rows.map(r=>`
          <article class="un-partner-footprint-item ${state.impl === r.implementing ? 'selected' : ''}" data-implementing-org="${String(r.implementing).replace(/"/g,'&quot;')}" title="Click to filter by ${String(r.implementing).replace(/"/g,'&quot;')}">
            <div class="un-partner-footprint-top">
              <div>
                <div class="un-partner-footprint-label">Implementing organisation</div>
                <h4>${r.implementing}</h4>
              </div>
              <div class="un-partner-footprint-badge">${r.counties.size} count${r.counties.size===1?'y':'ies'}</div>
            </div>

            <div class="un-partner-footprint-summary">
              <span>🏢 ${r.reporting.size} reporting org${r.reporting.size===1?'':'s'}</span>
              <span>🎯 ${r.objectives.size} objective${r.objectives.size===1?'':'s'}</span>
              <span>📋 ${r.activities.size} activit${r.activities.size===1?'y':'ies'}</span>
            </div>

            <div class="un-partner-footprint-section">
              <strong>📍 Counties covered</strong>
              <div class="un-partner-footprint-chipwrap">${chips(r.counties,'un-partner-county-chip')}</div>
            </div>

            <div class="un-partner-footprint-section">
              <strong>🏢 Reporting organisations</strong>
              <div class="un-partner-footprint-chipwrap">${chips(r.reporting,'un-county-org-pills-chip')}</div>
            </div>

            <div class="un-partner-footprint-section">
              <strong>🎯 UNSRM objectives supported</strong>
              <div class="un-partner-footprint-chipwrap">${chips(r.objectives,'un-partner-objective-chip')}</div>
            </div>

            <div class="un-partner-footprint-section un-partner-footprint-activities">
              <strong>Mapped services / activities</strong>
              ${activityList(r.activities)}
            </div>
          </article>
        `).join('') : '<div class="un-empty-state">No implementing partner records found under the selected filters.</div>'}
      </div>
    `;
  }

  function renderPartnerFootprintVisual(service){
    const existing = byId('partner-footprint-card');
    const oldTable = byId('partner-county-table');
    const card = existing || (oldTable ? oldTable.closest('.un-card') : null);
    if(!card) return;
    card.id = 'partner-footprint-card';
    card.classList.add('un-partner-footprint-card');
    card.innerHTML = partnerFootprintVisualHTML(service);
    bindPartnerFootprintVisual();
  }

  function bindPartnerFootprintVisual(){
    document.querySelectorAll('#partner-footprint-card .un-partner-footprint-item[data-implementing-org]').forEach(card=>{
      card.addEventListener('click', e=>{
        if(e.target.closest('.un-partner-footprint-more')) return;
        const org = clean(card.dataset.implementingOrg);
        state.impl = (state.impl === org) ? 'All' : org;
        const el = byId('filter-impl');
        if(el) el.value = state.impl;
        renderAll();
      });
    });

    document.querySelectorAll('#partner-footprint-card .un-partner-footprint-more').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.preventDefault();
        e.stopPropagation();
        const section = btn.closest('.un-partner-footprint-activities');
        if(!section) return;
        const expanded = section.classList.toggle('expanded');
        const count = Number(btn.dataset.moreCount) || section.querySelectorAll('.un-partner-footprint-extra').length;
        btn.textContent = expanded ? 'Show less' : `+${count} more activities`;
      });
    });
  }

  function renderPartners(a){
    const service = applyServiceFilters(D.serviceMapping || []);

    renderPartnerFootprint(service);
    renderSelectedPartnerSnapshot(service);

    renderPartnerFootprintVisual(service);

    // The old row-by-row “Partner Mapping by UNSRM Objective Indicator” table has been removed.
    // The map, selected snapshot, and Implementing Partner Footprint cards now provide the partner mapping view.
    const serviceTable = byId('service-table');
    if(serviceTable){
      const serviceCard = serviceTable.closest('.un-card');
      if(serviceCard) serviceCard.style.display = 'none';
      serviceTable.innerHTML = '';
    }
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

  function enablerOrgDisplayName(raw){
    const v = clean(raw);
    const map = {
      'UNMISS/CAD': 'UNMISS-CAD',
      'UNMISS/CAD/IOM': 'UNMISS-CAD/IOM',
      'UNMISS/HRD': 'UNMISS-HRD',
      'UNMISS/PTR': 'UNMISS-PTR',
      'UNMISS/ROLSIS': 'UNMISS-RoLSIS',
      'UNMISS/SECTOR NORTH': 'UNMISS-Sector North',
      'UNMISS/UNPOL': 'UNMISS-UNPOL'
    };
    return map[v.toUpperCase()] || v;
  }

  function enablerOrgKey(r){
    const raw = clean(r['REPORTING ORGANISATION'] || r['Reporting Organisation'] || r['Implemented by'] || r['Implemented By']);
    return enablerOrgDisplayName(raw);
  }

  function enablerOrgList(r){
    const v = enablerOrgKey(r);
    return v ? [v] : [];
  }

  function uniqueEnablerOrgs(rows){
    return unique((rows || []).flatMap(enablerOrgList));
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
      if(state.county !== 'All' && !countyMatches(enablerCountyKey(r), state.county)) return false;
      if(state.org !== 'All' && enablerOrgKey(r) !== state.org) return false;
      if(state.objective !== 'All' && enablerObjectiveKey(r) !== state.objective) return false;
      if(state.activity !== 'All' && enablerActivityFilterKey(r) !== state.activity) return false;
      if(state.unit !== 'All' && enablerUnitKey(r) !== state.unit) return false;
      return true;
    });
  }

  function enablerMapMetrics(countyName){
    const rows = applyEnablerFilters(D.enablers || []).filter(r=>countyMatches(enablerCountyKey(r), countyName));
    const totalResults = rows.reduce((s,r)=>s+enablerResultValue(r),0);
    const orgs = uniqueEnablerOrgs(rows);
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

  function enablerIconForUnit(unit){
    const text = clean(unit).toLowerCase();
    if(text.includes('people')) return '👥';
    if(text.includes('patient')) return '🏥';
    if(text.includes('farm') || text.includes('animal') || text.includes('livestock')) return '🐄';
    if(text.includes('training')) return '🎓';
    if(text.includes('awareness') || text.includes('awarness')) return '📢';
    if(text.includes('court')) return '⚖️';
    if(text.includes('peace')) return '🤝';
    if(text.includes('evaluation')) return '📊';
    if(text.includes('election')) return '🗳️';
    if(text.includes('woman') || text.includes('women')) return '👩';
    return '•';
  }

  function enablerTopActivities(rows){
    return group(
      rows.filter(r => enablerDescriptionKey(r)),
      r => enablerDescriptionKey(r),
      k => ({description:k, records:0, value:0, orgs:new Set(), counties:new Set()}),
      (g,r)=>{
        g.records += 1;
        g.value += enablerResultValue(r);
        enablerOrgList(r).forEach(o=>g.orgs.add(o));
        countyParts(enablerCountyKey(r)).forEach(c=>g.counties.add(c));
      }
    ).sort((a,b)=>b.records-a.records || b.value-a.value || a.description.localeCompare(b.description));
  }

  function enablerAchievementGroups(rows){
    const categoryOrder = ['Peace and Community Cohesion','Support Service and Livelihood','Public Services'];
    return group(rows, enablerCategoryKey, k=>({category:k, units:new Map(), total:0}), (g,r)=>{
      const unit = enablerUnitKey(r) || 'Not specified';
      const value = enablerResultValue(r);
      if(value <= 0) return;
      g.total += value;
      if(!g.units.has(unit)) g.units.set(unit, {unit, value:0, rows:[]});
      const u = g.units.get(unit);
      u.value += value;
      u.rows.push(r);
    }).sort((a,b)=>{
      const ai = categoryOrder.indexOf(a.category);
      const bi = categoryOrder.indexOf(b.category);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }

  function enablerAchievementTooltip(category, unit, unitRows, display){
    const counties = unique((unitRows || []).flatMap(r=>countyParts(enablerCountyKey(r)))).slice(0,12).join(', ') || 'No county reported';
    const orgs = uniqueEnablerOrgs(unitRows).slice(0,12).join(', ') || 'No reporting entity reported';
    const activities = unique((unitRows || []).map(enablerDescriptionKey)).slice(0,6).join('; ') || 'No activity description reported';
    return `${display.label}\n\n${display.sub}\n\nCounties: ${counties}\nReporting entities: ${orgs}\nActivities: ${activities}`;
  }

  function enablerKpiCardsHTML(rows){
    const counties = unique(rows.flatMap(r=>countyParts(enablerCountyKey(r))));
    const orgs = uniqueEnablerOrgs(rows);
    const objectives = unique(rows.map(enablerObjectiveKey));
    const activities = unique(rows.map(enablerActivityFilterKey));
    const tooltipBase = `Filtered by current selections.\n\nCounties: ${counties.join(', ') || 'None'}\nReporting entities: ${orgs.join(', ') || 'None'}\nObjectives: ${objectives.join(', ') || 'None'}`;
    const cards = [
      {icon:'📍', label:'Counties with enablers', value:counties.length, sub:'Counties with reported enabling activities'},
      {icon:'🤝', label:'Reporting entities', value:orgs.length, sub:'Distinct reporting entities with enabling activities'},
      {icon:'🎯', label:'UNSRM objectives supported', value:objectives.length, sub:'Roadmap objectives supported by enablers'},
      {icon:'📋', label:'Unique activity types', value:activities.length, sub:'Distinct enabling activity indicators/descriptions'}
    ];
    return `<div id="enabler-top-kpis" class="un-enabler-top-kpis">${cards.map(k=>`
      <div class="un-kpi un-impact-kpi" title="${tooltipBase.replace(/"/g,'&quot;')}">
        <div class="un-kpi-icon">${k.icon}</div>
        <div class="un-kpi-label">${k.label}</div>
        <div class="un-kpi-value">${fmtCompact(k.value)}</div>
        <div class="un-kpi-sub">${k.sub}</div>
      </div>`).join('')}</div>`;
  }

  function ensureEnablerKpis(rows){
    const panel = byId('panel-enablers');
    if(!panel) return;
    let host = byId('enabler-top-kpi-host');
    if(!host){
      host = document.createElement('div');
      host.id = 'enabler-top-kpi-host';
      const heading = panel.querySelector('.un-section-heading');
      if(heading && heading.nextSibling) heading.parentNode.insertBefore(host, heading.nextSibling);
      else panel.insertBefore(host, panel.firstChild);
    }
    host.innerHTML = enablerKpiCardsHTML(rows);
  }

  function enablerMoreButtonHTML(count, label='achievements'){
    return count > 0 ? `<button type="button" class="un-enabler-more" data-expanded="false">+ ${count} more ${label} ▾</button>` : '';
  }

  function renderSelectedEnablerSnapshot(rows){
    const selectedCounty = state.county !== 'All' ? state.county : null;
    const filtered = selectedCounty ? rows.filter(r=>countyMatches(enablerCountyKey(r), selectedCounty)) : rows;
    const title = selectedCounty || 'All counties';
    const orgs = uniqueEnablerOrgs(filtered);
    const objectives = unique(filtered.map(enablerObjectiveKey));
    const achievementLines = enablerReportedAchievementLines(filtered, 99);

    const el = byId('selected-enabler-snapshot');
    if(!el) return;

    el.innerHTML = `
      <div class="un-enabler-selection-card">
        <strong>${title}</strong>
        <span>Current selection</span>
      </div>

      <div class="un-enabler-snapshot-section">
        <div class="un-county-box-title">Upper Nile State Roadmap Objectives</div>
        <div class="un-county-objective-pills">
          ${objectives.length ? objectives.map(o=>`<span>${o}</span>`).join('') : '<em>Not reported</em>'}
        </div>
      </div>

      <div class="un-enabler-snapshot-section">
        <div class="un-county-box-title">Reporting Entities</div>
        <div class="un-county-org-pills">
          ${orgs.length ? orgs.map(o=>`<span>${o}</span>`).join('') : '<em>Not reported</em>'}
        </div>
      </div>

      <div class="un-enabler-snapshot-section">
        <div class="un-county-box-title">Reported achievements</div>
        ${achievementLines ? `<div class="un-enabler-achievement-lines">${achievementLines}</div>` : '<p>Not reported</p>'}
      </div>
    `;
  }

  function enablerCategoryGroupsHTML(rows){
    const groups = enablerAchievementGroups(rows);
    return groups.map(g=>{
      const units = [...g.units.values()].sort((a,b)=>b.value-a.value);
      const cards = units.map((u,i)=>{
        const display = enablerUnitDisplay(g.category, u.unit);
        const tooltip = enablerAchievementTooltip(g.category, u.unit, u.rows, display).replace(/"/g,'&quot;');
        return `
          <div class="un-enabler-unit-card un-enabler-unit-card-compact ${i >= 3 ? 'un-enabler-extra-achievement' : ''}" title="${tooltip}">
            <span><b class="un-enabler-unit-icon">${enablerIconForUnit(u.unit)}</b>${display.label}</span>
            <strong>${fmtCompact(u.value)}</strong>
            <p>${display.sub}</p>
          </div>`;
      }).join('');
      const more = enablerMoreButtonHTML(Math.max(0, units.length - 3), 'achievements');
      return `
        <div class="un-enabler-category">
          <h4>${g.category}</h4>
          <div class="un-enabler-unit-grid">${cards}</div>
          ${more}
        </div>`;
    }).join('');
  }

  function bindEnablerMoreButtons(scope=document){
    scope.querySelectorAll('.un-enabler-more').forEach(btn=>{
      btn.addEventListener('click', e=>{
        e.preventDefault();
        e.stopPropagation();
        const parent = btn.closest('.un-enabler-category, .un-enabler-top-activities');
        if(!parent) return;
        const expanded = parent.classList.toggle('expanded');
        const count = parent.querySelectorAll('.un-enabler-extra-achievement, .un-enabler-extra-activity').length;
        btn.dataset.expanded = String(expanded);
        btn.textContent = expanded ? 'Show less ▲' : `+ ${count} more ${parent.classList.contains('un-enabler-top-activities') ? 'activities' : 'achievements'} ▾`;
      });
    });
  }

  function enablerReportedAchievementLines(rows, limit=10){
    const unitRows = group(rows, enablerUnitKey, k=>({unit:k || 'Not specified', value:0}), (g,r)=>{
      g.value += enablerResultValue(r);
    }).filter(x=>x.value>0).sort((a,b)=>b.value-a.value);
    return unitRows.slice(0,limit).map(x=>`${enablerIconForUnit(x.unit)} ${x.unit}: <b>${fmtCompact(x.value)}</b>`).join('<br>');
  }

  function enablerObjectiveChartHTML(rows){
    const objectives = group(rows, enablerObjectiveKey, k=>({objective:k, records:0}), (g,r)=>{g.records += 1;})
      .sort((a,b)=>codeNumber(a.objective)-codeNumber(b.objective));
    const max = Math.max(1, ...objectives.map(x=>x.records));
    return `<div id="enabler-objective-chart" class="un-card un-enabler-chart-card">
      <h3>Contribution to Roadmap Objectives</h3>
      <p>Number of enabling activities by Upper Nile State Roadmap Objective under the selected filters.</p>
      <div class="un-enabler-bars">
        ${objectives.length ? objectives.map(o=>`
          <div class="un-enabler-bar-row">
            <strong>${o.objective}</strong>
            <div><span style="width:${Math.max(4, (o.records/max)*100)}%"></span></div>
            <b>${o.records}</b>
          </div>`).join('') : '<p>No objective activities found.</p>'}
      </div>
    </div>`;
  }

  function monthOrderIndex(m){
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const v = clean(m).toLowerCase();
    const idx = months.findIndex(x=>x === v || x.slice(0,3) === v.slice(0,3));
    return idx === -1 ? 99 : idx;
  }

  function enablerMonthlyTrendHTML(rows){
    const monthly = group(rows, enablerMonthKey, k=>({month:k || 'Not specified', records:0}), (g,r)=>{g.records += 1;})
      .sort((a,b)=>monthOrderIndex(a.month)-monthOrderIndex(b.month));
    const max = Math.max(1, ...monthly.map(x=>x.records));
    return `<div id="enabler-monthly-trend" class="un-card un-enabler-chart-card">
      <h3>Monthly Enabler Reporting Trend</h3>
      <p>Reporting volume by month, based on enabling activities under the selected filters.</p>
      <div class="un-enabler-month-bars">
        ${monthly.length ? monthly.map(m=>`
          <div class="un-enabler-month">
            <div class="un-enabler-month-bar"><span style="height:${Math.max(6, (m.records/max)*100)}%"></span></div>
            <strong>${m.records}</strong>
            <small>${m.month.slice(0,3)}</small>
          </div>`).join('') : '<p>No monthly activities found.</p>'}
      </div>
    </div>`;
  }

  function ensureEnablerCharts(rows){
    const table = byId('enabler-table');
    if(!table) return;
    const tableCard = table.closest('.un-card');
    if(!tableCard) return;
    let host = byId('enabler-charts-host');
    if(!host){
      host = document.createElement('div');
      host.id = 'enabler-charts-host';
      host.className = 'un-enabler-charts-host';
      tableCard.parentNode.insertBefore(host, tableCard);
    }
    host.innerHTML = enablerObjectiveChartHTML(rows) + enablerMonthlyTrendHTML(rows);
  }

  function relocateEnablerMapGuide(){
    const panel = byId('panel-enablers');
    const map = byId('upper-nile-enabler-map');
    if(!panel || !map) return;
    const legends = [...panel.querySelectorAll('.un-map-legend')];
    const legend = legends.find(l => /Map guide|enabler records|enabling activities/i.test(l.textContent || ''));
    const mapCard = map.closest('.un-card');
    if(legend){
      legend.innerHTML = legend.innerHTML
        .replace(/No enabler records/gi, 'No enabling activities')
        .replace(/records/gi, 'activities');
    }
    if(legend && mapCard && !mapCard.contains(legend)){
      mapCard.appendChild(legend);
      legend.classList.add('un-enabler-map-guide-relocated');
    }
  }


  let enablerTableMode = 'detailed';
  let enablerTableSearch = '';

  function enablerAchievementSummaryForRows(rows){
    return group(rows, enablerUnitKey, k=>({unit:k || 'Not specified', value:0}), (g,r)=>{
      g.value += enablerResultValue(r);
    })
      .filter(x=>x.value>0)
      .sort((a,b)=>b.value-a.value)
      .map(x=>`${enablerIconForUnit(x.unit)} ${fmtCompact(x.value)} ${x.unit}`)
      .join('<br>') || '—';
  }

  function enablerGroupedActivityRows(rows){
    return enablerTopActivities(rows).map(g=>{
      const activityRows = rows.filter(r => enablerDescriptionKey(r) === g.description);
      return {
        description:g.description,
        records:g.records,
        counties:unique(activityRows.flatMap(r=>countyParts(enablerCountyKey(r)))),
        orgs:uniqueEnablerOrgs(activityRows),
        objectives:unique(activityRows.map(enablerObjectiveKey)),
        achievements:enablerAchievementSummaryForRows(activityRows)
      };
    });
  }

  function enablerRowSearchText(row, mode){
    if(mode === 'grouped'){
      return [row.description, row.records, row.counties.join(' '), row.orgs.join(' '), row.objectives.join(' '), row.achievements]
        .map(v=>plainText(v)).join(' ').toLowerCase();
    }
    return [
      enablerYearKey(row), enablerMonthKey(row), enablerCountyKey(row), enablerOrgList(row).join(' '),
      enablerObjectiveKey(row), enablerResultValue(row), enablerUnitKey(row), enablerDescriptionKey(row)
    ].map(v=>plainText(v)).join(' ').toLowerCase();
  }

  function ensureEnablerTableToolbar(rows){
    const table = byId('enabler-table');
    if(!table) return;
    const wrap = table.closest('.un-table-wrap');
    if(!wrap) return;
    let toolbar = byId('enabler-table-toolbar');
    if(!toolbar){
      toolbar = document.createElement('div');
      toolbar.id = 'enabler-table-toolbar';
      toolbar.className = 'un-enabler-table-toolbar';
      wrap.parentNode.insertBefore(toolbar, wrap);
    }
    const groupedCount = enablerGroupedActivityRows(rows).length;
    toolbar.innerHTML = `
      <div class="un-enabler-table-toolbar-title">
        <span>${rows.length} detailed activities • ${groupedCount} grouped activity summaries</span>
      </div>
      <div class="un-enabler-table-actions">
        <div class="un-enabler-table-toggle" role="tablist" aria-label="Enabler table view">
          <button type="button" class="${enablerTableMode === 'detailed' ? 'active' : ''}" data-enabler-table-mode="detailed">Detailed activities</button>
          <button type="button" class="${enablerTableMode === 'grouped' ? 'active' : ''}" data-enabler-table-mode="grouped">Grouped activity summary</button>
        </div>
        <label class="un-enabler-table-search">
          <span>Search</span>
          <input id="enabler-table-search" type="search" value="${enablerTableSearch.replace(/"/g,'&quot;')}" placeholder="Search activities, counties, organisations...">
        </label>
      </div>
    `;
    toolbar.querySelectorAll('[data-enabler-table-mode]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        enablerTableMode = btn.dataset.enablerTableMode;
        renderEnablerTable(rows);
      });
    });
    const search = toolbar.querySelector('#enabler-table-search');
    if(search){
      search.addEventListener('input',()=>{
        enablerTableSearch = search.value.trim().toLowerCase();
        renderEnablerTable(rows, false);
      });
      search.focus({preventScroll:true});
      const len = search.value.length;
      search.setSelectionRange(len, len);
    }
  }

  function renderEnablerTable(rows, rebuildToolbar=true){
    const table = byId('enabler-table');
    if(!table) return;
    if(rebuildToolbar) ensureEnablerTableToolbar(rows);
    const query = enablerTableSearch;

    if(enablerTableMode === 'grouped'){
      const groupedRows = enablerGroupedActivityRows(rows)
        .filter(r => !query || enablerRowSearchText(r, 'grouped').includes(query))
        .slice(0,150);
      table.className = 'un-table un-enabler-table-grouped';
      table.innerHTML = tableHTML([
        {label:'Activity description',f:r=>r.description},
        {label:'Counties',f:r=>r.counties.join(', ') || '—'},
        {label:'Reporting entities',f:r=>r.orgs.map(o=>`<span class="un-partner-chip">${o}</span>`).join('') || '—'},
        {label:'UNSRM objectives',f:r=>r.objectives.map(o=>`<span class="un-pill">${o}</span>`).join('') || '—'},
        {label:'Reported achievements',f:r=>r.achievements}
      ], groupedRows);
      return;
    }

    const detailedRows = rows
      .filter(r => !query || enablerRowSearchText(r, 'detailed').includes(query))
      .slice(0,150);
    table.className = 'un-table un-enabler-table-detailed';
    table.innerHTML = tableHTML([
      {label:'Year',f:r=>enablerYearKey(r)},
      {label:'Month',f:r=>enablerMonthKey(r)},
      {label:'County',f:r=>enablerCountyKey(r)},
      {label:'Implemented by',f:r=>enablerOrgList(r).join(', ') || enablerOrgKey(r)},
      {label:'UNSRM Objective',f:r=>`<span class="un-pill">${enablerObjectiveKey(r)}</span>`},
      {label:'Result',f:r=>`${num(enablerResultValue(r))} ${enablerUnitKey(r)}`},
      {label:'Description',f:r=>enablerDescriptionKey(r)}
    ], detailedRows);
  }

  function renderEnablers(a){
    const rows = applyEnablerFilters(D.enablers || []);

    ensureEnablerKpis(rows);
    renderSelectedEnablerSnapshot(rows);

    const catEl = byId('enabler-category-groups');
    if(catEl){
      catEl.innerHTML = enablerCategoryGroupsHTML(rows);
      bindEnablerMoreButtons(catEl);
    }

    ensureEnablerCharts(rows);
    relocateEnablerMapGuide();

    renderEnablerTable(rows);
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
      gap ? `<strong>${gap.code}</strong> has the largest remaining funding gap under the selected filters: <strong>${money(gap.gap)}</strong>.` : 'No remaining funding gap available under the current filters.',
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
      if(countyName && countyName !== 'All' && !countyMatches(countyKey(r), countyName)) return false;
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

    const countyTargets = a.targets.filter(r => countyMatches(countyKey(r), countyName));
    const countyAchievements = a.achievements.filter(r => countyMatches(countyKey(r), countyName));
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
        const isSelected = selected !== 'All' && countyMatches(name, selected);
        if(isSelected) return '#042f46';
        if(entry.id === 'upper-nile-partner-map'){
          const pm = partnerMapMetrics(name);
          const hasPartnerData = pm.implementingOrgs.length > 0;
          return hasPartnerData ? '#ffffff' : '#f97316';
        }
        if(entry.id === 'upper-nile-map' || entry.id === 'upper-nile-county-map'){
          const m = countyMapMetrics(name);
          const hasCountyData = m.reportedActivities > 0;
          return hasCountyData ? '#ffffff' : '#f97316';
        }
        if(entry.id === 'upper-nile-enabler-map'){
          const em = enablerMapMetrics(name);
          const hasEnablerData = em.records > 0;
          return hasEnablerData ? '#ffffff' : '#f97316';
        }
        return '#ffffff';
      })
      .attr('stroke-width',d=>{
        const name=d.properties.ADM2_EN;
        const isSelected = selected !== 'All' && countyMatches(name, selected);
        if(isSelected) return 2.8;
        if(entry.id === 'upper-nile-partner-map'){
          const pm = partnerMapMetrics(name);
          return pm.implementingOrgs.length > 0 ? 1.1 : 2.6;
        }
        if(entry.id === 'upper-nile-map' || entry.id === 'upper-nile-county-map'){
          const m = countyMapMetrics(name);
          return m.reportedActivities > 0 ? 1.1 : 2.6;
        }
        if(entry.id === 'upper-nile-enabler-map'){
          const em = enablerMapMetrics(name);
          return em.records > 0 ? 1.1 : 2.6;
        }
        return 1.1;
      })
      .attr('stroke-dasharray',d=>{
        const name=d.properties.ADM2_EN;
        const isSelected = selected !== 'All' && countyMatches(name, selected);
        if(isSelected) return null;
        if(entry.id === 'upper-nile-partner-map'){
          const pm = partnerMapMetrics(name);
          return pm.implementingOrgs.length > 0 ? null : '6 4';
        }
        if(entry.id === 'upper-nile-map' || entry.id === 'upper-nile-county-map'){
          const m = countyMapMetrics(name);
          return m.reportedActivities > 0 ? null : '6 4';
        }
        if(entry.id === 'upper-nile-enabler-map'){
          const em = enablerMapMetrics(name);
          return em.records > 0 ? null : '6 4';
        }
        return null;
      })
      .attr('opacity',d=>selected!=='All' && !countyMatches(d.properties.ADM2_EN, selected) ? .35 : 1)
      .style('cursor','pointer')
      .on('mousemove',function(event,d){
        const name=d.properties.ADM2_EN;
        const m=countyMapMetrics(name);
        if(!tooltip) return;
        tooltip.style.display='block';
        if(entry.id === 'upper-nile-enabler-map'){
          const em = enablerMapMetrics(name);
          const achievements = enablerReportedAchievementLines(em.rows, 12) || '<em>No achievement values reported</em>';
          tooltip.innerHTML=`<strong>📍 ${name}</strong><br><br>Enabling activities: <b>${em.records}</b><br>Reporting entities: <b>${em.orgs.length}</b><br>Objectives: <b>${em.objectives.length ? em.objectives.join(', ') : 'Not reported'}</b><br><br><strong>Reported achievements</strong><br>${achievements}<br><br><span class="un-tooltip-hint">Click to filter</span>`;
          positionMapTooltip(tooltip, event, container);
        } else if(entry.id === 'upper-nile-partner-map'){
          const pm = partnerMapMetrics(name);
          tooltip.innerHTML=`<strong>${name}</strong><br>Implementing organisations: <b>${pm.implementingOrgs.length}</b><br>Reporting organisations: <b>${pm.reportingOrgs.length}</b><br>Objectives: <b>${pm.objectives.length ? pm.objectives.join(', ') : 'Not reported'}</b><br><span class="un-tooltip-hint">Click to filter</span>`;
          positionMapTooltip(tooltip, event, container);
        } else {
          const countyAchievements = filteredRowsForCounty(name).achievements.filter(r => countyMatches(countyKey(r), name) && progressUnits(r) > 0);
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
    const orgs=unique(a.achievements.map(orgKey)).length; const counties=unique([...countyListFromRows(a.achievements),...countyListFromRows(a.targets)]).length; const acts=unique(a.targets.map(r=>clean(r['UNS Activity Indicator Code']))).length; const impl=unique(a.service.map(r=>serviceImplementingOrgKey(r))).length;
    byId('partner-snapshot').innerHTML=`<div class="un-mini-metric"><strong>${orgs}</strong><span>Reporting orgs</span></div><div class="un-mini-metric"><strong>${impl}</strong><span>Implementing orgs</span></div><div class="un-mini-metric"><strong>${counties}</strong><span>Counties</span></div><div class="un-mini-metric"><strong>${acts}</strong><span>Activities</span></div>`;
  }
  function renderAll(){
    const a=aggregate(); renderKpis(a); renderImpactGlance(a); renderFinancialProgressMatrix(a); renderAlignment(); renderObjectives(a); renderActivityTable(a); renderRoadmap(a); renderCounty(a); renderPartners(a); renderEnablers(a); renderInsights(a); renderPartnerSnapshot(a); updateMap(); relocateCountyMapGuide(); relocatePartnerMapGuide(); relocateEnablerMapGuide();
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
        if(ignoreKey !== 'county' && state.county !== 'All' && !countyMatches(c, state.county)) return false;
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
        if(ignoreKey !== 'county' && state.county !== 'All' && !countyMatches(c, state.county)) return false;
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
      setContextOptions('filter-county', countyListFromRows(optionRowsForPanel('partners','county')), 'county');
      setContextOptions('filter-org', unique(optionRowsForPanel('partners','org').map(r=>clean(r['Reporting Organisation name']))), 'org');
      setContextOptions('filter-impl', unique(optionRowsForPanel('partners','impl').map(serviceImplementingOrgKey)), 'impl');
      setContextOptions('filter-objective', unique(optionRowsForPanel('partners','objective').map(serviceObjectiveKey)), 'objective');
    }

    if(target === 'enablers'){
      setFilterLabel('filter-activity', 'UNS Activity Indicator');
      setContextOptions('filter-year', unique(optionRowsForPanel('enablers','year').map(enablerYearKey)).sort(), 'year');
      setContextOptions('filter-county', countyListFromRows(optionRowsForPanel('enablers','county'), enablerCountyKey), 'county');
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
      setTimeout(()=>{updateMap(); relocateCountyMapGuide(); relocatePartnerMapGuide();},100);
    }));

    const active=document.querySelector('.un-tab.active');
    const fp=byId('global-filters');
    if(fp&&active) fp.classList.toggle('un-filter-hidden', active.dataset.target==='intro');
    setFilterVisibilityForPanel();
  }

  document.addEventListener('DOMContentLoaded',()=>{initTabs(); initFilters(); renderAll(); initMap(); setTimeout(relocateCountyMapGuide,150);});
})();
