
const _ = require('lodash')
const { ObjectId } = require('mongodb')

const COLLECTION_NAME = 'events'
const DUPLICATE_KEY_ERROR_CODE = 11000

exports.EventRepository = class {
  constructor ({ db }) {
    this._db = db
    this._collection = db.collection(COLLECTION_NAME)

    this._initPromise = db.createCollection(COLLECTION_NAME)
      .tap(collection => collection.createIndexes([
        { key: { owner: 1, name: 1 }, unique: true }
      ]))
  }

  addEvent (event) {
    return this._initPromise
      .then(() => this._collection.insertOne(_.pick(event, [
        'name',
        'owner',
        'startTime',
        'endTime',
        'city',
        'country',
        'region',
        'timeZone'
      ])))
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
}
