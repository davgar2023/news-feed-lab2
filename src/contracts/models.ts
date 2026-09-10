export interface User {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface TimelinePage {
  items: Post[];
  nextCursor: string | null;
}
