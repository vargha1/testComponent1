import { build, transform } from 'esbuild';
import { readFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const cssPlugin = {
  name: 'css-string',
  setup(b) {
    b.onLoad({ filter: /\.css$/ }, async (args) => {
      const { code } = await transform(readFileSync(args.path, 'utf8'), { loader: 'css', minify: true });
      return { contents: `export default ${JSON.stringify(code)};`, loader: 'js' };
    });
  },
};

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/cost-estimator.js',
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2020',
  legalComments: 'none',
  plugins: [cssPlugin],
});

mkdirSync('docs', { recursive: true });
copyFileSync('dist/cost-estimator.js', 'docs/cost-estimator.js');

const buf = readFileSync('dist/cost-estimator.js');
const gz = gzipSync(buf, { level: 9 }).length;
console.log(`cost-estimator.js: ${(buf.length / 1024).toFixed(1)} KB raw, ${(gz / 1024).toFixed(1)} KB gzip`);
if (gz > 30 * 1024) {
  console.error('Bundle exceeds 30 KB gzip budget');
  process.exit(1);
}
