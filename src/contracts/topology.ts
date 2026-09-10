export const RABBITMQ = {
  exchange: "newsfeed.events",
  queues: {
    fanout: "feed.fanout",
    cleanup: "feed.cleanup",
    rebuild: "feed.rebuild",
    deadLetter: "feed.dlq",
  },
  routingKeys: {
    postCreated: "post.created",
    userFollowed: "user.followed",
    userUnfollowed: "user.unfollowed",
    timelineRebuild: "timeline.rebuild",
  },
} as const;

export const redisKeys = {
  timeline: (userId: string): string => `timeline:${userId}`,
  authorPosts: (userId: string): string => `author_posts:${userId}`,
} as const;
