// config/passport.js
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import User from '../models/User.js'; // Import User model

dotenv.config(); // Load environment variables

const configurePassport = () => {
    // --- Google OAuth Strategy ---
    if (process.env.ENABLE_GOOGLE_LOGIN === 'true' && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
        passport.use(
            new GoogleStrategy(
                {
                    clientID: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    // IMPORTANT: This callbackURL must match EXACTLY what you entered
                    // in your Google Developer Console Authorized redirect URIs
                    // Also ensure it matches the route defined in authRoutes.js
                    callbackURL: '/api/auth/google/callback', // Relative path if proxy is true, otherwise full URL
                    passReqToCallback: true, // Allows us to access the req object in the callback
                    // Consider setting 'proxy: true' if your app is behind a proxy (like Heroku, Nginx)
                    // This helps Passport correctly handle http/https protocol in callback URL
                    // proxy: true,
                },
                async (req, accessToken, refreshToken, profile, done) => {
                    // This function is called when Google redirects back after successful authentication
                    console.log('--- Google Profile Received ---');
                    console.log('ID:', profile.id);
                    console.log('DisplayName:', profile.displayName);
                    console.log('Email:', profile.emails ? profile.emails[0].value : 'No Public Email');
                    console.log('------------------------------');

                    const googleId = profile.id;
                    const email = profile.emails && profile.emails.length > 0 ? profile.emails[0].value.toLowerCase() : null;
                    const name = profile.displayName;
                    // profile.photos[0].value // Contains profile picture URL if needed

                    if (!email) {
                        // Cannot proceed without an email from Google profile
                        return done(new Error('Could not retrieve email from Google profile. Please ensure your Google account has a primary email.'), null);
                    }

                    try {
                        // 1. Find user by Google ID
                        let user = await User.findOne({ googleId: googleId });

                        if (user) {
                            // User found via Google ID - Log them in
                            console.log(`User found via Google ID: ${user.email}`);
                            return done(null, user); // Pass user object to passport serialize/deserialize
                        }

                        // 2. If no user by Google ID, check by email
                        user = await User.findOne({ email: email });

                        if (user) {
                            // User found via email - Link Google ID and log them in
                            console.log(`User found via Email (${email}), linking Google ID.`);
                            user.googleId = googleId;
                            // User registered via email might not be verified, mark as verified now
                            user.isVerified = true;
                            await user.save();
                            return done(null, user);
                        }

                        // 3. If no user found by Google ID or Email - Create new user
                        console.log(`No user found, creating new user: ${email}`);
                        const newUser = new User({
                            googleId: googleId,
                            email: email,
                            name: name,
                            isVerified: true, // Automatically verified via Google
                            // No password needed for OAuth users
                        });
                        await newUser.save();
                        return done(null, newUser);

                    } catch (err) {
                        console.error('Error in Google OAuth strategy:', err);
                        return done(err, null); // Pass error to Passport
                    }
                }
            )
        );
    } else {
         if (process.env.ENABLE_GOOGLE_LOGIN === 'true') {
             console.warn('Google Login is enabled but GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing in .env');
         }
    }


    // --- Add GitHub Strategy later ---
    // if (process.env.ENABLE_GITHUB_LOGIN === 'true' && ...) { ... }


    // --- Passport Session Setup (Serialization/Deserialization) ---
    // Used to store user info in a session (if using sessions) or just to manage login state.
    // Even with JWTs, these are often needed for the OAuth flow itself.
    passport.serializeUser((user, done) => {
        // Serialize user ID into the session/cookie
        done(null, user.id); // user.id is the MongoDB _id
    });

    passport.deserializeUser(async (id, done) => {
        // Deserialize user from the ID stored in session/cookie
        try {
            const user = await User.findById(id);
            done(null, user); // Attaches user object to req.user
        } catch (err) {
            done(err, null);
        }
    });
};

export default configurePassport;