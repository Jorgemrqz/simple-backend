const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');  // Importamos la librería 'pg'

// Crear una instancia de la app de Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configuración para la conexión a la base de datos PostgreSQL
const pool = new Pool({
    user: 'postgres',           // Reemplaza con tu usuario de PostgreSQL
    host: '192.168.220.141',           // Dirección de tu servidor de base de datos
    database: 'book',   // Nombre de tu base de datos
    password: '123',   // Tu contraseña de base de datos
    port: 5432,                  // Puerto por defecto de PostgreSQL
});

// Middleware para CORS
app.use(cors());

// Middleware para manejar JSON
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
    res.send('¡Hola, Mundo!');
});

// Ruta para obtener todos los libros y autores
app.get('/api/books', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM book'); // Obtenemos todos los libros
        res.json(result.rows); // Enviamos los resultados en formato JSON
    } catch (err) {
        console.error('Error al obtener libros', err);
        res.status(500).send('Error al obtener libros');
    }
});

// Ruta para insertar un libro y su autor
app.post('/api/books', async (req, res) => {
    const { title, author } = req.body;  // Extraemos título y autor del cuerpo de la solicitud

    if (!title || !author) {
        return res.status(400).json({ mensaje: 'El título y el autor son requeridos' });
    }

    try {
        // Insertamos un nuevo libro en la tabla 'books'
        const result = await pool.query(
            'INSERT INTO book (title, author) VALUES ($1, $2) RETURNING *',
            [title, author]
        );
        res.status(201).json({
            mensaje: 'Libro insertado correctamente',
            data: result.rows[0] // Retornamos el libro insertado
        });
    } catch (err) {
        console.error('Error al insertar libro', err);
        res.status(500).send('Error al insertar libro');
    }
});

// Inicia el servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
    
});
