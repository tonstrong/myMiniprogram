export interface UserProfileRepository {
  findById(id: string): Promise<unknown>;
}
