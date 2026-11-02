import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeForHostedFreeTier } from '../api/coach.js';

describe('CareerOS AI provider controls', () => {
  test('hosted Gemini free pilot is capped at two reviews per user per day', () => {
    const coach = readFileSync('api/coach.js', 'utf8');
    assert.ok(coach.includes('const dailyLimit = 2;'));
    assert.ok(coach.includes('consume_careeros_ai_quota'));
    assert.ok(coach.includes('freeTierDataAcknowledged'));
  });

  test('hosted context sanitizer removes direct identifiers', () => {
    const input = {
      profile: { role: 'Frontend developer', email: 'student@example.com', phone: '+91 98765 43210' },
      notes: 'Contact me at user@example.org or https://linkedin.com/in/example',
      skills: ['JavaScript', 'React']
    };
    const result = sanitizeForHostedFreeTier(input);
    assert.equal(result.profile.email, '[redacted]');
    assert.equal(result.profile.phone, '[redacted]');
    assert.ok(!JSON.stringify(result).includes('student@example.com'));
    assert.ok(!JSON.stringify(result).includes('user@example.org'));
    assert.ok(!JSON.stringify(result).includes('linkedin.com'));
    assert.deepEqual(result.skills, ['JavaScript', 'React']);
    assert.equal(input.profile.email, 'student@example.com', 'sanitization must not mutate caller data');
  });

  test('personal API key is never sent to CareerOS API routes or workspace cloud sync', () => {
    const client = readFileSync('website/js/ai.js', 'utf8');
    assert.ok(client.includes('x-goog-api-key'));
    assert.ok(client.includes('Authorization'));
    assert.ok(client.includes('sessionStorage'));
    assert.ok(client.includes('localStorage'));
    assert.ok(client.includes('Your own key is sent directly from this browser'));
    assert.ok(!client.includes('body:JSON.stringify({task,context,consent:true,key:'));
  });

  test('AI consent text changes by hosted versus BYOK mode', () => {
    const client = readFileSync('website/js/ai.js', 'utf8');
    assert.ok(client.includes('Google may use free-tier prompts/responses'));
    assert.ok(client.includes('configured AI provider'));
    assert.ok(client.includes('freeTierDataAcknowledged:true'));
  });
});
