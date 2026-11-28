/**
 * Storefront contact settings & social media URL helpers.
 * Kept free of `server-only` and database imports so both server code and unit
 * tests can share the exact same resolution and sanitisation rules.
 */

export const DEFAULT_CONTACT_PHONE = '+213 555 00 00 00';
export const DEFAULT_CONTACT_EMAIL = 'contact@amaya.dz';

export const SOCIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'tiktok',
  'whatsapp',
  'youtube',
  'x',
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  x: 'X',
};

export const CONTACT_SETTING_KEYS = [
  'contact.address',
  'contact.phone',
  'contact.email',
  'contact.hours',
  'contact.instagram',
  'contact.facebook',
  'contact.tiktok',
  'contact.whatsapp',
  'contact.youtube',
  'contact.x',
] as const;

export type SocialLink = {
  platform: SocialPlatform;
  label: string;
  href: string;
};

export type ContactSettings = {
  address: string;
  phone: string;
  phoneHref: string;
  email: string;
  emailHref: string;
  hours: string;
  hasCustomHours: boolean;
  socialLinks: SocialLink[];
  hasSocialConfig: boolean;
};

export function formatTelHref(phone: string): string {
  const first = phone.split(/[/,;]/)[0]?.trim() ?? '';
  const cleaned = first.replace(/[^\d+]/g, '');
  const digits = cleaned.replace(/\+/g, '');
  if (!digits) return 'tel:+213555000000';
  return `tel:${cleaned.startsWith('+') ? '+' : ''}${digits}`;
}

const DOMAIN_PATTERNS: Record<Exclude<SocialPlatform, 'whatsapp'>, RegExp> = {
  instagram: /^(?:www\.)?(?:instagram\.com|instagr\.am)\//i,
  facebook: /^(?:www\.|m\.)?(?:facebook\.com|fb\.com|fb\.me)\//i,
  tiktok: /^(?:www\.)?tiktok\.com\//i,
  youtube: /^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i,
  x: /^(?:www\.)?(?:x\.com|twitter\.com)\//i,
};

/**
 * Normalise a user-entered social link or handle into a safe `http(s)://` URL.
 * Returns `null` for blank values or unsafe schemes (`javascript:`, `data:`, …).
 */
export function normalizeSocialUrl(platform: SocialPlatform, raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^(?:javascript|data|vbscript|file):/i.test(trimmed)) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.toString();
    } catch {
      return null;
    }
  }

  // Reject any other explicit URI scheme.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

  if (platform === 'whatsapp') {
    if (/^(?:www\.)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)\//i.test(trimmed)) {
      if (/\s/.test(trimmed)) return null;
      try {
        return new URL(`https://${trimmed}`).toString();
      } catch {
        return null;
      }
    }
    if (/^[\d\s().+-]+$/.test(trimmed)) {
      let digits = trimmed.replace(/\D/g, '');
      if (digits.startsWith('00')) digits = digits.slice(2);
      else if (digits.startsWith('0') && digits.length === 10) digits = `213${digits.slice(1)}`;
      if (digits.length < 6 || digits.length > 15) return null;
      return `https://wa.me/${digits}`;
    }
    return null;
  }

  if (DOMAIN_PATTERNS[platform].test(trimmed)) {
    if (/\s/.test(trimmed)) return null;
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return null;
    }
  }

  const handle = trimmed.replace(/^@+/, '');
  if (!handle || /[\s/\\?#]/.test(handle)) return null;

  switch (platform) {
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'facebook':
      return `https://facebook.com/${handle}`;
    case 'tiktok':
      return `https://www.tiktok.com/@${handle}`;
    case 'youtube':
      return `https://youtube.com/@${handle}`;
    case 'x':
      return `https://x.com/${handle}`;
  }
}

export function resolveContactSettings(
  rows: Record<string, unknown>,
  defaults: { location: string; hours: string },
  env: { phone?: string; email?: string; address?: string; hours?: string } = {},
): ContactSettings {
  const readText = (key: string): string | null => {
    const value = rows[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
    return null;
  };

  const dbAddress = readText('contact.address');
  const envAddress = env.address?.trim() || null;
  const address = dbAddress ?? envAddress ?? defaults.location;

  const dbPhone = readText('contact.phone');
  const envPhone = env.phone?.trim() || null;
  const phone = dbPhone ?? envPhone ?? DEFAULT_CONTACT_PHONE;

  const dbEmail = readText('contact.email');
  const envEmail = env.email?.trim() || null;
  const email = dbEmail ?? envEmail ?? DEFAULT_CONTACT_EMAIL;

  const dbHours = readText('contact.hours');
  const envHours = env.hours?.trim() || null;
  const hours = dbHours ?? envHours ?? defaults.hours;

  const hasSocialConfig = SOCIAL_PLATFORMS.some((platform) => `contact.${platform}` in rows);
  const socialLinks: SocialLink[] = [];
  for (const platform of SOCIAL_PLATFORMS) {
    const href = normalizeSocialUrl(platform, rows[`contact.${platform}`]);
    if (href) {
      socialLinks.push({ platform, label: SOCIAL_LABELS[platform], href });
    }
  }

  return {
    address,
    phone,
    phoneHref: formatTelHref(phone),
    email,
    emailHref: `mailto:${email}`,
    hours,
    hasCustomHours: Boolean(dbHours ?? envHours),
    socialLinks,
    hasSocialConfig,
  };
}
