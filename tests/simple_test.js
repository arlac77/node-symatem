/* global describe, it, xit, before, beforeEach, after, afterEach */
/* jslint node: true, esnext: true */

'use strict';

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should();

const path = require('path'),
  fs = require('fs'),
  spawn = require('child_process').spawn,
  api = require('../api');

let symatem;
let cp;


describe('connection problems', () => {
  it('should fail', () =>
    api.open('127.0.0.1', 12345)
    .catch(e => assert.equal(e.code, 'ECONNREFUSED'))
  );
});

describe('connection', () => {

  it('query', () =>
    cp.then(connection =>
      connection.query(false, api.queryMask.MMV, 1, 2, 0).then(data => assert.deepEqual(data, [589]))
    )
  );

  describe('upload', () => {
    describe('without package', () => {
      it('syntax error', () =>
        cp.then(connection =>
          connection.upload('(Entity; ]')
          .catch(result => assert.deepEqual(result, {
            Column: 11,
            Row: 1,
            Message: 'Missing closing bracket'
          }))
        )
      );
      it('valid', () =>
        cp.then(connection =>
          connection.upload('(Entity; Attribute Value;)')
          .then(result => connection.query(false, api.queryMask.MVI, result[0], 0, 0))
          .then(result => assert.deepEqual(result, [13, 28]))
        )
      );
    });

    it('query', () =>
      cp.then(connection =>
        connection.upload('Entity').then(result => {
          return connection.decodeSymbol(result[0]).then(data => assert.deepEqual(
            data, {
              Attribute: 'Value'
            }));
          /*return connection.query(false, api.queryMask.MVV, result[0], 2, 0).then(data => assert.deepEqual(
            data, [28, 32]));*/
        })
      )
    );

  });

  before('start SymatemAPI', done => {
    const store = path.join(__dirname, 'test.sdb');
    fs.unlink(store, error => {
      symatem = spawn(path.join(__dirname, '..', 'SymatemAPI'), [store]);

      symatem.stdout.on('data', data => console.log(`stdout: ${data}`));
      symatem.stderr.on('data', data => console.log(`stderr: ${data}`));
      symatem.on('error', err => console.log(`Failed to start child process. ${err}`));

      setTimeout(() => {
        cp = api.open();
        done();
      }, 300);
    });
  });

  after('stop SymatemAPI', done => {
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
});
