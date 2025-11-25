import { createStorage } from "../../../utils/localstorage/typed-localstorage";

export const ACCOUNT_SETTINGS = createStorage<{ sync1v1Challenges: boolean }>('ACCOUNT_SETTINGS', { sync1v1Challenges: true });
