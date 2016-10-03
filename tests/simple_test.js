/* global describe, it, xit, before, beforeEach, after, afterEach */
/* jslint node: true, esnext: true */

'use strict';

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should();

const path = require('path'),
  spawn = require('child_process').spawn,
  api = require('../api');

let symatem;


beforeEach('start SymatemAPI', done => {
  console.log('start SymatemAPI');
  symatem = spawn(path.join(__dirname, '..', 'SymatemAPI'), [path.join(__dirname, 'test.sdb')]);

  symatem.stdout.on('data', data => console.log(`stdout: ${data}`));
  symatem.stderr.on('data', data => console.log(`stderr: ${data}`));
  symatem.on('close', code => {
    symatem = undefined;
    console.log(`child process exited with code ${code}`);
  });
  symatem.on('error', err => console.log(`Failed to start child process. ${err}`));

  setTimeout(() => done(), 500);
});

afterEach(done => {
  if (symatem) {
    symatem.on('close', code => {
      symatem = undefined;
      console.log(`child process exited with code ${code}`);
      done();
    });

    symatem.kill();
  }
});

describe('connection', () => {
  it('opens', () =>
    api.open().then(connection =>
      connection.query(false, 9, 1, 2, 0).then(data => assert.deepEqual(data, [589]))
    )
  );

  xit('query', () =>
    api.open().then(connection =>
      connection.query(false, 9, 1, 2, 0).then(data => assert.deepEqual(data, [589]))
    )
  );
});
