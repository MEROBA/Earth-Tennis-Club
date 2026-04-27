export function createBuddyService(storage) {
  function getBuddies(userId) {
    return storage.get("buddyList", []).filter((b) => b.userId === userId);
  }

  function addBuddy(userId, buddyMemberId) {
    if (isBuddy(userId, buddyMemberId)) return null;
    const entry = {
      id: `buddy_${crypto.randomUUID().slice(0, 8)}`,
      userId,
      buddyMemberId,
      addedAt: Date.now(),
    };
    storage.update("buddyList", [], (list) => [...list, entry]);
    return entry;
  }

  function removeBuddy(userId, buddyMemberId) {
    storage.update("buddyList", [], (list) =>
      list.filter((b) => !(b.userId === userId && b.buddyMemberId === buddyMemberId))
    );
  }

  function isBuddy(userId, buddyMemberId) {
    return getBuddies(userId).some((b) => b.buddyMemberId === buddyMemberId);
  }

  return { getBuddies, addBuddy, removeBuddy, isBuddy };
}
