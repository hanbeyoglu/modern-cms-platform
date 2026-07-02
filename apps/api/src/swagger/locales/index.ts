import type { PortalLocale } from '../i18n/portal-locales';
import { ENDPOINT_GUIDE_LABELS } from '../developer-portal/endpoint-guides.content';
import { RECIPES_CONTENT } from '../developer-portal/recipes.content';
import { GETTING_STARTED_MARKDOWN } from '../getting-started.content';
import { en } from './en';
import { ru } from './ru';
import { tr } from './tr';

const INTRO_SUMMARY: Record<PortalLocale, string> = {
  tr: 'Modern CMS headless API — Admin ve Public uçlar için otomatik OpenAPI dokümantasyonu.',
  en: 'Modern CMS headless API — auto-generated OpenAPI documentation for Admin and Public endpoints.',
  ru: 'Modern CMS headless API — автоматическая OpenAPI-документация для Admin и Public эндпоинтов.',
};

const GETTING_STARTED_TITLE: Record<PortalLocale, string> = {
  tr: 'Başlangıç',
  en: 'Getting Started',
  ru: 'Начало работы',
};

const API_REFERENCE_TITLE: Record<PortalLocale, string> = {
  tr: 'API Referansı',
  en: 'API Reference',
  ru: 'Справочник API',
};

const RECIPES_TITLE: Record<PortalLocale, string> = {
  tr: 'Tarifler',
  en: 'Recipes',
  ru: 'Рецепты',
};

const DEVELOPER_PORTAL_LABELS: Record<PortalLocale, Record<string, string>> = {
  en: {
    'developerPortal.api.title': 'Modern CMS — Frontend Integration API',
    'developerPortal.api.description':
      'Public headless APIs for websites, mobile apps, kiosks and digital signage. No CMS admin endpoints.',
    'tags.public.homepage': 'Homepage',
    'tags.public.homepage.description': 'Curated home screen bundle (sliders, stores, events, campaigns).',
    'tags.public.siteConfig': 'Site Config',
    'tags.public.siteConfig.description': 'Tenant, mall, locales and bootstrap metadata.',
    'tags.public.sliders': 'Sliders',
    'tags.public.sliders.description': 'Hero and banner slider groups.',
    'tags.public.campaigns': 'Campaigns',
    'tags.public.campaigns.description': 'Published retail campaigns.',
    'tags.public.events': 'Events',
    'tags.public.events.description': 'Published mall events.',
    'tags.public.stores': 'Stores',
    'tags.public.stores.description': 'Store directory and detail pages.',
    'tags.public.pages': 'Pages',
    'tags.public.pages.description': 'CMS pages (footer, legal, custom content).',
    'tags.public.services': 'Services',
    'tags.public.services.description': 'Mall amenities and location services.',
    'tags.public.movies': 'Movies',
    'tags.public.movies.description': 'Cinema operators and movie sessions.',
    'tags.public.search': 'Search',
    'tags.public.search.description': 'Cross-content search.',
    'tags.public.popups': 'Popups',
    'tags.public.popups.description': 'Modal and promotional popups.',
    'tags.public.mediaGuidelines': 'Media Guidelines',
    'tags.public.mediaGuidelines.description': 'Recommended image dimensions per usage preset.',
    'tagGroup.developer.content.name': 'Content',
  },
  tr: {
    'developerPortal.api.title': 'Modern CMS — Frontend Entegrasyon API',
    'developerPortal.api.description':
      'Web, mobil, kiosk ve digital signage için public headless API. CMS admin uçları yok.',
    'tags.public.homepage': 'Ana Sayfa',
    'tags.public.homepage.description': 'Ana ekran paketi (slider, mağaza, etkinlik, kampanya).',
    'tags.public.siteConfig': 'Site Yapılandırması',
    'tags.public.siteConfig.description': 'Tenant, AVM, locale ve bootstrap metadata.',
    'tags.public.sliders': 'Sliderlar',
    'tags.public.sliders.description': 'Hero ve banner slider grupları.',
    'tags.public.campaigns': 'Kampanyalar',
    'tags.public.campaigns.description': 'Yayınlanmış perakende kampanyaları.',
    'tags.public.events': 'Etkinlikler',
    'tags.public.events.description': 'Yayınlanmış AVM etkinlikleri.',
    'tags.public.stores': 'Mağazalar',
    'tags.public.stores.description': 'Mağaza dizini ve detay sayfaları.',
    'tags.public.pages': 'Sayfalar',
    'tags.public.pages.description': 'CMS sayfaları (footer, yasal, özel içerik).',
    'tags.public.services': 'Hizmetler',
    'tags.public.services.description': 'AVM olanakları ve konum hizmetleri.',
    'tags.public.movies': 'Filmler',
    'tags.public.movies.description': 'Sinema operatörleri ve seanslar.',
    'tags.public.search': 'Arama',
    'tags.public.search.description': 'Çapraz içerik araması.',
    'tags.public.popups': 'Popuplar',
    'tags.public.popups.description': 'Modal ve promosyon popupları.',
    'tags.public.mediaGuidelines': 'Medya Kuralları',
    'tags.public.mediaGuidelines.description': 'Kullanım preset’i başına önerilen görsel boyutları.',
    'tagGroup.developer.content.name': 'İçerik',
  },
  ru: {
    'developerPortal.api.title': 'Modern CMS — Frontend Integration API',
    'developerPortal.api.description':
      'Публичные headless API для сайтов, мобильных приложений, киосков и digital signage. Без admin эндпоинтов CMS.',
    'tags.public.homepage': 'Главная',
    'tags.public.homepage.description': 'Подборка для главного экрана (слайдеры, магазины, события, кампании).',
    'tags.public.siteConfig': 'Конфигурация сайта',
    'tags.public.siteConfig.description': 'Tenant, ТЦ, локали и bootstrap metadata.',
    'tags.public.sliders': 'Слайдеры',
    'tags.public.sliders.description': 'Hero и баннерные слайдеры.',
    'tags.public.campaigns': 'Кампании',
    'tags.public.campaigns.description': 'Опубликованные retail-кампании.',
    'tags.public.events': 'События',
    'tags.public.events.description': 'Опубликованные события ТЦ.',
    'tags.public.stores': 'Магазины',
    'tags.public.stores.description': 'Каталог и детальные страницы магазинов.',
    'tags.public.pages': 'Страницы',
    'tags.public.pages.description': 'CMS-страницы (footer, legal, custom).',
    'tags.public.services': 'Сервисы',
    'tags.public.services.description': 'Удобства ТЦ и location services.',
    'tags.public.movies': 'Кино',
    'tags.public.movies.description': 'Кинотеатры и сеансы.',
    'tags.public.search': 'Поиск',
    'tags.public.search.description': 'Поиск по контенту.',
    'tags.public.popups': 'Попапы',
    'tags.public.popups.description': 'Модальные и промо попапы.',
    'tags.public.mediaGuidelines': 'Медиа-гайдлайны',
    'tags.public.mediaGuidelines.description': 'Рекомендуемые размеры изображений.',
    'tagGroup.developer.content.name': 'Контент',
  },
};

function buildDictionary(locale: PortalLocale): Record<string, string> {
  const base = { tr, en, ru }[locale];
  return {
    ...base,
    ...DEVELOPER_PORTAL_LABELS[locale],
    ...ENDPOINT_GUIDE_LABELS[locale],
    'intro.summary': INTRO_SUMMARY[locale],
    'gettingStarted.title': GETTING_STARTED_TITLE[locale],
    'gettingStarted.markdown': GETTING_STARTED_MARKDOWN[locale],
    'recipes.title': RECIPES_TITLE[locale],
    'recipes.markdown': RECIPES_CONTENT[locale],
    'portal.apiReference.title': API_REFERENCE_TITLE[locale],
    'portal.recipes.title': RECIPES_TITLE[locale],
  };
}

const dictionaries: Record<PortalLocale, Record<string, string>> = {
  tr: buildDictionary('tr'),
  en: buildDictionary('en'),
  ru: buildDictionary('ru'),
};

export function getLocaleDictionary(locale: PortalLocale): Record<string, string> {
  return dictionaries[locale];
}

export function getPortalLabels(locale: PortalLocale): {
  gettingStarted: string;
  recipes: string;
  apiReference: string;
  language: string;
} {
  const dict = getLocaleDictionary(locale);
  return {
    gettingStarted: dict['gettingStarted.title'] ?? 'Getting Started',
    recipes: dict['portal.recipes.title'] ?? 'Recipes',
    apiReference: dict['portal.apiReference.title'] ?? 'API Reference',
    language: dict['portal.language.label'] ?? 'Language',
  };
}

export function getAllSearchTermsForKey(key: string): string[] {
  const terms = new Set<string>();
  for (const dict of Object.values(dictionaries)) {
    const val = dict[key];
    if (val) {
      terms.add(val.toLowerCase());
      for (const word of val.toLowerCase().split(/[\s/.,;:()]+/)) {
        if (word.length >= 3) terms.add(word);
      }
    }
  }
  for (const part of key.split('.')) {
    if (part.length >= 3) terms.add(part.toLowerCase());
  }
  return [...terms].filter(Boolean);
}

export function validateLocaleParity(): void {
  const enKeys = new Set(Object.keys(en));
  for (const locale of ['tr', 'ru'] as const) {
    const dict = { tr, ru }[locale];
    const missing = [...enKeys].filter((k) => !(k in dict));
    const extra = Object.keys(dict).filter((k) => !enKeys.has(k));
    if (missing.length > 0) {
      throw new Error(`Locale "${locale}" missing ${missing.length} keys (e.g. ${missing.slice(0, 5).join(', ')})`);
    }
    if (extra.length > 0) {
      throw new Error(`Locale "${locale}" has ${extra.length} unknown keys (e.g. ${extra.slice(0, 5).join(', ')})`);
    }
  }
}

export { en, tr, ru };
