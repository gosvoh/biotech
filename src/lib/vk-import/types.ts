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
  lookupPosts?(groupId: string, postIds: string[]): Promise<VkPostLookup>;
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
  /** The explicit normal check is durable and will be retried by the worker. */
  queued?: boolean;
  sync?: VkSyncResult;
  group: VkGroup;
  successful: boolean;
  startedAt: string;
  finishedAt: string;
  lastSuccessAt: string | null;
  error: string | null;
  reasons: { postId: string; reason: string }[];
}

export interface VkImportStatus {
  lastSyncAt?: string | null;
  lastSyncResult?: VkSyncResult | null;
  configured: boolean;
  source: string | null;
  group: VkGroup | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastResult: VkImportResult | null;
  error: string | null;
}

export interface VkPostLookup {
  items: VkPost[];
  deletedIds: string[];
  ambiguousIds: string[];
}

export interface VkSelectionBasis { name: string; tagId: string }

export interface VkSyncResult {
  group: VkGroup;
  checked: number;
  updated: number;
  hidden: number;
  restored: number;
  failed: number;
  successful: boolean;
  startedAt: string;
  finishedAt: string;
  error: string | null;
}

export interface VkNewsState {
  groupId: string;
  postId: string;
  syncEnabled: boolean;
  manualHidden: boolean;
  manualDeleted: boolean;
  autoHiddenReason: string | null;
  lastCheckedAt: string | null;
  lastCheckError: string | null;
}

export interface VkHistoryState {
  id: string;
  groupId: string;
  from: string;
  to: string;
  initial: boolean;
  state: "queued" | "running" | "waiting" | "completed";
  processed: number;
  added: number;
  updated: number;
  hidden: number;
  restored: number;
  skipped: number;
  failed: number;
  queued: number;
  lastSuccessAt: string | null;
  error: string | null;
}
export type VkHistoryFilter = "all" | "skipped" | "failed";
export interface VkHistoryDetail {
  postId: string;
  sourceUrl: string | null;
  state: string;
  outcome: string | null;
  reasonCode: string | null;
  reasonText: string;
}
export interface VkHistoryDetailsPage {
  items: VkHistoryDetail[];
  total: number;
  page: number;
  pageSize: 20;
}
export interface VkAutomationState {
 manualCheckPending?: boolean;
 groupId: string | null;
 enabled: boolean;
 initialHistoryId: string | null;
 initialState: VkHistoryState | null;
 lastNewAt: string | null;
 lastSyncAt: string | null;
 nextNewAt: string | null;
 nextSyncAt: string | null;
 lastWorkerAt: string | null;
 error: string | null;
 running: boolean;
 queued: boolean;
}
