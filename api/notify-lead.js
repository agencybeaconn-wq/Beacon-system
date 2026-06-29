// Vercel Serverless Function - Proxy para enviar WhatsApp via Evolution API
// Simplificada: envia direto sem verificar estado para ser rápida

const EVOLUTION_API_URL = 'https://evo.jotabot.site';
const EVOLUTION_API_KEY = 'JotaBotEVO2025_API_Key_Definitiva';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { instance_name, number, text } = req.body;

        if (!instance_name || !number || !text) {
            return res.status(400).json({ error: 'Missing: instance_name, number, text' });
        }

        // Envia direto sem verificar estado (mais rápido)
        const sendRes = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instance_name}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
            body: JSON.stringify({ number, text })
        });

        const sendData = await sendRes.text();

        return res.status(sendRes.ok ? 200 : 502).json({
            success: sendRes.ok,
            status: sendRes.status,
            response: sendData.substring(0, 300)
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
