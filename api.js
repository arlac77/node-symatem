/* jslint node: true, esnext: true */

'use strict';

const net = require('net'),
  msgpack = require('msgpack');

const HOST = '::1',
  PORT = 1337,
  socket = new net.Socket(),
  msgpackStream = new msgpack.Stream(socket),
  promiseQueue = [];

msgpackStream.addListener('msg', (data) => {
  promiseQueue.shift().resolve(data);
});

socket.on('error', error => {
  console.log('Error');
  socket.destroy();
});

socket.on('close', () => {
  console.log('Lost connection');
  promiseQueue.forEach(p => p.reject());
  promiseQueue.length = 0;
});

socket.connect(PORT, HOST, () => {
  request('query', 9, 1, 2, 0).then((data) => {
    console.log('Then', data);
  }, () => {
    console.log('Then failed');
  });
});

const request = () => {
  const packet = msgpack.pack(Array.from(arguments));
  return new Promise((resolve, reject) => {
    promiseQueue.push({
      'resolve': resolve,
      'reject': reject
    });
    socket.write(packet);
    console.log(packet);
  });
};
