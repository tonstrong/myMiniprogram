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

export interface SavedOutfitService {
  save(command: SaveSavedOutfitCommand): Promise<SaveSavedOutfitResult>;
}

export interface SavedOutfitServiceDependencies {
  repository: SavedOutfitRepository;
  closetRepository: ClosetRepository;
}

export * from "./service";
