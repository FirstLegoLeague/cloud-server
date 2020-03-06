const Promise = require('bluebird')
const crypto = require('crypto')
const _ = require('lodash')
const { ObjectId, Long } = require('mongodb')

Promise.promisifyAll(crypto)

const COLLECTION_NAME = 'scores'

function toPublicScore (event) {
  return _.chain(event)
    .omit('version', 'localId')
    .value()
}

exports.ScoreRepository = class {
  constructor ({ db, config }) {
    this._db = db
    this._collection = db.collection(COLLECTION_NAME)

    this._initPromise = db.createCollection(COLLECTION_NAME)
      .tap(collection => collection.createIndexes([
        { key: { eventId: 1, localI1: 1 }, unique: true }
      ]))
  }

  updateScore (eventId, score, version) {
    eventId = new ObjectId(eventId)
    score = _.chain(score)
      .pick(['team', 'stage', 'round', 'score', 'published'])
      .assign({
        localId: new ObjectId(score.localId)
      })
      .defaultsDeep({
        team: { number: score.teamNumber }
      })
      .value()

    return this._initPromise
      .then(() => this._collection.findOne({
        eventId, localId: score.localId
      }))
      .then(oldScore => {
        if (oldScore == null) {
          return this._collection.insertOne({
            eventId,
            version: Long.fromNumber(version),
            ...score
          })
        } else if (oldScore.version < version) {
          return this._collection.updateOne({ _id: oldScore._id, version: { $lt: version } }, {
            $set: {
              version: Long.fromNumber(version),
              ..._.omit(score, ['localId'])
            }
          })
        }
      })
  }

  findScoresByEvent (eventId) {
    eventId = new ObjectId(eventId)

    return this._initPromise
      .then(() => this._collection.findMany({ eventId, published: true }))
      .then(cursor => cursor.toArray())
      .map(toPublicScore)
  }
}
