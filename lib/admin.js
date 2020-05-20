
const _ = require('lodash')
const { ObjectId } = require('mongodb')
const qs = require('querystring')

const { EventRepository } = require('./events')

exports.configure = options => {
  const { app } = options
  const eventRepo = new EventRepository(options)

  app.use('/admin', (req, res, next) => {
    if (req.user) {
      next()
    } else {
      res.redirect('/auth/login')
    }
  })

  app.get('/admin', (req, res) => {
    res.redirect('/admin/events')
  })

  app.get('/admin/events', (req, res, next) => {
    eventRepo.findEventsByOwner(req.user)
      .then(events => res.render('admin/events', { events }))
      .catch(next)
  })

  app.get('/admin/events/add', (req, res) => {
    res.render('admin/events/add', {
      data: req.query.data ? JSON.parse(req.query.data) : {},
      message: req.query.message
    })
  })

  app.use('/api/event', (req, res, next) => {
    if (req.user) {
      next()
    } else {
      res.status(401).send('Unauthorized')
    }
  })

  app.post('/api/event', (req, res, next) => {
    const body = _.pick(req.body, ['name', 'startTime', 'endTime', 'city'])

    eventRepo.addEvent(Object.assign({}, body, {
      owner: new ObjectId(req.user._id),
      region: req.user.region,
      country: req.user.country
    }))
      .then(() => res.status(201).send(), err => {
        if (err.code !== 'DUPLICATE') {
          throw err
        }

        res.status(409).json({
          message: 'event already exists'
        })
      })
      .catch(next)
  })

  app.put('/api/event/:id', (req, res, next) => {
    const body = _.pick(req.body, ['name', 'startTime', 'endTime', 'city'])

    eventRepo.update(req.params.id, req.user, body)
      .then(updated => res.status(updated ? 204 : 404).send())
      .catch(next)
  })

  app.delete('/api/event/:id', (req, res, next) => {
    eventRepo.delete(req.params.id, req.user)
      .then(deleted => res.status(deleted ? 204 : 404).send())
      .catch(next)
  })

  app.post('/api/event/:id/key', (req, res, next) => {
    eventRepo.createKey(req.params.id, req.user)
      .then(token => res.json({
        event: req.params.id,
        jwt: token
      }))
      .catch(next)
  })
}
