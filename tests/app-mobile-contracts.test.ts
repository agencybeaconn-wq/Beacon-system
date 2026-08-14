import assert from 'node:assert/strict';
import test from 'node:test';
import { deviceRegistrationSchema, journeyDefinitionSchema, pushPayloadSchema } from '../src/contracts/app-mobile.ts';

test('registro aceita instalação sem canal de push', () => {
    const result = deviceRegistrationSchema.safeParse({
        app_id: '04a0b9f6-0d5c-4b37-b5c1-47fa82056fd6',
        installation_id: '8f29f35d-93ef-4b0b-ad62-66a3a4ca3e10',
        expo_push_token: null,
        platform: 'android',
        app_version: '0.2.0',
        os_version: '16',
        device_model: 'teste',
        locale: 'pt-BR',
        shopify_customer_id: null,
    });
    assert.equal(result.success, true);
});

test('push aceita rota interna e rejeita destino externo', () => {
    const base = { title: 'Título', body: 'Corpo', image_url: null };
    assert.equal(pushPayloadSchema.safeParse({ ...base, deep_link: '/account' }).success, true);
    assert.equal(pushPayloadSchema.safeParse({ ...base, deep_link: '//externo.test' }).success, false);
    assert.equal(pushPayloadSchema.safeParse({ ...base, deep_link: 'https://externo.test' }).success, false);
});

test('jornada de conforto exige pelo menos um dia sem evento', () => {
    const base = {
        steps: [{ delay_minutes: 0, push: { title: 'Pedido', body: 'Seguimos acompanhando', image_url: null, deep_link: '/account' } }],
        exit_on: 'delivery',
    };
    assert.equal(journeyDefinitionSchema.safeParse({
        ...base, trigger: { kind: 'order_silent', days_without_event: 1 },
    }).success, true);
    assert.equal(journeyDefinitionSchema.safeParse({
        ...base, trigger: { kind: 'order_silent', days_without_event: 0 },
    }).success, false);
});
