import { sanitizeText } from "./security-service.js";

export function createForumService(storage) {
  function getPosts(category = "all") {
    return storage
      .get("forumPosts", [])
      .filter((post) => category === "all" || post.category === category)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((post) => ({
        ...post,
        comments: [...(post.comments || [])].sort((a, b) => b.createdAt - a.createdAt),
      }));
  }

  function addPost(payload) {
    const posts = storage.get("forumPosts", []);
    const post = {
      id: `post_${crypto.randomUUID().slice(0, 8)}`,
      title: sanitizeText(payload.title, 70),
      category: sanitizeText(payload.category, 20),
      content: sanitizeText(payload.content, 500),
      author: sanitizeText(payload.author || "匿名球友", 30),
      createdAt: Date.now(),
      comments: [],
    };
    posts.push(post);
    storage.set("forumPosts", posts);
    return post;
  }

  function addComment(postId, payload) {
    const posts = storage.get("forumPosts", []);
    const index = posts.findIndex((post) => post.id === postId);
    if (index < 0) {
      throw new Error("找不到文章");
    }

    const comment = {
      id: `comment_${crypto.randomUUID().slice(0, 8)}`,
      content: sanitizeText(payload.content, 220),
      author: sanitizeText(payload.author || "匿名球友", 30),
      createdAt: Date.now(),
    };

    posts[index].comments = [comment, ...(posts[index].comments || [])];
    storage.set("forumPosts", posts);
    return comment;
  }

  return {
    getPosts,
    addPost,
    addComment,
  };
}
