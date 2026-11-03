/** Resolve callable CJS defaults under Node and Forge webpack ESM interop. */
export function resolveDefaultExport(mod) {
  return typeof mod.default === 'function' ? mod.default : mod.default?.default;
}

/** Resolve named exports under Node and Forge webpack CJS namespace shapes. */
export function resolveNamedExport(mod, name) {
  if (mod[name] !== undefined) return mod[name];
  if (mod.default?.[name] !== undefined) return mod.default[name];
  return mod.default?.default?.[name];
}
