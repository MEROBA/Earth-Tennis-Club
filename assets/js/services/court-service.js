import { COURTS } from "../data/courts.js";
import { sanitizeText } from "./security-service.js";

function getReviewBucket(storage) {
  return storage.get("courtReviews", {});
}

function setReviewBucket(storage, payload) {
  storage.set("courtReviews", payload);
}

function toStats(reviews) {
  if (!reviews.length) {
    return { rating: 0, count: 0 };
  }
  const sum = reviews.reduce((acc, review) => acc + Number(review.rating), 0);
  return {
    rating: Number((sum / reviews.length).toFixed(1)),
    count: reviews.length,
  };
}

export function createCourtService(storage) {
  function getCourts(filters = {}) {
    const reviewsByCourt = getReviewBucket(storage);

    return COURTS.filter((court) => {
      if (filters.city && filters.city !== "all" && court.city !== filters.city) {
        return false;
      }
      if (filters.surface && filters.surface !== "all" && court.surface !== filters.surface) {
        return false;
      }
      return true;
    }).map((court) => {
      const stats = toStats(reviewsByCourt[court.id] || []);
      return {
        ...court,
        rating: stats.rating,
        reviewCount: stats.count,
      };
    });
  }

  function getCourt(courtId) {
    return getCourts({}).find((court) => court.id === courtId) || null;
  }

  function getReviews(courtId) {
    const reviewsByCourt = getReviewBucket(storage);
    return (reviewsByCourt[courtId] || []).sort((a, b) => b.createdAt - a.createdAt);
  }

  function addReview(courtId, payload) {
    const reviewsByCourt = getReviewBucket(storage);
    const author = sanitizeText(payload.author || "匿名球友", 30);
    const existing = (reviewsByCourt[courtId] || []).find((r) => r.author === author);

    if (existing) {
      existing.rating = Number(payload.rating);
      existing.comment = sanitizeText(payload.comment, 180);
      existing.updatedAt = Date.now();
      setReviewBucket(storage, reviewsByCourt);
      return existing;
    }

    const review = {
      id: `review_${crypto.randomUUID().slice(0, 8)}`,
      rating: Number(payload.rating),
      comment: sanitizeText(payload.comment, 180),
      author,
      createdAt: Date.now(),
    };

    reviewsByCourt[courtId] = [review, ...(reviewsByCourt[courtId] || [])];
    setReviewBucket(storage, reviewsByCourt);
    return review;
  }

  return {
    getCourts,
    getCourt,
    getReviews,
    addReview,
  };
}
