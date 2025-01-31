const { Storage } = require('@google-cloud/storage');

const storage = new Storage({ keyFilename: 'google-cloud-credentials.json' });

const bucketName = 'bucket_email_ev'; // Cambia esto por tu bucket
const bucket = storage.bucket(bucketName);

module.exports = bucket;
