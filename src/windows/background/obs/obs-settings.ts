import { createStorage } from '../../../utils/localstorage/typed-localstorage';

export type ObsConnectionSettings = {
  host: string;
  port: number;
  password: string;
  enabled: boolean;
};

export const OBS_SETTINGS = createStorage<ObsConnectionSettings>('OBS_SETTINGS', {
  host: 'localhost',
  port: 4455,
  password: '',
  enabled: false,
});
