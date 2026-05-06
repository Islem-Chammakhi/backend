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

const server = app.listen(process.env.PORT || 3000, "0.0.0.0", () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});
