const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  buildContactNotificationSubject,
  buildContactNotificationText,
  sanitizePlainText,
} = require('../dist/message.js');

test('sanitizePlainText strips control characters and normalizes newlines', () => {
  assert.equal(sanitizePlainText('a\u0000b\rc\r\nd'), 'ab\nc\nd');
});

test('subject includes mall name and visitor subject', () => {
  assert.equal(
    buildContactNotificationSubject({
      mallName: 'Metro <Garden>',
      visitorName: 'Ali',
      visitorEmail: 'a@example.test',
      subject: 'Öneri & destek',
      message: 'Merhaba',
    }),
    '[Metro <Garden>] Öneri & destek',
  );
  assert.equal(
    buildContactNotificationSubject({
      mallName: 'AVM',
      visitorName: 'Ali',
      visitorEmail: 'a@example.test',
      message: 'Merhaba',
    }),
    '[AVM] Yeni iletişim mesajı',
  );
});

test('body is plain text with optional phone', () => {
  const text = buildContactNotificationText({
    mallName: 'Metro',
    visitorName: 'Ali <script>',
    visitorEmail: 'ali@example.test',
    visitorPhone: '0555',
    subject: 'Konu',
    message: 'Satır1\nSatır2<script>',
  });
  assert.match(text, /Ad: Ali <script>/);
  assert.match(text, /Telefon: 0555/);
  assert.match(text, /Satır1\nSatır2<script>/);
  assert.doesNotMatch(text, /<html/i);
});
