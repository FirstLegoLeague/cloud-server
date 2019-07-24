
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

  app.post('/admin/events/add', (req, res, next) => {
    const body = _.pick(req.body, ['name', 'startTime', 'endTime', 'city'])

    eventRepo.addEvent(Object.assign({}, body, {
      owner: new ObjectId(req.user._id)
    }))
      .then(() => res.redirect('/admin/events'), err => {
        if (err.code !== 'DUPLICATE') {
          throw err
        }

        res.redirect('/admin/events/add?' + qs.stringify({
          message: 'duplicate',
          data: JSON.stringify(body)
        }))
      })
      .asCallback(next)
  })

  app.use('/api', (req, res, next) => {
    if (req.user) {
      next()
    } else {
      res.status(401).send('Unauthorized')
    }
  })

  app.post('/api/event', (req, res, next) => {
    const body = _.pick(req.body, ['name', 'startTime', 'endTime', 'city'])

    eventRepo.addEvent(Object.assign({}, body, {
      owner: new ObjectId(req.user._id)
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

  app.patch('/api/event/:id', (req, res, next) => {
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
}