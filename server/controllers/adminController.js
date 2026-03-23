import Team from "../models/teams.js";
import Event from "../models/event.js";
import LifelineRequest from "../models/lifelineRequest.js";
import Question from "../models/questions.js";
import asyncHandler from "../utils/asyncHandler.js";
import AppError from "../utils/appError.js";
import { applyLifelinePenaltyToTeam, getLifelinePenalty } from "./lifelineController.js";
import { getLeaderboardData } from "../services/leaderboardService.js";

const MAX_ACTIVITY_ITEMS = 8;

const toPercent = (value, total) => {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
};

const getRoundCode = (currentRoundValue) => {
  const currentRound = Number(currentRoundValue) || 1;
  if (currentRound <= 1) return "R1";
  if (currentRound === 2) return "R2";
  return "R3";
};

const getTeamLifecycleStatus = (team) => {
  const round3Submitted = Boolean(team?.submissions?.round3?.isSubmitted) || Boolean(team?.completedAt);
  if (round3Submitted) return "Completed";
  if (team.isLoggedIn) return "Active";
  return "Offline";
};

const getSubmissionStatus = (team) => {
  const r1Submitted = Boolean(team?.submissions?.round1?.isSubmitted);
  const r2SubASubmitted = Boolean(team?.submissions?.round2?.subA?.isSubmitted);
  const r2SubBSubmitted = Boolean(team?.submissions?.round2?.subB?.isSubmitted);
  const r2Submitted = Boolean(team?.submissions?.round2?.submittedAt) || (r2SubASubmitted && r2SubBSubmitted);
  const r3Submitted = Boolean(team?.submissions?.round3?.isSubmitted) || Boolean(team?.completedAt);

  if (r3Submitted) return "Round 3 submitted";
  if (r2Submitted) return "Round 2 completed";
  if (r2SubASubmitted && !r2SubBSubmitted) return "Round 2 Sub A submitted";
  if (r1Submitted) return "Round 1 submitted";
  if ((Number(team.currentRound) || 1) === 1) return "Round 1 in progress";
  return "Awaiting submission";
};

const deriveTeamActivity = (team) => {
  const round1SubmittedAt = team?.submissions?.round1?.submittedAt
    ? new Date(team.submissions.round1.submittedAt)
    : null;
  const round2SubASubmittedAt = team?.submissions?.round2?.subA?.submittedAt
    ? new Date(team.submissions.round2.subA.submittedAt)
    : null;
  const round2SubBSubmittedAt = team?.submissions?.round2?.subB?.submittedAt
    ? new Date(team.submissions.round2.subB.submittedAt)
    : null;
  const round2SubmittedAt = team?.submissions?.round2?.submittedAt
    ? new Date(team.submissions.round2.submittedAt)
    : null;
  const round3SubmittedAt = team?.submissions?.round3?.submittedAt
    ? new Date(team.submissions.round3.submittedAt)
    : null;

  if (round3SubmittedAt) {
    return {
      type: "success",
      message: `${team.teamName} submitted Round 3`,
      at: round3SubmittedAt
    };
  }

  if (round2SubmittedAt) {
    return {
      type: "success",
      message: `${team.teamName} completed Round 2`,
      at: round2SubmittedAt
    };
  }

  if (round2SubBSubmittedAt) {
    return {
      type: "success",
      message: `${team.teamName} submitted Round 2 - Sub B`,
      at: round2SubBSubmittedAt
    };
  }

  if (round2SubASubmittedAt) {
    return {
      type: "success",
      message: `${team.teamName} submitted Round 2 - Sub A`,
      at: round2SubASubmittedAt
    };
  }

  if (round1SubmittedAt) {
    return {
      type: "success",
      message: `${team.teamName} submitted Round 1`,
      at: round1SubmittedAt
    };
  }

  if (team.isLoggedIn) {
    return {
      type: "system",
      message: `${team.teamName} is online`,
      at: team.updatedAt ? new Date(team.updatedAt) : new Date()
    };
  }

  return {
    type: "system",
    message: `${team.teamName} updated team profile`,
    at: team.updatedAt ? new Date(team.updatedAt) : new Date()
  };
};

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const [teams, event] = await Promise.all([
    Team.find({}).select(
      "teamName teamId currentRound isLoggedIn completedAt totalScore submissions updatedAt"
    ),
    Event.findOne().select("name isLive")
  ]);

  const totalTeams = teams.length;
  const eventName = event?.name || "Techfest CodeVerse";
  const isLive = Boolean(event?.isLive);

  let loggedInTeams = 0;
  let round1Active = 0;
  let round1Completed = 0;
  let round2Active = 0;
  let round2Completed = 0;
  let round3Active = 0;
  let round3Completed = 0;

  for (const team of teams) {
    if (team.isLoggedIn) loggedInTeams += 1;

    const currentRound = Number(team.currentRound) || 1;
    const r1Submitted = Boolean(team?.submissions?.round1?.isSubmitted);
    const r2SubASubmitted = Boolean(team?.submissions?.round2?.subA?.isSubmitted);
    const r2SubBSubmitted = Boolean(team?.submissions?.round2?.subB?.isSubmitted);
    const r2Submitted = Boolean(team?.submissions?.round2?.submittedAt) || (r2SubASubmitted && r2SubBSubmitted);
    const r3Submitted = Boolean(team?.submissions?.round3?.isSubmitted) || Boolean(team?.completedAt);

    if (currentRound === 1 && !r1Submitted) {
      round1Active += 1;
    }
    if (r1Submitted || currentRound > 1) {
      round1Completed += 1;
    }

    if (currentRound === 2) {
      round2Active += 1;
    }
    if (r2Submitted || currentRound > 2) {
      round2Completed += 1;
    }

    if (currentRound === 3 && !r3Submitted) {
      round3Active += 1;
    }
    if (r3Submitted || currentRound > 3) {
      round3Completed += 1;
    }
  }

  const completedTeams = round3Completed;
  const roundTotal = totalTeams * 3;
  const globalCompletedUnits = round1Completed + round2Completed + round3Completed;

  const recentActivity = teams
    .map((team) => {
      const activity = deriveTeamActivity(team);
      return {
        teamName: team.teamName,
        teamId: team.teamId,
        type: activity.type,
        message: activity.message,
        at: activity.at.toISOString()
      };
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, MAX_ACTIVITY_ITEMS);

  res.json({
    event: {
      name: eventName,
      isLive
    },
    totals: {
      teams: totalTeams,
      loggedInTeams,
      completedTeams
    },
    rounds: {
      round1: {
        active: round1Active,
        completed: round1Completed,
        progressPercent: toPercent(round1Completed, totalTeams)
      },
      round2: {
        active: round2Active,
        completed: round2Completed,
        progressPercent: toPercent(round2Completed, totalTeams)
      },
      round3: {
        active: round3Active,
        completed: round3Completed,
        progressPercent: toPercent(round3Completed, totalTeams)
      }
    },
    globalProgressPercent: toPercent(globalCompletedUnits, roundTotal),
    recentActivity
  });
});

const parseRoundFilter = (value) => {
  if (!value || String(value).toLowerCase() === "all") return null;
  const normalized = String(value).toUpperCase();
  if (!["R1", "R2", "R3"].includes(normalized)) {
    throw new AppError("Invalid round filter", 400);
  }
  return normalized;
};

const parseQuestionRoundFilter = (value) => {
  if (!value || String(value).toLowerCase() === "all") return null;
  const normalized = Number(value);
  if (![1, 2, 3].includes(normalized)) {
    throw new AppError("Invalid question round filter", 400);
  }
  return normalized;
};

const getQuestionType = (question) => {
  if (question.round === 1) return "MCQ";
  if (question.round === 2) return "Coding";
  if (question.round === 3) return "Debugging";
  return "Unknown";
};

const parseTeamStatusFilter = (value) => {
  if (!value || String(value).toLowerCase() === "all") return null;
  const normalized = String(value).toLowerCase();
  if (!["active", "offline", "completed"].includes(normalized)) {
    throw new AppError("Invalid status filter", 400);
  }
  return normalized;
};

export const getTeamMonitor = asyncHandler(async (req, res) => {
  const search = String(req.query?.search || "").trim().toLowerCase();
  const roundFilter = parseRoundFilter(req.query?.round);
  const statusFilter = parseTeamStatusFilter(req.query?.status);

  const [teams, latestRequests] = await Promise.all([
    Team.find({})
      .select(
        "teamId teamName members currentRound totalScore scores lifelines isLoggedIn submissions completedAt updatedAt"
      )
      .lean(),
    LifelineRequest.aggregate([
      { $sort: { requestedAt: -1 } },
      {
        $group: {
          _id: "$team",
          status: { $first: "$status" },
          round: { $first: "$round" },
          requestedAt: { $first: "$requestedAt" },
          resolvedAt: { $first: "$resolvedAt" }
        }
      }
    ])
  ]);

  const latestRequestByTeam = new Map(
    latestRequests.map((item) => [
      String(item._id),
      {
        status: item.status,
        round: item.round,
        requestedAt: item.requestedAt,
        resolvedAt: item.resolvedAt || null
      }
    ])
  );

  let monitorRows = teams.map((team) => {
    const members = Array.isArray(team.members)
      ? team.members.map((member) => member.name).filter(Boolean)
      : [];
    const round = getRoundCode(team.currentRound);
    const lifecycleStatus = getTeamLifecycleStatus(team);
    const latestRequest = latestRequestByTeam.get(String(team._id)) || null;
    const lifelineUsed = Boolean(team?.lifelines?.round2Used || team?.lifelines?.round3Used);

    let lifelineState = "Available";
    if (lifelineUsed) lifelineState = "Used";
    else if (latestRequest?.status === "pending") lifelineState = "Pending";
    else if (latestRequest?.status === "rejected") lifelineState = "Rejected";

    return {
      _id: team._id,
      teamId: team.teamId,
      teamName: team.teamName,
      members,
      memberCount: members.length,
      round,
      currentRound: Number(team.currentRound) || 1,
      score: Number(team.totalScore) || 0,
      scores: {
        round1: Number(team?.scores?.round1) || 0,
        round2: Number(team?.scores?.round2) || 0,
        round3: Number(team?.scores?.round3) || 0
      },
      status: lifecycleStatus,
      lifeline: lifelineState,
      lifelineRequest: latestRequest,
      submissionStatus: getSubmissionStatus(team),
      isOnline: Boolean(team.isLoggedIn),
      lastUpdatedAt: team.updatedAt || null
    };
  });

  if (search) {
    monitorRows = monitorRows.filter((row) => {
      const memberLine = row.members.join(" ").toLowerCase();
      return (
        row.teamName.toLowerCase().includes(search) ||
        row.teamId.toLowerCase().includes(search) ||
        memberLine.includes(search)
      );
    });
  }

  if (roundFilter) {
    monitorRows = monitorRows.filter((row) => row.round === roundFilter);
  }

  if (statusFilter) {
    monitorRows = monitorRows.filter((row) => row.status.toLowerCase() === statusFilter);
  }

  monitorRows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.teamId).localeCompare(String(b.teamId));
  });

  const counts = {
    total: monitorRows.length,
    active: monitorRows.filter((row) => row.status === "Active").length,
    offline: monitorRows.filter((row) => row.status === "Offline").length,
    completed: monitorRows.filter((row) => row.status === "Completed").length,
    pendingLifeline: monitorRows.filter((row) => row.lifeline === "Pending").length
  };

  res.json({
    counts,
    teams: monitorRows
  });
});

export const getAdminQuestions = asyncHandler(async (req, res) => {
  const roundFilter = parseQuestionRoundFilter(req.query?.round);
  const search = String(req.query?.search || "").trim();
  const limit = Math.min(300, Math.max(1, Number(req.query?.limit) || 200));

  const query = {};
  if (roundFilter) query.round = roundFilter;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { subRound: { $regex: search, $options: "i" } }
    ];
  }

  const questions = await Question.find(query)
    .sort({ round: 1, createdAt: -1 })
    .limit(limit)
    .lean();

  const rows = questions.map((question) => ({
    _id: question._id,
    round: question.round,
    roundCode: `R${question.round}`,
    title: question.title || "Untitled Question",
    type: getQuestionType(question),
    subRound: question.subRound || null,
    difficulty: question.difficulty || null,
    marks: Number(question.marks) || 0,
    optionCount: Array.isArray(question.options) ? question.options.length : 0,
    visibleTestCount: Array.isArray(question.visibleTestCases) ? question.visibleTestCases.length : 0,
    hiddenTestCount: Array.isArray(question.hiddenTestCases) ? question.hiddenTestCases.length : 0,
    hasBuggyCode: Boolean(question.buggyCode),
    createdAt: question.createdAt || null,
    updatedAt: question.updatedAt || null
  }));

  const counts = {
    total: rows.length,
    round1: rows.filter((item) => item.round === 1).length,
    round2: rows.filter((item) => item.round === 2).length,
    round3: rows.filter((item) => item.round === 3).length
  };

  res.json({
    counts,
    questions: rows
  });
});

export const getAdminLeaderboard = asyncHandler(async (req, res) => {
  const payload = await getLeaderboardData({
    limit: req.query?.limit
  });

  res.json(payload);
});

const parseLifelineStatusFilter = (status) => {
  if (!status || status === "all") return null;
  if (!["pending", "approved", "rejected"].includes(status)) {
    throw new AppError("Invalid status filter", 400);
  }
  return status;
};

const mapLifelineRequest = (request) => ({
  _id: request._id,
  round: request.round,
  status: request.status,
  requestedAt: request.requestedAt,
  resolvedAt: request.resolvedAt || null,
  note: request.note || "",
  team: request.team
    ? {
        _id: request.team._id,
        teamId: request.team.teamId,
        teamName: request.team.teamName,
        currentRound: request.team.currentRound,
        totalScore: request.team.totalScore
      }
    : null
});

export const getLifelineRequests = asyncHandler(async (req, res) => {
  const statusFilter = parseLifelineStatusFilter(req.query?.status);
  const limit = Math.min(100, Math.max(1, Number(req.query?.limit) || 50));

  const query = statusFilter ? { status: statusFilter } : {};

  const requests = await LifelineRequest.find(query)
    .sort({ status: 1, requestedAt: -1 })
    .limit(limit)
    .populate("team", "teamId teamName currentRound totalScore");

  const pendingCount = await LifelineRequest.countDocuments({ status: "pending" });

  res.json({
    penaltyPoints: getLifelinePenalty(),
    pendingCount,
    requests: requests.map(mapLifelineRequest)
  });
});

export const approveLifelineRequest = asyncHandler(async (req, res) => {
  const request = await LifelineRequest.findById(req.params.id);

  if (!request) {
    throw new AppError("Lifeline request not found", 404);
  }

  if (request.status !== "pending") {
    throw new AppError("Only pending requests can be approved", 400);
  }

  const team = await Team.findById(request.team);
  if (!team) {
    throw new AppError("Team not found for request", 404);
  }

  const penaltyState = applyLifelinePenaltyToTeam({
    team,
    round: request.round
  });

  await team.save();

  request.status = "approved";
  request.resolvedAt = new Date();
  request.reviewedBy = req.admin?._id || null;
  request.note = (req.body?.note || "").trim();
  await request.save();
  await request.populate("team", "teamId teamName currentRound totalScore");

  res.json({
    message: "Lifeline request approved",
    penalty: {
      points: penaltyState.appliedPenalty,
      totalScore: penaltyState.totalScore
    },
    request: mapLifelineRequest(request)
  });
});

export const rejectLifelineRequest = asyncHandler(async (req, res) => {
  const request = await LifelineRequest.findById(req.params.id);

  if (!request) {
    throw new AppError("Lifeline request not found", 404);
  }

  if (request.status !== "pending") {
    throw new AppError("Only pending requests can be rejected", 400);
  }

  request.status = "rejected";
  request.resolvedAt = new Date();
  request.reviewedBy = req.admin?._id || null;
  request.note = (req.body?.note || "").trim();
  await request.save();
  await request.populate("team", "teamId teamName currentRound totalScore");

  res.json({
    message: "Lifeline request rejected",
    request: mapLifelineRequest(request)
  });
});
