/** Contact settings & social media URL resolution and sanitisation. */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CONTACT_EMAIL,
  DEFAULT_CONTACT_PHONE,
  formatTelHref,
  normalizeSocialUrl,
  resolveContactSettings,
} from '../src/lib/contact.ts';

test('falls back to localised dictionary defaults when no DB or env values exist', () => {
  const contact = resolveContactSettings({}, { location: 'وهران، الجزائر', hours: 'السبت – الخميس · 9 – 18' });
  assert.equal(contact.address, 'وهران، الجزائر');
  assert.equal(contact.hours, 'السبت – الخميس · 9 – 18');
  assert.equal(contact.phone, DEFAULT_CONTACT_PHONE);
  assert.equal(contact.phoneHref, 'tel:+213555000000');
  assert.equal(contact.email, DEFAULT_CONTACT_EMAIL);
  assert.equal(contact.emailHref, 'mailto:contact@amaya.dz');
  assert.equal(contact.hasCustomHours, false);
  assert.equal(contact.hasSocialConfig, false);
  assert.deepEqual(contact.socialLinks, []);
});

test('DB contact values take precedence over env vars and dictionary defaults', () => {
  const contact = resolveContactSettings(
    {
      'contact.address': '12 Rue Larbi Ben M’hidi, Oran',
      'contact.phone': '+213 770 11 22 33',
      'contact.email': 'hello@amaya.dz',
      'contact.hours': 'Sun – Thu · 10am – 7pm',
    },
    { location: 'Oran, Algeria', hours: 'Sat – Thu · 9am – 6pm' },
    {
      address: 'Env Address',
      phone: '+213 555 99 99 99',
      email: 'env@amaya.dz',
      hours: 'Env Hours',
    },
  );
  assert.equal(contact.address, '12 Rue Larbi Ben M’hidi, Oran');
  assert.equal(contact.phone, '+213 770 11 22 33');
  assert.equal(contact.phoneHref, 'tel:+213770112233');
  assert.equal(contact.email, 'hello@amaya.dz');
  assert.equal(contact.emailHref, 'mailto:hello@amaya.dz');
  assert.equal(contact.hours, 'Sun – Thu · 10am – 7pm');
  assert.equal(contact.hasCustomHours, true);
});

test('env vars take precedence over dictionary defaults when DB values are unset or null', () => {
  const contact = resolveContactSettings(
    { 'contact.address': null, 'contact.phone': '   ' },
    { location: 'Oran, Algeria', hours: 'Sat – Thu · 9am – 6pm' },
    { address: 'Alger, Algérie', phone: '0550 12 34 56', email: 'sales@amaya.dz' },
  );
  assert.equal(contact.address, 'Alger, Algérie');
  assert.equal(contact.phone, '0550 12 34 56');
  assert.equal(contact.phoneHref, 'tel:0550123456');
  assert.equal(contact.email, 'sales@amaya.dz');
  assert.equal(contact.hours, 'Sat – Thu · 9am – 6pm');
  assert.equal(contact.hasCustomHours, false);
});

test('formatTelHref handles spaces, separators, and local numbers', () => {
  assert.equal(formatTelHref('+213 555 00 00 00'), 'tel:+213555000000');
  assert.equal(formatTelHref('0555 12 34 56 / 0770 11 22 33'), 'tel:0555123456');
  assert.equal(formatTelHref(''), 'tel:+213555000000');
});

test('normalizeSocialUrl accepts full URLs, domains, handles, and WhatsApp phones', () => {
  assert.equal(normalizeSocialUrl('instagram', 'https://instagram.com/amaya.dz'), 'https://instagram.com/amaya.dz');
  assert.equal(normalizeSocialUrl('instagram', 'instagram.com/amaya.dz'), 'https://instagram.com/amaya.dz');
  assert.equal(normalizeSocialUrl('instagram', '@amaya.dz'), 'https://instagram.com/amaya.dz');
  assert.equal(normalizeSocialUrl('instagram', 'amaya.dz'), 'https://instagram.com/amaya.dz');
  assert.equal(normalizeSocialUrl('facebook', 'www.facebook.com/amayadz'), 'https://www.facebook.com/amayadz');
  assert.equal(normalizeSocialUrl('tiktok', '@amaya.dz'), 'https://www.tiktok.com/@amaya.dz');
  assert.equal(normalizeSocialUrl('tiktok', 'tiktok.com/@amaya.dz'), 'https://tiktok.com/@amaya.dz');
  assert.equal(normalizeSocialUrl('youtube', '@amaya'), 'https://youtube.com/@amaya');
  assert.equal(normalizeSocialUrl('x', '@amaya_dz'), 'https://x.com/amaya_dz');
  assert.equal(normalizeSocialUrl('whatsapp', '+213 555 00 00 00'), 'https://wa.me/213555000000');
  assert.equal(normalizeSocialUrl('whatsapp', '0555 12 34 56'), 'https://wa.me/213555123456');
  assert.equal(normalizeSocialUrl('whatsapp', 'https://wa.me/213555123456'), 'https://wa.me/213555123456');
});

test('normalizeSocialUrl rejects unsafe protocols and malformed values', () => {
  assert.equal(normalizeSocialUrl('instagram', 'javascript:alert(1)'), null);
  assert.equal(normalizeSocialUrl('facebook', 'DATA:text/html,<script>'), null);
  assert.equal(normalizeSocialUrl('tiktok', 'vbscript:msgbox(1)'), null);
  assert.equal(normalizeSocialUrl('youtube', 'ftp://example.com'), null);
  assert.equal(normalizeSocialUrl('whatsapp', 'not a phone'), null);
  assert.equal(normalizeSocialUrl('instagram', '   '), null);
});

test('hasSocialConfig distinguishes unconfigured DB from explicitly cleared social links', () => {
  const unconfigured = resolveContactSettings({}, { location: 'Oran', hours: '9-6' });
  assert.equal(unconfigured.hasSocialConfig, false);
  assert.equal(unconfigured.socialLinks.length, 0);

  const configured = resolveContactSettings(
    { 'contact.instagram': '@amaya.dz', 'contact.whatsapp': '0555 00 00 00', 'contact.facebook': null },
    { location: 'Oran', hours: '9-6' },
  );
  assert.equal(configured.hasSocialConfig, true);
  assert.deepEqual(
    configured.socialLinks.map((l) => [l.platform, l.href]),
    [
      ['instagram', 'https://instagram.com/amaya.dz'],
      ['whatsapp', 'https://wa.me/213555000000'],
    ],
  );

  const cleared = resolveContactSettings(
    { 'contact.instagram': null },
    { location: 'Oran', hours: '9-6' },
  );
  assert.equal(cleared.hasSocialConfig, true);
  assert.equal(cleared.socialLinks.length, 0);
});
