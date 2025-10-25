# CompileX - Real-Time Collaborative Code Editor 🚀

CompileX is a web-based collaborative code editor that allows multiple users to write, edit, and run code together in real-time. It features user authentication, room creation/joining, and code execution capabilities.

## Features ✨

* **Real-Time Collaboration:** Multiple users can join the same coding room and see edits live, powered by Socket.IO.
* **Code Execution:** Run code snippets directly in the browser (supports Python, JavaScript, C++, Java via Piston API).
* **User Authentication:** Secure signup and login using email/password or Google OAuth 2.0.
* **Room Management:** Create private coding rooms or join existing ones using unique Room IDs.
* **Syntax Highlighting:** Enhanced code readability with syntax highlighting (powered by CodeMirror).
* **Chat:** Built-in chat functionality for communication within a coding room.
* **Dark Theme:** Sleek and modern dark user interface.

## Tech Stack 🛠️

* **Frontend:** React, Vite, CSS, Axios, Socket.IO Client, React Router DOM
* **Backend:** Node.js, Express.js
* **Database:** Prisma ORM with SQLite (or PostgreSQL/MySQL, depending on your setup)
* **Real-Time Communication:** Socket.IO
* **Authentication:** JWT (JSON Web Tokens), Passport.js (for Google OAuth)
* **Code Execution:** Piston API (via Axios)

## Getting Started 🏁

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

* Node.js (v18 or later recommended)
* npm (usually comes with Node.js)
* Git

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd Online_code_editor
    ```

2.  **Install Server Dependencies:**
    ```bash
    cd server
    npm install
    ```

3.  **Install Client Dependencies:**
    ```bash
    cd ../client
    npm install
    ```

4.  **Set up Environment Variables (Server):**
    * Navigate back to the `server` directory.
    * Create a file named `.env` in the `server` directory.
    * Add the following environment variables (replace placeholder values):
        ```env
        # server/.env

        # For Prisma (Example uses SQLite, adjust if using PostgreSQL/MySQL)
        DATABASE_URL="file:./prisma/dev.db"

        # For JWT Authentication
        JWT_SECRET="YOUR_SUPER_SECRET_KEY_FOR_JWT" # Choose a strong, random string

        # For Google OAuth 2.0
        GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID_FROM_CLOUD_CONSOLE"
        GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET_FROM_CLOUD_CONSOLE"
        ```
    * **Important:** You need to obtain `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the [Google Cloud Console](https://console.cloud.google.com/) by setting up an OAuth 2.0 Client ID for a Web application. Remember to add `http://localhost:5001/api/auth/google/callback` to the "Authorized redirect URIs".

5.  **Set up Database (Server):**
    * Make sure you are in the `server` directory.
    * Run Prisma migrations to create the database schema:
        ```bash
        npx prisma migrate dev --name init
        ```
        *(This will create the SQLite database file if using the default `DATABASE_URL`)*

### Running the Application

1.  **Start the Backend Server:**
    * In the `server` directory terminal:
        ```bash
        npm run dev
        ```
    * The server should start on `http://localhost:5001`.

2.  **Start the Frontend Client:**
    * Open a **new terminal**.
    * Navigate to the `client` directory:
        ```bash
        cd ../client
        ```
    * Start the Vite development server:
        ```bash
        npm run dev
        ```
    * The application should open automatically in your browser at `http://localhost:5173`.

## Usage 🧑‍💻

1.  **Register/Login:** Create an account using your email and password, or sign in using your Google account.
2.  **Create a Room:** On the homepage, click "Create a New Room". You'll be redirected to a new editor page with a unique Room ID.
3.  **Join a Room:** On the homepage, enter an existing Room ID provided by someone else and click "Join".
4.  **Collaborate:** Once in a room, you can write code, see other users' cursors and selections in real-time, and chat with them.
5.  **Run Code:** Select the desired programming language, write your code, provide any necessary input (stdin), and click the "Run" button to see the output.

---

