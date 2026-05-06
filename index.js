const express = require("express");
const cors = require("cors");
const axios = require("axios");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const useJsonStorage = ["1", "true", "yes", "on"].includes(
  String(process.env.USE_JSON_STORAGE || "").toLowerCase(),
);

const usersFilePath = path.join(__dirname, "data", "users.json");
const sampleUsers = [
  { id: 1, name: "John Doe", email: "john@example.com" },
  { id: 2, name: "Jane Smith", email: "jane@example.com" },
  { id: 3, name: "Bob Johnson", email: "bob@example.com" },
];

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.options("*", cors());
app.use(express.json());

let db = null;
let dbReady = Promise.resolve();

function initializeDatabase() {
  const mysql = require("mysql2");
  db = mysql.createConnection({
    host:
      process.env.DB_HOST ||
      "database1.colpdmacwjni.us-east-1.rds.amazonaws.com",
    user: process.env.DB_USER || "admin",
    password: process.env.DB_PASSWORD || "admin123",
    database: process.env.DB_NAME || "database3",
  });

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const insertUsersQuery = `
    INSERT IGNORE INTO users (name, email) VALUES
    ('John Doe', 'john@example.com'),
    ('Jane Smith', 'jane@example.com'),
    ('Bob Johnson', 'bob@example.com');
  `;

  return new Promise((resolve, reject) => {
    db.connect((connectError) => {
      if (connectError) {
        console.error("Error connecting to the database:", connectError);
        reject(connectError);
        return;
      }

      console.log("Connected to MySQL database");

      db.query(createTableQuery, (createError) => {
        if (createError) {
          console.error("Error creating table:", createError);
          reject(createError);
          return;
        }

        db.query(insertUsersQuery, (insertError) => {
          if (insertError) {
            console.error("Error inserting users:", insertError);
            reject(insertError);
            return;
          }

          console.log("Users table is ready");
          resolve();
        });
      });
    });
  });
}

async function initializeJsonStorage() {
  await fs.mkdir(path.dirname(usersFilePath), { recursive: true });

  try {
    await fs.access(usersFilePath);
  } catch {
    const initialUsers = sampleUsers.map((user) => ({
      ...user,
      created_at: new Date().toISOString(),
    }));

    await fs.writeFile(
      usersFilePath,
      `${JSON.stringify(initialUsers, null, 2)}\n`,
      "utf8",
    );
    console.log(`JSON storage initialized at ${usersFilePath}`);
  }
}

function queryDb(query, params = []) {
  return dbReady.then(
    () =>
      new Promise((resolve, reject) => {
        db.query(query, params, (error, results) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(results);
        });
      }),
  );
}

async function readUsersFromFile() {
  await initializeJsonStorage();
  const content = await fs.readFile(usersFilePath, "utf8");
  const users = JSON.parse(content || "[]");

  if (!Array.isArray(users)) {
    throw new Error("Invalid users JSON format. Expected an array.");
  }

  return users;
}

async function writeUsersToFile(users) {
  await fs.writeFile(
    usersFilePath,
    `${JSON.stringify(users, null, 2)}\n`,
    "utf8",
  );
}

function getNextId(users) {
  return (
    users.reduce((maxId, user) => Math.max(maxId, Number(user.id) || 0), 0) + 1
  );
}

async function getAllUsers() {
  if (useJsonStorage) {
    return readUsersFromFile();
  }

  return queryDb("SELECT * FROM users");
}

async function getUserById(userId) {
  if (useJsonStorage) {
    const users = await readUsersFromFile();
    return users.find((user) => Number(user.id) === Number(userId)) || null;
  }

  const results = await queryDb("SELECT * FROM users WHERE id = ?", [userId]);
  return results[0] || null;
}

async function createUser(data) {
  if (useJsonStorage) {
    const users = await readUsersFromFile();

    if (users.some((user) => user.email === data.email)) {
      const duplicateError = new Error("Email already exists");
      duplicateError.code = "ER_DUP_ENTRY";
      throw duplicateError;
    }

    const newUser = {
      id: getNextId(users),
      name: data.name,
      email: data.email,
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    await writeUsersToFile(users);
    return newUser;
  }

  const result = await queryDb(
    "INSERT INTO users (name, email) VALUES (?, ?)",
    [data.name, data.email],
  );

  return {
    id: result.insertId,
    name: data.name,
    email: data.email,
  };
}

async function updateUser(userId, data) {
  if (useJsonStorage) {
    const users = await readUsersFromFile();
    const index = users.findIndex((user) => Number(user.id) === Number(userId));

    if (index === -1) {
      return null;
    }

    const duplicateEmail = users.some(
      (user, userIndex) => userIndex !== index && user.email === data.email,
    );

    if (duplicateEmail) {
      const duplicateError = new Error("Email already exists");
      duplicateError.code = "ER_DUP_ENTRY";
      throw duplicateError;
    }

    users[index] = {
      ...users[index],
      name: data.name,
      email: data.email,
    };

    await writeUsersToFile(users);
    return users[index];
  }

  const result = await queryDb(
    "UPDATE users SET name = ?, email = ? WHERE id = ?",
    [data.name, data.email, userId],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return {
    id: Number(userId),
    name: data.name,
    email: data.email,
  };
}

async function deleteUser(userId) {
  if (useJsonStorage) {
    const users = await readUsersFromFile();
    const index = users.findIndex((user) => Number(user.id) === Number(userId));

    if (index === -1) {
      return false;
    }

    users.splice(index, 1);
    await writeUsersToFile(users);
    return true;
  }

  const result = await queryDb("DELETE FROM users WHERE id = ?", [userId]);
  return result.affectedRows > 0;
}

function handleStorageError(res, error) {
  console.error("Error in storage operation:", error);

  if (error && error.code === "ER_DUP_ENTRY") {
    return res.status(409).json({ error: "Email already exists" });
  }

  return res.status(500).json({
    error: useJsonStorage ? "File storage error" : "Database error",
  });
}

if (useJsonStorage) {
  initializeJsonStorage()
    .then(() => {
      console.log("Storage mode: JSON file");
    })
    .catch((error) => {
      console.error("Error initializing JSON storage:", error);
    });
} else {
  dbReady = initializeDatabase();
  dbReady.catch((error) => {
    console.error("Database initialization failed:", error);
  });
}

// Routes
app.get("/server-info", async (req, res) => {
  try {
    let instanceId = "unknown";
    let availabilityZone = "unknown";

    try {
      const instanceResponse = await axios.get(
        "http://169.254.169.254/latest/meta-data/instance-id",
        { timeout: 1000 },
      );

      const zoneResponse = await axios.get(
        "http://169.254.169.254/latest/meta-data/placement/availability-zone",
        { timeout: 1000 },
      );

      instanceId = instanceResponse.data;
      availabilityZone = zoneResponse.data;
    } catch (error) {
      console.log("Not running on EC2 or metadata service not available");
    }

    res.json({
      instanceId,
      availabilityZone,
      hostname: os.hostname(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching server info:", error);
    res.status(500).json({ error: "Failed to get server information" });
  }
});

app.get("/", (req, res) => {
  res.status(200).json("Hello from Backend app!");
});
app.get("/health", (req, res) => {
  res.status(200).json("Hello from Backend app!");
});

app.get("/api/users", async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (error) {
    handleStorageError(res, error);
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (error) {
    return handleStorageError(res, error);
  }
});

app.post("/api/users", async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  try {
    const user = await createUser({ name, email });
    return res
      .status(201)
      .json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    return handleStorageError(res, error);
  }
});

app.put("/api/users/:id", async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  try {
    const user = await updateUser(req.params.id, { name, email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ id: user.id, name: user.name, email: user.email });
  } catch (error) {
    return handleStorageError(res, error);
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const deleted = await deleteUser(req.params.id);

    if (!deleted) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(204).send();
  } catch (error) {
    return handleStorageError(res, error);
  }
});

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");

    if (!db) {
      process.exit(0);
      return;
    }

    db.end((error) => {
      if (error) {
        console.error("Error while closing database connection:", error);
      }
      process.exit(0);
    });
  });
});
