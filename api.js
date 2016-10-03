/* jslint node: true, esnext: true */

'use strict';

const net = require('net'),
  msgpack = require('msgpack');

exports.open = function (host = '::1', port = 1337) {
  const socket = new net.Socket(),
    msgpackStream = new msgpack.Stream(socket),
    promiseQueue = [];

  const connection = {
    socket: socket,
    request: (...args) => {
      const packet = msgpack.pack(args);
      return new Promise((resolve, reject) => {
        promiseQueue.push({
          resolve, reject
        });
        socket.write(packet);
        console.log('sending', packet);
      });
    }
  };

  [
    'createSymbol', 'releaseSymbol',
    'getBlobSize', 'setBlobSize', 'decreaseBlobSize', 'increaseBlobSize', 'readBlob', 'writeBlob', 'deserializeBlob',
    'query', 'link', 'unlink'
  ].forEach(
    name => {
      connection[name] = (...args) => connection.request(name, ...args);
    });

  socket.on('data', data => console.log('received', data));
  msgpackStream.addListener('msg', data => promiseQueue.shift().resolve(data));

  socket.on('error', error => {
    console.log(`error: ${error}`);
    socket.destroy();
  });

  socket.on('close', () => {
    console.log('Lost connection');
    promiseQueue.forEach(p => p.reject());
    promiseQueue.length = 0;
  });

  return new Promise((f, r) => {
    socket.connect(port, host, error => {
      if (error) {
        r(error);
      } else {
        f(connection);
      }
    });
  });
};
