import express from "express";
import pg from "pg";
import env from "dotenv";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

env.config();

const app = express();
app.use(cors());

// Multer setup (we gebruiken geheugen i.p.v. schijf)
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(express.json());

// PostgreSQL
const db = new pg.Client({
  user: process.env.pg_user,
  host: process.env.pg_host,
  database: process.env.pg_database,
  password: process.env.pg_password,
  port: process.env.pg_port,
});
db.connect();

// Cloudinary configureren
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  const { voornaam, familienaam } = req.body;
  console.log(voornaam, familienaam);
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "Geen bestand geüpload." });
  }

  try {
    
    // Bestand naar Cloudinary uploaden
    // const stream = cloudinary.uploader.upload_stream(
    //   { folder: "inschrijvingen" },
    const timestamp = Date.now(); // of new Date().toISOString() als je iets leesbaarders wil
const safeName = `${voornaam}_${familienaam}`.toLowerCase().replace(/\s+/g, "_");
const filename = `${safeName}_${timestamp}`;

const stream = cloudinary.uploader.upload_stream(
  {
    folder: "inschrijvingen",
    public_id: filename,
    overwrite: true
  },
      async (error, result) => {
        if (error) {
          console.error("Cloudinary fout:", error);
          return res.status(500).json({ error: "Upload naar Cloudinary mislukt." });
        }

        // URL opslaan in DB
        const fileUrl = result.secure_url;
        const dbResult = await db.query(
          "INSERT INTO documents (voornaam, familienaam, url) VALUES ($1, $2, $3) RETURNING *",
          [voornaam, familienaam, fileUrl]
        );

        res.status(201).json({
          message: "Upload succesvol!",
          document: dbResult.rows[0],
        });
      }
    );

    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
    bufferStream.push(null);
    bufferStream.pipe(stream);
  } catch (err) {
    console.error("Fout bij verwerking:", err);
    res.status(500).json({ error: "Interne serverfout" });
  }
});


app.get("/documents", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM documents ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen documenten:", err);
    res.status(500).json({ error: "Kon documenten niet ophalen." });
  }
});


// Test route
app.get("/", (req, res) => {
  res.send("Hello from Express with Cloudinary!");
});

app.listen(3000, () => {
  console.log("Server draait op http://localhost:3000");
});
