// Minimal ESM loader hook so plain `node` can resolve this repo's `@/foo`
// path alias (defined in jsconfig.json for the Next.js/webpack build) when
// running a unit test file directly, without pulling in the full Next.js
// toolchain. Registered via `--experimental-loader` on the node invocation
// in the test's own file header comment.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..', '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const rest = specifier.slice(2);
    const withExt = rest.endsWith('.js') ? rest : `${rest}.js`;
    const resolved = pathToFileURL(path.join(root, withExt)).href;
    return nextResolve(resolved, context);
  }
  return nextResolve(specifier, context);
}
