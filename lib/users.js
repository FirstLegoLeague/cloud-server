
const _ = require('lodash')

const COLLECTION_NAME = 'users'

exports.UserRepository = class {
  constructor ({ db }) {
    this._db = db
    this._collection = db.collection(COLLECTION_NAME)

    this._initPromise = db.createCollection(COLLECTION_NAME)
      .tap(collection => collection.createIndexes([
        { key: { email: 1 }, unique: true }
      ]))
  }

  findUser (emails) {
    return this._initPromise
      .then(() => this._collection.findOne({ email: { $in: emails } }))
  }

  addUser (user) {
    return this._initPromise
      .then(() => this._collection.insertOne(_.pick(user, ['email', 'country', 'region', 'isAdmin'])))
  }
}
