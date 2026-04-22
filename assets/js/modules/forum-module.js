import { createNode, formatDateTime, renderList } from "../ui/dom.js";

const categoryText = {
  strategy: "戰術討論",
  equipment: "裝備心得",
  training: "訓練分享",
  general: "閒聊",
};

export function initForumModule({ forumService, memberService, notify, rateLimiter, postLimit }) {
  const form = document.querySelector("#forum-post-form");
  const list = document.querySelector("#forum-posts");

  function renderPosts() {
    const posts = forumService.getPosts();
    if (!posts.length) {
      list.innerHTML = "<p class='hint'>目前還沒有文章，歡迎發第一篇！</p>";
      return;
    }

    const nodes = posts.map((post) => {
      const node = createNode("article", "list-item");
      node.append(
        createNode("h4", null, post.title),
        createNode("p", "hint", `${categoryText[post.category] || post.category}｜${post.author}｜${formatDateTime(post.createdAt)}`),
        createNode("p", null, post.content)
      );

      const comments = createNode("div", "list");
      const commentTitle = createNode("p", "hint", `留言 ${post.comments?.length || 0} 則`);
      comments.append(commentTitle);

      (post.comments || []).forEach((comment) => {
        const commentNode = createNode("div", "list-item");
        commentNode.append(
          createNode("p", null, comment.content),
          createNode("p", "hint", `${comment.author}｜${formatDateTime(comment.createdAt)}`)
        );
        comments.append(commentNode);
      });

      const commentForm = document.createElement("form");
      commentForm.className = "inline-form";
      commentForm.dataset.postId = post.id;

      const input = document.createElement("input");
      input.name = "content";
      input.required = true;
      input.maxLength = 220;
      input.placeholder = "留言給這篇文章";

      const button = createNode("button", "btn-secondary", "送出留言");
      button.type = "submit";

      commentForm.append(input, button);
      comments.append(commentForm);

      node.append(comments);
      return node;
    });

    renderList(list, nodes);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const currentUser = memberService.getCurrentUser();
    const authorId = currentUser?.id || "anon";
    if (!rateLimiter.hit(`forum:${authorId}`, postLimit, 60_000)) {
      notify("發文過於頻繁，請稍後再試");
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    forumService.addPost({
      ...data,
      author: currentUser?.name || "匿名球友",
    });

    form.reset();
    renderPosts();
    notify("文章已發布");
  });

  list.addEventListener("submit", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLFormElement) || !target.dataset.postId) {
      return;
    }

    event.preventDefault();

    const currentUser = memberService.getCurrentUser();
    const authorId = currentUser?.id || "anon";
    if (!rateLimiter.hit(`comment:${authorId}`, postLimit * 2, 60_000)) {
      notify("留言過於頻繁，請稍後再試");
      return;
    }

    const data = Object.fromEntries(new FormData(target).entries());
    forumService.addComment(target.dataset.postId, {
      ...data,
      author: currentUser?.name || "匿名球友",
    });

    renderPosts();
  });

  renderPosts();

  return {
    refresh() {
      renderPosts();
    },
  };
}
