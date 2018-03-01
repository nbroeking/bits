(() => {
  'use strict';

  const chai = require('chai');
  const {expect} = chai;

  const SystemManager = require('./../../lib/system/system-manager');

  describe('SystemManager', () => {
    describe('setTime', () => {
      it('should reject...everytime', () => {
        const manager = new SystemManager('test');
        return expect(manager.setTime({timestamp: 1337})).to.be.rejectedWith(Error, 'operation-not-supported');
      });
    });
  });
})();
