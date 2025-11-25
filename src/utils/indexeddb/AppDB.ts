import { Mode1v1TimerChallenge } from "@diesermerlin/fog-companion-web";
import Dexie, { EntityTable } from "dexie";

export const AppDB = new Dexie('AppDatabase') as Dexie & {
  mode1v1Challenges: EntityTable<Mode1v1TimerChallenge & {syncError?: boolean}, 'challengeId'>;
};

AppDB.version(2).stores({
  mode1v1Challenges: 'challengeId, startedAt, continuedAt',
});
