// Empty stand-in for the `server-only` marker package under vitest.
// The real module throws when imported outside a React Server Component,
// which is exactly right in the app and exactly wrong in a node test runner.
export {};
