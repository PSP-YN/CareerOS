(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const start = $('startFullMock');
  const status = $('mockStatus');
  const answer = $('answer');
  const question = $('question');
  const hint = $('hint');
  const qtype = $('qtype');
  const evaluate = $('evaluate');
  const next = $('nextq');
  if (!start || !status || !window.CareerOSState || !window.CareerOSContent) return;

  const rounds = ['aptitude', 'coding', 'technical', 'system_design', 'case_study', 'behavioral', 'hr'];
  const labels = {
    aptitude: 'Aptitude & reasoning',
    coding: 'Coding & problem solving',
    technical: 'Technical fundamentals',
    system_design: 'System design',
    case_study: 'Case study',
    behavioral: 'Behavioral',
    hr: 'HR & motivation'
  };
  const baseEvaluate = evaluate.onclick;
  const baseNext = next.onclick;
  let active = false;
  let sequence = [];
  let index = 0;
  let answered = false;
  let sessionResults = [];
  let previousRound = qtype.value;

  function shuffle(items) {
    const result = items.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function buildSequence() {
    const base = window.CareerOSContent.questions || {};
    const bank = window.CareerOSQuestionBank || {};
    const fullScale = window.CareerOSFullScaleQuestions || {};
    return rounds.flatMap(round => {
      const combined = [...(base[round] || []), ...(bank[round] || []), ...(fullScale[round] || [])];
      const seen = new Set();
      const unique = combined.filter(item => {
        if (!Array.isArray(item) || typeof item[0] !== 'string' || seen.has(item[0])) return false;
        seen.add(item[0]);
        return true;
      });
      return shuffle(unique).slice(0, 2).map(item => ({ round, question: item[0], hint: item[1] || 'Explain your reasoning, evidence and trade-offs.' }));
    });
  }

  function showCurrent() {
    const item = sequence[index];
    if (!item) return finish(false);
    qtype.value = item.round;
    qtype.disabled = true;
    question.textContent = item.question;
    hint.textContent = item.hint;
    answer.value = '';
    answer.focus();
    answered = false;
    evaluate.disabled = false;
    next.textContent = index === sequence.length - 1 ? 'Finish interview' : 'Submit & continue';
    status.textContent = 'Question ' + (index + 1) + ' of ' + sequence.length + ' · ' + labels[item.round];
    document.getElementById('qnumber').textContent = 'MOCK INTERVIEW · ' + (index + 1) + ' / ' + sequence.length;
  }

  function evaluateCurrent() {
    if (!active) return baseEvaluate?.call(evaluate);
    if (answered) return;
    const before = window.CareerOSState.get().answers.length;
    if (typeof baseEvaluate === 'function') baseEvaluate.call(evaluate);
    const state = window.CareerOSState.get();
    if (state.answers.length <= before) return;
    const result = state.answers[state.answers.length - 1];
    sessionResults.push({ round: result.round, score: result.score, question: result.question, at: result.at });
    answered = true;
    evaluate.disabled = true;
    status.textContent = 'Recorded ' + sessionResults.length + ' of ' + sequence.length + ' answers · score ' + result.score + '/100 · continue when ready.';
  }

  function nextQuestion() {
    if (!active) return baseNext?.call(next);
    if (!answered) {
      status.textContent = 'Evaluate your answer before continuing. Answers need at least 30 characters.';
      return;
    }
    index += 1;
    if (index >= sequence.length) return finish(false);
    showCurrent();
  }

  function finish(stoppedEarly) {
    if (!active) return;
    active = false;
    qtype.disabled = false;
    evaluate.onclick = baseEvaluate;
    next.onclick = baseNext;
    evaluate.disabled = false;
    next.textContent = 'Next question';
    start.textContent = 'Start another full mock';
    const count = sessionResults.length;
    const average = count ? Math.round(sessionResults.reduce((sum, item) => sum + item.score, 0) / count) : 0;
    const byRound = rounds.map(round => {
      const values = sessionResults.filter(item => item.round === round);
      return values.length ? { round, score: Math.round(values.reduce((sum, item) => sum + item.score, 0) / values.length), count: values.length } : null;
    }).filter(Boolean);
    const weakest = byRound.slice().sort((a, b) => a.score - b.score)[0];
    if (count) {
      const state = window.CareerOSState.get();
      state.mockInterviewHistory = Array.isArray(state.mockInterviewHistory) ? state.mockInterviewHistory : [];
      state.mockInterviewHistory.unshift({
        id: 'mock-' + Date.now(),
        completedAt: new Date().toISOString(),
        role: String(state.profile?.role || 'Unspecified role'),
        questionCount: count,
        plannedQuestions: sequence.length,
        averageScore: average,
        rounds: byRound
      });
      state.mockInterviewHistory = state.mockInterviewHistory.slice(0, 20);
      window.CareerOSState.save();
    }
    status.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = stoppedEarly ? 'Mock interview stopped' : 'Mock interview complete';
    const summary = document.createElement('p');
    summary.textContent = count + '/' + sequence.length + ' answers recorded · average practice score ' + average + '/100.';
    status.append(title, summary);
    const list = document.createElement('ul');
    byRound.forEach(item => {
      const li = document.createElement('li');
      li.textContent = labels[item.round] + ': ' + item.score + '/100 (' + item.count + ' answer' + (item.count === 1 ? '' : 's') + ')';
      list.appendChild(li);
    });
    if (byRound.length) status.appendChild(list);
    const note = document.createElement('p');
    note.className = 'small';
    note.textContent = weakest ? 'Priority to revisit: ' + labels[weakest.round] + '. Scores are local practice heuristics, not validated hiring predictions.' : 'No answers were recorded. You can start again whenever ready.';
    status.appendChild(note);
    if (count) {
      const history = document.createElement('p');
      history.className = 'small';
      history.textContent = 'This scorecard was saved in your workspace on this device and syncs when cloud workspace sync is enabled.';
      status.appendChild(history);
    }
  }

  start.addEventListener('click', () => {
    if (active) return finish(true);
    previousRound = qtype.value;
    sequence = buildSequence();
    if (sequence.length < 7) {
      status.textContent = 'The question bank is unavailable. Refresh the workspace and try again.';
      return;
    }
    active = true;
    index = 0;
    answered = false;
    sessionResults = [];
    start.textContent = 'Stop mock interview';
    evaluate.onclick = evaluateCurrent;
    next.onclick = nextQuestion;
    showCurrent();
  });
})();
