/** §20.9 — Arabic default with RTL, French and English LTR, FR-first fallbacks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { dir, isLocale, LOCALES, DEFAULT_LOCALE, translate, translationMap } from '../src/lib/i18n.ts';

const ARABIC = /[\u0600-\u06FF]/;

test('Arabic is the default locale and the only RTL one', () => {
  assert.equal(DEFAULT_LOCALE, 'ar');
  assert.equal(dir('ar'), 'rtl');
  assert.equal(dir('fr'), 'ltr');
  assert.equal(dir('en'), 'ltr');
  assert.deepEqual([...LOCALES].sort(), ['ar', 'en', 'fr']);
});

test('unknown locales are rejected instead of silently accepted', () => {
  assert.equal(isLocale('ar'), true);
  assert.equal(isLocale('FR'), false);
  assert.equal(isLocale('de'), false);
  assert.equal(isLocale(null), false);
  assert.equal(isLocale(undefined), false);
});

test('translations resolve regardless of enum casing from the database', () => {
  const rows = [
    { locale: 'AR', name: 'سماعات' },
    { locale: 'FR', name: 'Écouteurs' },
    { locale: 'EN', name: 'Earbuds' },
  ];
  assert.equal(translate(rows, 'ar'), 'سماعات');
  assert.equal(translate(rows, 'fr'), 'Écouteurs');
  assert.equal(translate(rows, 'en'), 'Earbuds');
});

test('missing locales fall back to French, never to an empty string', () => {
  const rows = [{ locale: 'FR', name: 'Écouteurs' }];
  assert.equal(translate(rows, 'ar'), 'Écouteurs');
  assert.equal(translate(rows, 'en'), 'Écouteurs');
  assert.equal(translate([], 'ar'), '');
  assert.equal(translate([{ locale: 'AR', name: '   ' }, { locale: 'FR', name: 'x' }], 'ar'), 'x');
});

test('translationMap exposes all three locales to editors', () => {
  const map = translationMap([{ locale: 'AR', name: 'أ' }, { locale: 'EN', name: 'B' }]);
  assert.equal(map.ar?.name, 'أ');
  assert.equal(map.en?.name, 'B');
  assert.equal(map.fr, undefined);
});

test('every dictionary is complete for the three languages', async () => {
  const fr = (await import('../src/i18n/fr.ts')).default;
  const ar = (await import('../src/i18n/ar.ts')).default;
  const en = (await import('../src/i18n/en.ts')).default;

  const flat = (obj: unknown, prefix = ''): string[] =>
    Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? flat(value, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );

  const frKeys = flat(fr).sort();
  for (const [name, dictionary] of [['ar', ar], ['en', en]] as const) {
    assert.deepEqual(flat(dictionary).sort(), frKeys, `dictionary ${name} is out of sync with fr`);
  }
});

test('Arabic copy is actually Arabic across storefront and admin', async () => {
  const ar = (await import('../src/i18n/ar.ts')).default;
  assert.match(ar.nav.home, ARABIC);
  assert.match(ar.checkout.title, ARABIC);
  assert.match(ar.home.heroTitle, ARABIC);
  assert.match(ar.admin.nav.overview, ARABIC);
  assert.match(ar.admin.orders.title, ARABIC);
  assert.match(ar.admin.invoices.title, ARABIC);
  assert.match(ar.admin.settings.title, ARABIC);
});

test('the root layout applies lang + dir from the resolved locale and admin inherits it', () => {
  const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /lang=\{locale\}/);
  assert.match(layout, /dir=\{dir\(locale\)\}/);

  const adminShell = readFileSync(new URL('../src/components/admin/admin-shell.tsx', import.meta.url), 'utf8');
  assert.ok(!/dir="ltr"\s+lang="fr"/.test(adminShell), 'admin shell must not lock dir="ltr" lang="fr"');
  assert.match(adminShell, /LocaleSwitcher/);
});

test('invoices are pinned to French regardless of the site language', () => {
  const labels = readFileSync(new URL('../src/lib/invoice-labels.ts', import.meta.url), 'utf8');
  assert.match(labels, /ALWAYS French/i);
  assert.match(labels, /FACTURE/);
  assert.match(labels, /Montant total/);
  // No hook into the locale machinery: invoices must not follow the UI.
  assert.ok(!/from '@\/lib\/i18n'/.test(labels), 'invoice labels must not depend on i18n');

  const template = readFileSync(new URL('../src/lib/invoice-template.ts', import.meta.url), 'utf8');
  assert.match(template, /<html lang="fr" dir="ltr">/);
  assert.ok(!/from '@\/lib\/i18n'/.test(template), 'invoice template must not depend on i18n');
});
