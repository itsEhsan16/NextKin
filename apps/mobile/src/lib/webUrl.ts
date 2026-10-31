/**
 * The web app this build goes with: billing and the legal pages live there. A build pointed at a
 * backend opens that same deployment, so a tester on the demo is never sent somewhere else.
 */
const base = process.env.EXPO_PUBLIC_WEB_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL;

export const WEB_URL = (base || 'https://nextkin.ai').replace(/\/+$/, '');
