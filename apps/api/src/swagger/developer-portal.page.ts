import type { PortalLocale } from './i18n/portal-locales';
import { PORTAL_LOCALES } from './i18n/portal-locales';
import { getLocaleLabel } from './i18n/detect-locale';
import { getPortalLabels as getPortalLabelsFromLocales } from './locales';

/** Pinned Scalar build — explicit standalone bundle. */
const SCALAR_CDN =
  'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.62.0/dist/browser/standalone.js';

/** Scalar multi-document slugs — must match URL hash segment exactly. */
export const PORTAL_DOC_INTRODUCTION = 'introduction';
export const PORTAL_DOC_RECIPES = 'recipes';
export const PORTAL_DOC_API_REFERENCE = 'api-reference';

export type PortalDocument =
  | typeof PORTAL_DOC_INTRODUCTION
  | typeof PORTAL_DOC_RECIPES
  | typeof PORTAL_DOC_API_REFERENCE;

const PORTAL_DOCUMENTS: PortalDocument[] = [
  PORTAL_DOC_INTRODUCTION,
  PORTAL_DOC_RECIPES,
  PORTAL_DOC_API_REFERENCE,
];

export function renderDeveloperPortalPage(initialLocale: PortalLocale): string {
  const options = PORTAL_LOCALES.map(
    (loc) =>
      `<option value="${loc}"${loc === initialLocale ? ' selected' : ''}>${getLocaleLabel(loc)}</option>`,
  ).join('\n');

  const portalLabelsJson = JSON.stringify({
    tr: getPortalLabelsFromLocales('tr'),
    en: getPortalLabelsFromLocales('en'),
    ru: getPortalLabelsFromLocales('ru'),
  });

  const langLabel = initialLocale === 'tr' ? 'Dil' : initialLocale === 'ru' ? 'Язык' : 'Language';

  const documentSlugsJson = JSON.stringify(PORTAL_DOCUMENTS);

  return `<!DOCTYPE html>
<html lang="${initialLocale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Modern CMS Developer Portal</title>
  <script>
    (function () {
      var DEFAULT_DOC = '${PORTAL_DOC_INTRODUCTION}';
      var DOC_SLUGS = ${documentSlugsJson};
      var LEGACY_API = { tag: 1, model: 1, webhook: 1, operation: 1 };
      var DOC_KEY = 'cms-portal-document';

      function parseRawHash() {
        var hash = window.location.hash || '';
        var raw = hash.length > 1 ? hash.slice(1) : '';
        if (raw.charAt(0) === '/') raw = raw.slice(1);
        return raw;
      }

      function isKnownSlug(slug) {
        for (var i = 0; i < DOC_SLUGS.length; i++) {
          if (DOC_SLUGS[i] === slug) return true;
        }
        return false;
      }

      function isLegacyIntroRoute(raw) {
        if (!raw) return false;
        return raw === 'description/introduction' || raw.indexOf('description/introduction/') === 0;
      }

      window.__cmsPortalIsLegacyIntroRoute = function () {
        return isLegacyIntroRoute(parseRawHash());
      };

      function mapLegacyToSlug(raw) {
        if (!raw) return DEFAULT_DOC;
        var first = raw.split('/')[0];
        if (isKnownSlug(first)) return first;
        if (first === 'getting-started') return DEFAULT_DOC;
        if (isLegacyIntroRoute(raw)) return DEFAULT_DOC;
        if (LEGACY_API[first]) return 'api-reference';
        return DEFAULT_DOC;
      }

      function canonicalHash(documentSlug, raw) {
        if (documentSlug === 'api-reference' && raw && !isKnownSlug(raw.split('/')[0])) {
          return '#api-reference/' + raw;
        }
        return '#' + documentSlug;
      }

      /** Normalize hash before Scalar mounts — slug must exist in configList. */
      window.__cmsPortalResolveDocument = function () {
        var raw = parseRawHash();
        if (raw) {
          return mapLegacyToSlug(raw);
        }
        try {
          var saved = localStorage.getItem(DOC_KEY);
          if (saved === 'getting-started') saved = DEFAULT_DOC;
          if (isKnownSlug(saved)) return saved;
        } catch (e) {}
        return DEFAULT_DOC;
      };

      window.__cmsPortalApplyHash = function (documentSlug) {
        if (!documentSlug || !isKnownSlug(documentSlug)) documentSlug = DEFAULT_DOC;
        var href = window.location.pathname + window.location.search;
        var raw = parseRawHash();
        var next = canonicalHash(documentSlug, raw && !isKnownSlug(raw.split('/')[0]) ? raw : '');
        if (window.location.hash !== next) {
          window.history.replaceState(null, '', href + next);
        }
        return documentSlug;
      };

      window.__cmsPortalNormalizeHash = function () {
        if (isLegacyIntroRoute(parseRawHash())) {
          return DEFAULT_DOC;
        }
        var documentSlug = window.__cmsPortalResolveDocument();
        return window.__cmsPortalApplyHash(documentSlug);
      };

      if (!isLegacyIntroRoute(parseRawHash())) {
        window.__cmsPortalNormalizeHash();
      }

      window.__cmsPortalGuardHash = function () {
        if (isLegacyIntroRoute(parseRawHash())) {
          return;
        }
        var raw = parseRawHash();
        if (!raw) {
          window.__cmsPortalNormalizeHash();
          return;
        }
        var first = raw.split('/')[0];
        if (isKnownSlug(first)) return;
        var mapped = mapLegacyToSlug(raw);
        window.__cmsPortalApplyHash(mapped);
        if (typeof window.__cmsPortalRemount === 'function') {
          window.__cmsPortalRemount(mapped);
        }
      };

      window.addEventListener('hashchange', window.__cmsPortalGuardHash);
    })();
  </script>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; font-family: system-ui, -apple-system, sans-serif; }
    #portal-shell { display: flex; flex-direction: column; height: 100vh; }
    #portal-toolbar {
      display: flex; align-items: center; justify-content: flex-end; gap: 12px;
      padding: 10px 16px; border-bottom: 1px solid #e5e7eb; background: #fafafa; z-index: 1000;
    }
    #portal-toolbar label { font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px; }
    #portal-doc-switch { display: flex; gap: 4px; margin-right: auto; }
    #portal-doc-switch button {
      padding: 6px 12px; border-radius: 8px; border: 1px solid #d1d5db;
      background: #fff; font-size: 14px; cursor: pointer; color: #374151;
    }
    #portal-doc-switch button.active {
      background: #7c3aed; border-color: #7c3aed; color: #fff;
    }
    #portal-locale {
      padding: 6px 10px; border-radius: 8px; border: 1px solid #d1d5db;
      background: #fff; font-size: 14px; cursor: pointer;
    }
    #api-reference { flex: 1; min-height: 0; }
  </style>
</head>
<body>
  <div id="portal-shell">
    <div id="portal-toolbar">
      <div id="portal-doc-switch" role="tablist" aria-label="Documentation">
        <button type="button" role="tab" id="doc-introduction" data-doc="${PORTAL_DOC_INTRODUCTION}"></button>
        <button type="button" role="tab" id="doc-recipes" data-doc="${PORTAL_DOC_RECIPES}"></button>
        <button type="button" role="tab" id="doc-api-reference" data-doc="${PORTAL_DOC_API_REFERENCE}"></button>
      </div>
      <label for="portal-locale">🌍 <span id="lang-label">${langLabel}</span></label>
      <select id="portal-locale" aria-label="Language">${options}</select>
    </div>
    <div id="api-reference"></div>
  </div>
  <script src="${SCALAR_CDN}"></script>
  <script>
    (function () {
      var STORAGE_KEY = 'cms-portal-locale';
      var DOC_KEY = 'cms-portal-document';
      var DEFAULT_LOCALE = '${initialLocale}';
      var DOC_INTRO = '${PORTAL_DOC_INTRODUCTION}';
      var DOC_RECIPES = '${PORTAL_DOC_RECIPES}';
      var DOC_API = '${PORTAL_DOC_API_REFERENCE}';
      var PORTAL_LABELS = ${portalLabelsJson};
      var select = document.getElementById('portal-locale');
      var container = document.getElementById('api-reference');
      var docButtons = document.querySelectorAll('#portal-doc-switch [data-doc]');

      function specUrl(locale) {
        return locale === 'tr' ? '/openapi.developer.json' : '/openapi.developer.' + locale + '.json';
      }

      function gettingStartedUrl(locale) {
        return '/developer/getting-started/' + locale + '.json';
      }

      function recipesUrl(locale) {
        return '/developer/recipes/' + locale + '.json';
      }

      function labelForLocale(locale) {
        return { tr: 'Dil', en: 'Language', ru: 'Язык' }[locale] || 'Language';
      }

      function resolveDocumentSlug(preferred) {
        if (preferred === DOC_INTRO || preferred === DOC_RECIPES || preferred === DOC_API) return preferred;
        if (typeof window.__cmsPortalIsLegacyIntroRoute === 'function' && window.__cmsPortalIsLegacyIntroRoute()) {
          return DOC_INTRO;
        }
        if (typeof window.__cmsPortalNormalizeHash === 'function') {
          return window.__cmsPortalNormalizeHash();
        }
        return DOC_INTRO;
      }

      function useLegacyIntroMount() {
        return typeof window.__cmsPortalIsLegacyIntroRoute === 'function' && window.__cmsPortalIsLegacyIntroRoute();
      }

      function updateDocTabs(documentSlug, locale) {
        var labels = PORTAL_LABELS[locale] || PORTAL_LABELS.en;
        var intro = document.getElementById('doc-introduction');
        var recipes = document.getElementById('doc-recipes');
        var api = document.getElementById('doc-api-reference');
        if (intro) {
          intro.textContent = labels.gettingStarted;
          intro.classList.toggle('active', documentSlug === DOC_INTRO);
          intro.setAttribute('aria-selected', documentSlug === DOC_INTRO ? 'true' : 'false');
        }
        if (recipes) {
          recipes.textContent = labels.recipes;
          recipes.classList.toggle('active', documentSlug === DOC_RECIPES);
          recipes.setAttribute('aria-selected', documentSlug === DOC_RECIPES ? 'true' : 'false');
        }
        if (api) {
          api.textContent = labels.apiReference;
          api.classList.toggle('active', documentSlug === DOC_API);
          api.setAttribute('aria-selected', documentSlug === DOC_API ? 'true' : 'false');
        }
      }

      function mount(locale, preferredDocument) {
        var documentSlug = resolveDocumentSlug(preferredDocument);
        var legacyIntro = useLegacyIntroMount();

        if (!legacyIntro && (!window.location.hash || window.location.hash === '#')) {
          if (typeof window.__cmsPortalApplyHash === 'function') {
            window.__cmsPortalApplyHash(documentSlug);
          }
        }

        var labels = PORTAL_LABELS[locale] || PORTAL_LABELS.en;
        container.innerHTML = '';

        if (legacyIntro) {
          Scalar.createApiReference('#api-reference', {
            url: gettingStartedUrl(locale),
            theme: 'purple',
            metaData: { title: 'Modern CMS Developer Portal' },
            defaultHttpClient: { targetKey: 'javascript', clientKey: 'fetch' },
          });
        } else {
          Scalar.createApiReference('#api-reference', {
            sources: [
              {
                title: labels.gettingStarted,
                slug: DOC_INTRO,
                default: documentSlug === DOC_INTRO,
                url: gettingStartedUrl(locale),
              },
              {
                title: labels.recipes,
                slug: DOC_RECIPES,
                default: documentSlug === DOC_RECIPES,
                url: recipesUrl(locale),
              },
              {
                title: labels.apiReference,
                slug: DOC_API,
                default: documentSlug === DOC_API,
                url: specUrl(locale),
              },
            ],
            theme: 'purple',
            metaData: { title: 'Modern CMS Developer Portal' },
            defaultHttpClient: { targetKey: 'javascript', clientKey: 'fetch' },
          });
        }

        document.documentElement.lang = locale;
        var langLabel = document.getElementById('lang-label');
        if (langLabel) langLabel.textContent = labelForLocale(locale);
        updateDocTabs(documentSlug, locale);
        try { localStorage.setItem(STORAGE_KEY, locale); } catch (e) {}
        try { localStorage.setItem(DOC_KEY, documentSlug); } catch (e) {}
      }

      var saved = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
      var startLocale = saved || DEFAULT_LOCALE;
      if (select) select.value = startLocale;
      mount(startLocale, resolveDocumentSlug());

      window.__cmsPortalRemount = function (documentSlug) {
        mount(select ? select.value : startLocale, resolveDocumentSlug(documentSlug));
      };

      if (select) {
        select.addEventListener('change', function () {
          mount(select.value, resolveDocumentSlug());
        });
      }

      docButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var doc = btn.getAttribute('data-doc');
          if (doc !== DOC_INTRO && doc !== DOC_RECIPES && doc !== DOC_API) return;
          if (doc === DOC_INTRO || doc === DOC_RECIPES) {
            if (typeof window.__cmsPortalApplyHash === 'function') {
              window.__cmsPortalApplyHash(doc);
            }
          } else if (typeof window.__cmsPortalApplyHash === 'function') {
            window.__cmsPortalApplyHash(doc);
          }
          mount(select ? select.value : startLocale, doc);
        });
      });
    })();
  </script>
</body>
</html>`;
}
