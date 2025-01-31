const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'erika05cristin@gmail.com', // Cambia esto
        pass: 'Yolo1215123' // Usa una contraseña segura o App Password de Gmail
    }
});

module.exports = transporter;
