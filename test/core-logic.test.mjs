import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Extract the exact code from website/data/career-content.js, website/js/app.js, and website/js/auth.js
const careerContentJs = readFileSync('website/data/career-content.js', 'utf8');
const appJs = readFileSync('website/js/app.js', 'utf8');
const authJs = readFileSync('website/js/auth.js', 'utf8');

// Create mock DOM environment for app state evaluation
const makeEl = () => ({
  value: '',
  textContent: '',
  classList: { add() {}, remove() {} },
  innerHTML: '',
  style: {},
  addEventListener() {},
  dataset: {},
  parentElement: { querySelector() { return makeEl(); } },
  closest() { return null; },
  setAttribute() {},
  removeAttribute() {}
});

const windowObj = {
  dispatchEvent: () => {},
  CustomEvent: class {},
  CareerOSContent: null,
  CareerOSQuestionBank: {}
};

const domMock = {
  window: windowObj,
  document: {
    getElementById: () => makeEl(),
    querySelector: () => makeEl(),
    querySelectorAll: () => [makeEl()]
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  },
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ questions: [] }) }),
  setTimeout: () => {},
  clearTimeout: () => {},
  URL,
  Math,
  Date,
  JSON,
  Number,
  String,
  Array,
  Object,
  Map,
  Set
};

const context = vm.createContext({ ...domMock, globalThis: {} });
// Run career content definitions first so window.CareerOSContent is set
vm.runInContext(careerContentJs, context);

const scriptCode = `
${appJs}
globalThis.fresh = fresh;
globalThis.gaps = gaps;
globalThis.score = score;
globalThis.esc = esc;
globalThis.safeUrl = safeUrl;
globalThis.ROLE_TEMPLATES = ROLE_TEMPLATES;
globalThis.Q = Q;
globalThis.getState = () => S;
globalThis.setState = (val) => { S = val; };
`;
vm.runInContext(scriptCode, context);

const { fresh, gaps, score, esc, safeUrl, ROLE_TEMPLATES, Q, setState } = context.globalThis;

// Extract mergeWorkspace function from auth.js
const mergeWorkspaceMatch = authJs.match(/function mergeWorkspace\([\s\S]*?\n\}/);
assert.ok(mergeWorkspaceMatch, 'auth.js must contain mergeWorkspace function');
const mergeContext = vm.createContext({ Math, Number, String, Array, Object, Map, Set });
vm.runInContext(`var mergeWorkspace = ${mergeWorkspaceMatch[0]}`, mergeContext);
const mergeWorkspace = mergeContext.mergeWorkspace;

describe('Core Logic: Fresh State & Templates', () => {
  test('fresh() initializes completely blank workspace with no seeded progress', () => {
    const s = fresh();
    assert.equal(s.profile.role, '');
    assert.equal(s.profile.experience, '');
    assert.equal(s.profile.timeline, '');
    assert.deepEqual([...s.skills], []);
    assert.deepEqual([...s.done], []);
    assert.deepEqual([...s.apps], []);
    assert.equal(s.sessions, 0);
  });

  test('all 7 role templates provide defined skills and roadmaps', () => {
    const expectedRoles = ['ai_ml', 'full_stack', 'backend', 'frontend', 'data_analyst', 'cybersecurity', 'product'];
    for (const roleKey of expectedRoles) {
      const template = ROLE_TEMPLATES[roleKey];
      assert.ok(template, `Template for ${roleKey} must exist`);
      assert.ok(template.role.length > 0, `Template ${roleKey} must have role title`);
      assert.ok(template.skills.length >= 6, `Template ${roleKey} must have at least 6 skills`);
      assert.ok(template.roadmap.length >= 6, `Template ${roleKey} must have at least 6 roadmap items`);
      for (const skill of template.skills) {
        assert.equal(skill[1], 0, 'Templates must start with unassessed skill level (0)');
        assert.ok(['Critical', 'High', 'Medium'].includes(skill[3]), 'Skills must have valid importance rating');
      }
    }
  });
});

describe('Core Logic: Scoring & Gap Analysis', () => {
  test('score() returns null when skills are empty or unassessed', () => {
    setState({ skills: [], profile: {}, sessions: 0 });
    assert.equal(score(), null);

    setState({
      skills: [{ name: 'SQL', level: 0, required: 3, importance: 'High' }],
      profile: {},
      sessions: 0
    });
    assert.equal(score(), null);
  });

  test('score() calculates accurate score when all skills are assessed', () => {
    setState({
      skills: [
        { name: 'Python', level: 4, required: 4, importance: 'Critical' },
        { name: 'SQL', level: 3, required: 3, importance: 'High' }
      ],
      profile: { role: 'Backend Engineer', evidence: 'Built production pipeline' },
      sessions: 2
    });
    const calculated = score();
    assert.ok(calculated > 70 && calculated <= 100);
  });

  test('gaps() prioritizes Critical over High over Medium and ignores unassessed skills', () => {
    setState({
      skills: [
        { name: 'Unrated Skill', level: 0, required: 3, importance: 'Critical' },
        { name: 'Low Priority Gap', level: 1, required: 3, importance: 'Medium' },
        { name: 'High Priority Gap', level: 2, required: 3, importance: 'High' },
        { name: 'Critical Gap', level: 2, required: 4, importance: 'Critical' },
        { name: 'Mastered Skill', level: 4, required: 3, importance: 'High' }
      ]
    });
    const result = gaps();
    assert.equal(result.length, 3, 'Should only include skills with level > 0 and level < required');
    assert.equal(result[0].name, 'Critical Gap');
    assert.equal(result[1].name, 'High Priority Gap');
    assert.equal(result[2].name, 'Low Priority Gap');
  });
});

describe('Core Logic: Cloud Merge (auth.js)', () => {
  test('merges guest work into cloud without overwriting with defaults', () => {
    const cloud = {
      profile: { role: 'Backend Engineer', experience: '2–5 years' },
      skills: [{ name: 'Go', level: 2, required: 4 }],
      done: [true, false],
      apps: [{ id: 1, role: 'Backend Eng', company: 'Acme', status: 'Applied' }],
      sessions: 3
    };
    const local = {
      profile: { role: 'Backend Engineer', objective: 'Lead API architecture' },
      skills: [{ name: 'Go', level: 3, required: 4 }, { name: 'PostgreSQL', level: 2, required: 3 }],
      done: [true, true],
      apps: [{ id: 2, role: 'Systems Eng', company: 'Beta', status: 'Saved' }],
      sessions: 5
    };

    const merged = mergeWorkspace(cloud, local);
    assert.equal(merged.profile.role, 'Backend Engineer');
    assert.equal(merged.profile.objective, 'Lead API architecture');
    assert.equal(merged.skills.find(s => s.name.toLowerCase() === 'go').level, 3);
    assert.equal(merged.skills.length, 2);
    assert.deepEqual(merged.done, [true, true]);
    assert.equal(merged.apps.length, 2);
    assert.equal(merged.sessions, 5);
  });

  test('resets role-specific skills and roadmap when role changed locally', () => {
    const cloud = {
      profile: { role: 'AI / ML Engineer' },
      skills: [{ name: 'Deep Learning', level: 2, required: 3 }],
      done: [true, true]
    };
    const local = {
      profile: { role: 'Product Manager' },
      skills: [{ name: 'User Research', level: 3, required: 4 }],
      done: [false, false]
    };

    const merged = mergeWorkspace(cloud, local);
    assert.equal(merged.profile.role, 'Product Manager');
    assert.deepEqual(merged.skills, [{ name: 'User Research', level: 3, required: 4 }]);
    assert.deepEqual(merged.done, [false, false]);
  });
});

describe('Core Logic: Sanitization & Security Helpers', () => {
  test('esc() escapes HTML dangerous characters', () => {
    const dangerous = '<script>alert("xss & \'hack\'")</script>';
    const safe = esc(dangerous);
    assert.ok(!safe.includes('<'));
    assert.ok(!safe.includes('>'));
    assert.ok(!safe.includes('"'));
    assert.ok(!safe.includes("'"));
    assert.ok(safe.includes('&lt;script&gt;'));
  });

  test('safeUrl() rejects non-HTTP(S) protocols', () => {
    assert.equal(safeUrl('javascript:alert(1)'), '');
    assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), '');
    assert.equal(safeUrl('file:///etc/passwd'), '');
    assert.equal(safeUrl('https://careeros-intelligence.vercel.app'), 'https://careeros-intelligence.vercel.app/');
    assert.equal(safeUrl('http://localhost:3000/app'), 'http://localhost:3000/app');
  });
});

describe('Core Logic: Interview Question Bank', () => {
  test('all 7 interview rounds have at least 5 questions with guidance hints', () => {
    const rounds = ['aptitude', 'coding', 'technical', 'system_design', 'case_study', 'behavioral', 'hr'];
    for (const round of rounds) {
      const bank = Q[round];
      assert.ok(Array.isArray(bank), `Bank for ${round} must be an array`);
      assert.ok(bank.length >= 5, `Bank for ${round} must contain at least 5 questions`);
      for (const item of bank) {
        assert.ok(item[0].length >= 10, 'Question text must be substantive');
        assert.ok(item[1].length >= 10, 'Hint text must be substantive');
      }
    }
  });
});
