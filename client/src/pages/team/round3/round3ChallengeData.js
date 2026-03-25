export const ROUND3_TOTAL_BUGS = 30;
export const ROUND3_POINTS_PER_BUG = 5;
export const ROUND3_DURATION_SECONDS = 60 * 60;

const buildBuggyCode = (fixedCode, rules) =>
  rules.reduce((nextCode, rule) => nextCode.replace(rule.fixed, rule.broken), fixedCode);

const normalizeCode = (code = "") => String(code).replace(/\r\n/g, "\n");

const evaluateRules = (rules, code) => {
  const normalizedCode = normalizeCode(code);
  const fixedBugIds = rules
    .filter((rule) => normalizedCode.includes(rule.fixed) && !normalizedCode.includes(rule.broken))
    .map((rule) => rule.id);

  return {
    fixedBugIds,
    remainingBugIds: rules
      .map((rule) => rule.id)
      .filter((id) => !fixedBugIds.includes(id)),
    passed: fixedBugIds.length,
    total: ROUND3_TOTAL_BUGS,
    score: fixedBugIds.length * ROUND3_POINTS_PER_BUG
  };
};

const cppFixedCode = `#include <bits/stdc++.h>
using namespace std;

struct TeamScore {
  string name;
  int solved;
  int penalty;
};

bool betterTeam(const TeamScore& a, const TeamScore& b) {
  if (a.solved != b.solved) return a.solved > b.solved;
  if (a.penalty != b.penalty) return a.penalty < b.penalty;
  return a.name < b.name;
}

int sanitizeSolved(int solved) {
  return max(0, solved);
}

int sanitizePenalty(int penalty) {
  return max(0, penalty);
}

double averageSolved(const vector<TeamScore>& teams) {
  if (teams.empty()) return 0.0;
  double total = 0;
  for (const auto& team : teams) total += team.solved;
  return total / teams.size();
}

int totalPenalty(const vector<TeamScore>& teams) {
  int total = 0;
  for (const auto& team : teams) total += team.penalty;
  return total;
}

int main() {
  ios::sync_with_stdio(false);
  cin.tie(nullptr);

  int n;
  cin >> n;

  vector<TeamScore> teams(n);
  for (int i = 0; i < n; i++) {
    cin >> teams[i].name >> teams[i].solved >> teams[i].penalty;
    teams[i].solved = sanitizeSolved(teams[i].solved);
    teams[i].penalty = sanitizePenalty(teams[i].penalty);
  }

  sort(teams.begin(), teams.end(), betterTeam);

  cout << fixed << setprecision(2);
  cout << "Average solved: " << averageSolved(teams) << "\\n";
  cout << "Total penalty: " << totalPenalty(teams) << "\\n";
  cout << "Leaderboard\\n";

  for (size_t i = 0; i < teams.size(); i++) {
    cout << i + 1 << ". " << teams[i].name << " " << teams[i].solved << " " << teams[i].penalty;
    if (i + 1 < teams.size()) cout << "\\n";
  }

  return 0;
}
`;

const cppRules = [
  { id: 1, fixed: "#include <bits/stdc++.h>", broken: "#include <iostream> // BUG 01: umbrella header missing" },
  { id: 2, fixed: "using namespace std;", broken: "using namespace std: // BUG 02: broken namespace syntax" },
  { id: 3, fixed: "  string name;", broken: "  sting name; // BUG 03: invalid type" },
  { id: 4, fixed: "  int solved;", broken: "  string solved; // BUG 04: wrong field type" },
  { id: 5, fixed: "  int penalty;", broken: "  string penalty; // BUG 05: wrong field type" },
  { id: 6, fixed: "bool betterTeam(const TeamScore& a, const TeamScore& b) {", broken: "bool betterTeam(TeamScore a, TeamScore b) { // BUG 06: comparator copies values" },
  { id: 7, fixed: "  if (a.solved != b.solved) return a.solved > b.solved;", broken: "  if (a.solved == b.solved) return a.solved > b.solved; // BUG 07: wrong comparison" },
  { id: 8, fixed: "  if (a.penalty != b.penalty) return a.penalty < b.penalty;", broken: "  if (a.penalty == b.penalty) return a.penalty < b.penalty; // BUG 08: wrong comparison" },
  { id: 9, fixed: "  return a.name < b.name;", broken: "  return a.name > b.name; // BUG 09: reversed alphabetical order" },
  { id: 10, fixed: "int sanitizeSolved(int solved) {", broken: "int sanitizeSolved(string solved) { // BUG 10: wrong parameter type" },
  { id: 11, fixed: "  return max(0, solved);", broken: "  return min(0, solved); // BUG 11: clamps the wrong direction" },
  { id: 12, fixed: "int sanitizePenalty(int penalty) {", broken: "int sanitizePenalty(string penalty) { // BUG 12: wrong parameter type" },
  { id: 13, fixed: "  return max(0, penalty);", broken: "  return min(0, penalty); // BUG 13: clamps the wrong direction" },
  { id: 14, fixed: "double averageSolved(const vector<TeamScore>& teams) {", broken: "double averageSolved(vector<TeamScore> teams) { // BUG 14: copies the whole vector" },
  { id: 15, fixed: "  if (teams.empty()) return 0.0;", broken: "  if (teams.size() < 0) return 0.0; // BUG 15: impossible empty check" },
  { id: 16, fixed: "  double total = 0;", broken: "  double total = 1; // BUG 16: wrong accumulator start" },
  { id: 17, fixed: "  for (const auto& team : teams) total += team.solved;", broken: "  for (const auto& team : teams) total -= team.solved; // BUG 17: subtracts solved count" },
  { id: 18, fixed: "  return total / teams.size();", broken: "  return total * teams.size(); // BUG 18: invalid average formula" },
  { id: 19, fixed: "int totalPenalty(const vector<TeamScore>& teams) {", broken: "int totalPenalty(vector<TeamScore> teams) { // BUG 19: copies the whole vector" },
  { id: 20, fixed: "  int total = 0;", broken: "  int total = 1; // BUG 20: wrong penalty accumulator" },
  { id: 21, fixed: "  for (const auto& team : teams) total += team.penalty;", broken: "  for (const auto& team : teams) total -= team.penalty; // BUG 21: subtracts penalties" },
  { id: 22, fixed: "  ios::sync_with_stdio(false);", broken: "  ios::sync_with_stdio(true); // BUG 22: slower I/O mode" },
  { id: 23, fixed: "  cin.tie(nullptr);", broken: "  cin.tie(0); // BUG 23: legacy tie usage" },
  { id: 24, fixed: "  vector<TeamScore> teams(n);", broken: "  vector<TeamScore> teams(n + 1); // BUG 24: extra empty row" },
  { id: 25, fixed: "  for (int i = 0; i < n; i++) {", broken: "  for (int i = 0; i <= n; i++) { // BUG 25: off-by-one loop" },
  { id: 26, fixed: "    cin >> teams[i].name >> teams[i].solved >> teams[i].penalty;", broken: "    cin >> teams[i].penalty >> teams[i].solved >> teams[i].name; // BUG 26: wrong input order" },
  { id: 27, fixed: "    teams[i].solved = sanitizeSolved(teams[i].solved);", broken: "    teams[i].solved = sanitizePenalty(teams[i].solved); // BUG 27: wrong sanitizer" },
  { id: 28, fixed: "    teams[i].penalty = sanitizePenalty(teams[i].penalty);", broken: "    teams[i].penalty = sanitizeSolved(teams[i].penalty); // BUG 28: wrong sanitizer" },
  { id: 29, fixed: "  sort(teams.begin(), teams.end(), betterTeam);", broken: "  sort(teams.begin(), teams.end()); // BUG 29: comparator missing" },
  { id: 30, fixed: "  cout << fixed << setprecision(2);", broken: "  cout << fixed << setprecision(0); // BUG 30: score precision lost" }
];

const javaFixedCode = `import java.io.*;
import java.util.*;

class TeamScore {
  String name;
  int solved;
  int penalty;

  TeamScore(String name, int solved, int penalty) {
    this.name = name;
    this.solved = solved;
    this.penalty = penalty;
  }
}

public class Main {
  static boolean betterTeam(TeamScore a, TeamScore b) {
    if (a.solved != b.solved) return a.solved > b.solved;
    if (a.penalty != b.penalty) return a.penalty < b.penalty;
    return a.name.compareTo(b.name) < 0;
  }

  static int sanitizeSolved(int solved) {
    return Math.max(0, solved);
  }

  static int sanitizePenalty(int penalty) {
    return Math.max(0, penalty);
  }

  static double averageSolved(List<TeamScore> teams) {
    if (teams.isEmpty()) return 0.0;
    double total = 0;
    for (TeamScore team : teams) total += team.solved;
    return total / teams.size();
  }

  static int totalPenalty(List<TeamScore> teams) {
    int total = 0;
    for (TeamScore team : teams) total += team.penalty;
    return total;
  }

  public static void main(String[] args) throws Exception {
    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
    int n = Integer.parseInt(br.readLine().trim());
    List<TeamScore> teams = new ArrayList<>();

    for (int i = 0; i < n; i++) {
      StringTokenizer st = new StringTokenizer(br.readLine());
      String name = st.nextToken();
      int solved = Integer.parseInt(st.nextToken());
      int penalty = Integer.parseInt(st.nextToken());
      teams.add(new TeamScore(name, sanitizeSolved(solved), sanitizePenalty(penalty)));
    }

    teams.sort((a, b) -> {
      if (betterTeam(a, b)) return -1;
      if (betterTeam(b, a)) return 1;
      return 0;
    });

    System.out.printf(Locale.US, "Average solved: %.2f%n", averageSolved(teams));
    System.out.println("Total penalty: " + totalPenalty(teams));
    System.out.println("Leaderboard");
    for (int i = 0; i < teams.size(); i++) {
      TeamScore team = teams.get(i);
      System.out.println((i + 1) + ". " + team.name + " " + team.solved + " " + team.penalty);
    }
  }
}
`;

const javaRules = [
  { id: 1, fixed: "import java.io.*;", broken: "import java.net.*; // BUG 01: wrong import" },
  { id: 2, fixed: "import java.util.*;", broken: "import java.math.*; // BUG 02: util classes missing" },
  { id: 3, fixed: "  String name;", broken: "  string name; // BUG 03: invalid type" },
  { id: 4, fixed: "  int solved;", broken: "  String solved; // BUG 04: wrong field type" },
  { id: 5, fixed: "  int penalty;", broken: "  String penalty; // BUG 05: wrong field type" },
  { id: 6, fixed: "  TeamScore(String name, int solved, int penalty) {", broken: "  TeamScore(String name, String solved, String penalty) { // BUG 06: wrong constructor signature" },
  { id: 7, fixed: "    this.name = name;", broken: "    this.teamName = name; // BUG 07: unknown field" },
  { id: 8, fixed: "    this.solved = solved;", broken: "    this.solved = penalty; // BUG 08: swapped assignment" },
  { id: 9, fixed: "    this.penalty = penalty;", broken: "    this.penalty = solved; // BUG 09: swapped assignment" },
  { id: 10, fixed: "  static boolean betterTeam(TeamScore a, TeamScore b) {", broken: "  static int betterTeam(TeamScore a, TeamScore b) { // BUG 10: wrong return type" },
  { id: 11, fixed: "    if (a.solved != b.solved) return a.solved > b.solved;", broken: "    if (a.solved == b.solved) return a.solved > b.solved; // BUG 11: wrong comparison" },
  { id: 12, fixed: "    if (a.penalty != b.penalty) return a.penalty < b.penalty;", broken: "    if (a.penalty == b.penalty) return a.penalty < b.penalty; // BUG 12: wrong comparison" },
  { id: 13, fixed: "    return a.name.compareTo(b.name) < 0;", broken: "    return a.name.compareTo(b.name) > 0; // BUG 13: reversed sort order" },
  { id: 14, fixed: "  static int sanitizeSolved(int solved) {", broken: "  static int sanitizeSolved(String solved) { // BUG 14: wrong parameter type" },
  { id: 15, fixed: "    return Math.max(0, solved);", broken: "    return Math.min(0, solved); // BUG 15: clamps the wrong direction" },
  { id: 16, fixed: "  static int sanitizePenalty(int penalty) {", broken: "  static int sanitizePenalty(String penalty) { // BUG 16: wrong parameter type" },
  { id: 17, fixed: "    return Math.max(0, penalty);", broken: "    return Math.min(0, penalty); // BUG 17: clamps the wrong direction" },
  { id: 18, fixed: "  static double averageSolved(List<TeamScore> teams) {", broken: "  static double averageSolved(ArrayList<TeamScore> teams) { // BUG 18: interface narrowed" },
  { id: 19, fixed: "    if (teams.isEmpty()) return 0.0;", broken: "    if (teams.size() < 0) return 0.0; // BUG 19: impossible empty check" },
  { id: 20, fixed: "    double total = 0;", broken: "    double total = 1; // BUG 20: wrong accumulator start" },
  { id: 21, fixed: "    for (TeamScore team : teams) total += team.solved;", broken: "    for (TeamScore team : teams) total -= team.solved; // BUG 21: subtracts solved count" },
  { id: 22, fixed: "    return total / teams.size();", broken: "    return total * teams.size(); // BUG 22: invalid average formula" },
  { id: 23, fixed: "  static int totalPenalty(List<TeamScore> teams) {", broken: "  static int totalPenalty(ArrayList<TeamScore> teams) { // BUG 23: interface narrowed" },
  { id: 24, fixed: "    int total = 0;", broken: "    int total = 1; // BUG 24: wrong penalty accumulator" },
  { id: 25, fixed: "    for (TeamScore team : teams) total += team.penalty;", broken: "    for (TeamScore team : teams) total -= team.penalty; // BUG 25: subtracts penalties" },
  { id: 26, fixed: "    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));", broken: "    BufferedReader br = null; // BUG 26: reader never initialized" },
  { id: 27, fixed: "    int n = Integer.parseInt(br.readLine().trim());", broken: "    int n = Integer.parseInt(br.readLine()); // BUG 27: missing trim" },
  { id: 28, fixed: "    List<TeamScore> teams = new ArrayList<>();", broken: "    List<TeamScore> teams = new LinkedList<>(); // BUG 28: wrong list choice for indexed access" },
  { id: 29, fixed: "    for (int i = 0; i < n; i++) {", broken: "    for (int i = 0; i <= n; i++) { // BUG 29: off-by-one loop" },
  { id: 30, fixed: "      teams.add(new TeamScore(name, sanitizeSolved(solved), sanitizePenalty(penalty)));", broken: "      teams.add(new TeamScore(name, sanitizePenalty(solved), sanitizeSolved(penalty))); // BUG 30: swapped sanitizers" }
];

const challengeMap = {
  cpp: {
    language: "cpp",
    label: "C++",
    title: "Round 3 - Bug Apocalypse",
    subtitle: "Tournament leaderboard compiler meltdown",
    systems: ["Comparator logic", "Input parsing", "Sanitizer helpers", "Scoreboard rendering"],
    fixedCode: cppFixedCode,
    rules: cppRules
  },
  java: {
    language: "java",
    label: "Java",
    title: "Round 3 - Bug Apocalypse",
    subtitle: "Ranking engine meltdown in the JVM bunker",
    systems: ["Constructor wiring", "Collections math", "Comparator logic", "I/O pipeline"],
    fixedCode: javaFixedCode,
    rules: javaRules
  }
};

export const getRound3Challenge = (language) => {
  const challenge = challengeMap[language] || challengeMap.cpp;

  return {
    ...challenge,
    buggyCode: buildBuggyCode(challenge.fixedCode, challenge.rules)
  };
};

export const evaluateRound3Code = ({ language, code }) => {
  const challenge = getRound3Challenge(language);

  return {
    ...evaluateRules(challenge.rules, code),
    title: challenge.subtitle
  };
};

export const round3Languages = [
  {
    value: "cpp",
    label: "C++",
    shortLabel: "C++17",
    accent: "from-cyan-400 to-sky-500",
    glow: "shadow-[0_0_30px_rgba(56,189,248,0.25)]",
    description: "Fast, low-level fixes for teams that like control and raw speed."
  },
  {
    value: "java",
    label: "Java",
    shortLabel: "JDK 17",
    accent: "from-orange-400 to-amber-500",
    glow: "shadow-[0_0_30px_rgba(251,146,60,0.25)]",
    description: "Structured debugging with classes, collections, and JVM-safe patching."
  }
];
