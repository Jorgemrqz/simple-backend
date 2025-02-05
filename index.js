const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { Pool } = require("pg");
const { Storage } = require("@google-cloud/storage");
const transporter = require("./emailConfig"); // Configuración de correo
const bucket = require("./gcsConfig"); // Configuración de Google Cloud Storage

const fastCsvFormat = require("@fast-csv/format"); // Para escribir
const fastCsvParse = require("@fast-csv/parse"); // Para leer

// Crear una instancia de la app de Express
const app = express();
const PORT = process.env.PORT || 3000;
const commentsFile = "comentarios.csv";
const commentsCloudPath = `emails/${commentsFile}`;

// Configuración para la conexión a la base de datos PostgreSQL
const pool = new Pool({
  user: "postgres",
  host: "192.168.220.141",
  database: "book",
  password: "123",
  port: 5432,
});

// Middleware para CORS y JSON
app.use(cors());
app.use(express.json());

// Ruta principal
app.get("/", (req, res) => {
  res.send("¡Hola, Mundo!");
});

// Función para obtener los libros desde PostgreSQL
async function fetchBooks() {
  try {
    const result = await pool.query("SELECT * FROM book");
    return result.rows;
  } catch (err) {
    console.error("Error de conexión con la base de datos:", err);
    return [];
  }
}

// Ruta para obtener todos los libros
app.get("/api/books", async (req, res) => {
  try {
    const books = await fetchBooks();
    res.json(books);
  } catch (err) {
    console.error("Error al obtener libros", err);
    res.status(500).send("Error al obtener libros");
  }
});

// Ruta para insertar un libro y su autor en PostgreSQL
app.post("/api/books", async (req, res) => {
  const { title, author, email } = req.body;

  if (!title || !author || !email) {
    return res.status(400).json({ mensaje: "Título, autor y email son requeridos" });
  }

  try {
    const result = await pool.query(
      "INSERT INTO book (title, author, email) VALUES ($1, $2, $3) RETURNING *",
      [title, author, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error al insertar el libro", err);
    res.status(500).send("Error al insertar el libro");
  }
});

// Función para escribir comentarios en CSV y subir a Google Cloud Storage
async function appendToCommentsCSV(title, comment) {
  return new Promise((resolve, reject) => {
    const fileExists = fs.existsSync(commentsFile);
    const ws = fs.createWriteStream(commentsFile, {
      flags: "a",
      encoding: "utf8",
    });

    const csvStream = fastCsvFormat.format({
      headers: !fileExists,
      writeHeaders: !fileExists,
    });

    csvStream.pipe(ws);
    csvStream.write({ title, comment });
    ws.write("\n");
    csvStream.end();

    ws.on("finish", async () => {
      console.log("✅ Comentario guardado en CSV correctamente.");
      try {
        await bucket.upload(commentsFile, { destination: commentsCloudPath });
        console.log("☁️ Comentarios subidos a Google Cloud Storage.");
        resolve();
      } catch (err) {
        reject("❌ Error al subir comentarios a GCS: " + err);
      }
    });

    ws.on("error", (err) => reject("❌ Error al escribir en CSV: " + err));
  });
}

// Ruta para enviar un comentario y almacenarlo en CSV
app.post("/api/comments", async (req, res) => {
  const { title, comment } = req.body;

  if (!title || !comment) {
    return res.status(400).json({ mensaje: "Título y comentario son requeridos" });
  }

  try {
    const books = await fetchBooks();
    const book = books.find((b) => b.title === title);

    if (!book) {
      return res.status(404).json({ mensaje: "Libro no encontrado" });
    }

    await appendToCommentsCSV(title, comment);

    // Enviar el comentario al autor por correo
    const mailOptions = {
      from: "erika05cristin@gmail.com",
      to: book.email,
      subject: `Nuevo comentario en tu libro: ${title}`,
      text: `Han dejado un comentario en tu libro:\n\n"${comment}"`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ mensaje: "Comentario enviado y guardado correctamente" });
  } catch (err) {
    console.error("Error al procesar el comentario", err);
    res.status(500).send("Error al procesar el comentario");
  }
});

// Iniciar el servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor corriendo en http://0.0.0.0:${PORT}`);
});
