import { Facebook, Instagram, Youtube } from 'lucide-react';
import type { SocialPlatform } from '@/lib/contact';

export function SocialIcon({ platform, className = 'h-3.5 w-3.5' }: { platform: SocialPlatform; className?: string }) {
  switch (platform) {
    case 'instagram':
      return <Instagram className={className} aria-hidden="true" />;
    case 'facebook':
      return <Facebook className={className} aria-hidden="true" />;
    case 'youtube':
      return <Youtube className={className} aria-hidden="true" />;
    case 'tiktok':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
          <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
        </svg>
      );
    case 'x':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={className}
          aria-hidden="true"
        >
          <path d="M4 4l11.733 16h4.267l-11.733-16z" />
          <path d="M4 20l6.768-6.768m2.46-2.46L19.998 4" />
        </svg>
      );
  }
}
