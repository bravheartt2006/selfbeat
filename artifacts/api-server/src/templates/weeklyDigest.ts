export interface WeeklyDigestData {
  userName: string;
  unsubscribeUrl: string;
  topQuestions: { question: string; winner: string; winnerColor: string }[];
  highlight: { model: string; quote: string };
  leaderboard: { rank: number; model: string; wins: number }[];
  personalStats: {
    questionsThisWeek: number;
    streakDays: number;
    creditsRemaining: number;
    subscriptionStatus: string;
  };
  dailyQuestionUrl: string;
  featuredQuestion: string;
}

export function renderWeeklyDigest(data: WeeklyDigestData): string {
  const {
    userName,
    unsubscribeUrl,
    topQuestions,
    highlight,
    leaderboard,
    personalStats,
    dailyQuestionUrl,
    featuredQuestion,
  } = data;

  const questionRows = topQuestions
    .map(
      (q, i) => `
      <tr>
        <td style="padding:10px 16px; border-bottom:1px solid #1e2c4a; color:#94a3b8; font-size:13px; width:24px;">${i + 1}</td>
        <td style="padding:10px 16px; border-bottom:1px solid #1e2c4a; color:#e2e8f0; font-size:14px;">${escHtml(q.question)}</td>
        <td style="padding:10px 16px; border-bottom:1px solid #1e2c4a; font-size:13px; white-space:nowrap;">
          <span style="background:${q.winnerColor}22; color:${q.winnerColor}; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600;">${escHtml(q.winner)}</span>
        </td>
      </tr>`,
    )
    .join("");

  const leaderboardRows = leaderboard
    .slice(0, 5)
    .map(
      (r) => `
      <tr>
        <td style="padding:8px 16px; border-bottom:1px solid #1e2c4a; color:#94a3b8; font-size:13px; width:30px;">${r.rank}</td>
        <td style="padding:8px 16px; border-bottom:1px solid #1e2c4a; color:#e2e8f0; font-size:14px;">${escHtml(r.model)}</td>
        <td style="padding:8px 16px; border-bottom:1px solid #1e2c4a; color:#c8b560; font-size:14px; font-weight:600; text-align:right;">${r.wins.toLocaleString()} wins</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Selfbeat Weekly</title>
</head>
<body style="margin:0; padding:0; background:#0b1120; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0b1120; min-height:100vh;">
    <tr><td align="center" style="padding:32px 16px;">

      <!-- Card -->
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background:#111827; border-radius:16px; overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a5f 0%,#0f172a 100%); padding:36px 40px 28px; text-align:center; border-bottom:1px solid #1e2c4a;">
            <div style="font-size:28px; margin-bottom:8px;">🥁</div>
            <div style="font-family:Georgia,serif; font-size:26px; font-weight:700; color:#f1f5f9; letter-spacing:-0.5px;">Selfbeat Weekly</div>
            <div style="color:#94a3b8; font-size:14px; margin-top:6px;">Where AI meets its match — itself.</div>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:28px 40px 0;">
            <p style="margin:0; color:#cbd5e1; font-size:16px;">Hi ${escHtml(userName || "there")} 👋</p>
            <p style="margin:8px 0 0; color:#94a3b8; font-size:14px; line-height:1.6;">
              Here's your weekly roundup of the most interesting AI self-critiques, the current leaderboard, and your personal stats.
            </p>
          </td>
        </tr>

        <!-- Top questions -->
        <tr>
          <td style="padding:24px 40px 0;">
            <div style="font-family:Georgia,serif; font-size:16px; font-weight:700; color:#c8b560; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.05em; font-size:12px;">🏆 Top Questions This Week</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a; border-radius:10px; overflow:hidden;">
              <tr style="background:#1e2c4a;">
                <th style="padding:8px 16px; color:#64748b; font-size:11px; font-weight:600; text-align:left; text-transform:uppercase;">#</th>
                <th style="padding:8px 16px; color:#64748b; font-size:11px; font-weight:600; text-align:left; text-transform:uppercase;">Question</th>
                <th style="padding:8px 16px; color:#64748b; font-size:11px; font-weight:600; text-align:left; text-transform:uppercase;">Winner</th>
              </tr>
              ${questionRows || `<tr><td colspan="3" style="padding:16px; color:#64748b; font-size:13px; text-align:center;">No questions this week yet.</td></tr>`}
            </table>
          </td>
        </tr>

        <!-- Highlight -->
        <tr>
          <td style="padding:24px 40px 0;">
            <div style="font-family:Georgia,serif; font-size:12px; font-weight:700; color:#818cf8; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.05em;">✨ This Week's Highlight</div>
            <div style="background:#1e1b4b; border-left:3px solid #818cf8; border-radius:0 10px 10px 0; padding:16px 20px;">
              <p style="margin:0 0 8px; color:#a5b4fc; font-size:12px; font-weight:600; text-transform:uppercase;">${escHtml(highlight.model)}</p>
              <p style="margin:0; color:#c7d2fe; font-size:14px; line-height:1.6; font-style:italic;">"${escHtml(highlight.quote)}"</p>
            </div>
          </td>
        </tr>

        <!-- Leaderboard -->
        <tr>
          <td style="padding:24px 40px 0;">
            <div style="font-size:12px; font-weight:700; color:#f59e0b; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.05em;">⚡ Current Leaderboard</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a; border-radius:10px; overflow:hidden;">
              ${leaderboardRows || `<tr><td style="padding:16px; color:#64748b; font-size:13px; text-align:center;">No leaderboard data yet.</td></tr>`}
            </table>
          </td>
        </tr>

        <!-- Personal stats -->
        <tr>
          <td style="padding:24px 40px 0;">
            <div style="font-size:12px; font-weight:700; color:#34d399; margin-bottom:12px; text-transform:uppercase; letter-spacing:0.05em;">📊 Your Stats This Week</div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:4px 0; width:50%;">
                  <div style="background:#0f172a; border-radius:10px; padding:14px 16px; margin-right:6px;">
                    <div style="color:#64748b; font-size:11px; text-transform:uppercase; margin-bottom:4px;">Questions</div>
                    <div style="color:#f1f5f9; font-size:22px; font-weight:700; font-family:Georgia,serif;">${personalStats.questionsThisWeek}</div>
                  </div>
                </td>
                <td style="padding:4px 0; width:50%;">
                  <div style="background:#0f172a; border-radius:10px; padding:14px 16px; margin-left:6px;">
                    <div style="color:#64748b; font-size:11px; text-transform:uppercase; margin-bottom:4px;">🔥 Streak</div>
                    <div style="color:#fb923c; font-size:22px; font-weight:700; font-family:Georgia,serif;">${personalStats.streakDays} days</div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:4px 0;">
                  <div style="background:#0f172a; border-radius:10px; padding:14px 16px; margin-right:6px; margin-top:8px;">
                    <div style="color:#64748b; font-size:11px; text-transform:uppercase; margin-bottom:4px;">Credits Left</div>
                    <div style="color:#c8b560; font-size:22px; font-weight:700; font-family:Georgia,serif;">${personalStats.creditsRemaining === -1 ? "∞" : personalStats.creditsRemaining}</div>
                  </div>
                </td>
                <td style="padding:4px 0;">
                  <div style="background:#0f172a; border-radius:10px; padding:14px 16px; margin-left:6px; margin-top:8px;">
                    <div style="color:#64748b; font-size:11px; text-transform:uppercase; margin-bottom:4px;">Plan</div>
                    <div style="color:#a78bfa; font-size:16px; font-weight:700; font-family:Georgia,serif; padding-top:3px;">${escHtml(personalStats.subscriptionStatus)}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:28px 40px 0; text-align:center;">
            <div style="background:#0f172a; border:1px solid #1e2c4a; border-radius:12px; padding:24px;">
              <p style="margin:0 0 6px; color:#94a3b8; font-size:13px;">This week's featured question:</p>
              <p style="margin:0 0 20px; color:#e2e8f0; font-size:15px; font-weight:600; line-height:1.5; font-family:Georgia,serif;">"${escHtml(featuredQuestion)}"</p>
              <a href="${dailyQuestionUrl}" style="display:inline-block; background:linear-gradient(135deg,#c8b560,#a09040); color:#0b1120; text-decoration:none; font-weight:700; font-size:14px; padding:12px 28px; border-radius:999px;">
                Ask This Question Free →
              </a>
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:28px 40px 32px; text-align:center; border-top:1px solid #1e2c4a; margin-top:28px;">
            <p style="margin:0 0 8px; color:#475569; font-size:12px;">
              © ${new Date().getFullYear()} Selfbeat · Physician-founded
            </p>
            <p style="margin:0; font-size:12px;">
              <a href="${unsubscribeUrl}" style="color:#64748b; text-decoration:underline;">Unsubscribe from weekly digest</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

function escHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
