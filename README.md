# AuthStarter

**A battle-tested auth starter kit – built for devs who just want auth to work.**

## Features

- User registration & login (with JWT)
- Email verification
- Password reset via email
- Google OAuth integration
- Secure token handling
- Modular and clean project structure
- Uses modern **ESM (ECMAScript Modules)** – no `require`, only `import/export`

## Tech Stack

- Node.js
- Express.js
- MongoDB & Mongoose
- JSON Web Tokens (JWT)
- Nodemailer
- Passport.js

## Getting Started

### Clone the repository

```bash
git clone https://github.com/master-longhord/AuthStarter.git
cd AuthStarter

install dependencies
npm install

Environment Variables
Create a .env file using .env.example as a reference.

Run the server 
npm run dev

Folder Structure
├── config          # DB and Passport config
├── controllers     # Auth logic
├── middleware      # Error and auth middleware
├── models          # User schema
├── routes          # API routes
├── utils           # Token generation, email utils

API Usage
POST /api/auth/register
Register a new user.
Body: { name, email, password }

POST /api/auth/login
Login with email & password.
Body: { email, password }
Returns: JWT token

GET /api/auth/verify/:token
Verify user email with token sent via mail.

POST /api/auth/forgot-password
Trigger password reset link via email.
Body: { email }

POST /api/auth/reset-password/:token
Reset your password using the token.
Body: { newPassword }

GET /api/auth/google
Trigger Google OAuth login.

GET /api/auth/google/callback
OAuth redirect URL from Google. Handles token creation & login.

License
MIT
