export const DATABASE_ROUTINES = {
  users: {
    createUser: "pkg_users.create_user",
    getUser: "pkg_users.get_user",
    followUser: "pkg_users.follow_user",
    unfollowUser: "pkg_users.unfollow_user",
    getFollowers: "pkg_users.get_followers",
    getFollowing: "pkg_users.get_following",
    countFollowers: "pkg_users.count_followers",
    isFollowing: "pkg_users.is_following",
    getCelebrityFollowing: "pkg_users.get_celebrity_following",
  },
  posts: {
    createPost: "pkg_posts.create_post",
    getPost: "pkg_posts.get_post",
    getUserPosts: "pkg_posts.get_user_posts",
    getRecentPosts: "pkg_posts.get_recent_posts",
    deletePost: "pkg_posts.delete_post",
  },
  feed: {
    validateFeedItems: "pkg_feed.validate_feed_items",
  },
  outbox: {
    getPendingEvents: "pkg_outbox.get_pending_events",
    markPublished: "pkg_outbox.mark_published",
    markFailed: "pkg_outbox.mark_failed",
    tryProcessEvent: "pkg_outbox.try_process_event",
  },
  seed: {
    generateMockData: "pkg_lab_seed.generate_mock_data",
  },
} as const;

export const APPROVED_DATABASE_SCHEMAS = [
  "pkg_users",
  "pkg_posts",
  "pkg_feed",
  "pkg_outbox",
  "pkg_lab_seed",
] as const;
