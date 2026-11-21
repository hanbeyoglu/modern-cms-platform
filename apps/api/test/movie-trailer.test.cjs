const assert = require('node:assert/strict');
const { test } = require('node:test');
const { resolveMovieTrailer } = require('../dist/public/movie-trailer.util');
const id = 'M7lc1UVf-VE';

test('supported YouTube links normalize to the same player without forwarding arbitrary parameters', () => {
  for (const url of [
    `https://www.youtube.com/watch?v=${id}&autoplay=1&list=anything`,
    `https://youtu.be/${id}?si=tracking`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtube.com/shorts/${id}`,
    `https://youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ]) {
    assert.deepEqual(resolveMovieTrailer(url), {
      provider: 'YOUTUBE', videoId: id,
      url: `https://www.youtube.com/watch?v=${id}`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1`,
    });
  }
});

test('missing, unsupported or misleading URLs never become iframe sources', () => {
  for (const url of [null, undefined, '', 'invalid', 'javascript:alert(1)',
    `https://youtube.com.evil.test/watch?v=${id}`, `https://evil.test/?v=${id}`,
    `https://youtube.com@evil.test/watch?v=${id}`, `https://user@youtube.com/watch?v=${id}`,
    `https://youtube.com:444/watch?v=${id}`, 'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/playlist?list=123', 'https://vimeo.com/123',
  ]) assert.equal(resolveMovieTrailer(url), null, String(url));
});
