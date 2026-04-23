import { EQUIPMENT_LIST } from "../data/equipment.js";

/**
 * 裝備服務 — 管理裝備資料與評論。
 * 評論以 LocalStorage 持久化。
 */
export function createEquipmentService(storage) {
  const REVIEWS_KEY = "equipment_reviews";

  function _loadReviews() {
    return storage.get(REVIEWS_KEY) ?? {};
  }

  function _saveReviews(data) {
    storage.set(REVIEWS_KEY, data);
  }

  /** 取得所有裝備（可依分類篩選） */
  function getEquipment(category = "all") {
    if (category === "all") return [...EQUIPMENT_LIST];
    return EQUIPMENT_LIST.filter((e) => e.category === category);
  }

  /** 取得單一裝備 */
  function getEquipmentById(id) {
    return EQUIPMENT_LIST.find((e) => e.id === id) ?? null;
  }

  /**
   * 取得某裝備的所有評論，並計算平均星評。
   * @returns {{ reviews: Review[], avgRating: number, count: number }}
   */
  function getReviews(equipmentId) {
    const all = _loadReviews();
    const reviews = all[equipmentId] ?? [];
    const count = reviews.length;
    const avgRating =
      count === 0
        ? 0
        : Math.round((reviews.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10;
    return { reviews, avgRating, count };
  }

  /**
   * 新增評論。
   * @param {string} equipmentId
   * @param {{ authorName: string, rating: number, comment: string }} payload
   */
  function addReview(equipmentId, payload) {
    const { authorName, rating, comment } = payload;
    if (!authorName || !comment?.trim()) throw new Error("必填欄位缺失");
    if (rating < 1 || rating > 5) throw new Error("評分必須介於 1 到 5 星");

    const all = _loadReviews();
    if (!all[equipmentId]) all[equipmentId] = [];

    all[equipmentId].unshift({
      id: `rev_${Date.now()}`,
      equipmentId,
      authorName,
      rating,
      comment: comment.trim().slice(0, 300),
      createdAt: new Date().toISOString(),
    });

    _saveReviews(all);
    return all[equipmentId][0];
  }

  return { getEquipment, getEquipmentById, getReviews, addReview };
}
