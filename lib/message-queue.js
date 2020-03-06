const Promise = require('bluebird')
const _ = require('lodash')

const MAX_ERRORS_PER_MESSAGE = 5

const collectionNameTemplate = n => `mq-${n}`

exports.MessageQueue = class MessageQueue {
  constructor (name, processor, { db }) {
    this._db = db
    this._collectionName = collectionNameTemplate(name)
    this._collection = db.collection(this._collectionName)
    this._processor = processor

    this._initPromise = db.createCollection(this._collectionName)
      .tap(collection => collection.createIndexes([
        { key: { timestamp: 1 }, background: true, partialFilterExpression: { status: 'pending' } }
      ]))
  }

  saveMessage (message, additionalData) {
    return this._initPromise.then(() => this._collection.insertOne({
      timestamp: new Date(),
      status: 'pending',
      errors: [],
      type: message.type,
      localTimestamp: new Date(message.localTimestamp),
      body: message.body,
      ...additionalData
    }))
  }

  startProcessing () {
    setInterval(() => {
      this._initPromise.then(() => this._collection.find({ status: 'pending' }, {
        limit: 50,
        sort: { 'timestamp': 1 }
      })
        .forEach(message => {
          return Promise.try(() => {
            this._processor[message.type](message.body, _.omit(message, ['_id', 'status', 'errors']))
          })
            .then(() => this._collection.updateOne({ _id: message._id }, { $set: { status: 'done' } }),
              err => {
                if (message.errors.length < MAX_ERRORS_PER_MESSAGE - 1) {
                  this._collection.updateOne({ _id: message._id }, {
                    $push: { errors: _.pick(err, ['name', 'code', 'message', 'stack']) }
                  })
                } else {
                  this._collection.updateOne({ _id: message._id }, {
                    $push: { errors: _.pick(err, ['name', 'code', 'message', 'stack']) },
                    $set: { status: 'error' }
                  })
                }
              })
        }))
        .catch(err => { throw err })
    }, 1000)
  }
}
