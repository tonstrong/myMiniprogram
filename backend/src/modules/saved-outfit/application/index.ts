import type { PaginatedResult } from "../../../app/common/types";
import type { ClosetRepository } from "../../closet/infrastructure";
import type { SavedOutfitRepository } from "../infrastructure";

export interface SaveSavedOutfitSlots {
  top?: string;
  bottom?: string;
  dress?: string;
  outer?: string;
  shoes?: string;
  bag?: string;
  accessories?: string[];
}

export interface SaveSavedOutfitCommand {
  userId: string;
  sourceType: "canvas";
  slots: SaveSavedOutfitSlots;
}

export interface SaveSavedOutfitResult {
  savedOutfitId: string;
  createdAt: string;
}

export interface SavedOutfitHistoryItem {
  savedOutfitId: string;
  sourceType: string;
  createdAt: string;
  coverImageUrl?: string;
  itemCount: number;
}

export interface SavedOutfitListQuery {
  pageNo?: number;
  pageSize?: number;
}

export interface SavedOutfitService {
  save(command: SaveSavedOutfitCommand): Promise<SaveSavedOutfitResult>;
  list(
    userId: string,
    query: SavedOutfitListQuery
  ): Promise<PaginatedResult<SavedOutfitHistoryItem>>;
}

export interface SavedOutfitServiceDependencies {
  repository: SavedOutfitRepository;
  closetRepository: ClosetRepository;
}

export * from "./service";
