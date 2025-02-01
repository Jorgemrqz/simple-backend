const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { format } = require('fast-csv');
const { Pool } = require('pg');
const { Storage } = require('@google-cloud/storage');
const transporter = require('./emailConfig'); // Configuración de correo
const bucket = require('./gcsConfig'); // Configuración de Google Cloud Storage

// Crear una instancia de la app de Express
const app = express();
const PORT = process.env.PORT || 3000;
const fileName = 'books.csv';
const localPath = `./${fileName}`;
const cloudPath = `emails/${fileName}`;

// Configuración para la conexión a la base de datos PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: '192.168.220.141',
    database: 'book',
    password: '123',
    port: 5432,
});

// Middleware para CORS y JSON
app.use(cors());
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
    res.send('¡Hola, Mundo!');
});

// Función para obtener los libros, primero desde la base de datos y luego desde Google Cloud Storage si hay error
async function fetchBooks() {
    try {
        const result = await pool.query('SELECT * FROM book');
        return result.rows;
    } catch (err) {
        console.error('Error de conexión con la base de datos:', err);
        console.log('Intentando recuperar datos desde Google Cloud Storage...');

        // Si hay un error, intenta recuperar desde Google Cloud Storage
        const file = bucket.file(cloudPath);
        const [contents] = await file.download();
        
        return parseCSV(contents.toString());
    }
}

// Función para parsear el archivo CSV
function parseCSV(csvData) {
    const rows = csvData.split('\n');
    return rows.map(row => {
        const [title, author, email] = row.split(',');
        if (title && author && email) {
            return { title, author, email };
        }
    }).filter(book => book);
}

// Ruta para obtener todos los libros
app.get('/api/books', async (req, res) => {
    try {
        const books = await fetchBooks();
        res.json(books);
    } catch (err) {
        console.error('Error al obtener libros', err);
        res.status(500).send('Error al obtener libros');
    }
});

// Ruta para insertar un libro y su autor
app.post('/api/books', async (req, res) => {
    const { title, author, email } = req.body; // Se agrega email para identificar al autor

    if (!title || !author || !email) {
        return res.status(400).json({ mensaje: 'Título, autor y email son requeridos' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO book (title, author, email) VALUES ($1, $2, $3) RETURNING *',
            [title, author, email]
        );

        res.status(201).json({
            mensaje: 'Libro insertado correctamente',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error al insertar libro', err);
        res.status(500).send('Error al insertar libro');
    }
});

// Ruta para enviar un comentario al autor del libro por email
app.post('/api/comments', async (req, res) => {
    const { title, comment } = req.body;

    if (!title || !comment) {
        return res.status(400).json({ mensaje: 'Título y comentario son requeridos' });
    }

    try {
        const books = await fetchBooks();
        let email = '';

        // Buscar el libro y obtener el correo del autor
        for (let book of books) {
            if (book.title === title) {
                email = book.email;
                break;
            }
        }

        if (!email) {
            return res.status(404).json({ mensaje: 'Libro no encontrado' });
        }

        // Enviar el comentario al autor por correo
        const mailOptions = {
            from: 'tu-correo@gmail.com',
            to: email,
            subject: `Nuevo comentario en tu libro: ${title}`,
            text: `Han dejado un comentario en tu libro:\n\n"${comment}"`
        };

        await transporter.sendMail(mailOptions);

        res.status(200).json({ mensaje: 'Comentario enviado al autor' });

    } catch (err) {
        console.error('Error al enviar comentario', err);
        res.status(500).send('Error al enviar comentario');
    }
});

// Iniciar el servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});
