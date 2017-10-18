(() => {
  'use strict';

  const chai = require('chai');
  const OmgsManager = require('./../../lib/omgs/omgs-manager');

  const expect = chai.expect;

  describe('OmgsManager', () => {
    let manager = null;

    beforeEach('Create manager', () => {
      manager = new OmgsManager();
    });

    describe('isBaseAllowed', () => {
      it('should allow if no baseInfo', () => {
        expect(manager.isBaseAllowed()).to.be.true;
      });
      it('should allow if version is empty string', () => {
        expect(manager.isBaseAllowed({version: ''})).to.be.true;
      });
      it('should not allow if version is invalid', () => {
        expect(manager.isBaseAllowed({version: 'not valie'})).to.be.false;
      });
      it('should not allow if version major component is less than 2', () => {
        expect(manager.isBaseAllowed({version: '1.2.3'})).to.be.false;
      });
      it('should allow if version major component is at least 2', () => {
        expect(manager.isBaseAllowed({version: '2.0.0'})).to.be.true;
      });
    });
  });
})();
