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
  api = require('../dist/api');

let cp;

describe('connection problems', () => {
  it('should fail', () =>
    api.open({
      port: 12345
    })
    .catch(e => assert.equal(e.code, 'ECONNREFUSED'))
  );
});

describe('connection', () => {

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

    describe('query', () => {
      it('simple', () =>
        cp.then(connection =>
          connection.query(false, api.queryMask.MMV, 1, 2, 0).then(data => assert.deepEqual(data, [589]))
        )
      );

      describe('decode with cache', () => {
        it('known value', () =>
          cp.then(connection =>
            connection.upload('(Entity; Attribute Value;)').then(() =>
              connection.upload('Entity').then(result =>
                connection.decodeSymbolWithCache(result[0]).then(data => assert.deepEqual(
                  data, {
                    Attribute: 'Value',
                    BlobType: 'UTF8'
                  }))
              )
            ))
        );

        it('known value again', () =>
          cp.then(connection =>
            connection.upload('(Entity; Attribute Value;)').then(() =>
              connection.upload('Entity').then(result =>
                connection.decodeSymbolWithCache(result[0]).then(data => assert.deepEqual(
                  data, {
                    Attribute: 'Value',
                    BlobType: 'UTF8'
                  }))
              )
            ))
        );
      });

      describe('decode', () => {
        it('known value', () =>
          cp.then(connection =>
            connection.upload('(Entity; Attribute Value;)').then(() =>
              connection.upload('Entity').then(result =>
                connection.decodeSymbol(result[0]).then(data => assert.deepEqual(
                  data, {
                    Attribute: 'Value',
                    BlobType: 'UTF8'
                  }))
              )
            ))
        );

        it('unknown value', () =>
          cp.then(connection =>
            connection.upload('(Entity; Attribute "Other Value";)').then(() =>
              connection.upload('Entity').then(result =>
                connection.decodeSymbol(result[0]).then(data => assert.deepEqual(
                  data, {
                    Attribute: 'Other Value',
                    BlobType: 'UTF8'
                  }))
              )
            ))
        );

        it('unknwon attribute', () =>
          cp.then(connection =>
            connection.upload('(Entity; someOtherAttribute "Other Value";)').then(() =>
              connection.upload('Entity').then(result =>
                connection.decodeSymbol(result[0]).then(data => assert.deepEqual(
                  data, {
                    Attribute: 'Other Value',
                    someOtherAttribute: 'Other Value',
                    BlobType: 'UTF8'
                  }))
              )
            ))
        );
      });

      it('raw', () =>
        cp.then(connection =>
          connection.upload('(Entity; Attribute Value;)').then(() =>
            connection.upload('Entity').then(result =>
              connection.query(false, api.queryMask.MVV, result[0], 2, 0).then(data => assert.deepEqual(
                data, [13, 14, 28, 32]))
            )
          ))
      );
    });
  });

  before('start SymatemAPI', done => {
    const store = path.join(__dirname, 'test.sdb');
    fs.unlink(store, error => {
      cp = api.open({
        store: store
      });
      done();
    });
  });

  after('stop SymatemAPI', done => {
    cp.then(c => c.close()).then(() => done());
  });
});
