import express from 'express';
// We will import controller functions here later
import { registerUser, loginUser, verifyEmail, forgotPassword , resetPassword} from '../controllers/authController.js'; 
import passport from 'passport'; // Import passport for authentication
import generateToken from '../utils/generateToken.js'; // Import the token generation utility

const router = express.Router();

//--Auth Routes--

// Define the login route
// POST /api/auth/login
router.post('/login', loginUser); 

//-- Define the registration route--
// POST /api/auth/register
router.post('/register', registerUser);

//-- Define the email verification route--
// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', verifyEmail);

//--Add forgot password route--
// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPassword);

//--Add reset password route--
// PUT /api/auth/reset-password/:token
router.put('/reset-password/:token', resetPassword);

//--Google OAuth route--
// GET /api/auth/google
router.get('/google',
    (req, res, next) => {
        // Check if Google login is enabled before attempting
        if (process.env.ENABLE_GOOGLE_LOGIN !== 'true' || !process.env.GOOGLE_CLIENT_ID) {
            return res.status(400).json({ message: 'Google login is not enabled or configured.' });
        }
        next(); // Proceed to passport authenticate
    },
    passport.authenticate('google', {
        scope: ['profile', 'email'], // Request access to profile info and email
        // Optional: prompt: 'select_account' // Forces user to select account every time
    })
);

// Callback route Google redirects to after authentication
// GET /api/auth/google/callback
router.get('/google/callback',
    passport.authenticate('google', {
        // failureRedirect: '/login', // Optional: Redirect if Google auth fails
        session: false // We are using JWTs, don't create a server session
    }),
    (req, res) => {
        // --- Successful Authentication ---
        // Passport attaches the user object to req.user based on the 'done(null, user)' call in the strategy
        if (!req.user) {
            // Should not happen if passport.authenticate succeeded, but good check
             console.error('User object not found after successful Google auth.');
             return res.redirect(`${process.env.FRONTEND_URL}/login?error=AuthenticationFailed`); // Redirect frontend on error
        }

        console.log('Google callback successful, user:', req.user.email);

        // Generate JWT for the authenticated user
        const token = generateToken(req.user._id);

        // Redirect user back to the frontend, passing the token
        // Option A: Redirect with token in query parameter (simple, but token visible)
        // res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);

        // Option B: Redirect and have frontend store token (if frontend can handle it)
        // This is often preferred. Frontend might store in localStorage/cookie.
        // Send user data along if needed by frontend immediately after login
        const userData = JSON.stringify({ // Stringify to safely pass in URL
             _id: req.user._id,
             name: req.user.name,
             email: req.user.email,
             isVerified: req.user.isVerified,
             token: token
         });
        res.redirect(`${process.env.FRONTEND_URL}/login/success?user=${encodeURIComponent(userData)}`);

        // Option C: Set HttpOnly cookie with token (more secure if frontend/backend on same domain or configured CORS)
        // res.cookie('jwt', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 30 * 24 * 60 * 60 * 1000 });
        // res.redirect(`${process.env.FRONTEND_URL}/dashboard`); // Redirect to protected area
    }
);

export default router;