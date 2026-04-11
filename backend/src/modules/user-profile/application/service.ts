import { randomUUID } from "crypto";
import type { JsonValue } from "../../../app/common/persistence";
import type { UserProfileRepository } from "../infrastructure";
import {
  createInMemoryUserProfileRepository,
  mapUpdateUserProfileCommandToRecordPatch,
  mapUserProfileRecordsToSnapshot
} from "../infrastructure";
import type {
  UpdateUserProfileCommand,
  UserProfileService,
  UserProfileSnapshot
} from "./index";

export interface UserProfileServiceDependencies {
  repository: UserProfileRepository;
}

export class InMemoryUserProfileService implements UserProfileService {
  constructor(private readonly deps: UserProfileServiceDependencies) {}

  async getProfile(userId: string): Promise<UserProfileSnapshot> {
    const user = await this.deps.repository.findById(userId);
    const preferences = await this.deps.repository.findPreferencesByUserId(userId);

    if (!user) {
      return {
        userId,
        nickname: undefined,
        avatarUrl: undefined,
        stylePreferences: [],
        bodyPreferences: [],
        city: preferences?.city ?? undefined,
        defaultTemperatureSensitivity:
          preferences?.temperatureSensitivity ?? undefined
      };
    }

    return mapUserProfileRecordsToSnapshot(user, preferences);
  }

  async updateProfile(
    command: UpdateUserProfileCommand
  ): Promise<UserProfileSnapshot> {
    const existingUser = await this.ensureUser(command.userId);
    const existingPreferences = await this.deps.repository.findPreferencesByUserId(
      command.userId
    );
    const { userPatch, preferencePatch } =
      mapUpdateUserProfileCommandToRecordPatch(command);
    const now = new Date();

    await this.deps.repository.saveUser({
      ...existingUser,
      ...userPatch,
      wechatOpenId: existingUser.wechatOpenId,
      unionId: existingUser.unionId ?? null,
      nickname: userPatch.nickname ?? existingUser.nickname,
      avatarUrl:
        userPatch.avatarUrl !== undefined ? userPatch.avatarUrl : existingUser.avatarUrl,
      status: existingUser.status,
      createdAt: existingUser.createdAt,
      updatedAt: now
    });

    await this.deps.repository.savePreferences({
      id: existingPreferences?.id ?? generateId(),
      userId: command.userId,
      stylePreferences:
        preferencePatch.stylePreferences !== undefined
          ? (preferencePatch.stylePreferences as JsonValue)
          : existingPreferences?.stylePreferences,
      bodyPreferences:
        preferencePatch.bodyPreferences !== undefined
          ? (preferencePatch.bodyPreferences as JsonValue)
          : existingPreferences?.bodyPreferences,
      city:
        preferencePatch.city !== undefined
          ? preferencePatch.city
          : existingPreferences?.city,
      temperatureSensitivity:
        preferencePatch.temperatureSensitivity !== undefined
          ? preferencePatch.temperatureSensitivity
          : existingPreferences?.temperatureSensitivity,
      createdAt: existingPreferences?.createdAt ?? now,
      updatedAt: now
    });

    return this.getProfile(command.userId);
  }

  private async ensureUser(userId: string) {
    const existing = await this.deps.repository.findById(userId);
    if (existing) {
      return existing;
    }

    const now = new Date();
    const user = {
      id: userId,
      wechatOpenId: `dev:${userId}`,
      unionId: null,
      nickname: `User ${userId.slice(0, 8)}`,
      avatarUrl: null,
      status: "active" as const,
      createdAt: now,
      updatedAt: now
    };

    await this.deps.repository.saveUser(user);
    return user;
  }
}

export function createUserProfileService(
  deps: UserProfileServiceDependencies
): UserProfileService {
  return new InMemoryUserProfileService(deps);
}

export function createInMemoryUserProfileService(): UserProfileService {
  return new InMemoryUserProfileService({
    repository: createInMemoryUserProfileRepository()
  });
}

function generateId(): string {
  try {
    return randomUUID();
  } catch (error) {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
