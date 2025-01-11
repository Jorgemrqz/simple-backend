const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para CORS
app.use(cors());

// Middleware para manejar JSON
app.use(express.json());

// Ruta principal
app.get('/', (req, res) => {
    res.send('¡Hola, Mundo!');
});

// Ruta de ejemplo
app.get('/api', (req, res) => {
    res.json({ mensaje: 'Este es un endpoint simple.' });
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
