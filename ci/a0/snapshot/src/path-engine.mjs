// Compatibility shim. The shared PC enumeration/router was historically named
// path-engine even though Chance, Saves, Minimals, Fourth, Fifth, and PATH all
// use it. New code should import pc-enumeration-engine.mjs directly.
export * from "./pc-enumeration-engine.mjs";
