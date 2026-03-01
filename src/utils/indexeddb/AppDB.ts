import { Mode1v1TimerChallenge, Mode1v1TimerTheme } from "@diesermerlin/fog-companion-web";
import Dexie, { EntityTable } from "dexie";

export const AppDB = new Dexie('AppDatabase') as Dexie & {
  mode1v1Challenges: EntityTable<Mode1v1TimerChallenge & { syncError?: boolean }, 'challengeId'>;
  mode1v1Themes: EntityTable<Mode1v1TimerTheme & { addedAt: number, updatedAt: number, newestVersion: string }, 'themeId'>;
};

AppDB.version(2).stores({
  mode1v1Challenges: 'challengeId, startedAt, continuedAt',
});

AppDB.version(3).stores({
  mode1v1Challenges: 'challengeId, startedAt, continuedAt',
  mode1v1Themes: 'themeId, versionId, addedAt, updatedAt',
});
