/* global describe, it, xit */
/* jslint node: true, esnext: true */

'use strict';

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should();

const api = require('../api');

describe('connection', () => {
  const cp = api.open();

  it('opens', () =>
    cp.then(connection =>
      connection.query(9, 1, 2, 0).then(data => assert.deepEqual(data, [589]))
    )
  );

  it('query', () =>
    cp.then(connection =>
      connection.query(9, 1, 2, 0).then(data => assert.deepEqual(data, [589]))
    )
  );
});
