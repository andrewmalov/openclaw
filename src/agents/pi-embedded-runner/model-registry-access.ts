/**
 * Single import path for model registry discovery so Vitest `vi.mock` applies to the same
 * module instance as `resolveModel` (avoids duplicate `pi-model-discovery` resolutions).
 */
export { discoverAuthStorage, discoverModels } from "../pi-model-discovery.js";
