import type { UserProfileRepository } from "./index";
import type { UserPreferenceRecord, UserRecord } from "./persistence";

export class InMemoryUserProfileRepository implements UserProfileRepository {
  private users = new Map<string, UserRecord>();
  private preferences = new Map<string, UserPreferenceRecord>();

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async saveUser(user: UserRecord): Promise<void> {
    this.users.set(user.id, user);
  }

  async savePreferences(preferences: UserPreferenceRecord): Promise<void> {
    this.preferences.set(preferences.userId, preferences);
  }

  async findPreferencesByUserId(
    userId: string
  ): Promise<UserPreferenceRecord | null> {
    return this.preferences.get(userId) ?? null;
  }
}

export const createInMemoryUserProfileRepository = (): UserProfileRepository =>
  new InMemoryUserProfileRepository();

export const createNoopUserProfileRepository = (): UserProfileRepository => ({
  async findById() {
    return null;
  },
  async saveUser() {
    return undefined;
  },
  async savePreferences() {
    return undefined;
  },
  async findPreferencesByUserId() {
    return null;
  }
});
