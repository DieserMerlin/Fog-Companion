import { createStorage } from "../../../utils/localstorage/typed-localstorage";

export const MODE_1V1_SYNC = createStorage<{ syncing: string | null }>('MODE_1V1_SYNC', { syncing: null });
