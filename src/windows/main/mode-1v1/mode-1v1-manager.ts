import { Mode1v1TimerChallenge, Mode1v1TimerTheme } from "@diesermerlin/fog-companion-web";
import { AppDB } from "../../../utils/indexeddb/AppDB";
import { useSession } from "../../../utils/trpc/use-session";
import { MODE_1V1_SYNC } from "./mode-1v1-sync";
import { trpcClient } from "../../../utils/trpc/trpc";
import { ACCOUNT_SETTINGS } from "../account/account-settings";
import { MODE_1V1_THEME } from "../../mode_1v1/mode_1v1-settings";

export class Mode1v1Manager {
  private appDb = AppDB;

  public static Instance(): Mode1v1Manager {
    return overwolf.windows.getMainWindow().cache.mode1v1ChallengeManager || (overwolf.windows.getMainWindow().cache.mode1v1Manager = new Mode1v1Manager());
  }

  private constructor() {
    this.init().then();
  }

  async init() {
    if (!(await this.appDb.mode1v1Challenges.count()))
      await this.createChallenge();

    this.scheduleSync();
    ACCOUNT_SETTINGS.hook.subscribe((s, p) => (s.sync1v1Challenges !== p.sync1v1Challenges || s.sync1v1Interval !== p.sync1v1Interval) && this.scheduleSync());
  }

  async createChallenge() {
    const now = Date.now();
    const challenge: Mode1v1TimerChallenge = {
      challengeId: self.crypto.randomUUID(),
      names: { opponent: '' },
      played: [{ gameId: self.crypto.randomUUID(), playedAt: now, kllrTime: 0, survTime: 0 }],
      startedAt: now,
      continuedAt: now,
      updatedAt: now,
      syncedAt: null,
    }
    await this.appDb.transaction('rw', this.appDb.mode1v1Challenges, async () => {
      await this.appDb.mode1v1Challenges.add(challenge);
    });
  }

  async continueChallenge(challenge: Mode1v1TimerChallenge) {
    const current = await this.currentChallenge();
    await this.appDb.transaction('rw', this.appDb.mode1v1Challenges, async () => {
      await this.appDb.mode1v1Challenges.upsert(challenge.challengeId, { ...challenge, continuedAt: Date.now() });
      if (current && !this.isCommittable(current)) await this.removeChallenge(current.challengeId);
    });
  }

  async updateChallenge(challenge: Mode1v1TimerChallenge) {
    console.log('updateChallenge', challenge);
    await this.appDb.transaction('rw', this.appDb.mode1v1Challenges, async () => {
      challenge.updatedAt = Date.now();
      await this.appDb.mode1v1Challenges.update(challenge.challengeId, challenge);
    });
  }

  async removeChallenge(challengeId: string) {
    await this.appDb.transaction('rw', this.appDb.mode1v1Challenges, async () => {
      await this.appDb.mode1v1Challenges.delete(challengeId);
    });
  }

  async addGame(challenge: Mode1v1TimerChallenge, auto?: true) {
    const currentGame = challenge.played[challenge.played.length - 1];

    const condition = auto ? (currentGame.kllrTime && currentGame.survTime) : (currentGame.kllrTime || currentGame.survTime);
    if (!currentGame || condition) challenge.played.push({ gameId: self.crypto.randomUUID(), playedAt: Date.now(), kllrTime: 0, survTime: 0 });

    await this.updateChallenge(challenge);
    return challenge;
  }

  async currentChallenge() {
    return await this.appDb.mode1v1Challenges.orderBy('startedAt').reverse().first();
  }

  isCommittable(challenge: Mode1v1TimerChallenge) {
    return challenge.played.some(c => !!c.kllrTime || !!c.survTime);
  }

  async commit(challenge: Mode1v1TimerChallenge) {
    if (!this.isCommittable(challenge)) return false;
    challenge.played = challenge.played.filter(g => !!g.kllrTime || !!g.survTime);
    await this.updateChallenge(challenge);
    await this.createChallenge();
    return true;
  }

  private syncTimeout: NodeJS.Timeout;
  private syncLock = false;
  async syncCycle() {
    if (this.syncLock) return;
    this.syncLock = true;

    if (this.syncTimeout) clearTimeout(this.syncTimeout);

    try {
      if (ACCOUNT_SETTINGS.getValue().sync1v1Challenges && !!useSession.getState().session?.user) {
        const update = [] as Mode1v1TimerChallenge[];

        await AppDB.transaction('r', [AppDB.mode1v1Challenges], async () => {
          await AppDB.mode1v1Challenges.each(async obj => {
            if (obj.syncedAt >= obj.updatedAt) return;
            update.push(obj);
          });
        });

        // Fix old challenges
        for (const challenge of update) {
          let updated = false;
          if (!challenge.syncedAt) { challenge.syncedAt = 1; updated = true; }
          challenge.played.forEach(p => {
            if (!p.playedAt) { p.playedAt = Date.now(); updated = true; }
            if (!p.gameId) { p.gameId = self.crypto.randomUUID(); updated = true; }
          })
          if (updated)
            await this.updateChallenge(challenge);
        }

        for (const challenge of update) {
          try {
            MODE_1V1_SYNC.update({ syncing: challenge.challengeId });
            await new Promise<void>(res => setTimeout(res, 1000));

            const updated = await trpcClient().mode1v1.challenges.sync.mutate(challenge);

            await AppDB.transaction('rw', [AppDB.mode1v1Challenges], async () => {
              AppDB.mode1v1Challenges.update(challenge.challengeId, { syncError: !updated, ...(updated ? { syncedAt: new Date(updated.syncedAt).getTime() } : {}) });
            })
          } catch (e) {
            await AppDB.transaction('rw', [AppDB.mode1v1Challenges], async () => {
              AppDB.mode1v1Challenges.update(challenge.challengeId, { syncError: true });
            })
          } finally {
            MODE_1V1_SYNC.update({ syncing: null });
          }
        }
      }
    } finally {
      this.syncLock = false;
      MODE_1V1_SYNC.update({ syncing: null });
      this.scheduleSync();
    }
  }

  scheduleSync() {
    if (this.syncTimeout) clearTimeout(this.syncTimeout);
    this.syncTimeout = setTimeout(() => this.syncCycle(), ACCOUNT_SETTINGS.getValue().sync1v1Interval);
  }

  themes() {
    return AppDB.mode1v1Themes.orderBy('updatedAt').reverse().toArray();
  }

  saveTheme(theme: Mode1v1TimerTheme) {
    const now = Date.now();
    return AppDB.transaction('rw', AppDB.mode1v1Themes, async () => {
      const existing = await AppDB.mode1v1Themes.get(theme.themeId);
      if (existing) return await AppDB.mode1v1Themes.update(theme.themeId, { ...theme, updatedAt: now, newestVersion: theme.versionId });
      else return await AppDB.mode1v1Themes.add({ ...theme, addedAt: now, updatedAt: now, newestVersion: theme.versionId });
    });
  }

  removeTheme(themeId: string) {
    if (MODE_1V1_THEME.getValue().theme?.themeId === themeId) MODE_1V1_THEME.update({ theme: null });
    return AppDB.mode1v1Themes.delete(themeId);
  }

  putNewestThemeVersion(themeId: string, versionId: string) {
    return AppDB.mode1v1Themes.update(themeId, { newestVersion: versionId });
  }

  fetchThemeUpdates() {
    // TODO implement
  }

  updateTheme(themeId: string) {
    // TODO implement
  }
}
