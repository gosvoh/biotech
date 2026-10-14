/** Plain data at the VK boundary. Never contains credentials or raw API errors. */
export interface VkGroup {
  id: string;
  name: string;
  screenName: string;
}

export interface VkPhoto {
  url: string;
}

export interface VkPost {
  id: string;
  ownerId: string;
  fromId: string;
  date: number;
  text: string;
  isRepost: boolean;
  isPinned: boolean;
  postType: string;
  photos: VkPhoto[];
}

export interface VkApi {
  getGroup(): Promise<VkGroup>;
  getWall(groupId: string, offset: number, count: number): Promise<{ items: VkPost[]; count: number }>;
  getPosts(groupId: string, postIds: string[]): Promise<VkPost[]>;
}

export interface PreparedVkImage {
  id: string;
  sortOrder: number;
}

export interface VkImageStore {
  prepare(photos: VkPhoto[], heartbeat?: () => Promise<void>): Promise<PreparedVkImage[]>;
  discard(images: PreparedVkImage[]): Promise<void>;
}

export interface VkImportCounts {
  added: number;
  skipped: number;
  failed: number;
}

export interface VkImportResult extends VkImportCounts {
  group: VkGroup;
  successful: boolean;
  startedAt: string;
  finishedAt: string;
  lastSuccessAt: string | null;
  error: string | null;
  reasons: { postId: string; reason: string }[];
}

export interface VkImportStatus {
  configured: boolean;
  source: string | null;
  group: VkGroup | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastResult: VkImportResult | null;
  error: string | null;
}
