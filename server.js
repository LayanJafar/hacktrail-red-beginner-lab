const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use("/public", express.static(path.join(__dirname, "public")));

// Database
const db = new sqlite3.Database("./lab.db");

// Create table + seed data
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      password TEXT,
      role TEXT,
      secret TEXT
    )
  `);

  db.get("SELECT COUNT(*) AS count FROM users", (err, row) => {
    if (err) {
      console.error("DB count error:", err.message);
      return;
    }

    if (row.count === 0) {
      db.run(`
        INSERT INTO users (username, password, role, secret)
        VALUES
        ('administrator', 'admin123', 'admin', 'FLAG{admin_access}'),
        ('student1', '123456', 'student', 'FLAG{student}')
      `);
      console.log("Database seeded");
    }
  });
});

// In-memory sessions
const sessions = {};

// Intro
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "intro.html"));
});

app.get("/intro", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "intro.html"));
});

// Login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

// Vulnerable login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const query = `SELECT * FROM users WHERE username='${username}' AND password='${password}'`;

  console.log("Executing:", query);

  db.get(query, (err, user) => {
    if (err) {
      console.error("SQL Error:", err.message);
      return res.redirect("/login?error=1");
    }

    if (user) {
      const sessionId = Math.random().toString(36).substring(2);

      const exploitUsed = username.trim() === "administrator'--";

      console.log("Username entered:", username);
      console.log("Exploit used:", exploitUsed);

      sessions[sessionId] = {
        username: user.username,
        role: user.role,
        exploitUsed: exploitUsed
      };

      res.cookie("sessionId", sessionId);
      return res.redirect("/dashboard");
    }

    return res.redirect("/login?error=1");
  });
});

// Dashboard
app.get("/dashboard", (req, res) => {
  const session = sessions[req.cookies.sessionId];

  if (!session) return res.redirect("/login");

  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

// Session API
app.get("/api/session", (req, res) => {
  const session = sessions[req.cookies.sessionId];

  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  res.json({
    username: session.username,
    role: session.role,
    exploitUsed: session.exploitUsed,
    flag1: session.exploitUsed
      ? "Authentication Bypass → The system accepted manipulated input and granted access without proper credential verification."
      : ""
  });
});

// Admin panel
app.get("/admin-panel", (req, res) => {
  const session = sessions[req.cookies.sessionId];

  if (!session) return res.redirect("/login");

  if (session.role !== "admin") {
    return res.sendFile(path.join(__dirname, "views", "denied.html"));
  }

  res.sendFile(path.join(__dirname, "views", "admin.html"));
});

// Admin secret / flag 2
app.get("/api/admin-secret", (req, res) => {
  const session = sessions[req.cookies.sessionId];

  if (!session || session.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }

  return res.json({
    exploitUsed: session.exploitUsed,
    flag2: session.exploitUsed
      ? "Privilege Escalation → You reached an administrator-only area through untrusted input and improper authorization handling."
      : ""
  });
});

// Logout
app.get("/logout", (req, res) => {
  delete sessions[req.cookies.sessionId];
  res.clearCookie("sessionId");
  res.redirect("/login");
});

app.listen(PORT, () => {
  console.log(`Lab running on http://localhost:${PORT}`);
});