import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { eq, sql } from "drizzle-orm";
import { db, selfbeatUsersTable, selfbeatLoginLogTable } from "@workspace/db";
import { pool } from "@workspace/db";

const router = Router();

// ── Domain helper ──────────────────────────────────────────────────────────────
function getDomain(): string {
  return (
    process.env.REPLIT_DOMAINS?.split(",")[0] ||
    process.env.REPLIT_DEV_DOMAIN ||
    "localhost:8080"
  );
}

// ── Passport configuration ─────────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `https://${getDomain()}/api/auth/google/callback`,
      scope: ["profile", "email"],
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const userId = `google_${googleId}`;
        const email = profile.emails?.[0]?.value || null;
        const displayName = profile.displayName || null;
        const pictureUrl = profile.photos?.[0]?.value || null;

        const existing = await db
          .select()
          .from(selfbeatUsersTable)
          .where(eq(selfbeatUsersTable.id, userId))
          .limit(1);

        if (existing.length > 0) {
          // Update profile info + last sign-in
          await db
            .update(selfbeatUsersTable)
            .set({
              lastSignInAt: new Date(),
              ...(displayName && { displayName }),
              ...(pictureUrl && { pictureUrl }),
              ...(email && !existing[0].email && { email }),
            })
            .where(eq(selfbeatUsersTable.id, userId));

          return done(null, { id: userId });
        }

        // New user — 25 free credits
        await db.insert(selfbeatUsersTable).values({
          id: userId,
          email,
          displayName,
          pictureUrl,
          credits: 25,
          lastSignInAt: new Date(),
        });

        return done(null, { id: userId });
      } catch (err) {
        return done(err as Error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => done(null, user.id));

passport.deserializeUser(async (id: string, done) => {
  try {
    const [user] = await db
      .select()
      .from(selfbeatUsersTable)
      .where(eq(selfbeatUsersTable.id, id))
      .limit(1);
    done(null, user || null);
  } catch (err) {
    done(err);
  }
});

// ── Auth routes ────────────────────────────────────────────────────────────────

// Kick off Google OAuth
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth callback
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/sign-in?error=auth_failed" }),
  async (req, res) => {
    const user = req.user as any;
    if (!user) return res.redirect("/sign-in?error=no_user");

    // Attach userId to session
    (req.session as any).userId = user.id;

    // Log sign-in
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;
    db.insert(selfbeatLoginLogTable)
      .values({ userId: user.id, ipAddress: ip })
      .catch(() => {});

    // Redirect to success page (popup will close itself)
    res.redirect("/api/auth/success");
  }
);

// Tiny success page — posts message to opener and closes the popup
router.get("/success", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html>
<head><title>Signed in</title></head>
<body style="background:#0d1224;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <p>Signing you in...</p>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'selfbeat-auth-success' }, '*');
        setTimeout(function() { window.close(); }, 300);
      } else {
        window.location.href = '/';
      }
    } catch(e) {
      window.location.href = '/';
    }
  </script>
</body>
</html>`);
});

// Current user info
router.get("/me", (req, res) => {
  const user = req.user as any;
  if (!user) return res.status(401).json({ error: "Unauthenticated" });
  const now = new Date();
  const isUnlimited =
    user.hasUnlimited && (!user.unlimitedUntil || new Date(user.unlimitedUntil) > now);
  const isOnActiveTrial =
    user.trialUsed &&
    user.trialStartDate &&
    user.trialEndDate &&
    new Date(user.trialEndDate) > now;
  const trialEndDate = user.trialEndDate ? new Date(user.trialEndDate).toISOString() : null;
  const trialExpiredRecently =
    user.trialUsed &&
    user.trialEndDate &&
    new Date(user.trialEndDate) <= now &&
    now.getTime() - new Date(user.trialEndDate).getTime() < 24 * 60 * 60 * 1000;

  const isAdmin =
    !!user.email &&
    !!process.env.ADMIN_EMAIL &&
    user.email === process.env.ADMIN_EMAIL;

  res.json({
    ...user,
    isUnlimited,
    isOnActiveTrial,
    trialEndDate,
    trialExpiredRecently,
    isAdmin,
  });
});

// Sign out
router.post("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });
});

export { passport };
export default router;
