const Promise = require('bluebird')
const express = require('express')
const { MongoClient } = require('mongodb')
const winston = require('winston')

const { main } = require('./lib/main')

const app = express()
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: winston.format.json(),
  defaultMeta: { service: 'server' },
  transports: [
    new winston.transports.Console()
  ]
})
const port = process.env.PORT || 3000

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27018/fll-cloud'
const mongoPromise = MongoClient.connect(mongoUri, {
  promiseLibrary: Promise,
  useNewUrlParser: true
})

const config = {
  auth: {
    google: {
      clientId: process.env.GOOGLE_CONSUMER_KEY,
      clientSecret: process.env.GOOGLE_CONSUMER_SECRET
    },
    callbackBaseUrl: process.env.AUTH_CALLBACK_BASE_URL,
    superAdminEmail: process.env.SUPER_AMDIN_EMAIL
  },
  appSecret: process.env.APP_SECRET || 'secret'
}

const options = {
  app,
  db: mongoPromise.then(client => client.db()),
  config,
  logger,
  mongo: mongoPromise
}

const entries = Object.entries(options)

Promise.all(entries.map(([k, v]) => v))
  .then(optionsArray => main(entries
    .map(([k], index) => ({ [k]: optionsArray[index] }))
    .reduce((obj, entry) => Object.assign(obj, entry), {})))
  .then(() => app.listen(port, () => {
    logger.info(`Server listens in port ${port}`)
  }))
  .catch(err => {
    throw err
  })
