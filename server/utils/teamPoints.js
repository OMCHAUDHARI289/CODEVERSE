export const getEqualMemberShare = (teamTotalScore = 0, memberCount = 0) => {
  const safeTotal = Number(teamTotalScore) || 0;
  const safeCount = Number(memberCount) > 0 ? Number(memberCount) : 0;

  if (!safeCount) return 0;
  return Number((safeTotal / safeCount).toFixed(2));
};

export const distributeTeamPoints = (teamTotalScore = 0, members = []) => {
  const safeMembers = Array.isArray(members) ? members : [];
  const safeCount = safeMembers.length || 0;
  const share = getEqualMemberShare(teamTotalScore, safeCount);

  return safeMembers.map((member) => ({
    ...member,
    points: share
  }));
};
