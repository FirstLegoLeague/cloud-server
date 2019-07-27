const Promise = require('bluebird')
const crypto = require('crypto')
const { ObjectId } = require('mongodb')

const COLLECTION_NAME = 'event-keys'

const KEY_SIZE = 256
const SALT_SIZE = 64

Promise.promisifyAll(crypto)

exports.EventKeysRepository = class {
  constructor ({ db }) {
    this._db = db
    this._collection = db.collection(COLLECTION_NAME)

    this._initPromise = db.createCollection(COLLECTION_NAME)
      .tap(collection => collection.createIndexes([
        { key: { event: 1 }, unique: true }
      ]))
  }

  createKey (event) {
    return Promise.all([
      crypto.randomBytes(KEY_SIZE),
      crypto.randomBytes(SALT_SIZE),
      this._initPromise
    ])
      .then(([key, salt]) => {
        return this._collection.insertOne({
          event: new ObjectId(event._id),
          hash: crypto.createHmac('sha512', salt).update(key).digest(),
          salt
        })
          .then(result => ({
            id: result.insertedId,
            key: key.toString('base64')
          }))
      })
  }
}
