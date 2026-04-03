import { ApolloLink } from '@apollo/client';
import { ScenePaths } from './types';
import getClient = PluginApi.utils.StashService.getClient;

class WatchSceneUpdateLink extends ApolloLink {
  static instance: WatchSceneUpdateLink;
  scenePaths: ScenePaths = {};
  constructor() {
    super((operation, forward) => {
      console.log('operation', operation);
      return forward(operation).map((response) => {
        console.log('operation', operation);
        console.log('response', response);
        return response;
      });
    });
    WatchSceneUpdateLink.instance = this;
  }
}

const defaultClient = getClient();

const link = ApolloLink.concat(defaultClient.link, new WatchSceneUpdateLink());
defaultClient.setLink(link);

export const useSubscribeToSceneUpdates = (scenePaths: ScenePaths) => {
  const instance = WatchSceneUpdateLink.instance;
  instance.scenePaths = scenePaths;
};
