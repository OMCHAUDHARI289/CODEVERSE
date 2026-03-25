import {
  getRound3Challenge,
  ROUND3_POINTS_PER_BUG,
  ROUND3_TOTAL_BUGS
} from "../../../client/src/pages/team/round3/round3ChallengeData.js";

const buildRound3Question = (language) => {
  const challenge = getRound3Challenge(language);

  return {
    round: 3,
    title: `${challenge.title} - ${challenge.label}`,
    description: `${challenge.subtitle}. Fix ${ROUND3_TOTAL_BUGS} deliberate bugs in the provided ${challenge.label} program.` ,
    inputFormat: "No separate runtime input is required. Teams inspect the buggy source and repair it directly.",
    outputFormat: "Submit corrected code with all bugs fixed.",
    constraints: [
      `Fix all ${ROUND3_TOTAL_BUGS} seeded bugs in the source file.`,
      `Each bug awards ${ROUND3_POINTS_PER_BUG} marks.`
    ],
    buggyCode: challenge.buggyCode,
    language: challenge.language,
    expectedOutput: `A corrected ${challenge.label} source file with all ${ROUND3_TOTAL_BUGS} bugs fixed.`,
    marks: ROUND3_TOTAL_BUGS * ROUND3_POINTS_PER_BUG
  };
};

const round3Questions = [buildRound3Question("cpp"), buildRound3Question("java")];

export default round3Questions;

