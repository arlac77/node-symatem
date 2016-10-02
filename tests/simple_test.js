/* global describe, it, xit, before, after */
/* jslint node: true, esnext: true */

'use strict';

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should();

const path = require('path'),
  spawn = require('child_process').spawn,
  api = require('../api');

describe('connection', () => {
  let symatem;
  before(() => {
    symatem = spawn(path.join(__dirname, '..', 'SymatemAPI'), ['aFile']);

    symatem.stdout.on('data', (data) => console.log(`stdout: ${data}`));
    symatem.stderr.on('data', (data) => console.log(`stderr: ${data}`));
    symatem.on('close', (code) => {
      symatem = undefined;
      console.log(`child process exited with code ${code}`);
    });
    symatem.on('error', (err) => console.log('Failed to start child process.'));
  });

  after(() => {
    if (symatem) {
      symatem.kill();
      symatem = undefined;
    }
  });

  const cp = api.open();

  it('opens', () =>
    cp.then(connection =>
      connection.query(9, 1, 2, 0).then(data => assert.deepEqual(data, [589]))
    )
  );

  xit('query', () =>
    cp.then(connection =>
      connection.query(9, 1, 2, 0).then(data => assert.deepEqual(data, [589]))
    )
  );
});
