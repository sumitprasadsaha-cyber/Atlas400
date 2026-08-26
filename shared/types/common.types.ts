export type EntityId = string;

export interface BaseEntity {
  id: EntityId;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface AsyncState<T, E = string> {
  status: AsyncStatus;
  data: T | null;
  error: E | null;
}
