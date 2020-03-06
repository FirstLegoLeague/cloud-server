
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const mongoStoreFactory = require('connect-mongo')
const session = require('express-session')
const hbs = require('hbs')

const auth = require('./auth')
const admin = require('./admin')
const agent = require('./agent')
const startupValidator = require('./startup-validator')

const MongoStore = mongoStoreFactory(session)

exports.main = options => {
  const { app, config, mongo } = options

  startupValidator.validate(options)

  hbs.registerPartials('./partials')

  app.set('views', './views')
  app.set('view engine', 'hbs')

  app.use(cookieParser())
  app.use(bodyParser.json())
  app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: config.appSecret,
    store: new MongoStore({
      client: mongo
    })
  }))

  auth.configure(options)
  admin.configure(options)
  agent.configure(options)
}
