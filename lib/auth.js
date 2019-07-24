
const passport = require('passport')
const { Strategy: GoogleStrategy } = require('passport-google-oauth20')

const { UserRepository } = require('./users')

exports.configure = options => {
  const { app, config, logger } = options
  const usersRepo = new UserRepository(options)

  app.use(passport.initialize())
  app.use(passport.session())

  passport.serializeUser((user, done) => {
    done(null, user)
  })

  passport.deserializeUser((user, done) => {
    done(null, user)
  })

  passport.use(new GoogleStrategy({
    clientID: config.auth.google.clientId,
    clientSecret: config.auth.google.clientSecret,
    callbackURL: `${config.auth.callbackBaseUrl}/auth/google/callback`
  }, (token, tokenSecret, profile, done) => {
    const emails = profile.emails.map(e => e.value)

    usersRepo.findUser(emails)
      .then(user => {
        const isSuperAdmin = emails.includes(config.auth.superAdminEmail)

        if (user) {
          const role = isSuperAdmin ? 'SUPER-ADMIN'
            : user.isAdmin ? 'ADMIN' : 'PARTNER'
          logger.info(`Login succeed: ${user._id.toString()} [${role}]`)
          return Object.assign({}, user, {
            superAdmin: isSuperAdmin || user.admin
          })
        } else if (isSuperAdmin) {
          logger.warn(`Embedded super admin missing from the system.`)
          return usersRepo.addUser({
            email: config.auth.superAdminEmail,
            isAdmin: true
          })
        } else {
          logger.info(`Login failed: unknown email address`)
          return null
        }
      })
      .asCallback(done)
  }))

  app.get('/auth/google', passport.authenticate('google', {
    scope: 'https://www.googleapis.com/auth/userinfo.email'
  }))

  app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/auth/forbidden' }), (req, res) => {
    res.redirect('/admin')
  })

  app.get('/auth/login', (req, res) => {
    res.render('auth/login')
  })

  app.get('/auth/forbidden', (req, res) => {
    res.render('auth/forbidden')
  })

  app.get('/auth/logout', (req, res) => {

  })
}
