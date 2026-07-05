export const SITE_URL = 'https://icra.builders/';
export const SITE_NAME = 'icra.builders';
export const ACQUISITION_EMAIL = 'sales@desertrich.com';
export const GOOGLE_SITE_VERIFICATION = 'GKGwnNyrTz_ykbOlfMN1Xh_JaKjUmTaiCXl2oRMfu1s';

/** Cloudflare Images CDN — hero / OG */
export const HERO_IMAGE_URL =
  'https://imagedelivery.net/-sPAUAWeA405NiWJ0SNIQA/19c09c31-eeaf-4862-097b-1bb1b68e6e00/public';

export const DISCLAIMER =
  'This website is for demonstration and informational purposes only. It does not constitute an offer of services, a commitment to deploy, or a guarantee of outcomes. All statistics, projections, and references to specific technologies are based on publicly available information as of the date shown and are subject to change.';

export function acquisitionMailto(subject?: string, body?: string): string {
  const params = new URLSearchParams();
  params.set(
    'subject',
    subject ?? 'Domain acquisition inquiry: icra.builders',
  );
  if (body) params.set('body', body);
  return `mailto:${ACQUISITION_EMAIL}?${params.toString()}`;
}
