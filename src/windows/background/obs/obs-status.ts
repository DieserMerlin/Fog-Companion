import { createStorage } from '../../../utils/localstorage/typed-localstorage';

export type ObsConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type ObsStatusStore = {
  status: ObsConnectionStatus;
  error: string | null;
};

export const OBS_STATUS = createStorage<ObsStatusStore>('OBS_STATUS', {
  status: 'disconnected',
  error: null,
});
