import { Mode1v1TimerChallenge } from "@diesermerlin/fog-companion-web";
import { AppDB } from "../../../utils/indexeddb/AppDB";
import { useSession } from "../../../utils/trpc/use-session";
import { MODE_1V1_SYNC } from "./mode-1v1-sync";
import { trpcClient } from "../../../utils/trpc/trpc";
import { ACCOUNT_SETTINGS } from "../account/account-settings";

export class Mode1v1ChallengeManager {
  private appDb = AppDB;

  public static Instance(): Mode1v1ChallengeManager {
    return overwolf.windows.getMainWindow().cache.mode1v1ChallengeManager || (overwolf.windows.getMainWindow().cache.mode1v1ChallengeManager = new Mode1v1ChallengeManager());
  }

  private constructor() {
    this.init().then();
  }

  async init() {
    if (!(await this.appDb.mode1v1Challenges.count()))
      await this.createChallenge();

    useSession.subscribe(async (s, p) => {
      if (s.session?.user?.mainAuth.displayName && s.session?.user?.mainAuth.displayName !== p.session?.user?.mainAuth.displayName)
        await this.updateSelfName(s.session.user.mainAuth.displayName);
    });

    if (useSession.getState().session?.user) await this.updateSelfName(useSession.getState().session?.user?.mainAuth.displayName);

    this.startSyncing();
  }

  async updateSelfName(name: string) {
    await this.appDb.transaction('rw', this.appDb.mode1v1Challenges, async () => {
      await this.appDb.mode1v1Challenges.each(async challenge => {
        if (!challenge.names.self) {
          await this.appDb.mode1v1Challenges.update(challenge.challengeId, { ...challenge, names: { ...challenge.names, self: name } });
        }
      });
    });
  }

  async createChallenge() {
    const now = Date.now();
    const challenge: Mode1v1TimerChallenge = {
      challengeId: self.crypto.randomUUID(),
      names: { opponent: '', self: useSession.getState().session?.user?.mainAuth?.displayName || '' },
      played: [{ kllrTime: 0, survTime: 0 }],
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
    await this.appDb.transaction('rw', this.appDb.mode1v1Challenges, async () => {
      await this.appDb.mode1v1Challenges.upsert(challenge.challengeId, { ...challenge, continuedAt: Date.now() });
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

  async currentChallenge() {
    return await this.appDb.mode1v1Challenges.orderBy('startedAt').reverse().first();
  }

  private syncTimeout: NodeJS.Timeout;
  private syncLock = false;
  async startSyncing() {
    if (this.syncLock) return;
    this.syncLock = true;

    if (this.syncTimeout) clearTimeout(this.syncTimeout);

    try {
      if (ACCOUNT_SETTINGS.getValue().sync1v1Challenges) {
        const update = [] as Mode1v1TimerChallenge[];

        await AppDB.transaction('r', [AppDB.mode1v1Challenges], async () => {
          await AppDB.mode1v1Challenges.each(async obj => {
            if (obj.syncedAt >= obj.updatedAt) return;
            update.push(obj);
          });
        })

        for (const challenge of update) {
          try {
            MODE_1V1_SYNC.update({ syncing: challenge.challengeId });
            await new Promise<void>(res => setTimeout(res, 1000));

            if (!challenge.syncedAt) challenge.syncedAt = 1;
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
      this.syncTimeout = setTimeout(() => this.startSyncing(), 10_000);
    }
  }
}
