const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { format } = require('fast-csv');
const { Pool } = require('pg');
const { Storage } = require('@google-cloud/storage');
const transporter = require('./emailConfig');
const bucket = require('./gcsConfig');

const app = express();
const PORT = process.env.PORT || 3000;
const fileName = 'books.csv';
const localPath = `./${fileName}`;
const cloudPath = `emails/${fileName}`;

app.use(cors());
app.use(express.json());

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: '192.168.220.141',
    database: 'book',
    password: '123',
    port: 5432,
});

// Función para obtener los libros, primero de la base de datos y luego de Google Cloud Storage si hay un error
async function fetchBooks() {
    try {
        // Intentamos obtener los libros desde PostgreSQL
        const result = await pool.query('SELECT * FROM books');
        return result.rows;
    } catch (err) {
        console.error('Error de conexión con la base de datos:', err);
        console.log('Intentando recuperar datos desde Google Cloud Storage...');

        // Si hay un error, leemos desde Google Cloud Storage
        const file = bucket.file('emails/books.csv');
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
    }).filter(book => book);  // Filtra las filas vacías o mal formateadas
}

// Ruta para enviar un comentario al autor del libro
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
            from: 'erika05cristin@gmail.com',
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

// Inicia el servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);

});
