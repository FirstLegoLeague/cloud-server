const Promise = require('bluebird')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const _ = require('lodash')
const { ObjectId } = require('mongodb')

Promise.promisifyAll(crypto)

const COLLECTION_NAME = 'events'
const DUPLICATE_KEY_ERROR_CODE = 11000

const KEY_SIZE = 24

function cleanName (displayName) {
  return displayName.toLowerCase()
    .replace(/[^-_\sa-z0-9]/g, '')
    .replace(/[-_\s]+/g, '-')
    .replace(/-(?=[0-9])/g, '')
}

function toPublicEvent (event) {
  return _.chain(event)
    .update('key', Boolean)
    .value()
}

exports.EventRepository = class {
  constructor ({ db, config }) {
    this._db = db
    this._collection = db.collection(COLLECTION_NAME)
    this._appSecret = config.appSecret

    this._initPromise = db.createCollection(COLLECTION_NAME)
      .tap(collection => collection.createIndexes([
        { key: { owner: 1, name: 1 }, unique: true }
      ]))
  }

  addEvent (event) {
    const transformedEvent = _.chain(event)
      .pick([
        'name',
        'owner',
        'startTime',
        'endTime',
        'city',
        'country',
        'region',
        'timeZone'
      ])
      .assign({
        name: cleanName(event.name),
        displayName: event.name
      })
      .value()

    return this._initPromise
      .then(() => this._collection.insertOne(transformedEvent))
      .catch(err => {
        if (err.code !== DUPLICATE_KEY_ERROR_CODE) {
          throw err
        } else {
          throw Object.assign(new Error('Event already exists'), {
            code: 'DUPLICATE'
          })
        }
      })
  }

  findEventsByOwner (owner) {
    return this._initPromise
      .then(() => this._collection.find({ owner: new ObjectId(owner._id) }))
      .then(cursor => cursor.toArray())
      .map(toPublicEvent)
  }

  findEvent (id, owner) {
    return this._initPromise
      .then(() => this._collection.findOne({ _id: new ObjectId(id), owner: new ObjectId(owner._id) }))
      .then(toPublicEvent)
  }

  update (id, owner, properties) {
    return this._initPromise
      .then(() => this._collection.updateOne({
        _id: new ObjectId(id),
        owner: new ObjectId(owner._id)
      }, {
        $set: _.pick(properties, [
          'startTime',
          'endTime',
          'city',
          'country',
          'region',
          'timeZone'
        ])
      }))
      .then(result => result.matchedCount > 0)
  }

  delete (id, owner) {
    return this._initPromise
      .then(() => this._collection.deleteOne({
        _id: new ObjectId(id),
        owner: new ObjectId(owner._id)
      }))
      .then(result => result.deletedCount > 0)
  }

  createKey (id, owner) {
    return Promise.all([
      crypto.randomBytesAsync(KEY_SIZE),
      this._initPromise
    ])
      .then(([key]) => key.toString('base64'))
      .then(key => {
        return this._collection.updateOne({
          _id: new ObjectId(id),
          owner: new ObjectId(owner._id)
        }, {
          $set: { key }
        })
          .then(result => {
            if (result.matchedCount > 0) {
              return jwt.sign({ e: id, k: key }, this._appSecret)
            } else {
              throw Object.assign(new Error('Event not found'), {
                code: 'NOT_FOUND'
              })
            }
          })
      })
  }
}
