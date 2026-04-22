import { assertRequired, safeNumber, sanitizeText } from "./security-service.js";

const DEFAULT_MEMBERS = [
  {
    id: "m_demo_1",
    name: "Wendy",
    city: "台北市",
    gender: "female",
    age: 28,
    yearsPlaying: 5,
    preferredSurface: "hard",
    availability: "平日晚上",
    utr: 5.2,
    ntrp: 3.5,
    createdAt: Date.now() - 600000,
  },
  {
    id: "m_demo_2",
    name: "Jason",
    city: "台中市",
    gender: "male",
    age: 32,
    yearsPlaying: 8,
    preferredSurface: "hard",
    availability: "週末上午",
    utr: 7.1,
    ntrp: 4.0,
    createdAt: Date.now() - 500000,
  },
  {
    id: "m_demo_3",
    name: "Mina",
    city: "高雄市",
    gender: "female",
    age: 24,
    yearsPlaying: 3,
    preferredSurface: "synthetic",
    availability: "週末下午",
    utr: 4.3,
    ntrp: 3.0,
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
  if (!aTokens.size || !bTokens.size) {
    return 0;
  }
  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) {
      overlap += 1;
    }
  });
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
    age: safeNumber(input.age, 10, 90, 18),
    yearsPlaying: safeNumber(input.yearsPlaying, 0, 70, 0),
    preferredSurface: sanitizeText(input.preferredSurface, 16),
    availability: sanitizeText(input.availability || "", 80),
    utr: safeNumber(input.utr || 1, 1, 16.5, 1),
    ntrp: safeNumber(input.ntrp || 1.5, 1.5, 7, 1.5),
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
    const index = members.findIndex((member) => member.id === normalized.id);

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
    const currentUserId = getCurrentUserId();
    return getMembers().find((member) => member.id === currentUserId) || null;
  }

  function filterMembers({ city, minNtrp }) {
    const level = Number(minNtrp || 0);
    return getMembers().filter((member) => {
      if (city && city !== "all" && member.city !== city) {
        return false;
      }
      if (level > 0 && Number(member.ntrp) < level) {
        return false;
      }
      return true;
    });
  }

  function findMatches(currentUserId, limit = 8) {
    const current = getMembers().find((member) => member.id === currentUserId);
    if (!current) {
      return [];
    }

    return getMembers()
      .filter((member) => member.id !== current.id)
      .map((member) => {
        const ntrpGap = Math.abs(Number(member.ntrp) - Number(current.ntrp));
        const ageGap = Math.abs(Number(member.age) - Number(current.age));
        const yearsGap = Math.abs(Number(member.yearsPlaying) - Number(current.yearsPlaying));
        const cityScore = member.city === current.city ? 30 : 10;
        const levelScore = Math.max(0, 28 - ntrpGap * 10);
        const ageScore = Math.max(0, 18 - ageGap * 1.2);
        const yearsScore = Math.max(0, 12 - yearsGap * 1.5);
        const availabilityScore = availabilitySimilarity(member.availability, current.availability) * 12;
        const total = cityScore + levelScore + ageScore + yearsScore + availabilityScore;

        return {
          member,
          score: Number(total.toFixed(1)),
          reason: `地區${member.city === current.city ? "相同" : "相近"}、NTRP差 ${ntrpGap.toFixed(1)}`,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  function saveAssessment(payload) {
    const record = {
      averageScore: payload.averageScore,
      ntrp: payload.ntrp,
      utr: payload.utr,
      summary: payload.summary,
      createdAt: Date.now(),
    };
    storage.update("assessmentHistory", [], (history) => [record, ...history].slice(0, 50));
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
