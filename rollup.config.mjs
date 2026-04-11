// rollup.config.js
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import scss from 'rollup-plugin-scss';
import terser from '@rollup/plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import copy from 'rollup-plugin-copy';
import json from '@rollup/plugin-json';
import zip from 'rollup-plugin-zip';
import fs from 'fs';
import path from 'path';
import strip from '@rollup/plugin-strip';
import semanticRelease from 'semantic-release';
import replace from '@rollup/plugin-replace';
import YAML from 'yaml';
import debug from 'debug';
import 'dotenv/config';
import { Writable } from 'stream';

debug.enable('semantic-release:*');

const ASSETS_TO_OMIT = [
  'payload.json',
  'stash_interactive_tools.db',
  '__pycache__',
];
const META_FILE_PATH = path.resolve('./dist/StashInteractiveTools.yml');
const nullWriteStream = new Writable({
  write(chunk, encoding, callback) {
    // Do nothing with the chunk
    callback();
  },
});
const MANIFEST_ERROR_LOG = {
  main: 'info',
  next: 'trace',
  alpha: 'trace',
};

function updateMetadataVersionPlugin() {
  return {
    name: 'update-metadata-version-plugin',
    generateBundle: {
      sequential: true,
      order: 'pre',
      handler: async (_, bundle) => {
        const results = await semanticRelease(
          {
            debug: true,
            dryRun: true,

            branches: [
              { name: 'main' },
              { name: 'next', prerelease: true },
              { name: 'alpha', prerelease: true },
            ],
            plugins: [
              [
                '@semantic-release/commit-analyzer',
                {
                  preset: 'conventionalcommits',
                  releaseRules: [
                    { type: 'build', release: 'patch' },
                    { type: 'docs', scope: 'README', release: 'patch' },
                    { type: 'refactor', release: 'patch' },
                    { type: 'style', release: 'patch' },
                  ],
                },
              ],
            ],
          },
          {
            stdout: process.stdout,
            error: process.stderr,
          },
        );
        if (!results) {
          console.log(`Skipping updating ${META_FILE_PATH}`);
          return;
        }
        console.log(
          `Updating ${META_FILE_PATH} -> ${results.nextRelease.version}`,
        );

        const value = {
          ...YAML.parse(fs.readFileSync(META_FILE_PATH, 'utf8')),
          errLog: MANIFEST_ERROR_LOG[results.nextRelease.channel],
          version: results.nextRelease.version,
        };
        for (const [fileName, chunkOrAsset] of Object.entries(bundle)) {
          if (
            chunkOrAsset.type === 'asset' &&
            fileName === 'StashInteractiveTools.yml'
          ) {
            chunkOrAsset.source = YAML.stringify(value);
          }
        }
        // fs.writeFileSync(META_FILE_PATH, YAML.stringify(value));
      },
    },
  };
}
function emitAssetsPlugin(assetsDir) {
  return {
    name: 'mark-assets',
    buildStart() {
      const walk = (dir) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (ASSETS_TO_OMIT.includes(entry.name)) continue;

          if (entry.isDirectory()) {
            walk(fullPath);
          } else {
            this.addWatchFile(fullPath);
            const relativePath = path.relative(assetsDir, fullPath);
            this.emitFile({
              type: 'asset',
              source: fs.readFileSync(fullPath),
              fileName: relativePath, // preserve folder structure
            });
          }
        }
      };

      walk(assetsDir);
    },
  };
}

const prod = process.env.NODE_ENV === 'production';

const OMITS = [
  'payload.json',
  'stash_interactive_tools.db',
  '**/__pycache__',
  '**.pyc',
];
const TO_COPY = ['assets', 'assets/tasks', 'assets/tasks/migrations'];

const plugins = [
  peerDepsExternal(),
  resolve({
    browser: true,
  }),
  commonjs(),
  typescript({ tsconfig: './tsconfig.json' }),
  terser(),
  json(),
  copy({
    targets: [
      {
        src: [
          'assets/**',
          '!assets/payload.json',
          '!assets/stash_interactive_tools.db',
          '!assets/tasks',
          '!assets/migrations',
          '!assets/**/__pycache__',
          '!assets/**/*.pyc',
        ],

        dest: 'dist/',
      },
      {
        src: [
          'assets/tasks/**',
          '!assets/tasks/**/__pycache__',
          '!assets/tasks/**/*.pyc',
        ],
        dest: 'dist/tasks',
      },
      {
        src: [
          'assets/migrations/**',
          '!assets/migrations/**/__pycache__',
          '!assets/migrations/**/*.pyc',
        ],
        dest: 'dist/migrations',
      },
    ],
  }),
  scss({
    name: 'index.css',
    fileName: 'index.css',
  }), //
  emitAssetsPlugin('assets'),
  replace({
    preventAssignment: true,
    'process.env.HANDY_APPLICATION_ID': JSON.stringify(
      process.env.HANDY_APPLICATION_ID,
    ),
    'process.env.NODE_ENV': JSON.stringify(
      process.env.NODE_ENV || 'development',
    ),
    'process.env.DEBUG': JSON.stringify(!prod),
  }),
];

if (prod) {
  plugins.push(updateMetadataVersionPlugin());
  plugins.push(zip({ file: 'StashInteractiveTools.zip' }));
  plugins.push(strip({}));
}

/**
 * @type {import('rollup').RollupOptions[]}
 */
export default [
  {
    input: 'src/index.tsx',
    cache: prod,

    output: [
      {
        banner: `(function StashInteractiveTools_init(w){
        var window = w;
        const require = function(name){
           let  value = typeof window.require === 'function' ? window.require(name) : undefined;
           if(value) return value;
           return {
             'global/window':window,
            'global/document':window.document,
           "react":window.PluginApi.React,
           "react-dom":window.PluginApi.ReactDOM,
           "thehandy":window.PluginApi.libraries.TheHandy,
           "video.js":window.PluginApi.libraries.videojs,
           "react-bootstrap":window.PluginApi.libraries.Bootstrap,
           "react-intl": window.PluginApi.libraries.Intl,
           '@apollo/client':window.PluginApi.libraries.Apollo,           
           '@fortawesome/free-regular-svg-icons':window.PluginApi.libraries.FontAwesomeRegular,
           '@fortawesome/free-solid-svg-icons':window.PluginApi.libraries.FontAwesomeSolid,
           '@fortawesome/free-brands-svg-icons':window.PluginApi.libraries.FontAwesomeBrands,
           '@fortawesome/react-fontawesome':window.PluginApi.libraries.ReactFontAwesome,
          }[name];
        }`,
        //file: packageJson.main,
        dir: './dist',
        format: 'cjs',
        sourcemap: !prod,
        footer: `})(window);`,

        sourcemapBaseUrl: !prod
          ? 'http://localhost:9999/plugin/StashInteractiveTools/assets/'
          : '',
      },
    ],
    context: 'globalThis',
    plugins,

    external: [
      'react',
      'react-dom',
      'thehandy',
      'video.js',
      'react-bootstrap',
      'react-intl',
      '@apollo/client',
      '@fortawesome/free-regular-svg-icons',
      '@fortawesome/free-solid-svg-icons',
      '@fortawesome/free-brands-svg-icons',
      '@fortawesome/react-fontawesome',
    ],
  },
];
