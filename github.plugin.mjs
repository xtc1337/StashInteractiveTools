import * as githubPlugin from '@semantic-release/github';

export async function verifyConditions(pluginConfig, context) {
  return githubPlugin.verifyConditions(pluginConfig, context);
}
export async function publish(pluginConfig, context) {
  const { nextRelease } = context;
  pluginConfig.assets = [
    { path: `./dist/StashInteractiveTools-${nextRelease.version}.zip` },
  ];
  return githubPlugin.publish(pluginConfig, context);
}
export async function addChannel(pluginConfig, context) {
  return githubPlugin.addChannel(pluginConfig, context);
}
export async function success(pluginConfig, context) {
  return githubPlugin.success(pluginConfig, context);
}
export async function fail(pluginConfig, context) {
  return githubPlugin.fail(pluginConfig, context);
}
