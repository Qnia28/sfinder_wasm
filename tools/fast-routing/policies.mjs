export const STUDY = 'fast-routing-e2e-20261017';
export const ARM_OPTIONS = Object.freeze({
  BASE100: {},
  DIRECT: { fastPolicy: 'DIRECT_2X2' },
  PREVIEW_ONLY: { fastPolicy: 'PREVIEW_ONLY' },
  I1K: { fastStateBudget: 1000, fastPreviewBudget: 0, fastGraceBudget: 0 },
  I10K: { fastStateBudget: 10000, fastPreviewBudget: 0, fastGraceBudget: 0 },
  S200_OR_D16: { fastPolicy: 'S200_OR_D16' },
  U192_OR_D16: { fastPolicy: 'U192_OR_D16' },
});
