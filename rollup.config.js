/* jslint node: true, esnext: true */
'use strict';

import commonjs from 'rollup-plugin-commonjs';

export default {
  format: 'cjs',
  plugins: [commonjs()]
};
