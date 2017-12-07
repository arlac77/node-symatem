import test from 'ava';
import { open, queryMask } from '../src/api';

const path = require('path'),
  fs = require('fs'),
  { spawn } = require('child_process');

test('connection problems', async t => {
  try {
    await open({
      port: 12345
    });
  } catch (e) {
    t.is(e.code, 'ECONNREFUSED');
  }
});

test('connection upload', async t => {
  try {
    const store = path.join(__dirname, 'test2.sdb');

    const connection = await open({
      store
    });

    t.is(connection !== undefined, true);

    await connection.upload('(Entity; ]');
  } catch (result) {
    t.deepEqual(result, {
      Column: 11,
      Row: 1,
      Message: 'Missing closing bracket'
    });
  }
});

/*
describe('connection', () => {
  describe('upload', () => {
    describe('without package', () => {
      it('syntax error', () =>
        cp.then(connection =>
          connection.upload('(Entity; ]').catch(result =>
            assert.deepEqual(result, {
              Column: 11,
              Row: 1,
              Message: 'Missing closing bracket'
            })
          )
        ));
      it('valid', () =>
        cp.then(connection =>
          connection
            .upload('(Entity; Attribute Value;)')
            .then(result =>
              connection.query(false, api.queryMask.MVI, result[0], 0, 0)
            )
            .then(result => assert.deepEqual(result, [6, 13]))
        ));
    });

    describe('query', () => {
      it('simple', () =>
        cp.then(connection =>
          connection
            .query(false, api.queryMask.MMV, 1, 2, 0)
            .then(data => assert.deepEqual(data, [274]))
        ));

      describe('decode with cache', () => {
        it('known value', () =>
          cp.then(connection =>
            connection.upload('(Entity; Attribute Value;)').then(() =>
              connection.upload('Entity').then(result =>
                connection.decodeSymbolWithCache(result[0]).then(data =>
                  assert.deepEqual(data, {
                    Attribute: 'Value',
                    BlobType: 'UTF8'
                  })
                )
              )
            )
          ));

        it('known value again', () =>
          cp.then(connection =>
            connection.upload('(Entity; Attribute Value;)').then(() =>
              connection.upload('Entity').then(result =>
                connection.decodeSymbolWithCache(result[0]).then(data =>
                  assert.deepEqual(data, {
                    Attribute: 'Value',
                    BlobType: 'UTF8'
                  })
                )
              )
            )
          ));
      });

      describe('decode', () => {
        it('known value', () =>
          cp.then(connection =>
            connection.upload('(Entity; Attribute Value;)').then(() =>
              connection.upload('Entity').then(result =>
                connection.decodeSymbol(result[0]).then(data =>
                  assert.deepEqual(data, {
                    Attribute: 'Value',
                    BlobType: 'UTF8'
                  })
                )
              )
            )
          ));

        it('unknown value', () =>
          cp.then(connection =>
            connection.upload('(Entity; Attribute "Other Value";)').then(() =>
              connection.upload('Entity').then(result =>
                connection.decodeSymbol(result[0]).then(data =>
                  assert.deepEqual(data, {
                    Attribute: 'Other Value',
                    BlobType: 'UTF8'
                  })
                )
              )
            )
          ));

        it('unknwon attribute', () =>
          cp.then(connection =>
            connection
              .upload('(Entity; someOtherAttribute "Other Value";)')
              .then(() =>
                connection.upload('Entity').then(result =>
                  connection.decodeSymbol(result[0]).then(data =>
                    assert.deepEqual(data, {
                      Attribute: 'Other Value',
                      someOtherAttribute: 'Other Value',
                      BlobType: 'UTF8'
                    })
                  )
                )
              )
          ));
      });

      it('raw', () =>
        cp.then(connection =>
          connection
            .upload('(Entity; Attribute Value;)')
            .then(() =>
              connection
                .upload('Entity')
                .then(result =>
                  connection
                    .query(false, api.queryMask.MVV, result[0], 2, 0)
                    .then(data => assert.deepEqual(data, [6, 7, 13, 17]))
                )
            )
        ));
    });
  });

  before('start SymatemMP', done => {
    const store = path.join(__dirname, 'test.sdb');
    fs.unlink(store, error => {
      cp = api.open({
        store: store
      });
      done();
    });
  });

  after('stop SymatemMP', () => cp.then(c => c.close()));
});

*/
