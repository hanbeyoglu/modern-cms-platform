import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isExpired,
  mapFloorLabel,
  mapSocialLinks,
  parseWorkingHoursText,
  resolveAbsoluteUrl,
  urlHash,
} from '../src/metrogarden-import/helpers';

test('urlHash is stable for identical URLs', () => {
  const a = urlHash('https://images.unsplash.com/photo-1?w=800');
  const b = urlHash('https://images.unsplash.com/photo-1?w=800');
  const c = urlHash('https://images.unsplash.com/photo-1?w=801');
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 64);
});

test('isExpired treats end-of-day inclusively', () => {
  assert.equal(isExpired('2026-06-15', new Date('2026-06-15T12:00:00.000Z')), false);
  assert.equal(isExpired('2026-06-15', new Date('2026-06-16T00:00:00.000Z')), true);
  assert.equal(isExpired(undefined, new Date()), false);
});

test('parseWorkingHoursText maps Turkish day ranges', () => {
  const parsed = parseWorkingHoursText('Pazartesi – Pazar: 10:00 – 22:00');
  assert.equal(parsed.unsupported, false);
  assert.equal(parsed.schedule?.monday?.open, true);
  assert.equal(parsed.schedule?.monday?.from, '10:00');
  assert.equal(parsed.schedule?.sunday?.to, '22:00');
});

test('mapSocialLinks maps known platforms and reports unknowns', () => {
  const mapped = mapSocialLinks({
    instagram: 'https://instagram.com/x',
    twitter: 'https://twitter.com/x',
    foo: 'https://example.com',
  });
  assert.equal(mapped.links.length, 2);
  assert.deepEqual(mapped.unsupported, ['social_links.foo']);
});

test('mapFloorLabel and resolveAbsoluteUrl', () => {
  assert.equal(mapFloorLabel('ground'), 'Zemin');
  assert.equal(mapFloorLabel('1f'), '1');
  assert.equal(
    resolveAbsoluteUrl('/stores', 'https://metrogarden.hanbeyoglu.com'),
    'https://metrogarden.hanbeyoglu.com/stores',
  );
  assert.equal(resolveAbsoluteUrl('#', 'https://metrogarden.hanbeyoglu.com'), undefined);
});
