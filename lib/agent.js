
const _ = require('lodash')
const jwt = require('jsonwebtoken')
const { ObjectId } = require('mongodb')

const { EventRepository } = require('./events')
const { MessageQueue } = require('./message-queue')
const { ScoreRepository } = require('./scores')
const { TeamRepository } = require('./teams')

exports.configure = options => {
  const { app, config, logger } = options
  const eventRepo = new EventRepository(options)
  const scoreRepo = new ScoreRepository(options)
  const teamRepo = new TeamRepository(options)

  const messageProcessor = {
    score: (score, { eventId, localTimestamp }) => {
      logger.debug(`process score message: ${JSON.stringify(score)}`)

      return scoreRepo.updateScore(eventId, score, localTimestamp.getTime())
    },
    team: (team, { eventId, localTimestamp }) => {
      logger.debug(`process team message: ${JSON.stringify(team)}`)

      return teamRepo.updateTeam(eventId, team, localTimestamp.getTime())
    }
  }

  const messageQueue = new MessageQueue('agent', messageProcessor, options)

  app.use('/api/agent', (req, res, next) => {
    try {
      req.auth = jwt.verify(req.header('X-Auth-Token'), config.appSecret)
      next()
    } catch (err) {
      if (err.name === 'JsonWebTokenError') {
        res.status(401).send()
      } else {
        next(err)
      }
    }
  })

  app.get('/api/agent/event/:id', (req, res, next) => {
    if (req.params.id !== req.auth.e) {
      res.status(403).send()
      return
    }

    eventRepo.findEventByKey(req.auth)
      .then(event => _.pick(event, ['_id', 'name', 'startTime', 'endTime', 'city', 'region', 'country']))
      .then(event => { res.json(event) })
      .catch(next)
  })

  app.post('/api/agent/event/:id/message', (req, res, next) => {
    if (req.params.id !== req.auth.e) {
      res.status(403).send()
      return
    }

    messageQueue.saveMessage(req.body, { eventId: new ObjectId(req.params.id) })
      .then(() => res.send())
      .catch(next)
  })

  messageQueue.startProcessing()
}
