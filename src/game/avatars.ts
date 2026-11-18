function makeTacticalAvatarSvg(initials: string, bgHex: string, accentHex: string): string {
  const safe = initials.slice(0, 2).toUpperCase() || 'EF';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${bgHex}"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs><rect width="96" height="96" rx="18" fill="url(#g)"/><polygon points="0,78 96,58 96,96 0,96" fill="${accentHex}" fill-opacity="0.24"/><circle cx="48" cy="48" r="34" fill="none" stroke="${accentHex}" stroke-width="2" stroke-opacity="0.6"/><text x="48" y="57" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-weight="900" font-size="30" fill="#f8fafc">${safe}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const PRESET_AVATARS: string[] = [
  makeTacticalAvatarSvg('VK', '#ea580c', '#fb923c'),
  makeTacticalAvatarSvg('KR', '#6d28d9', '#c084fc'),
  makeTacticalAvatarSvg('TT', '#0369a1', '#38bdf8'),
  makeTacticalAvatarSvg('NV', '#047857', '#34d399'),
];

export function getFallbackAvatar(username?: string): string {
  const clean = (username || 'EF').trim();
  const initials = clean.length >= 2 ? clean.slice(0, 2) : `${clean[0] || 'E'}F`;
  return makeTacticalAvatarSvg(initials, '#ea580c', '#38bdf8');
}
