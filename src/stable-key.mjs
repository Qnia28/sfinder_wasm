// Candidate IDs must agree with Rust's ASCII ordering of canonical hex keys.
// Locale-dependent display ordering must not determine optimization ties.
export const compareStableKeys = (a, b) => a < b ? -1 : a > b ? 1 : 0;
