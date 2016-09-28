/* global describe, it, xit */
/* jslint node: true, esnext: true */

'use strict';

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should();

const api = require('../api');

describe('connection', () => {
  it('opens', () =>
    api.open().then(connection =>
      connection.request('query', 9, 1, 2, 0).then(data => assert.deepEqual(data, [1219]))
    )
  );
});
