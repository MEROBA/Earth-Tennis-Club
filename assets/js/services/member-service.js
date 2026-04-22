import { assertRequired, safeNumber, sanitizeText } from "./security-service.js";

const DEFAULT_MEMBERS = [
  {
    id: "m_demo_1",
    name: "Wendy",
    city: "台北市",
    gender: "female",
    height: 163,
    age: 28,
    yearsPlaying: 5,
    preferredSurface: "hard",
    playStyle: "baseline",
    availability: "平日晚上",
    ntrp: 3.5,
    photo: null,
    createdAt: Date.now() - 600000,
  },
  {
    id: "m_demo_2",
    name: "Jason",
    city: "台中市",
    gender: "male",
    height: 178,
    age: 32,
    yearsPlaying: 8,
    preferredSurface: "hard",
    playStyle: "all_court",
    availability: "週末上午",
    ntrp: 4.0,
    photo: null,
    createdAt: Date.now() - 500000,
  },
  {
    id: "m_demo_3",
    name: "Mina",
    city: "高雄市",
    gender: "female",
    height: 158,
    age: 24,
    yearsPlaying: 3,
    preferredSurface: "synthetic",
    playStyle: "defensive",
    availability: "週末下午",
    ntrp: 3.0,
    photo: null,
    createdAt: Date.now() - 400000,
  },
];

const tokenSet = (text) =>
  new Set(
    String(text || "")
      .toLowerCase()
      .split(/[\s,，、/]+/)
      .filter(Boolean)
  );

function availabilitySimilarity(a, b) {
  const aTokens = tokenSet(a);
  const bTokens = tokenSet(b);
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  aTokens.forEach((t) => { if (bTokens.has(t)) overlap++; });
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function ensureSeed(storage) {
  const members = storage.get("members", []);
  if (!members.length) {
    storage.set("members", DEFAULT_MEMBERS);
    storage.set("currentUserId", DEFAULT_MEMBERS[0].id);
  }
}

function normalizeMember(input) {
  assertRequired(input, ["name", "city", "gender", "age", "yearsPlaying", "preferredSurface"]);

  return {
    id: input.id || `m_${crypto.randomUUID().slice(0, 8)}`,
    name: sanitizeText(input.name, 30),
    city: sanitizeText(input.city, 12),
    gender: sanitizeText(input.gender, 20),
    height: safeNumber(input.height || 0, 0, 230, 0),
    age: safeNumber(input.age, 10, 90, 18),
    yearsPlaying: safeNumber(input.yearsPlaying, 0, 70, 0),
    preferredSurface: sanitizeText(input.preferredSurface, 16),
    playStyle: sanitizeText(input.playStyle || "all_court", 20),
    availability: sanitizeText(input.availability || "", 80),
    ntrp: safeNumber(input.ntrp || 1.5, 1.5, 7, 1.5),
    photo: typeof input.photo === "string" && input.photo.startsWith("data:image/") ? input.photo : null,
    createdAt: input.createdAt || Date.now(),
  };
}

export function createMemberService(storage) {
  ensureSeed(storage);

  function getMembers() {
    return storage.get("members", []).sort((a, b) => b.createdAt - a.createdAt);
  }

  function saveMember(payload) {
    const normalized = normalizeMember(payload);
    const members = storage.get("members", []);
    const index = members.findIndex((m) => m.id === normalized.id);
    if (index >= 0) {
      members[index] = normalized;
    } else {
      members.push(normalized);
    }
    storage.set("members", members);
    return normalized;
  }

  function getCurrentUserId() {
    return storage.get("currentUserId", null);
  }

  function setCurrentUserId(memberId) {
    storage.set("currentUserId", memberId);
  }

  function getCurrentUser() {
    const id = getCurrentUserId();
    return getMembers().find((m) => m.id === id) || null;
  }

  function filterMembers({ city, minNtrp }) {
    const level = Number(minNtrp || 0);
    return getMembers().filter((m) => {
      if (city && city !== "all" && m.city !== city) return false;
      if (level > 0 && Number(m.ntrp) < level) return false;
      return true;
    });
  }

  function findMatches(currentUserId, limit = 8) {
    const current = getMembers().find((m) => m.id === currentUserId);
    if (!current) return [];

    return getMembers()
      .filter((m) => m.id !== current.id)
      .map((m) => {
        const ntrpGap = Math.abs(Number(m.ntrp) - Number(current.ntrp));
        const ageGap = Math.abs(Number(m.age) - Number(current.age));
        const yearsGap = Math.abs(Number(m.yearsPlaying) - Number(current.yearsPlaying));
        const cityScore = m.city === current.city ? 30 : 10;
        const levelScore = Math.max(0, 28 - ntrpGap * 10);
        const ageScore = Math.max(0, 18 - ageGap * 1.2);
        const yearsScore = Math.max(0, 12 - yearsGap * 1.5);
        const availScore = availabilitySimilarity(m.availability, current.availability) * 10;
        const total = cityScore + levelScore + ageScore + yearsScore + availScore;
        return {
          member: m,
          score: Number(total.toFixed(1)),
          reason: `地區${m.city === current.city ? "相同" : "相近"} · NTRP差 ${ntrpGap.toFixed(1)} · 球齡差 ${yearsGap} 年`,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function saveAssessment(payload) {
    const record = {
      ntrp: payload.ntrp,
      averageScore: payload.averageScore,
      summary: payload.summary,
      createdAt: Date.now(),
    };
    storage.update("assessmentHistory", [], (h) => [record, ...h].slice(0, 50));
    return record;
  }

  function getAssessmentHistory() {
    return storage.get("assessmentHistory", []);
  }

  return {
    getMembers,
    saveMember,
    getCurrentUserId,
    setCurrentUserId,
    getCurrentUser,
    filterMembers,
    findMatches,
    saveAssessment,
    getAssessmentHistory,
  };
}
