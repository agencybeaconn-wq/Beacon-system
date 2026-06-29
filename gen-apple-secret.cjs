const jwt = require('jsonwebtoken');
const fs = require('fs');

const teamId = '4FWZYLARA5';
const keyId = '3P63HT38HX';
const clientId = 'com.proplay.leverads.auth';
const privateKey = fs.readFileSync('AuthKey_3P63HT38HX.p8'); // Certifique-se de que o arquivo está na mesma pasta

const token = jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d', // O máximo permitido pela Apple é 6 meses (180 dias)
    audience: 'https://appleid.apple.com',
    issuer: teamId,
    subject: clientId,
    keyid: keyId,
});

console.log('Seu JWT para o Supabase:');
console.log(token);