import { createStorage } from "../../../utils/localstorage/typed-localstorage";

export const ACCOUNT_SETTINGS = createStorage<{ sync1v1Challenges: boolean, sync1v1Interval: number }>('ACCOUNT_SETTINGS', { sync1v1Challenges: true, sync1v1Interval: 10_000 });
