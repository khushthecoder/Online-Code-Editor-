const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const prisma = require("../prismaClient");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback",
      proxy: true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile || !profile.emails || !profile.emails[0]) {
          return done(new Error("No email found in Google profile"), null);
        }

        const email = profile.emails[0].value;
        const googleId = profile.id;
        const username = profile.displayName || email.split("@")[0];

        // Robust find/create using transaction or findFirst to avoid race conditions
        console.log(`[GoogleAuth] Processing user: ${email}`);

        // Try to find existing user by email or googleId
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [{ email: email }, { googleId: googleId }],
          },
        });

        if (existingUser) {
          // If user exists but no googleId, link it
          if (!existingUser.googleId) {
            console.log(`[GoogleAuth] Linking Google account to existing user: ${email}`);
            const updatedUser = await prisma.user.update({
              where: { id: existingUser.id },
              data: { googleId: googleId },
            });
            return done(null, updatedUser);
          }
          console.log(`[GoogleAuth] Logged in existing user: ${email}`);
          return done(null, existingUser);
        }

        // Create new user
        // Ensure unique username
        let baseUsername = profile.displayName || email.split("@")[0];
        baseUsername = baseUsername.replace(/\s+/g, '').toLowerCase(); // clean up
        const uniqueSuffix = Math.floor(1000 + Math.random() * 9000); // 4 digit random
        const finalUsername = `${baseUsername}${uniqueSuffix}`;

        console.log(`[GoogleAuth] Creating new user: ${email} as ${finalUsername}`);
        const newUser = await prisma.user.create({
          data: {
            username: finalUsername,
            email: email,
            googleId: googleId,
          },
        });

        return done(null, newUser);
      } catch (error) {
        console.error("[GoogleAuth] Error:", error);
        // If it's a connection error, we might see it here. 
        // Returning the error allows Passport to handle it (redirect to failure)
        return done(error, null);
      }
    }
  )
);
