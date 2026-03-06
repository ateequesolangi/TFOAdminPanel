# TFO Admin Panel

A modern, sleek, and premium admin panel for TFO (The Final Overs) Cricket game management. Built with Node.js, Express, and EJS, featuring a glassmorphism dark theme.

## 🚀 Features

- **Dashboard**: Overview of key metrics and Community engagement.
- **Feedback Management**: Analyze user feedback with interactive charts and AI insights.
- **Community Polls**: Create and manage voting polls for the community.
- **Media Management (Ad Stadium)**: Upload and manage in-game stadium advertisements.
- **Multiplayer Content**: Manage local multiplayer zip uploads.
- **Review Bat Unlock**: Manually grant review-exclusive items based on user reviews.
- **Leaderboards**: Track GP Rankings for both personal and public categories.

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MySQL
- **Templating**: EJS
- **Styling**: Bootstrap 5 + Vanilla CSS (Glassmorphism)
- **Icons**: IonIcons, FontAwesome
- **Charts**: Chart.js

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/tfo-admin-panel.git
   cd tfo-admin-panel
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Fill in your database credentials and reCAPTCHA keys.

4. **Database Setup**:
   - Create a MySQL database named `halljyqm_tfoprofile`.
   - Ensure the `admin` and `users` tables are present (refer to schema documentation if available).

5. **Run the Application**:
   ```bash
   # For production
   npm start

   # For development (automatic bypass of reCAPTCHA on localhost:3000)
   npm run dev
   ```

## 🔐 Security Features

- **Dynamic reCAPTCHA**: Automatically enabled on production hosts and bypassed only on `localhost:3000` for development convenience.
- **Session Management**: Secure cookie-based sessions for administrator authentication.
- **Encrypted Storage**: Secure handling of sensitive user data.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
