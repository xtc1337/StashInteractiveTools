const path = require('path');
const {
  writeFile,
  createReadStream,
  renameSync,
  existsSync,
  unlinkSync,
} = require('fs-extra');
const { createHash } = require('crypto');

const CONFIGS = {
  '@semantic-release/changelog': {
    next: false,
  },
  '@semantic-release/git': {
    common: {
      message:
        'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
    },
    main: {
      assets: ['./stash.yml', './CHANGELOG.md'],
    },
    next: {
      assets: ['./stash-next.yml'],
    },
  },
};
function wrapPlugin(name) {
  const plugin = require(name);
  Object.keys(plugin).forEach((methodName) => {
    const defaultMethod = plugin[methodName];
    /**
     *
     * @param config
     * @param {import('semantic-release').PrepareContext } context
     * @returns {Promise<void>}
     */
    plugin[methodName] = async (config, context) => {
      const { branch, logger } = context;
      const branchConfig = CONFIGS[name]?.[branch.name];
      if (branchConfig === false) {
        logger.info(
          `${name}->${methodName} method is disabled when on branch=${branch.name}`,
        );
        // don't run for branch
        return;
      }
      logger.info(`invoking ${name}->${methodName} method`);
      config = {
        ...config,
        ...CONFIGS[methodName]?.common,
        ...branchConfig,
      };
      await defaultMethod.apply(plugin, [config, context]);
    };
  });

  return plugin;
}

const changelogPlugin = wrapPlugin('@semantic-release/changelog');
const gitPlugin = wrapPlugin('@semantic-release/git');
const YAML = require('yaml');

function getCurrentDate() {
  const date = new Date();
  const pad = (num) => String(num).padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());

  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Calculate SHA-256 hash of a file
 */
async function getFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

const zipPlugin = {
  prepare: async (pluginConfig, context) => {
    const { cwd, nextRelease, options, logger } = context;
    const stashFiles =
      context.branch.name === 'main' ? ['stash.yml'] : ['stash-next.yml'];

    const zipFile = path.resolve(cwd, 'dist', 'StashInteractiveTools.zip');

    const versionedZipFileName = `StashInteractiveTools-${nextRelease.version}.zip`;
    const downloadUrl = `${BASE_DOWNLOAD_URL}${nextRelease.gitTag}/${versionedZipFileName}`;
    const versionedZipFilePath = path.resolve(
      cwd,
      'dist',
      versionedZipFileName,
    );
    logger.info(`Renaming ${zipFile} to ${versionedZipFilePath}`);
    if (!options.dryRun) {
      if (existsSync(versionedZipFilePath)) {
        unlinkSync(versionedZipFilePath);
      }
      renameSync(zipFile, versionedZipFilePath);
    }

    const stashContents = {
      id: 'StashInteractiveTools',
      name: `Stash Interactive Tools (${context.branch.name})`,
      metadata: {
        description: 'Enhance your Stash Interactive experience',
      },
      version: nextRelease.version,
      date: getCurrentDate(),
      path: downloadUrl,
      sha256: await getFileSha256(versionedZipFilePath),
    };

    logger.info(
      `Updated stash.yml \nversion:${stashContents.version}\npath:${downloadUrl}\n${stashContents.sha256}`,
    );
    if (!options.dryRun) {
      await Promise.all(
        stashFiles.map(async (stashFile) => {
          await writeFile(
            path.resolve(cwd, stashFile),
            YAML.stringify([stashContents]),
          );
        }),
      );
    } else {
      logger.info();
    }
  },
};

const BASE_DOWNLOAD_URL =
  'https://github.com/blackx69/StashInteractiveTools/releases/download/';
module.exports = {
  verifyConditions: async (pluginConfig, context) => {
    await changelogPlugin.verifyConditions(pluginConfig, context);
    await gitPlugin.verifyConditions(pluginConfig, context);
  },
  /**
   *
   * @param { {stashFile:string} } pluginConfig
   * @param {import('semantic-release').PrepareContext } context
   * @returns {Promise<void>}
   */
  prepare: async (pluginConfig, context) => {
    await changelogPlugin.prepare(pluginConfig, context);
    await zipPlugin.prepare(pluginConfig, context);
    await gitPlugin.prepare(pluginConfig, context);
  },
};
