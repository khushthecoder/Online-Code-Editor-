const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const prisma = require("../prismaClient");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.VITE_API_URL
        ? `${process.env.VITE_CLIENT_URL}/api/auth/google/callback`
        : "http://localhost:5001/api/auth/google/callback",
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


        console.log(`[GoogleAuth] Processing user: ${email}`);


        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [{ email: email }, { googleId: googleId }],
          },
        });

        if (existingUser) {

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

        let baseUsername = profile.displayName || email.split("@")[0];
        baseUsername = baseUsername.replace(/\s+/g, '').toLowerCase();
        const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
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
        console.error("🔥 [GoogleAuth] CRITICAL ERROR:", error);
        console.error("🔥 [GoogleAuth] Stack:", error.stack);

        return done(error, null);
      }
    }
  )
);
