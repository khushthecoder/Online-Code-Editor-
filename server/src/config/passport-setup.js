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
        const existingUser = await prisma.user.findUnique({
          where: { email: profile.emails[0].value },
        });

        if (existingUser) {
          console.log("Google user already exists:", existingUser.email);
          return done(null, existingUser);
        }

        console.log("Creating new Google user...");
        const newUser = await prisma.user.create({
          data: {
            username: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id,
          },
        });

        console.log("New user created:", newUser.email);
        return done(null, newUser);
      } catch (error) {
        console.error("Error in Google Strategy:", error);
        return done(error, null);
      }
    },
  ),
);
