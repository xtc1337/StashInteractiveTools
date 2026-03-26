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

import 'dotenv/config';
import { Writable } from 'stream';

const ASSETS_TO_OMIT = ['payload.json'];
const META_FILE_PATH = 'dist/StashInteractiveTools.yml';
const nullWriteStream = new Writable({
  write(chunk, encoding, callback) {
    // Do nothing with the chunk
    callback();
  },
});

function updateMetadataVersionPlugin() {
  return {
    name: 'update-metadata-version-plugin',
    async buildEnd() {
      const results = await semanticRelease(
        {
          dryRun: false,

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
                  { type: 'docs', scope: 'README', release: 'patch' },
                  { type: 'refactor', release: 'patch' },
                  { type: 'style', release: 'patch' },
                ],
              },
            ],
          ],
        },
        {
          stdout: nullWriteStream,
          error: nullWriteStream,
        },
      );
      if (!results) {
        console.log('Skipping updating dist/StashInteractiveTools.yml');
        return;
      }
      console.log(
        `Updating StashInteractiveTools.yml -> ${results.nextRelease.version}`,
      );

      fs.writeFileSync(
        META_FILE_PATH,
        YAML.stringify({
          ...YAML.parse(fs.readFileSync(META_FILE_PATH, 'utf8')),
          version: results.nextRelease.version,
        }),
      );
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
        src: ['assets/**', '!assets/payload.json', '!assets/tasks'],

        dest: 'dist/',
      },
      {
        src: ['assets/tasks/**'],
        dest: 'dist/tasks',
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
