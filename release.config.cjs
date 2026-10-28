require('dotenv').config();
/**
 * @type {import('semantic-release').GlobalConfig}
 */
module.exports = {
  branches: [
    'main',
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
          // forced releases from the release workflow
          { type: 'release', scope: 'patch', release: 'patch' },
          { type: 'release', scope: 'minor', release: 'minor' },
          { type: 'release', scope: 'major', release: 'major' },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        host: 'github.com',
        preset: 'conventionalcommits',
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'chore', hidden: true },
            { type: 'docs', hidden: true },
            { type: 'style', hidden: true },
            { type: 'refactor', hidden: false },
            { type: 'perf', hidden: true },
            { type: 'test', hidden: true },
          ],
        },
      },
    ],

    ['./release.plugin.js'],

    [
      './github.plugin.mjs',
      {
        assets: [{ path: './dist/StashInteractiveTools-*.zip' }],
      },
    ],
  ],
};
