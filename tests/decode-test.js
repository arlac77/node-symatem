import test from 'ava';
import { open, queryMask } from '../src/api';

const path = require('path'),
  fs = require('fs'),
  { spawn } = require('child_process');

const hrl = `
(name device1;
	networkInterface (
		ipv4Address 10.0.0.1;
		macAddress 72:41:0A:A9:58:01;
	);
)

(name device2;
	networkInterface (
		ipv4Address 10.0.0.2;
		macAddress 72:41:0A:A9:58:02;
	);
)
`;

test('decode object present', async t => {
  const store = path.join(__dirname, 'test2.sdb');
  const connection = await open({
    port: 1235,
    store: store
  });

  await connection.upload(hrl);

  const result = await connection.upload('networkInterface');
  const symbols = await connection.query(
    false,
    symatem.queryMask.VMV,
    0,
    result[0],
    0
  );

  const dps = await Promise.all(
    symbols.map(symbol => connection.decodeSymbolWithCache(symbol))
  );
  t.deepEqual(dps, [
    {
      name: 'device1'
    },
    {
      ipv4Address: '10.0.0.1',
      macAddress: '72:41:0A:A9:58:01'
    },
    {
      name: 'device2'
    },
    {
      ipv4Address: '10.0.0.2',
      macAddress: '72:41:0A:A9:58:02'
    }
  ]);

  await connection.close();
});
