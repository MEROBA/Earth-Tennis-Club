export function createMatchRecordService(storage) {
  const KEY = "match_records";

  function getAll() {
    return storage.get(KEY, []).sort((a, b) => b.createdAt - a.createdAt);
  }

  function getRecordsForMember(memberId) {
    return getAll().filter(
      (r) => r.player1Id === memberId || r.player2Id === memberId
    );
  }

  function getRecordById(id) {
    return getAll().find((r) => r.id === id) ?? null;
  }

  function createRecord(data) {
    const record = {
      id: `mr_${crypto.randomUUID().slice(0, 8)}`,
      player1Id: data.player1Id,
      player1Name: data.player1Name,
      player2Id: data.player2Id,
      player2Name: data.player2Name,
      date: data.date ?? new Date().toISOString().slice(0, 10),
      venue: data.venue ?? "",
      sets: data.sets ?? [],
      winner: data.winner ?? null,   // "p1" | "p2" | "draw" | null
      status: data.status ?? "scheduled", // "scheduled" | "completed"
      source: data.source ?? "manual",
      lookingForId: data.lookingForId ?? null,
      createdAt: Date.now(),
    };
    storage.update(KEY, [], (records) => [record, ...records]);
    return record;
  }

  function updateRecord(recordId, updates) {
    storage.update(KEY, [], (records) =>
      records.map((r) => (r.id === recordId ? { ...r, ...updates } : r))
    );
  }

  return { getAll, getRecordsForMember, getRecordById, createRecord, updateRecord };
}
