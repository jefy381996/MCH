/**
 * Pins the cost of an oracle update. Publishing the script once as a
 * reference script must keep paying for itself; if a change makes updates
 * more expensive this test says by how much.
 */
import {
  Emulator,
  generateEmulatorAccount,
  getAddressDetails,
  Lucid,
} from '@lucid-evolution/lucid';
import { parseBasket, serializeBasket } from '@mch/index-core';
import { describe, expect, it } from 'vitest';
import { blueprintHashes } from '../src/blueprint.ts';
import type { Deployment } from '../src/deployment.ts';
import { createOracle, findReferenceScript, readFeed } from '../src/oracle-ops.ts';
import { oracleDatumToCbor, oracleRedeemer } from '../src/codec.ts';
import { oracleScript } from '../src/blueprint.ts';
import { oracleSettingsOf } from '../src/deployment.ts';

const basket = parseBasket({
  name: 'Fees',
  version: 1,
  baseDate: '2026-10-13',
  components: [
    { metal: 'XAU', weightPpm: 250_000, basePrice: '4000' },
    { metal: 'XAG', weightPpm: 250_000, basePrice: '48' },
    { metal: 'XPT', weightPpm: 250_000, basePrice: '1600' },
    { metal: 'NI', weightPpm: 250_000, basePrice: '15500' },
  ],
});
const PRICES = [4_000_000_000n, 48_000_000n, 1_600_000_000n, 15_500_000_000n];

describe('oracle update fees', () => {
  it('costs well under 1 ADA, and less with the reference script than without', async () => {
    const admin = generateEmulatorAccount({ lovelace: 1_000_000_000n });
    const operator = generateEmulatorAccount({ lovelace: 100_000_000n });
    const emulator = new Emulator([admin, operator]);
    const lucid = await Lucid(emulator, 'Custom');
    emulator.awaitBlock(15);
    lucid.selectWallet.fromSeed(admin.seedPhrase);
    const opHash = getAddressDetails(operator.address).paymentCredential!.hash;
    const created = await createOracle(lucid, {
      basket,
      operator: opHash,
      pricesMicro: PRICES,
      now: emulator.now(),
      publishReferenceScript: true,
    });
    emulator.awaitBlock(1);
    const deployment: Deployment = {
      network: 'Custom',
      deployedAt: '',
      blueprint: blueprintHashes(),
      oracle: {
        policyId: created.policyId,
        address: created.address,
        authUnit: created.authUnit,
        admin: created.settings.admin,
        seed: created.settings.seed,
        basket: serializeBasket(basket),
        maxValidityMs: created.settings.maxValidityMs,
        referenceScript: await findReferenceScript(lucid, created.txHash),
        createTx: created.txHash,
      },
    };

    lucid.selectWallet.fromSeed(operator.seedPhrase);
    emulator.awaitBlock(3);
    const { utxo, datum } = await readFeed(lucid, deployment);
    const now = emulator.now();
    const build = () =>
      lucid
        .newTx()
        .collectFrom([utxo], oracleRedeemer.update())
        .pay.ToContract(
          deployment.oracle!.address,
          { kind: 'inline', value: oracleDatumToCbor({ ...datum, sequence: 1, publishedAt: now }) },
          { lovelace: utxo.assets.lovelace!, [deployment.oracle!.authUnit]: 1n },
        )
        .addSignerKey(opHash)
        .validFrom(now - 60_000)
        .validTo(now + 240_000);

    const fee = async (tx: Awaited<ReturnType<ReturnType<typeof build>['complete']>>) =>
      BigInt(tx.toTransaction().body().fee());
    const withRef = await fee(
      await build()
        .readFrom(await lucid.utxosByOutRef([deployment.oracle!.referenceScript!]))
        .complete(),
    );
    const attached = await fee(
      await build()
        .attach.Script(oracleScript(oracleSettingsOf(deployment), 'Custom').script)
        .complete(),
    );
    console.log(
      `update fee: ${Number(withRef) / 1e6} ADA with reference script, ${Number(attached) / 1e6} ADA attached`,
    );
    expect(withRef).toBeLessThan(attached);
    expect(withRef).toBeLessThan(1_000_000n);
  });
});
