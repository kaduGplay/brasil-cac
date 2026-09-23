export default async function handler(request, response) {
    if (request.method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return response.status(204).end();
    }

    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Método não permitido' });
    }

    const publicKey = process.env.PIX_PUBLIC_KEY;
    const secretKey = process.env.PIX_SECRET_KEY;
    if (!publicKey || !secretKey) {
        return response.status(500).json({ message: 'Credenciais PIX não configuradas no servidor' });
    }

    const body = request.body || {};
    const client = body.client || {};
    if (!body.identifier || !Number.isFinite(Number(body.amount)) || Number(body.amount) < 0.01) {
        return response.status(400).json({ message: 'identifier e amount válido são obrigatórios' });
    }
    if (!client.name || !client.email || !client.phone) {
        return response.status(400).json({ message: 'Nome, e-mail e telefone do cliente são obrigatórios' });
    }

    const upstreamResponse = await fetch('https://dash.voidpayments.com/api/v1/gateway/pix/receive', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-public-key': publicKey,
            'x-secret-key': secretKey
        },
        body: JSON.stringify(body)
    });

    const data = await upstreamResponse.json().catch(() => ({
        message: 'A API PIX retornou uma resposta inválida'
    }));

    return response.status(upstreamResponse.status).json(data);
}
