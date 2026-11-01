(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const calculate = $('calculateDecision');
  const save = $('saveDecision');
  const result = $('decisionResult');
  const history = $('decisionHistory');
  if (!calculate || !save || !result || !window.CareerOSState) return;

  const criteria = [
    { name: 'Personal fit and motivation', weight: 25 },
    { name: 'Current skills and evidence', weight: 25 },
    { name: 'Learning and growth potential', weight: 20 },
    { name: 'Opportunity access and fit', weight: 15 },
    { name: 'Time, cost and practical feasibility', weight: 15 }
  ];
  let latest = null;

  function readOption(prefix) {
    return criteria.map((criterion, index) => {
      const value = Number($(prefix + index).value);
      if (!Number.isInteger(value) || value < 1 || value > 5) throw new Error('Every rating must be a whole number from 1 to 5.');
      return { criterion: criterion.name, weight: criterion.weight, rating: value };
    });
  }

  function score(values) {
    return values.reduce((sum, item) => sum + item.rating * item.weight, 0) / 100;
  }

  function calculateDecision() {
    try {
      const title = $('decisionTitle').value.trim();
      const optionA = $('decisionOptionA').value.trim();
      const optionB = $('decisionOptionB').value.trim();
      if (!title || !optionA || !optionB) throw new Error('Enter a decision and both options before calculating.');
      const a = readOption('decisionA');
      const b = readOption('decisionB');
      const scoreA = score(a);
      const scoreB = score(b);
      latest = {
        title, optionA, optionB, a, b,
        scoreA: Number(scoreA.toFixed(2)),
        scoreB: Number(scoreB.toFixed(2)),
        difference: Number(Math.abs(scoreA - scoreB).toFixed(2)),
        recommendation: Math.abs(scoreA - scoreB) < 0.15 ? 'Close call — gather more evidence before deciding.' : scoreA > scoreB ? optionA : optionB,
        createdAt: new Date().toISOString()
      };
      $('decisionHeadA').textContent = optionA;
      $('decisionHeadB').textContent = optionB;
      result.replaceChildren();
      const heading = document.createElement('h3');
      heading.textContent = 'Weighted comparison';
      const line = document.createElement('p');
      line.textContent = optionA + ': ' + scoreA.toFixed(2) + '/5 · ' + optionB + ': ' + scoreB.toFixed(2) + '/5';
      const recommendation = document.createElement('p');
      recommendation.textContent = 'Current signal: ' + latest.recommendation;
      const caveat = document.createElement('p');
      caveat.className = 'small';
      caveat.textContent = 'This is a structured reflection aid, not an objective prediction. Revisit the ratings when you obtain new evidence; a close score is a reason to run a small experiment.';
      result.append(heading, line, recommendation, caveat);
      save.disabled = false;
    } catch (error) {
      latest = null;
      save.disabled = true;
      result.textContent = error.message;
    }
  }

  function renderHistory() {
    const items = window.CareerOSState.get().decisions || [];
    history.replaceChildren();
    if (!items.length) {
      history.textContent = 'No saved comparisons yet.';
      history.className = 'empty';
      return;
    }
    history.className = '';
    items.slice(0, 10).forEach(item => {
      const entry = document.createElement('article');
      entry.className = 'decision-history-item';
      const heading = document.createElement('strong');
      heading.textContent = item.title;
      const detail = document.createElement('p');
      detail.textContent = item.optionA + ' (' + item.scoreA + '/5) vs ' + item.optionB + ' (' + item.scoreB + '/5)';
      const verdict = document.createElement('p');
      verdict.textContent = 'Signal: ' + item.recommendation;
      const date = document.createElement('small');
      date.textContent = new Date(item.createdAt).toLocaleDateString();
      entry.append(heading, detail, verdict, date);
      history.appendChild(entry);
    });
  }

  calculate.addEventListener('click', calculateDecision);
  save.addEventListener('click', () => {
    if (!latest) return;
    const state = window.CareerOSState.get();
    state.decisions = Array.isArray(state.decisions) ? state.decisions : [];
    state.decisions.unshift(latest);
    state.decisions = state.decisions.slice(0, 20);
    window.CareerOSState.save();
    renderHistory();
    save.disabled = true;
  });
  renderHistory();
})();
