import User from '../models/User.js'; // Import the User model
import asyncHandler from 'express-async-handler'; // Import error handler utility
import generateToken from '../utils/generateToken.js';
import sendEmail from '../utils/sendEmail.js'; // Import email utility (if needed later)
import crypto from 'crypto'; // Import crypto for generating tokens

// --- Register User Function ---
/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = asyncHandler(async (req, res) => {
    // 1. Extract data from request body
    const { name, email, password } = req.body;

    // 2. Basic Validation (check if fields are provided)
    if (!name || !email || !password) {
        res.status(400); // Bad Request
        throw new Error('Please provide name, email, and password');
        // Note: Because we use asyncHandler, this error will be passed to our error handling middleware
    }

    // 3. Check if user already exists (by email)
    const userExists = await User.findOne({ email: email.toLowerCase() }); // Use lowercase email for check

    if (userExists) {
        res.status(400); // Bad Request
        throw new Error('User with that email already exists');
    }

    // 4. If user doesn't exist, create new user in memory
    const user = new User({
        name,
        email: email.toLowerCase(), // Store email in lowercase
        password, // Provide plain password - hashing happens in the pre-save hook
    });
    
    // --->  EMAIL VERIFICATION <---
    // Generate the verification token using the method on the user instance
    const verificationToken = user.generateEmailVerificationToken();
    // Note: At this point, user instance has hashed token & expiry set, but not saved yet
    console.log('>>> RegisterUser: Raw token received from generator:', verificationToken);
    
    // Build the verification URL
    // Ensure FRONTEND_URL is set in your .env file!
    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email/${verificationToken}`;

    // Email message content
    const message = `
        Thank you for registering for AuthStarter!

        Please click the link below to verify your email address:
        ${verifyUrl}

        This link will expire in 15 minutes.

        If you did not create an account, please ignore this email.
    `;
    // ---> END EMAIL VERIFICATION <---
    console.log('>>> RegisterUser: User object BEFORE save:', JSON.stringify(user, null, 2));

    // 5. Save the user to the database
    try {
        await user.save(); // This triggers the pre-save hook for password hashing
        console.log('>>> RegisterUser: User saved successfully.');
        // ---> SEND VERIFICATION EMAIL <---
        try {
            await sendEmail({
                email: user.email,
                subject: 'AuthStarter - Verify Your Email Address',
                message: message, // Send the plain text message
                // Optionally add an HTML version here if desired
            });

             res.status(201).json({
                 message: `User registered successfully. Verification email sent to ${user.email}.`,
                 _id: user._id,
                 name: user.name,
                 email: user.email,
                 isVerified: user.isVerified,
             });

        } catch (emailError) {
            console.error('Email sending failed after user registration:', emailError);
            // IMPORTANT: User is saved, but email failed. What to do?
            // Option A: Inform user, maybe provide a way to resend later.
            // Option B: For critical flows, potentially delete the user (complex).
            // For now, we'll let the registration succeed but inform about the email issue.
            user.emailVerificationToken = undefined; // Clear token fields if email fails? Debatable.
            user.emailVerificationExpires = undefined;
            await user.save({ validateBeforeSave: false }); // Save without validation to clear fields

            res.status(201).json({ // Still 201 as user was created
                 message: `User registered successfully, but failed to send verification email. Please contact support or try verifying later.`,
                 warning: 'Email sending failed.',
                 _id: user._id,
                 name: user.name,
                 email: user.email,
                 isVerified: user.isVerified, // Will be false
             });
        }
        // ---> END EMAIL SENDING <---

    } catch (error) {
        res.status(400); // Assume validation error from Mongoose or other save issue
        // Mongoose validation errors can be more specific, we can refine this later
        throw new Error(error.message || 'User registration failed');
    }
});

// --- Login User Function ---

/**
 * @desc    Authenticate user & get token (Login)
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = asyncHandler(async (req, res) => {
    // 1. Extract email and password from request body
    const { email, password } = req.body;

    // 2. Basic validation
    if (!email || !password) {
        res.status(400);
        throw new Error('Please provide email and password');
    }

    // 3. Find user by email - IMPORTANT: Explicitly select the password field
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    // 4. Check if user exists AND if password matches
    if (user && (await user.matchPassword(password))) {
        // Password matches! Generate token
        const token = generateToken(user._id);

        // TODO: Optionally handle email verification check here later
        // if (!user.isVerified) {
        //     res.status(401);
        //     throw new Error('Email not verified. Please check your inbox.');
        // }

        // 5. Send response with token and user info (excluding password)
        res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified, // Include verification status
            token: token, // The generated JWT
        });
    } else {
        // User not found or password doesn't match
        res.status(401); // Unauthorized
        throw new Error('Invalid email or password');
    }
});

//-- VERIFY EMAIL ADDRESS USING TOKEN--
/**
 * @desc    Verify email address using token
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
const verifyEmail = asyncHandler(async (req, res) => {
    // 1. Get the raw token from the URL params
    const rawToken = req.params.token;
    console.log('*** VerifyEmail: Raw token received from URL:', rawToken); // Add log

    // 2. Hash the raw token using the same method as when generated
    const hashedToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');
    console.log('*** VerifyEmail: Hashed token for lookup:', hashedToken); // Add log

    console.log('*** VerifyEmail: Finding user with query:', {
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: new Date(Date.now()).toLocaleString() }
    });
    // 3. Find the user by the hashed token & check expiry
    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() }, // Check if token hasn't expired
    });

    console.log('*** VerifyEmail: Result of User.findOne:', user ? `User Found (ID: ${user._id})` : 'User Not Found');

    // 4. Handle Token Not Found or Expired
    if (!user) {
        console.log('*** VerifyEmail: Throwing Invalid/Expired Error'); // Add log
        res.status(400); // Bad Request
        throw new Error('Invalid or expired email verification token.');
        // Consider redirecting to frontend error page:
        // return res.redirect(`${process.env.FRONTEND_URL}/invalid-token`);
    }

    // 5. Token is valid! Update user verification status
    user.isVerified = true;
    user.emailVerificationToken = undefined; // Clear the token fields
    user.emailVerificationExpire = undefined;

    await user.save({ validateBeforeSave: false }); // Save changes (skip validation if only clearing fields)

    // 6. Send success response
    res.status(200).json({ message: 'Email verified successfully.' });
    // Optionally redirect to a success page on the frontend:
    // res.redirect(`${process.env.FRONTEND_URL}/email-verified`);
});


//-- FORGOT PASSWORD FUNCTION--
/**
 * @desc    Request password reset link
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = asyncHandler(async (req, res) => {
    // 1. Get email from request body
    const { email } = req.body;

    if (!email) {
        res.status(400);
        throw new Error('Please provide an email address');
    }

    // 2. Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    // 3. IMPORTANT: Always send a success-like response, even if user not found.
    // This prevents attackers from checking which emails are registered.
    if (!user) {
        // Log potentially for monitoring, but don't reveal user non-existence
        // console.warn(`Password reset requested for non-existent email: ${email}`);
        return res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // 4. Check if user signed up with OAuth only (no password)
    // We might need to retrieve the password field specifically for this check
    // Alternatively, assume if user exists via email, they *could* have a password
    // or want to set one now. Let's proceed for now.
    // const userWithPass = await User.findById(user._id).select('+password');
    // if (!userWithPass.password && (userWithPass.googleId || userWithPass.githubId)) {
    //     return res.status(400).json({ message: 'Account registered via OAuth cannot reset password this way.' });
    // }


    // 5. Generate the reset token using the method on the user instance
    const resetToken = user.generatePasswordResetToken();

    // 6. Save the user document with the token fields
    // Use a try-catch in case save fails (though unlikely here if user exists)
    try {
        await user.save({ validateBeforeSave: false }); // Skip validation if only adding token fields
    } catch(saveError) {
        console.error('Error saving user with reset token:', saveError);
        // Clear the fields in case of partial failure before saving again or erroring out
        user.passwordResetToken = undefined;
        user.passwordResetExpire = undefined;
        // Rethrow or handle error appropriately
        res.status(500);
        throw new Error('Error processing password reset request. Please try again.');
    }


    // 7. Build the password reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // 8. Email message content
    const message = `
        You are receiving this email because you (or someone else) requested the reset of a password for your account.

        Please click the link below to reset your password:
        ${resetUrl}

        This link will expire in 10 minutes.

        If you did not request this, please ignore this email and your password will remain unchanged.
    `;

    // 9. Send the email
    try {
        await sendEmail({
            email: user.email,
            subject: 'AuthStarter - Password Reset Request',
            message: message,
        });

        // Send the success-like response
        res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });

    } catch (emailError) {
        console.error('Error sending password reset email:', emailError);
        // IMPORTANT: If email fails, the token is saved in DB but user doesn't know.
        // Clear the token fields from the user document to allow retries later.
        user.passwordResetToken = undefined;
        user.passwordResetExpire = undefined;
        await user.save({ validateBeforeSave: false });

        res.status(500); // Internal server error because email failed
        throw new Error('Could not send password reset email. Please try again later.');
    }
});

// --- resetPassword function  ---
/**
 * @desc    Reset password using token
 * @route   PUT /api/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = asyncHandler(async (req, res) => {
    // 1. Get the raw token from the URL params
    const rawToken = req.params.token;

    // 2. Get the new password from the request body
    const { password } = req.body;

    // Basic validation for new password
    if (!password) {
        res.status(400);
        throw new Error('Please provide a new password');
    }
    // Add more password strength validation here if desired (e.g., min length)
    if (password.length < 6) {
         res.status(400);
         throw new Error('Password must be at least 6 characters long');
    }

    // 3. Hash the raw token from the URL
    const hashedToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

    // 4. Find the user by the hashed token & check expiry
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpire: { $gt: Date.now() }, // Check if token hasn't expired
    });

    // 5. Handle Token Not Found or Expired
    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired password reset token.');
    }

    // 6. Token is valid! Set the new password
    user.password = password; // Assign the plain text password
    user.passwordResetToken = undefined; // Clear the reset token fields
    user.passwordResetExpire = undefined;

    // 7. Save the user. The pre-save hook will automatically hash the new password.
    try {
        await user.save(); // No need for validateBeforeSave:false as we are changing password

        // 8. Optionally: Send confirmation email (or just success response)
        // await sendEmail({ ... });

        res.status(200).json({ message: 'Password reset successful.' });

    } catch (saveError) {
         console.error('Error saving user after password reset:', saveError);
         res.status(500);
         throw new Error('Error resetting password. Please try again.');
    }
});



// --- Export the controller function ---
export { registerUser, loginUser, verifyEmail, forgotPassword, resetPassword };
// Note: Ensure to handle errors and edge cases in production code. This is a basic implementation.

