/* jslint node: true, esnext: true */

'use strict';

const net = require('net'),
  msgpack = require('msgpack'),
  path = require('path'),
  fs = require('fs'),
  child_process = require('child_process');

const queryMode = ['M', 'V', 'I'];

const symbolByName = {
  Void: 0,
  PosX: 13,
  PosY: 14,
  BlobType: 15,
  Natural: 16,
  Integer: 17,
  Float: 18,
  UTF8: 19,
  BinaryOntologyCodec: 22
};

const symbolToName = ['Void', undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, undefined, undefined,
  undefined, undefined, undefined, 'PosX', 'PosY',
  'BlobType', 'Natural', 'Integer', 'Float', 'UTF8',
  undefined, undefined, 'BinaryOntologyCodec'
];

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

for (let i = 0; i < 27; ++i) {
  const key = queryMode[i % 3] + queryMode[Math.floor(i / 3) % 3] + queryMode[Math.floor(i / 9) %
    3];
  queryMask[key] = i;
}

function open(options = {}) {
  const port = options.port || 1337;
  const host = options.host || '::1';

  return new Promise((fullfill, reject) => {
    const socket = new net.Socket(),
      msgpackStream = new msgpack.Stream(socket),
      promiseQueue = [];

    const symbolToNameCache = {};

    const symbolCache = new Map();

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

      nameToSymbol: (name) => connection.deserializeBlob(`"${name}"`),

      symbolToName: (symbol) => {
        const name = symbolToName[symbol] || symbolToNameCache[symbol];
        if (name !== undefined) {
          return name;
        }

        return connection.query(false, queryMask.MMV, symbol, symbolByName.BlobType, 0).then(result =>
          connection.readBlob(symbol).then(result => {
            const name = result.toString();
            //console.log(`${symbol} -> ${name}`);
            symbolToNameCache[symbol] = name;
            return name;
          })
        );
      },

      decodeSymbolWithCache: (symbol) => {
        const d = symbolCache.get(symbol);
        if (d !== undefined) {
          //console.log(`already found: ${symbol}`);
          d.access += 1;
          return Promise.resolve(d.object);
        }

        const p = connection.decodeSymbol(symbol).then(decoded => {
          //console.log(`add ${symbol} -> ${decoded.name}`);
          symbolCache.set(symbol, {
            access: symbolCache.get(symbol).access,
            object: decoded
          });
          return decoded;
        });

        symbolCache.set(symbol, {
          access: 0,
          object: p
        });

        return p;
      },

      decodeSymbol: (symbol) => {
        return connection.query(false, queryMask.MVV, symbol, 0, 0).then(avs => {
          const valuesAndTypes = [];

          //console.log(`avs: ${avs}`);
          for (let i = 0; i < avs.length; i += 2) {
            const value = avs[i + 1] + 0;
            valuesAndTypes.push(connection.readBlob(value));
            valuesAndTypes.push(connection.query(false, queryMask.MMV, value, symbolByName.BlobType,
              0));
          }

          return Promise.all(valuesAndTypes).then(valuesAndTypes => {
            const object = {};
            const promises = [];

            for (let i = 0; i < valuesAndTypes.length; i += 2) {
              let v = valuesAndTypes[i];

              const type = valuesAndTypes[i + 1][0];

              switch (type) {
                case symbolByName.UTF8:
                  v = v.toString();
                  break;
                case symbolByName.Natural:
                  v = v.readUInt32LE(0);
                  break;
                case symbolByName.Integer:
                  v = v.readInt32LE(0);
                  break;
                default:
                  if (v.length === 0) {
                    v = undefined;
                  } else {
                    console.log(
                      `unknown type '${type}' ${typeof type} ${JSON.stringify(type)} for ${v} : ${avs[i]}`
                    );
                  }
              }
              //console.log(`${avs[i]} ${v} (${type})`);

              if (v !== undefined) {
                const propertyName = connection.symbolToName(avs[i]);
                if (propertyName.then) {
                  promises.push(propertyName.then(name => object[name] = v));
                } else {
                  object[propertyName] = v;
                }
              }
            }
            return Promise.all(promises).then(() => object);
          });
        });
      },

      upload: (text, packageSymbol = symbolByName.Void) => {
        const buffer = Buffer.from(text);
        return connection.createSymbol().then(textSymbol =>
          connection.setBlobSize(textSymbol, buffer.length * 8).then(() =>
            connection.writeBlob(textSymbol, 0, buffer.length * 8, buffer).then(() =>
              connection.link(textSymbol, symbolByName.BlobType, symbolByName.UTF8).then(() =>
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

    if (options.store === undefined) {
      socket.connect(port, host, error => {
        if (error) {
          reject(error);
        } else {
          fullfill(connection);
        }
      });
    } else {
      const executable = path.join(__dirname, '..', 'SymatemMP');
      const symatem = child_process.spawn(executable, ['--port', port, '--file', options.store], {
        shell: false,
        detached: false,
        stdio: ['ignore', 'pipe', process.stderr]
      });

      /*
            symatem.stdout.on('data', data => {
              console.log(`stdout: ${data}`);
              if (data.match(/Listening/)) {
                socket.connect(port, host, error => {
                  if (error) {
                    reject(error);
                  } else {
                    fullfill(connection);
                  }
                });
              }
            });
      */

      //process.stderr.on('data', data => console.error(data));
      symatem.on('error', err => reject(`Failed to start ${executable}: ${err}`));

      connection.close = () => {
        symatem.kill();
        return Promise.resolve();
      };

      setTimeout(() =>
        socket.connect(port, host, error => {
          if (error) {
            reject(error);
          } else {
            fullfill(connection);
          }
        }), 200);
    }
  });
}

export {
  queryMode,
  queryMask,
  symbolByName,
  open
};
