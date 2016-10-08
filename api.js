/* jslint node: true, esnext: true */

'use strict';

const net = require('net'),
  msgpack = require('msgpack');

exports.queryMode = ['M', 'V', 'I'];

const PredefinedSymbolLookup = [
  'Void', 'RunTimeEnvironment', 'ArchitectureSize',
  'Package', 'Holds', 'Input', 'Output', 'Target',
  'Destination', 'Source', 'Count', 'Direction',
  'Entity', 'Attribute', 'Value', 'Search', 'Varying',
  'Link', 'Unlink', 'Create', 'Destroy', 'Serialize',
  'Deserialize', 'UnnestEntity', 'UnnestAttribute',
  'Message', 'Row', 'Column', 'BlobType', 'Natural',
  'Integer', 'Float', 'UTF8', 'CloneBlob', 'SliceBlob',
  'GetBlobSize', 'DecreaseBlobSize', 'IncreaseBlobSize',
  'At'
];

const PredefinedSymbols = {};
PredefinedSymbolLookup.forEach((s, i) => {
  PredefinedSymbols[s] = i;
});

exports.PredefinedSymbols = PredefinedSymbols;

const queryMask = {
  /*
  MMM: 0,
  VMM: 1,
  IMM: 2,
  MVM: 3,
  VVM: 4,
  IVM: 5,
  MIM: 6,
  VIM: 7,
  IIM: 8,
  MMV: 9,
  VMV: 10,
  IMV: 11,
  MVV: 12,
  VVV: 13,
  IVV: 14,
  MIV: 15,
  VIV: 16,
  IIV: 17,
  MMI: 18,
  VMI: 19,
  IMI: 20,
  MVI: 21,
  VVI: 22,
  IVI: 23,
  MII: 24,
  VII: 25,
  III: 26
  */
};

exports.queryMask = queryMask;

for (let i = 0; i < 27; ++i) {
  const key = exports.queryMode[i % 3] + exports.queryMode[Math.floor(i / 3) % 3] + exports.queryMode[Math.floor(i / 9) %
    3];
  queryMask[key] = i;
}

exports.open = function (host = '::1', port = 1337) {
  return new Promise((fullfill, reject) => {
    const socket = new net.Socket(),
      msgpackStream = new msgpack.Stream(socket),
      promiseQueue = [];

    const connection = {
      request: (...args) => {
        const packet = msgpack.pack(args);
        return new Promise((resolve, reject) => {
          promiseQueue.push({
            resolve, reject
          });
          socket.write(packet);
          //console.log('sending', packet);
        });
      },
      symbolNamed: (name) => connection.deserializeBlob(`"${name}"`),
      decodeSymbol: (s) => {
        return connection.query(false, queryMask.MVV, s, 0, 0).then(avs => {
          const valuesAndTypes = [];
          for (let i = 0; i < avs.length; i += 2) {
            const value = avs[i + 1];
            valuesAndTypes.push(connection.readBlob(value));
            valuesAndTypes.push(connection.query(false, queryMask.MMV, value, PredefinedSymbols.BlobType,
              0));
          }

          return Promise.all(valuesAndTypes).then(valuesAndTypes => {
            const object = {};

            for (let i = 0; i < valuesAndTypes.length; i += 2) {
              let v = valuesAndTypes[i];
              const type = valuesAndTypes[i + 1];

              if (type == PredefinedSymbols.UTF8) {
                v = v.toString();
              } else if (type == PredefinedSymbols.Natural) {
                v = v.readInt32LE(0);
              } else {
                console.log(`unknown type ${type}`);
              }

              let propertyName = PredefinedSymbolLookup[avs[i]];
              if (propertyName === undefined) {
                console.log(`${avs[i]} ${type}`);
                propertyName = `symbol_${avs[i]}`;
              }
              object[propertyName] = v;
            }
            return object;
          });
        });
      },

      upload: (text, packageSymbol = PredefinedSymbols.Void) => {
        return connection.createSymbol().then(textSymbol =>
          connection.setBlobSize(textSymbol, text.length * 8).then(() =>
            connection.writeBlob(textSymbol, 0, text.length * 8, Buffer.from(text)).then(() =>
              connection.link(textSymbol, PredefinedSymbols.BlobType, PredefinedSymbols.UTF8).then(() =>
                connection.deserializeBlob(textSymbol, packageSymbol).then(data => {
                  connection.releaseSymbol(textSymbol);
                  return Array.isArray(data) ? data : connection.decodeSymbol(data).then(r =>
                    Promise.reject(r)
                  );
                }))
            )
          )
        );
      }
    };

    [
      'createSymbol', 'releaseSymbol',
      'getBlobSize', 'setBlobSize', 'decreaseBlobSize', 'increaseBlobSize', 'readBlob', 'writeBlob',
      'deserializeBlob',
      'query', 'link', 'unlink'
    ].forEach(
      name => {
        connection[name] = (...args) => connection.request(name, ...args);
      });

    //socket.on('data', data => console.log('received', data));
    msgpackStream.addListener('msg', data => promiseQueue.shift().resolve(data));

    socket.on('error', error => {
      socket.destroy();
      reject(error);
    });

    socket.on('close', () => {
      promiseQueue.forEach(p => p.reject());
      promiseQueue.length = 0;
      socket.destroy();
    });

    socket.connect(port, host, error => {
      if (error) {
        reject(error);
      } else {
        fullfill(connection);
      }
    });
  });
};
