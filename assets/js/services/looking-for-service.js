export function createLookingForService(storage, matchRecordService) {
  const KEY = "looking_for_posts";

  function getPosts() {
    return storage.get(KEY, []).sort((a, b) => b.createdAt - a.createdAt);
  }

  function getActivePosts() {
    const now = Date.now();
    return getPosts().filter(
      (p) => p.status === "open" && new Date(p.deadline).getTime() > now
    );
  }

  function getPostById(postId) {
    return getPosts().find((p) => p.id === postId) ?? null;
  }

  function createPost({ authorId, authorName, criteria, deadline, note }) {
    const post = {
      id: `lf_${crypto.randomUUID().slice(0, 8)}`,
      authorId,
      authorName,
      note: String(note || "").slice(0, 200),
      criteria: {
        gender: criteria.gender || "all",
        city: criteria.city || "all",
        minNtrp: criteria.minNtrp ? Number(criteria.minNtrp) : null,
        maxNtrp: criteria.maxNtrp ? Number(criteria.maxNtrp) : null,
        minAge: criteria.minAge ? Number(criteria.minAge) : null,
        maxAge: criteria.maxAge ? Number(criteria.maxAge) : null,
        minYears: criteria.minYears ? Number(criteria.minYears) : null,
        maxYears: criteria.maxYears ? Number(criteria.maxYears) : null,
      },
      deadline,
      status: "open",
      applicants: [],
      createdAt: Date.now(),
    };
    storage.update(KEY, [], (posts) => [post, ...posts]);
    return post;
  }

  function memberMeetsCriteria(member, criteria) {
    if (criteria.gender !== "all" && member.gender !== criteria.gender) return false;
    if (criteria.city !== "all" && member.city !== criteria.city) return false;
    if (criteria.minNtrp && Number(member.ntrp) < criteria.minNtrp) return false;
    if (criteria.maxNtrp && Number(member.ntrp) > criteria.maxNtrp) return false;
    if (criteria.minAge && Number(member.age) < criteria.minAge) return false;
    if (criteria.maxAge && Number(member.age) > criteria.maxAge) return false;
    if (criteria.minYears && Number(member.yearsPlaying) < criteria.minYears) return false;
    if (criteria.maxYears && Number(member.yearsPlaying) > criteria.maxYears) return false;
    return true;
  }

  function applyToPost(postId, { memberId, memberName }) {
    storage.update(KEY, [], (posts) =>
      posts.map((p) => {
        if (p.id !== postId) return p;
        if (p.applicants.some((a) => a.memberId === memberId)) return p;
        return {
          ...p,
          applicants: [
            ...p.applicants,
            { memberId, memberName, appliedAt: Date.now(), status: "pending" },
          ],
        };
      })
    );
  }

  function approveApplicant(postId, memberId) {
    const post = getPostById(postId);
    if (!post) return;
    const applicant = post.applicants.find((a) => a.memberId === memberId);
    if (!applicant) return;

    storage.update(KEY, [], (posts) =>
      posts.map((p) =>
        p.id !== postId
          ? p
          : {
              ...p,
              applicants: p.applicants.map((a) =>
                a.memberId === memberId ? { ...a, status: "approved" } : a
              ),
            }
      )
    );

    matchRecordService.createRecord({
      player1Id: post.authorId,
      player1Name: post.authorName,
      player2Id: memberId,
      player2Name: applicant.memberName,
      status: "scheduled",
      source: "looking_for",
      lookingForId: postId,
    });
  }

  function rejectApplicant(postId, memberId) {
    storage.update(KEY, [], (posts) =>
      posts.map((p) =>
        p.id !== postId
          ? p
          : {
              ...p,
              applicants: p.applicants.map((a) =>
                a.memberId === memberId ? { ...a, status: "rejected" } : a
              ),
            }
      )
    );
  }

  function closePost(postId) {
    storage.update(KEY, [], (posts) =>
      posts.map((p) => (p.id === postId ? { ...p, status: "closed" } : p))
    );
  }

  return {
    getPosts,
    getActivePosts,
    getPostById,
    createPost,
    memberMeetsCriteria,
    applyToPost,
    approveApplicant,
    rejectApplicant,
    closePost,
  };
}
