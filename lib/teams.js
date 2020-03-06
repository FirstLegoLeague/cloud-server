const Promise = require('bluebird')
const crypto = require('crypto')
const _ = require('lodash')
const { ObjectId, Long } = require('mongodb')

Promise.promisifyAll(crypto)

const COLLECTION_NAME = 'teams'

function toPublicTeam (event) {
  return _.chain(event)
    .omit('version')
    .value()
}

exports.TeamRepository = class {
  constructor ({ db, config }) {
    this._db = db
    this._collection = db.collection(COLLECTION_NAME)

    this._initPromise = db.createCollection(COLLECTION_NAME)
      .tap(collection => collection.createIndexes([
        { key: { eventId: 1, number: 1 }, unique: true }
      ]))
  }

  updateTeam (eventId, team, version) {
    eventId = new ObjectId(eventId)

    return this._initPromise
      .then(() => this._collection.findOne({ eventId, number: team.number }))
      .then(oldTeam => {
        if (oldTeam == null) {
          return this._collection.insertOne({
            eventId,
            version: Long.fromNumber(version),
            ...team
          })
        } else if (oldTeam.version < version) {
          return this._collection.updateOne({ _id: oldTeam._id, version: { $lt: version } }, {
            $set: {
              version: Long.fromNumber(version),
              ..._.omit(team, 'number')
            }
          })
        }
      })
  }

  findTeamsByEvent (eventId) {
    return this._initPromise
      .then(() => this._collection.findMany({ eventId: new ObjectId(eventId) }))
      .then(cursor => cursor.toArray())
      .map(toPublicTeam)
  }
}
