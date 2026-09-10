export const EVENT_TYPES = {
  postCreated: "post.created",
  userFollowed: "user.followed",
  userUnfollowed: "user.unfollowed",
  timelineRebuild: "timeline.rebuild",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export interface DomainEvent<T = Record<string, unknown>> {
  eventId: string;
  eventType: EventType;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  payload: T;
}

export interface PostCreatedPayload {
  postId: string;
  authorId: string;
  createdAt: string;
}

export interface FollowChangedPayload {
  followerId: string;
  followedId: string;
}
