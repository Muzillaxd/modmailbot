const Eris = require('eris');
const utils = require('./utils');
const jsonDb = require('./jsonDb');
const config = require('../config');

const accidentalThreadMessages = [
  'ok',
  'okay',
  'thanks',
  'ty',
  'k',
  'thank you',
  'thanx',
  'thnx',
  'thx',
  'tnx'
];

/**
 * @typedef {Object} ModMailThread
 * @property {String} channelId
 * @property {String} userId
 * @property {String} username
 * @property {Boolean} _wasCreated
 */

/**
 * Returns information about the modmail thread channel for the given user. We can't return channel objects
 * directly since they're not always available immediately after creation.
 * @param {Eris.Client} bot
 * @param {Eris.User} user
 * @param {Boolean} allowCreate
 * @returns {Promise<ModMailThread>}
 */
function getForUser(bot, user, allowCreate = true, originalMessage = null) {
  return jsonDb.get('threads', []).then(threads => {
    const thread = threads.find(t => t.userId === user.id);
    if (thread) return thread;

    // If we didn't find an existing modmail thread, attempt creating one
    if (! allowCreate) return null;

    // Channel names are particularly picky about what characters they allow...
    let cleanName = user.username.replace(/[^a-zA-Z0-9]/ig, '').toLowerCase().trim();
    if (cleanName === '') cleanName = 'unknown';

    const channelName = `${cleanName}-${user.discriminator}`;

    if (originalMessage && originalMessage.cleanContent && config.ignoreAccidentalThreads) {
      const cleaned = originalMessage.cleanContent.replace(/[^a-z\s]/gi, '').toLowerCase().trim();
      if (accidentalThreadMessages.includes(cleaned)) {
        console.log('[NOTE] Skipping thread creation for message:', originalMessage.cleanContent);
        return null;
      }
    }

    console.log(`[NOTE] Creating new thread channel ${channelName}`);
    return utils.getModmailGuild(bot).createChannel(`${channelName}`)
      .then(channel => {
        const thread = {
          channelId: channel.id,
          userId: user.id,
          username: `${user.username}#${user.discriminator}`,
        };

        return jsonDb.get('threads', []).then(threads => {
          threads.push(thread);
          jsonDb.save('threads', threads);

          return Object.assign({}, thread, {_wasCreated: true});
        });
      }, err => {
        console.error(`Error creating modmail channel for ${user.username}#${user.discriminator}!`);
        throw err;
      });
  });
}

/**
 * @param {String} channelId
 * @returns {Promise<ModMailThread>}
 */
function getByChannelId(channelId) {
  return jsonDb.get('threads', []).then(threads => {
    return threads.find(t => t.channelId === channelId);
  });
}

/**
 * Deletes the modmail thread for the given channel id
 * @param {String} channelId
 * @returns {Promise}
 */
function close(channelId) {
  return jsonDb.get('threads', []).then(threads => {
    const thread = threads.find(t => t.channelId === channelId);
    if (! thread) return;

    threads.splice(threads.indexOf(thread), 1);
    return jsonDb.save('threads', threads);
  });
}

module.exports = {
  getForUser,
  getByChannelId,
  close,
};
