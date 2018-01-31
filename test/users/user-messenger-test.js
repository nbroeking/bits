(() => {
  'use strict';

  const chai = require('chai');
  const EventEmitter = require('events');
  const MessageCenter = require('./../../lib/message-center');
  const UserApi = require('./../../lib/users/user-api');
  const UserMessenger = require('./../../lib/users/user-messenger');

  const {expect} = chai;

  describe('UserMessenger', () => {
    it('should santized user items', () => {
      const messageCenter = new MessageCenter(require('cluster'), process);
      const manager = new class extends EventEmitter {
        list() {
          return [{
            id: 1,
            username: 'test',
            salt: '0123456789abcdef0123456789abcdef',
            passwordHash: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            scopes: [
              {name: 'base', displayName: 'Administrator'},
              {name: 'users', displayName: 'User Management'},
              {name: 'public', displayName: 'Public'},
            ],
            isAnonymous: true,
            createdAt: 1516378921603,
            updatedAt: 1516378921603
          }];
        }
      };
      const messenger = new UserMessenger(manager);
      const api = new UserApi(messageCenter);

      return Promise.resolve()
      .then(() => messenger.load(messageCenter))
      .then(() => api.list())
      .then(([user]) => { // 'back end' list
        expect(user).to.have.all.keys('id', 'username', 'scopes', 'isAnonymous', 'createdAt', 'updatedAt', 'passwordHash', 'salt');
      })
      .then(() => messenger._list({scopes: []}))
      .then(([user]) => { // 'front end' list
        expect(user).to.have.all.keys('id', 'username', 'scopes', 'isAnonymous', 'createdAt', 'updatedAt');
      }); ;
    });
  });
})();
