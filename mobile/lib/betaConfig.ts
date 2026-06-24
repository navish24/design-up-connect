// EXPO_PUBLIC_* vars are inlined at build time by Metro/EAS.
// In beta builds (APP_VARIANT=beta) this is "true"; in production it is unset.
export const isBeta: boolean = process.env.EXPO_PUBLIC_IS_BETA === 'true';
