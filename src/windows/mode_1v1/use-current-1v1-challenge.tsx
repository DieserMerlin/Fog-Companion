import { useLiveQuery } from "dexie-react-hooks";
import { AppDB } from "../../utils/indexeddb/AppDB";

export const useCurrent1v1Challenge = () => {
  return useLiveQuery(() => AppDB.mode1v1Challenges.orderBy('continuedAt').reverse().first());
};
