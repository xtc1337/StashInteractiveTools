const api = window.PluginApi;

const {
  React,
  libraries,
  hooks,
  GQL,
  patch,
  utils,
  components,
  loadableComponents,
} = api;
const Apollo = libraries.Apollo;
const gql = Apollo.gql;
export type InteractiveAPI = ReturnType<
  typeof hooks.useInteractive
>['interactive'];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Any = any;

export {
  React,
  libraries,
  hooks,
  GQL,
  patch,
  utils,
  Apollo,
  gql,
  components,
  loadableComponents,
};
