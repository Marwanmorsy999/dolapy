(() => {
  'use strict';

  const STORE_KEY = 'dolapy.pages.v3';
  const SETTINGS_KEY = 'dolapy.intelligence.v1';
  const $ = (selector) => document.querySelector(selector);

  const CATEGORY_ROLES = {
    tops: 'top',
    bottoms: 'bottom',
    dresses: 'dress',
    outerwear: 'layer',
    shoes: 'shoe',
    accessories: 'accessory'
  };

  const COLOR_COMPAT = {
    black:{black:1,white:1,grey:.99,neutral:.97,blue:.96,brown:.91,green:.88,red:.94,orange:.86,yellow:.88,purple:.93,pink:.92},
    white:{black:1,white:.94,grey:.98,neutral:.97,blue:.98,brown:.94,green:.92,red:.96,orange:.93,yellow:.91,purple:.95,pink:.94},
    grey:{black:.99,white:.98,grey:.95,neutral:.95,blue:.95,brown:.93,green:.91,red:.89,orange:.84,yellow:.87,purple:.93,pink:.92},
    neutral:{black:.97,white:.97,grey:.95,neutral:.93,blue:.98,brown:.98,green:.94,red:.91,orange:.9,yellow:.87,purple:.9,pink:.92},
    blue:{black:.96,white:.98,grey:.95,neutral:.98,blue:.86,brown:.97,green:.83,red:.78,orange:.76,yellow:.8,purple:.82,pink:.87},
    brown:{black:.91,white:.94,grey:.93,neutral:.98,blue:.97,brown:.91,green:.93,red:.82,orange:.88,yellow:.84,purple:.8,pink:.83},
    green:{black:.88,white:.92,grey:.91,neutral:.94,blue:.83,brown:.93,green:.86,red:.72,orange:.9,yellow:.88,purple:.76,pink:.82},
    red:{black:.94,white:.96,grey:.89,neutral:.91,blue:.78,brown:.82,green:.72,red:.74,orange:.67,yellow:.68,purple:.74,pink:.86},
    orange:{black:.86,white:.93,grey:.84,neutral:.9,blue:.76,brown:.88,green:.9,red:.67,orange:.72,yellow:.75,purple:.77,pink:.78},
    yellow:{black:.88,white:.91,grey:.87,neutral:.87,blue:.8,brown:.84,green:.88,red:.68,orange:.75,yellow:.74,purple:.84,pink:.8},
    purple:{black:.93,white:.95,grey:.93,neutral:.9,blue:.82,brown:.8,green:.76,red:.74,orange:.77,yellow:.84,purple:.8,pink:.86},
    pink:{black:.92,white:.94,grey:.92,neutral:.92,blue:.87,brown:.83,green:.82,red:.86,orange:.78,yellow:.8,purple:.86,pink:.84}
  };

  const STYLE_COMPAT = {
    casual:{casual:1,streetwear:.93,smart:.72,athletic:.82,utility:.88,minimal:.98,preppy:.9,vintage:.92,street:.93},
    streetwear:{casual:.93,streetwear:1,smart:.6,athletic:.88,utility:.96,minimal:.9,preppy:.72,vintage:.95,street:.98},
    street:{casual:.93,streetwear:.98,smart:.6,athletic:.88,utility:.96,minimal:.9,preppy:.72,vintage:.95,street:1},
    smart:{casual:.72,streetwear:.6,smart:1,athletic:.5,utility:.55,minimal:.95,preppy:.98,vintage:.82,street:.6},
    athletic:{casual:.82,streetwear:.88,smart:.5,athletic:1,utility:.8,minimal:.76,preppy:.55,vintage:.7,street:.88},
    utility:{casual:.88,streetwear:.96,smart:.55,athletic:.8,utility:1,minimal:.82,preppy:.66,vintage:.9,street:.96},
    minimal:{casual:.98,streetwear:.9,smart:.95,athletic:.76,utility:.82,minimal:1,preppy:.9,vintage:.84,street:.9},
    preppy:{casual:.9,streetwear:.72,smart:.98,athletic:.55,utility:.66,minimal:.9,preppy:1,vintage:.88,street:.72},
    vintage:{casual:.92,streetwear:.95,smart:.82,athletic:.7,utility:.9,minimal:.84,preppy:.88,vintage:1,street:.95}
  };

  const clean = (value) => String(value || '').trim().toLowerCase();
  const family = (value) => {
    const s = clean(value);
    const groups = {
      black:['black','charcoal','graphite','onyx'], white:['white','cream','ivory'], grey:['grey','gray','silver'],
      neutral:['beige','tan','camel','khaki','sand','stone','oat'], brown:['brown','chocolate','mocha','coffee'],
      blue:['navy','blue','denim','cobalt','teal','sky','azure'], green:['green','olive','sage','forest','mint'],
      red:['red','burgundy','maroon','wine','crimson'], orange:['orange','rust','terracotta','coral'],
      yellow:['yellow','mustard','gold'], purple:['purple','lavender','lilac','violet'], pink:['pink','rose','blush']
    };
    for (const [name, words] of Object.entries(groups)) if (words.some((word) => s.includes(word))) return name;
    return 'unknown';
  };

  const style = (item) => {
    const s = clean(`${item?.style || ''} ${item?.name || ''}`);
    if (s.includes('street')) return 'streetwear';
    if (s.includes('smart') || s.includes('formal')) return 'smart';
    if (s.includes('athletic') || s.includes('sport')) return 'athletic';
    if (s.includes('utility')) return 'utility';
    if (s.includes('minimal')) return 'minimal';
    if (s.includes('preppy')) return 'preppy';
    if (s.includes('vintage')) return 'vintage';
    return 'casual';
  };

  function load() {
    try {
      const value = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      return Array.isArray(value) ? value.filter(Boolean) : [];
    } catch { return []; }
  }

  function pairScore(a, b) {
    const ca = family(a.color), cb = family(b.color);
    const color = ca === 'unknown' || cb === 'unknown' ? .72 : (COLOR_COMPAT[ca]?.[cb] ?? COLOR_COMPAT[cb]?.[ca] ?? .72);
    const sa = style(a), sb = style(b);
    const styleScore = STYLE_COMPAT[sa]?.[sb] ?? STYLE_COMPAT[sb]?.[sa] ?? .72;
    const silhouette = a.silhouette && b.silhouette && a.silhouette === b.silhouette ? .88 : .96;
    const patternPenalty = a.pattern !== 'solid' && b.pattern !== 'solid' ? .74 : 1;
    return Math.round((color * .48 + styleScore * .37 + silhouette * .15) * patternPenalty * 100);
  }

  function validRoleSet(set) {
    const roles = new Set(set.map((item) => CATEGORY_ROLES[item.category] || item.category));
    if (roles.has('dress')) return roles.has('shoe');
    return roles.has('top') && roles.has('bottom') && roles.has('shoe');
  }

  function outfitScore(set) {
    if (!validRoleSet(set)) return 0;
    const pairScores = [];
    for (let i = 0; i < set.length; i += 1) for (let j = i + 1; j < set.length; j += 1) pairScores.push(pairScore(set[i], set[j]));
    if (!pairScores.length) return 0;
    const average = pairScores.reduce((sum, value) => sum + value, 0) / pairScores.length;
    const strongPairs = pairScores.filter((value) => value >= 78).length / pairScores.length;
    const wornPenalty = Math.min(12, set.reduce((sum, item) => sum + Number(item.wearCount || 0), 0) * .8);
    return Math.round(Math.max(0, average * .72 + strongPairs * 28 - wornPenalty));
  }

  function combinations(items, limit = 10000) {
    const tops = items.filter((item) => item.category === 'tops');
    const bottoms = items.filter((item) => item.category === 'bottoms');
    const dresses = items.filter((item) => item.category === 'dresses');
    const shoes = items.filter((item) => item.category === 'shoes');
    const layers = items.filter((item) => item.category === 'outerwear');
    const results = [];
    const push = (set) => {
      if (results.length >= limit || !validRoleSet(set)) return;
      const score = outfitScore(set);
      if (score >= 58) results.push({set, score});
    };
    for (const dress of dresses) for (const shoe of shoes) {
      push([dress, shoe]);
      for (const layer of layers) push([dress, layer, shoe]);
    }
    for (const top of tops) for (const bottom of bottoms) for (const shoe of shoes) {
      push([top, bottom, shoe]);
      for (const layer of layers) push([top, bottom, layer, shoe]);
    }
    return results.sort((a, b) => b.score - a.score);
  }

  function analyze(items) {
    const active = items.filter((item) => item.category);
    const counts = active.reduce((map, item) => { map[item.category] = (map[item.category] || 0) + 1; return map; }, {});
    const candidates = combinations(active);
    const strong = candidates.filter((outfit) => outfit.score >= 76);
    const coveredIds = new Set(strong.flatMap((outfit) => outfit.set.map((item) => item.id)));
    const wear = active.reduce((sum, item) => sum + Number(item.wearCount || 0), 0);
    const underused = [...active].sort((a, b) => Number(a.wearCount || 0) - Number(b.wearCount || 0)).slice(0, Math.min(5, active.length));
    const gaps = [];
    if (!counts.tops && !counts.dresses) gaps.push('tops or dresses');
    if (!counts.bottoms && !counts.dresses) gaps.push('bottoms');
    if (!counts.shoes) gaps.push('shoes');
    if (!counts.outerwear && active.length >= 4) gaps.push('a versatile layer');
    const redundancy = Object.entries(counts).filter(([, count]) => count >= 5).sort((a, b) => b[1] - a[1]).map(([category, count]) => ({category, count}));
    const coverage = active.length ? Math.round((coveredIds.size / active.length) * 100) : 0;
    const potential = candidates.length;
    return {counts, candidates, strong, coverage, potential, underused, gaps, redundancy, total:active.length, wear};
  }

  function persistSettings(patch) {
    try {
      const current = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({...current, ...patch}));
    } catch {}
  }

  function card(label, value, detail) {
    return `<div class="intel-stat"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`;
  }

  function render() {
    const host = $('#wardrobeIntel');
    if (!host) return;
    const analysis = analyze(load());
    if (!analysis.total) {
      host.innerHTML = `<div class="intel-empty"><div class="eyebrow green">Wardrobe intelligence</div><h3>Your wardrobe graph starts here.</h3><p>Add a few pieces and Dolapy will map combinations, coverage, gaps, and underused items automatically.</p></div>`;
      return;
    }
    const topCategory = Object.entries(analysis.counts).sort((a,b) => b[1]-a[1])[0];
    const gapText = analysis.gaps.length ? `Biggest gap: <strong>${analysis.gaps[0]}</strong>.` : 'Your core categories are covered.';
    const underusedText = analysis.underused[0] ? `<strong>${underused[0].name || 'An item'}</strong> is currently underused.` : 'Keep adding pieces to sharpen the graph.';
    const redundancyText = analysis.redundancy[0] ? `${analysis.redundancy[0][1]} ${analysis.redundancy[0][0]} create a concentration point.` : 'No major category concentration yet.';
    host.innerHTML = `
      <div class="intel-head"><div><div class="eyebrow green">Wardrobe intelligence</div><h3>Your wardrobe, <em>as a system.</em></h3><p>Dolapy now measures how well your pieces work together instead of treating the closet like a photo gallery.</p></div><div class="intel-badge"><strong>${analysis.strong.length}</strong><span>strong<br>outfits</span></div></div>
      <div class="intel-grid">${card('Pieces', analysis.total, `${topCategory ? topCategory[1] + ' ' + topCategory[0] : 'logged'}`)}${card('Outfit potential', analysis.potential, 'viable combinations')}${card('Coverage', `${analysis.coverage}%`, 'pieces in strong looks')}${card('Wear signals', analysis.wear, 'recorded wears')}</div>
      <div class="intel-insights"><div><span class="insight-kicker">WARDROBE GAP</span><p>${gapText}</p></div><div><span class="insight-kicker">UNDERUSED</span><p>${underusedText}</p></div><div><span class="insight-kicker">BALANCE</span><p>${redundancyText}</p></div></div>
      <div class="intel-actions"><button type="button" class="intel-action" data-intel-action="refresh">Recalculate</button><button type="button" class="intel-action" data-intel-action="mark-ready">Keep improving the graph</button></div>`;
  }

  function init() {
    render();
    window.addEventListener('storage', (event) => { if (event.key === STORE_KEY) render(); });
    document.addEventListener('click', (event) => {
      const action = event.target.closest('[data-intel-action]')?.dataset.intelAction;
      if (!action) return;
      if (action === 'refresh') render();
      if (action === 'mark-ready') persistSettings({lastInteraction: Date.now()});
    });
    const original = window.renderAll;
    if (typeof original === 'function' && !original.__dolapyIntelWrapped) {
      const wrapped = function(...args) { const result = original.apply(this, args); render(); return result; };
      wrapped.__dolapyIntelWrapped = true;
      window.renderAll = wrapped;
    }
    setTimeout(render, 250);
    setTimeout(render, 1000);
  }

  window.DolapyIntelligence = { analyze, render, pairScore };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
