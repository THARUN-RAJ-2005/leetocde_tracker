export interface SubmissionsByDay { [date: string]: number; }
export interface RecentProblem {
  title: string; titleSlug: string;
  difficulty: string; solvedAt: string; submissionCount: number;
}
export interface UserProfile {
  username: string; realName: string; ranking: number;
  totalSolved: number; easySolved: number; mediumSolved: number; hardSolved: number;
  acceptanceRate: number;
  topicStats: { topicName: string; problemsSolved: number }[];
  submissionCalendar: { [timestamp: string]: number };
  recentSubmissions: {
    title: string; titleSlug: string; timestamp: string;
    statusDisplay: string; lang: string;
  }[];
}
export interface TodayProblem {
  title: string; titleSlug: string; difficulty: string;
  solvedAt: string; submissionCount: number; lang: string;
}

export interface ILeetCodeClient {
  fetchSubmissionsByDay(username: string): Promise<SubmissionsByDay>;
  fetchTotalSolved(username: string): Promise<number>;
  fetchRecentSolvedProblems(username: string): Promise<RecentProblem[]>;
  fetchUserProfile(username: string): Promise<UserProfile>;
  fetchTodayProblems(username: string, dateStr: string): Promise<TodayProblem[]>;
}

const GRAPHQL_URL = "https://leetcode.com/graphql/";

const RECENT_AC_QUERY = `
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) {
    id titleSlug timestamp
  }
}`;

const ALL_SUBMISSIONS_QUERY = `
query userSubmissions($username: String!, $limit: Int!) {
  recentSubmissionList(username: $username, limit: $limit) {
    title titleSlug timestamp statusDisplay lang
  }
}`;

const PROBLEM_DIFFICULTY_QUERY = `
query problemDifficulty($titleSlug: String!) {
  question(titleSlug: $titleSlug) { title difficulty questionFrontendId }
}`;

const TOTAL_SOLVED_QUERY = `
query userProblemsSolved($username: String!) {
  matchedUser(username: $username) {
    submitStatsGlobal {
      acSubmissionNum { difficulty count }
    }
  }
}`;

const USER_PROFILE_QUERY = `
query userProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile { realName ranking userAvatar }
    submitStatsGlobal {
      acSubmissionNum { difficulty count }
      totalSubmissionNum { difficulty count }
    }
    tagProblemCounts {
      advanced { tagName problemsSolved }
      intermediate { tagName problemsSolved }
      fundamental { tagName problemsSolved }
    }
    userCalendar { submissionCalendar }
  }
  recentSubmissionList(username: $username, limit: 15) {
    title titleSlug timestamp statusDisplay lang
  }
}`;

async function getCsrfToken(): Promise<string> {
  try {
    const res = await fetch("https://leetcode.com/", {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
    });
    const cookie = res.headers.get("set-cookie") || "";
    const match = cookie.match(/csrftoken=([^;]+)/);
    return match?.[1] ?? "";
  } catch { return ""; }
}

export class LeetCodeClient implements ILeetCodeClient {
  private csrf: string | null = null;

  private async getToken(): Promise<string> {
    if (!this.csrf) this.csrf = await getCsrfToken();
    return this.csrf;
  }

  private async gql(body: object, username?: string): Promise<unknown> {
    const csrf = await this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      Origin: "https://leetcode.com",
    };
    if (username) headers["Referer"] = `https://leetcode.com/${username}/`;
    if (csrf) { headers["x-csrftoken"] = csrf; headers["Cookie"] = `csrftoken=${csrf}`; }
    const res = await fetch(GRAPHQL_URL, {
      method: "POST", headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`LeetCode HTTP ${res.status}`);
    return res.json();
  }

  async fetchSubmissionsByDay(username: string): Promise<SubmissionsByDay> {
    const data = await this.gql({
      query: RECENT_AC_QUERY,
      variables: { username, limit: 50 },
      operationName: "recentAcSubmissions",
    }, username) as { data: { recentAcSubmissionList: { titleSlug: string; timestamp: string }[] } };

    const submissions = data?.data?.recentAcSubmissionList;
    if (submissions == null) throw new Error(`User '${username}' not found or private.`);

    const byDate: Record<string, Set<string>> = {};
    for (const sub of submissions) {
      const dateStr = new Date(parseInt(sub.timestamp, 10) * 1000).toISOString().split("T")[0];
      if (!byDate[dateStr]) byDate[dateStr] = new Set();
      byDate[dateStr].add(sub.titleSlug);
    }
    const result: SubmissionsByDay = {};
    for (const [date, slugs] of Object.entries(byDate)) result[date] = slugs.size;
    return result;
  }

  async fetchTotalSolved(username: string): Promise<number> {
    const data = await this.gql({
      query: TOTAL_SOLVED_QUERY, variables: { username },
      operationName: "userProblemsSolved",
    }, username) as { data: { matchedUser: { submitStatsGlobal: { acSubmissionNum: { difficulty: string; count: number }[] } } } };

    const acList = data?.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum;
    if (!acList) return 0;
    return acList.find((e) => e.difficulty === "All")?.count ?? 0;
  }

  async fetchRecentSolvedProblems(username: string): Promise<RecentProblem[]> {
    const data = await this.gql({
      query: ALL_SUBMISSIONS_QUERY, variables: { username, limit: 50 },
      operationName: "userSubmissions",
    }, username) as { data: { recentSubmissionList: { title: string; titleSlug: string; timestamp: string; statusDisplay: string }[] } };

    const submissions = data?.data?.recentSubmissionList;
    if (!submissions) throw new Error(`Could not fetch submissions for '${username}'`);

    const seen = new Set<string>();
    const lastFive: { titleSlug: string; title: string; timestamp: string }[] = [];
    for (const sub of submissions) {
      if (sub.statusDisplay === "Accepted" && !seen.has(sub.titleSlug)) {
        seen.add(sub.titleSlug);
        lastFive.push({ titleSlug: sub.titleSlug, title: sub.title, timestamp: sub.timestamp });
        if (lastFive.length === 5) break;
      }
    }

    return Promise.all(lastFive.map(async ({ titleSlug, title, timestamp }) => {
      const attempts = submissions.filter((s) => s.titleSlug === titleSlug).length;
      let difficulty = "Unknown";
      try {
        const d = await this.gql({
          query: PROBLEM_DIFFICULTY_QUERY, variables: { titleSlug },
          operationName: "problemDifficulty",
        }) as { data: { question: { difficulty: string } } };
        difficulty = d?.data?.question?.difficulty ?? "Unknown";
      } catch { /* keep Unknown */ }
      return { title, titleSlug, difficulty, solvedAt: new Date(parseInt(timestamp, 10) * 1000).toISOString(), submissionCount: attempts };
    }));
  }

  async fetchTodayProblems(username: string, dateStr: string): Promise<TodayProblem[]> {
    const data = await this.gql({
      query: ALL_SUBMISSIONS_QUERY, variables: { username, limit: 50 },
      operationName: "userSubmissions",
    }, username) as { data: { recentSubmissionList: { title: string; titleSlug: string; timestamp: string; statusDisplay: string; lang: string }[] } };

    const submissions = data?.data?.recentSubmissionList;
    if (!submissions) return [];

    // Filter only today's accepted (unique problems)
    const todaySeen = new Set<string>();
    const todaySubs = submissions.filter((s) => {
      const sDate = new Date(parseInt(s.timestamp, 10) * 1000).toISOString().split("T")[0];
      return sDate === dateStr;
    });

    const todayAc: typeof todaySubs = [];
    for (const s of todaySubs) {
      if (s.statusDisplay === "Accepted" && !todaySeen.has(s.titleSlug)) {
        todaySeen.add(s.titleSlug);
        todayAc.push(s);
      }
    }

    return Promise.all(todayAc.map(async (s) => {
      const attempts = todaySubs.filter((x) => x.titleSlug === s.titleSlug).length;
      let difficulty = "Unknown";
      try {
        const d = await this.gql({
          query: PROBLEM_DIFFICULTY_QUERY, variables: { titleSlug: s.titleSlug },
          operationName: "problemDifficulty",
        }) as { data: { question: { difficulty: string } } };
        difficulty = d?.data?.question?.difficulty ?? "Unknown";
      } catch { /* keep Unknown */ }
      return {
        title: s.title, titleSlug: s.titleSlug, difficulty,
        solvedAt: new Date(parseInt(s.timestamp, 10) * 1000).toISOString(),
        submissionCount: attempts, lang: s.lang,
      };
    }));
  }

  async fetchUserProfile(username: string): Promise<UserProfile> {
    const data = await this.gql({
      query: USER_PROFILE_QUERY, variables: { username },
      operationName: "userProfile",
    }, username) as {
      data: {
        matchedUser: {
          username: string;
          profile: { realName: string; ranking: number };
          submitStatsGlobal: {
            acSubmissionNum: { difficulty: string; count: number }[];
            totalSubmissionNum: { difficulty: string; count: number }[];
          };
          tagProblemCounts: {
            advanced: { tagName: string; problemsSolved: number }[];
            intermediate: { tagName: string; problemsSolved: number }[];
            fundamental: { tagName: string; problemsSolved: number }[];
          };
          userCalendar: { submissionCalendar: string };
        };
        recentSubmissionList: { title: string; titleSlug: string; timestamp: string; statusDisplay: string; lang: string }[];
      };
    };

    const u = data?.data?.matchedUser;
    if (!u) throw new Error(`User '${username}' not found.`);

    const acNums = u.submitStatsGlobal.acSubmissionNum;
    const totalNums = u.submitStatsGlobal.totalSubmissionNum;
    const totalAc = acNums.find((e) => e.difficulty === "All")?.count ?? 0;
    const totalSub = totalNums.find((e) => e.difficulty === "All")?.count ?? 0;

    const allTopics = [
      ...(u.tagProblemCounts?.advanced ?? []),
      ...(u.tagProblemCounts?.intermediate ?? []),
      ...(u.tagProblemCounts?.fundamental ?? []),
    ].map((t) => ({ topicName: t.tagName, problemsSolved: t.problemsSolved }))
      .sort((a, b) => b.problemsSolved - a.problemsSolved);

    let calendar: { [k: string]: number } = {};
    try { calendar = JSON.parse(u.userCalendar?.submissionCalendar ?? "{}"); } catch { /**/ }

    return {
      username,
      realName: u.profile?.realName || username,
      ranking: u.profile?.ranking ?? 0,
      totalSolved: totalAc,
      easySolved: acNums.find((e) => e.difficulty === "Easy")?.count ?? 0,
      mediumSolved: acNums.find((e) => e.difficulty === "Medium")?.count ?? 0,
      hardSolved: acNums.find((e) => e.difficulty === "Hard")?.count ?? 0,
      acceptanceRate: totalSub > 0 ? Math.round((totalAc / totalSub) * 100) : 0,
      topicStats: allTopics,
      submissionCalendar: calendar,
      recentSubmissions: data.data.recentSubmissionList ?? [],
    };
  }
}
