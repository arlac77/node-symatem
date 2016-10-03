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
  symatem = spawn(path.join(__dirname, '..', 'SymatemAPI'), [path.join(__dirname, 'test.sdb')]);

  symatem.stdout.on('data', data => console.log(`stdout: ${data}`));
  symatem.stderr.on('data', data => console.log(`stderr: ${data}`));
  symatem.on('error', err => console.log(`Failed to start child process. ${err}`));

  setTimeout(() => done(), 300);
});

afterEach('stop SymatemAPI', done => {
  if (symatem) {
    symatem.on('close', code => {
      symatem = undefined;
      console.log(`child process exited with code ${code}`);
      //done();
    });

    symatem.kill();
    done();

  } else {
    done();
  }
});


describe('connection', () => {
  describe('wrong connection', () => {
    it('should fail', () =>
      api.open('127.0.0.1', 12345)
      .catch(e => assert.equal(e.code, 'ECONNREFUSED'))
    );
  });

  it('opens', () =>
    api.open().then(connection =>
      connection.query(false, api.queryMask.MMV, 1, 2, 0).then(data => assert.deepEqual(data, [589]))
    )
  );

  xit('query', () =>
    api.open().then(connection =>
      connection.query(false, api.queryMask.MMV, 1, 2, 0).then(data => assert.deepEqual(data, [589]))
    )
  );

  xit('upload', () =>
    api.open().then(connection =>
      connection.upload('(Entity; Attribute Value;)')
      .then(symbol => connection.query(true, api.queryMask.MVI, symbol, 0, 0))
      .then(result => assert.deepEqual(result, [1]))
    )
  );
});
