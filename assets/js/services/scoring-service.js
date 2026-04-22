const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function roundToHalf(v) {
  return Math.round(v * 2) / 2;
}

function describeNtrp(ntrp) {
  if (ntrp < 2.5) return "初學者：建議強化基本揮拍與步伐";
  if (ntrp < 3.5) return "入門進階：可建立穩定多拍與發接發套路";
  if (ntrp < 4.5) return "中高階：已有競技能力，可加強戰術決策";
  return "進階競技：具備高強度對抗能力";
}

export function evaluateTennisLevel(answers) {
  const values = Object.values(answers).map((v) => Number(v || 0));
  if (!values.length || values.some((v) => v < 1 || v > 7)) {
    throw new Error("問卷分數需介於 1 到 7");
  }

  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const ntrp = clamp(roundToHalf(1.5 + avg * 0.57), 1.5, 7.0);

  return {
    averageScore: Number(avg.toFixed(2)),
    ntrp,
    summary: describeNtrp(ntrp),
  };
}
