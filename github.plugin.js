const githubPlugin = require('@semantic-release/github');

module.exports = {
  verifyConditions: async (pluginConfig, context) => {
    return githubPlugin.verifyConditions(pluginConfig, context);
  },
  publish: async (pluginConfig, context) => {
    const { nextRelease } = context;
    pluginConfig.assets = [
      { path: `./dist/StashInteractiveTools-${nextRelease.version}.zip` },
    ];
    return githubPlugin.publish(pluginConfig, context);
  },
  addChannel: async (pluginConfig, context) => {
    return githubPlugin.addChannel(pluginConfig, context);
  },
  success: async (pluginConfig, context) => {
    return githubPlugin.success(pluginConfig, context);
  },
  fail: async (pluginConfig, context) => {
    return githubPlugin.fail(pluginConfig, context);
  },
};
